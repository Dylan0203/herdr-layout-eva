// Once a day, asks GitHub for this layout's latest release and posts one 通報 toast
// per newer version. Click opens the releases page. Silent offline, rate-limited or
// on bad JSON. Off with `"updates": false` in the command deck block's props.
import { exec, notify, nextCommand } from "herdr";
import { VERSION } from "./version.js";

const REPO = "Dylan0203/herdr-layout-eva";
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES = `https://github.com/${REPO}/releases`;
export const DAY = 24 * 3600000;
const HOUR = 3600000;
const SETTLE = 60000;

export const releaseVersion = (release) =>
  /^v?(\d+\.\d+\.\d+)$/.exec(release?.tag_name ?? "")?.[1] ?? null;

// Numeric per segment; an unknown side is never newer.
export function isNewer(latest, current) {
  if (!latest || !current) return false;
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  const i = a.findIndex((n, k) => n !== b[k]);
  return i >= 0 && a[i] > b[i];
}

export const due = (checkedAt, now) =>
  typeof checkedAt !== "number" || now - checkedAt >= DAY;

const load = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

async function check() {
  if (!due(load("eva.update.checkedAt"), Date.now())) return;
  save("eva.update.checkedAt", Date.now());
  const res = await fetch(LATEST, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "herdr-layout-eva" },
  });
  if (!res.ok) return;
  const latest = releaseVersion(await res.json());
  if (!isNewer(latest, VERSION) || load("eva.update.notified") === latest) return;
  save("eva.update.notified", latest);
  notify({
    title: `EVA LAYOUT v${latest} OUT`,
    body: "Ask your agent to update it.",
    level: "info",
    action: { name: "eva-chrome.releases" },
  });
}

export function startUpdates(cx) {
  cx.spawn(async (cx) => {
    await cx.sleep(SETTLE); // nothing pops up while the window opens
    for (;;) {
      await check().catch(() => {});
      await cx.sleep(HOUR);
    }
  });
  cx.spawn(async () => {
    for (;;) {
      if ((await nextCommand()) === "releases")
        await exec("open", [RELEASES]).catch(() => {});
    }
  });
}
