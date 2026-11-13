// Host readouts for the command deck: CPU, memory, network, thermal state, power
// and the watts going into the battery while it charges.
// One `sh -c` every POLL ms prints every source, split by SEP. macOS only; no sudo.
import { exec } from "herdr";

export const SEP = "@@EVA@@";
const POLL = 5000;

const SCRIPT = [
  "pmset -g batt",
  "memory_pressure -Q",
  "sysctl -n kern.memorystatus_vm_pressure_level",
  "sysctl -n hw.ncpu",
  "ps -A -o %cpu=",
  "i=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}'); netstat -ibn -I \"${i:-en0}\"",
  "pmset -g therm",
  "ioreg -rn AppleSmartBattery | grep -E '\"IsCharging\" = |\"BatteryData\" = '",
].join(`; echo ${SEP}; `);

export function parseBattery(text) {
  const external = !/'Battery Power'/.test(text);
  const cell = text.match(/(\d+)%;\s*([^;]+);\s*(?:(\d+):(\d+) remaining)?/);
  if (!cell) return { percent: null, external, remaining: null };
  const discharging = cell[2].trim() === "discharging";
  const remaining =
    discharging && cell[3] != null
      ? Number(cell[3]) * 60 + Number(cell[4])
      : null;
  return { percent: Number(cell[1]), external, remaining };
}

const PRESSURE = { 1: "normal", 2: "warn", 4: "critical" };
export function parseMemory(text, level) {
  const free = text.match(/free percentage:\s*(\d+)%/);
  if (!free) return null;
  return {
    used: 100 - Number(free[1]),
    pressure: PRESSURE[level.trim()] ?? "normal",
  };
}

// ps %cpu is per core: the sum over all processes, divided by the core count.
export function parseCpu(cores, ps) {
  const total = ps
    .split("\n")
    .reduce((sum, value) => sum + (Number(value) || 0), 0);
  return Math.min(100, total / (Number(cores) || 1));
}

// netstat lists an interface once per address with the same counters: read the link row only.
export function parseNet(text) {
  const row = text.split("\n").find((l) => /<Link#\d+>/.test(l));
  if (!row) return null;
  // ... Ibytes Opkts Oerrs Obytes Coll. Count from the end: Address can be blank.
  const cols = row.trim().split(/\s+/).map(Number);
  return { rx: cols.at(-5), tx: cols.at(-2) };
}

export function netRate(prev, next) {
  if (
    !prev ||
    !next ||
    next.at <= prev.at ||
    next.rx < prev.rx ||
    next.tx < prev.tx
  )
    return null;
  const seconds = (next.at - prev.at) / 1000;
  return {
    rx: (next.rx - prev.rx) / seconds,
    tx: (next.tx - prev.tx) / seconds,
  };
}

// Watts into the battery (BatteryData.BatteryPower, mW), only while charging.
// The battery gauge refreshes it every 20-60 s. No battery (a desktop Mac): null.
export function parseCharge(text) {
  if (!/"IsCharging" = Yes/.test(text)) return null;
  const mw = text.match(/"BatteryData" = \{[^}]*"BatteryPower"=(\d+)/);
  return mw ? Number(mw[1]) / 1000 : null;
}

// Apple Silicon has no sudo-free temperature reading; pmset only reports throttling.
export function parseThermal(text) {
  const limit = text.match(/CPU_Speed_Limit\s*=\s*(\d+)/);
  const value = limit ? Number(limit[1]) : 100;
  return { throttled: value < 100, limit: value };
}

export function formatBytes(bytes) {
  const k = bytes / 1024;
  if (k < 1000) return `${Math.round(k)}K`;
  if (k < 1024 * 1000) return `${(k / 1024).toFixed(1)}M`;
  return `${(k / 1024 / 1024).toFixed(1)}G`;
}

// macOS estimates whole minutes and revises them often. Count down locally from a
// deadline and take macOS's estimate again only every RESYNC; a lost estimate keeps it.
const RESYNC = 10 * 60000;
function deadline(battery, prev, now) {
  if (!battery || battery.external) return { deadline: null, anchoredAt: null };
  const fresh = prev?.deadline != null && now - prev.anchoredAt < RESYNC;
  if (fresh || (battery.remaining == null && prev?.deadline != null)) return { deadline: prev.deadline, anchoredAt: prev.anchoredAt };
  if (battery.remaining == null) return { deadline: null, anchoredAt: null };
  return { deadline: now + battery.remaining * 60000, anchoredAt: now };
}

export function countdown(deadline, now) {
  const seconds = Math.max(0, Math.round((deadline - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(n => String(n).padStart(2, "0")).join(":");
}

// Discharging: the deck redraws every second so the countdown ticks.
export const ticking = () => state?.battery?.external === false;

export function snapshot(stdout, prev, now) {
  const [
    batt = "",
    pressure = "",
    level = "",
    cores = "",
    ps = "",
    netstat = "",
    therm = "",
    charge = "",
  ] = stdout.split(SEP).map((s) => s.trim());
  const counters = parseNet(netstat);
  const net = counters && { ...counters, at: now };
  const battery = parseBattery(batt);
  return {
    battery,
    ...deadline(battery, prev, now),
    memory: parseMemory(pressure, level),
    cpu: parseCpu(cores, ps),
    net,
    rate: netRate(prev?.net, net),
    thermal: parseThermal(therm),
    charge: parseCharge(charge),
  };
}

let state = null;
export const machine = () => state;

export function startMachine(cx) {
  cx.spawn(async (cx) => {
    for (;;) {
      try {
        state = snapshot(
          (await exec("sh", ["-c", SCRIPT])).stdout,
          state,
          Date.now(),
        );
      } catch {
        // Keep the last reading; the next poll tries again.
      }
      cx.notify();
      await cx.sleep(POLL);
    }
  });
}
