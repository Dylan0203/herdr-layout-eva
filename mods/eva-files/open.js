// The file tree's right-click menu: which items a row gets, and the apps macOS offers for it.
// Pure: no Herdr calls, so tests import it directly.

// Asks Launch Services, like Finder's "Open With": prints {"default": path | null, "apps": [path]}.
export const APPS_SCRIPT = `ObjC.import("AppKit");
function run(argv) {
  const ws = $.NSWorkspace.sharedWorkspace, url = $.NSURL.fileURLWithPath(argv[0]);
  const def = ws.URLForApplicationToOpenURL(url), all = ws.URLsForApplicationsToOpenURL(url), apps = [];
  for (let i = 0; i < all.count; i++) apps.push(all.objectAtIndex(i).path.js);
  return JSON.stringify({ default: def.isNil() ? null : def.path.js, apps });
}`;

export const appName = (path) =>
  path
    .replace(/\/+$/, "")
    .split("/")
    .pop()
    .replace(/\.app$/, "");

// The default app first, then the others installed where people install apps.
// Helpers inside bundles (Instruments) and copies in caches (Playwright's Chrome) stay out.
export function pickApps(raw, home) {
  const roots = [
    "/Applications/",
    "/System/Applications/",
    `${home}/Applications/`,
  ];
  const usual = (p) =>
    roots.some((r) => p.startsWith(r) && !p.slice(r.length).includes(".app/"));
  const def = raw?.default ?? null;
  const seen = new Set(),
    out = [];
  for (const path of [def, ...(Array.isArray(raw?.apps) ? raw.apps : [])]) {
    if (!path || (path !== def && !usual(path))) continue;
    const name = appName(path);
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ path, name, default: path === def });
  }
  return out;
}

const parent = (path) => path.replace(/\/[^/]*$/, "") || "/";

export function menuItems({ abs, rel, dir, mac, local, apps }) {
  const items = [];
  const add = (group, label, action, more) => items.push({ group, label, action, ...more });
  const def = apps?.find((a) => a.default);
  const others = apps?.filter((a) => !a.default) ?? [];
  if (mac && local) {
    if (dir) add("open", "Open in Finder", { type: "exec", argv: ["open", abs] });
    else if (def) add("open", `Open in ${def.name}`, { type: "exec", argv: ["open", "-a", def.path, abs] });
    else add("open", "Open", { type: "exec", argv: ["open", abs] });
    add("open", "Reveal in Finder", { type: "exec", argv: ["open", "-R", abs] });
  }
  add("copy", "Copy path", { type: "copy", text: abs });
  add("copy", "Copy relative path", { type: "copy", text: rel });
  if (local) add("terminal", "Open terminal here", { type: "terminal", folder: dir ? abs : parent(abs) });
  if (mac && local && !dir && (!apps || others.length)) {
    add("with", "Open with", null, { heading: true });
    if (!apps) add("with", "Finding apps…", null);
    for (const app of others) add("with", app.name, { type: "exec", argv: ["open", "-a", app.path, abs] });
  }
  return items;
}
