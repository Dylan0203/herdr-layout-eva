// SYNC RATE: the percent of an agent's context window still free, read from
// its own session files every 15 s. Local Claude Code, Codex and OpenCode; any
// other agent (or one it can't read) has no rate (null).
// Adapted from FunnyQ/herdr-layout-p5's sp-context.js.
//
// Reads: ~/.claude/sessions/<pid>.json, the session's jsonl (its last few MB,
// plus a compaction count over bytes appended since the last poll), ~/.claude/settings.json; for Codex, ~/.codex/state_*.sqlite and its
// rollout file; for OpenCode, ~/.local/share/opencode/opencode.db (read-only)
// and ~/.cache/opencode/models.json. Runs pgrep, ps, lsof, sqlite3, grep, jq.
// Nothing leaves the machine.

import { terminals, exec, home, readTextFile } from "herdr";

const POLL = 15000;
const CLAUDE_WINDOW = 1000000;
const rates = new Map();
const stats = new Map();

const rows = (text) =>
  text.split("\n").flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

const left = (used, window) =>
  Math.max(0, Math.min(100, 100 - (used / window) * 100));

export function claudeRate(text, settings) {
  const last = rows(text)
    .filter(
      (r) =>
        r.type === "assistant" &&
        r.message?.usage &&
        r.message.model !== "<synthetic>" &&
        !r.isSidechain,
    )
    .at(-1);
  if (!last) return null;
  const { model, usage } = last.message;
  const used =
    usage.input_tokens +
    (usage.cache_read_input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0);
  // autoCompactWindow can be "auto" or null: only a positive number overrides.
  const window =
    [
      settings?.modelSettings?.[model]?.autoCompactWindow,
      settings?.autoCompactWindow,
    ].find((w) => typeof w === "number" && w > 0) ?? CLAUDE_WINDOW;
  const rate = left(used, window);
  return Number.isFinite(rate) ? rate : null;
}

export function codexRate(text) {
  const info = rows(text)
    .filter((r) => r.payload?.type === "token_count" && r.payload.info)
    .at(-1)?.payload.info;
  if (!info) return null;
  return left(info.last_token_usage.input_tokens, info.model_context_window);
}

export function opencodeRate(tokens, window) {
  if (!tokens || !window) return null;
  const used =
    (tokens.input ?? 0) +
    (tokens.cache?.read ?? 0) +
    (tokens.cache?.write ?? 0);
  return left(used, window);
}

// Each compaction writes one system line; tool output that merely mentions the
// subtype is escaped inside a string, and a line cut by a scan window doesn't parse.
export const countCompacts = (text) =>
  rows(text).filter(
    (r) => r.type === "system" && r.subtype === "compact_boundary",
  ).length;

export function formatSize(bytes) {
  const k = bytes / 1024;
  if (k < 1000) return `${Math.round(k)}K`;
  if (k < 1024 * 1000) return `${Math.round(k / 1024)}M`;
  return `${(k / 1024 / 1024).toFixed(1)}G`;
}

// macOS `ps -o etime`: [[dd-]hh:]mm:ss.
export function elapsedMs(etime) {
  const [days, clock] = etime.trim().includes("-")
    ? etime.trim().split("-")
    : ["0", etime.trim()];
  const parts = clock.split(":").map(Number);
  while (parts.length < 3) parts.unshift(0);
  const [h, m, sec] = parts;
  return (((Number(days) * 24 + h) * 60 + m) * 60 + sec) * 1000;
}

const sh = async (command, args) => (await exec(command, args)).stdout.trim();
// Transcripts reach gigabytes: grep only their last few MB, wider only when that
// window holds nothing usable (a huge tool result or image after the last turn).
const WINDOWS = [4e6, 64e6, 0];
async function lastMatching(file, needle, parse) {
  for (const bytes of WINDOWS) {
    const source = bytes ? `tail -c ${bytes} "$2"` : 'cat "$2"';
    const value = parse(
      await sh("sh", [
        "-c",
        `${source} | grep -F -- "$1" | tail -n 20`,
        "sh",
        needle,
        file,
      ]),
    );
    if (value != null) return value;
  }
  return null;
}

// Compactions and transcript size, scanning only the bytes appended since the last
// poll. The file only grows; a smaller size means a new file, so scan it whole.
const COMPACT = '"subtype":"compact_boundary"';
const scans = new Map();
async function transcript(file) {
  const size = Number(await sh("stat", ["-f", "%z", file]));
  if (!size) return null;
  const seen = scans.get(file);
  const from = seen && size >= seen.size ? seen.size : 0;
  const text = await sh("sh", [
    "-c",
    'tail -c +"$1" "$2" | head -c "$3" | grep -F -- "$4" || true',
    "sh",
    String(from + 1),
    file,
    String(size - from),
    COMPACT,
  ]);
  const compacts = (from ? seen.compacts : 0) + countCompacts(text);
  scans.set(file, { size, compacts });
  return { compacts, bytes: size };
}

// Herdr starts agents inside an interactive shell (sometimes a login shell
// around it), so the agent can be a few levels below the terminal's pid.
const children = async (pid) =>
  (await sh("pgrep", ["-P", String(pid)])).split("\n").filter(Boolean);
async function descendants(pid, depth = 4) {
  const kids = await children(pid);
  if (depth <= 1) return kids;
  return [
    ...kids,
    ...(await Promise.all(kids.map((k) => descendants(k, depth - 1)))).flat(),
  ];
}

async function claude(pid, address) {
  const session = JSON.parse(
    (await readTextFile(`${home()}/.claude/sessions/${pid}.json`)) ?? "null",
  );
  if (!session) return null;
  const folder = session.cwd.replace(/[^A-Za-z0-9]/g, "-");
  const file = `${home()}/.claude/projects/${folder}/${session.sessionId}.jsonl`;
  const settings = JSON.parse(
    (await readTextFile(`${home()}/.claude/settings.json`)) ?? "{}",
  );
  const counts = await transcript(file).catch(() => null);
  counts ? stats.set(address, counts) : stats.delete(address);
  return lastMatching(file, '"usage"', (text) => claudeRate(text, settings));
}

// Codex sessions are written by a shared app-server, not the codex process: find the
// thread by its resume id, else the newest interactive thread in the agent's folder.
async function codex(pid) {
  const argv = await sh("ps", ["-o", "command=", "-p", pid]);
  if (!/\bcodex\b/.test(argv)) return null; // a shell between the terminal and codex
  const id = argv.match(/\bresume\s+([0-9a-f-]{36})\b/)?.[1];
  const cwd = id
    ? null
    : (await sh("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]))
        .split("\n")
        .find((l) => l.startsWith("n"))
        ?.slice(1);
  if (!id && !cwd) return null;
  const where = id
    ? `id = '${id}'`
    : `cwd = '${cwd.replaceAll("'", "''")}' and source in ('cli', 'vscode')`;
  const file = await sh("sh", [
    "-c",
    'sqlite3 "$(ls "$HOME"/.codex/state_*.sqlite | tail -n 1)" "$1"',
    "sh",
    `select rollout_path from threads where ${where} order by updated_at_ms desc limit 1`,
  ]);
  if (!file) return null;
  return lastMatching(file, '"token_count"', codexRate);
}

// OpenCode keeps everything in one sqlite file. The agent's session is the newest
// top-level one in its folder touched since the process started (a fresh start
// has none until the first message). The window comes from its models cache.
// v1 writes `session` + `message`; v2 writes `session_v2` + `session_message`.
const OPENCODE_QUERIES = {
  v2: (
    dir,
    since,
  ) => `select json_extract(m.data, '$.model.providerID') as provider, json_extract(m.data, '$.model.id') as model,
      json_extract(m.data, '$.tokens') as tokens, m.time_created as at
    from session_message m join session_v2 s on s.id = m.session_id
    where s.directory = ${dir} and s.parent_id is null and s.time_updated >= ${since}
      and m.type = 'assistant' and json_extract(m.data, '$.tokens.input') is not null
    order by m.time_created desc limit 1`,
  v1: (
    dir,
    since,
  ) => `select json_extract(m.data, '$.providerID') as provider, json_extract(m.data, '$.modelID') as model,
      json_extract(m.data, '$.tokens') as tokens, m.time_created as at
    from message m join session s on s.id = m.session_id
    where s.directory = ${dir} and s.parent_id is null and s.time_updated >= ${since}
      and json_extract(m.data, '$.role') = 'assistant' and json_extract(m.data, '$.tokens.input') is not null
    order by m.time_created desc limit 1`,
};

async function opencode(pid) {
  const argv = await sh("ps", ["-o", "command=", "-p", pid]);
  if (!/\bopencode\b/.test(argv) || /\bserve\b/.test(argv)) return null;
  const cwd = (await sh("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]))
    .split("\n")
    .find((l) => l.startsWith("n"))
    ?.slice(1);
  if (!cwd) return null;
  const started = Math.floor(
    Date.now() - elapsedMs(await sh("ps", ["-o", "etime=", "-p", pid])),
  );
  const dir = `'${cwd.replaceAll("'", "''")}'`;
  const db = `${home()}/.local/share/opencode/opencode.db`;
  // Each query alone: a missing table (older or newer OpenCode) only empties its own result.
  const found = await Promise.all(
    Object.values(OPENCODE_QUERIES).map(async (query) => {
      const out = await sh("sqlite3", [
        "-readonly",
        "-json",
        db,
        query(dir, started),
      ]);
      try {
        return out ? JSON.parse(out)[0] : null;
      } catch {
        return null;
      }
    }),
  );
  const row = found.filter(Boolean).sort((a, b) => b.at - a.at)[0];
  if (!row) return null;
  const window =
    Number(
      await sh("jq", [
        "-r",
        "--arg",
        "p",
        row.provider,
        "--arg",
        "m",
        row.model,
        ".[$p].models[$m].limit.context // empty",
        `${home()}/.cache/opencode/models.json`,
      ]),
    ) || null;
  return opencodeRate(JSON.parse(row.tokens), window);
}

const READERS = { claude, codex, opencode };

/** The agent's sync rate (0–100), or null when unknown. */
export const syncRate = (address) => rates.get(address) ?? null;

/** A Claude Code agent's compaction count and transcript bytes, or null. */
export const transcriptStats = (address) => stats.get(address) ?? null;

async function poll() {
  const live = terminals().filter(
    (t) => READERS[t.program?.key] && !t.address.includes("/"),
  );
  for (const t of live) {
    try {
      let value = null;
      for (const pid of await descendants(t.pid)) {
        value = await READERS[t.program.key](pid, t.address).catch(() => null);
        if (value != null) break;
      }
      value == null ? rates.delete(t.address) : rates.set(t.address, value);
    } catch {
      rates.delete(t.address);
    }
  }
  const alive = new Set(live.map((t) => t.address));
  for (const map of [rates, stats])
    for (const address of map.keys())
      if (!alive.has(address)) map.delete(address);
}

export function startSync(cx) {
  cx.spawn(async (cx) => {
    for (;;) {
      await poll();
      cx.notify();
      await cx.sleep(POLL);
    }
  });
}
