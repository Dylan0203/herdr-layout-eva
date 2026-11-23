// A lazy file browser for the focused pane's folder, with bounded read-only previews.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Editor, EditorState, ScrollHandle } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, settings, window, props, openOverlay, closeOverlay, run, home } from "herdr";
import { C, MINCHO } from "./eva.js";
import { fitFolder } from "./tree.js";
import { APPS_SCRIPT, HEADER, HEADING, ROW, menuHeight, menuItems, pickApps } from "./open.js";

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, space: space?.id };
}
const key = () => JSON.stringify(location());
const LANG = { ts: "js", tsx: "js", mts: "js", cts: "js", jsx: "js", mjs: "js", toml: "yaml", jsonc: "json", svelte: "html", vue: "html" };
const PER_FOLDER = 500, TOTAL = 5000;

async function directory(path, on) {
  if (!on && window()?.platform === "windows") {
    // Windows PowerShell otherwise uses the console code page; exec decodes UTF-8.
    // Reparse points keep directory attributes even when dangling; check their target.
    const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress } '" + path.replaceAll("'", "''") + "'"]);
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  }
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  const r = await exec("sh", ["-c", script, "files", path], { on });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class Files extends View {
  init(_props, cx) {
    if (props()?.fileMenu) return this.menuInit(cx);
    this.saved = new Map();
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    this.refresh(cx);
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    const context = this.context;
    cx.spawn(async cx => {
      try { while (this.context === context) { await watchFolder(root); if (this.current(context)) this.refresh(cx); } }
      catch { if (this.context === context) this.watched = null; }
    });
  }

  current(context) {
    return this.context === context && key() === context.key;
  }

  async loadFolder(path, context) {
    const { on, cwd: root } = context;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(path, fitFolder(entries, Math.min(PER_FOLDER, TOTAL - used)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    const { cwd, on } = location(), next = key();
    if (next !== this.context?.key) {
      if (this.context) this.saved.set(this.context.key, { folders: this.folders, file: this.file });
      const saved = this.saved.get(next);
      this.context = { key: next, cwd, on }; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set(saved?.folders);
      this.pending = new Set(); this.marks = {}; this.show(null); this.watched = null; this.error = null; this.limited = false;
      this.loading = false;
      if (saved?.file) this.show(saved.file, cx);
    }
    if (!cwd || this.loading) return;
    const context = this.context;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(context)) return;
          await this.loadFolder(path, context);
        }
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        const marks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
          if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
            const xy = entry.slice(0, 2);
            marks[`${top.stdout.trim()}/${entry.slice(3)}`] = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
          }
        }
        if (!this.current(context)) return;
        this.marks = marks; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally { if (this.context === context) this.loading = false; cx.notify(); }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  show(path, cx) {
    this.code?.release(); this.code = null; this.file = path; this.fileError = null;
    if (!path || !cx) return;
    const context = this.context, root = this.root, on = this.on;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(`${root}/${path}`, { on });
        if (this.file !== path || !this.current(context)) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const t = theme(), ext = path.includes(".") ? path.split(".").pop() : "txt";
        this.code = EditorState.new({ language: LANG[ext] ?? ext, readonly: true,
          value: text.length > 400000 ? text.slice(0, 400000) + "\n… (file truncated)" : text,
          syntax: { keyword: t.ansi5, string: t.ansi2, comment: t.dim, function: t.ansi4, type: t.ansi3, number: t.ansi1, constant: t.ansi6 } });
      } catch { if (this.file === path && this.current(context)) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  rows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.marks[`${this.root}/${path}`];
      out.push(h_flex().id(`file-${path}`).h(28).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => entry.dir ? this.toggle(path, cx) : this.show(path, cx))
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); this.openMenu(path, entry); })
        // drag_paths arrived in Herdr 0.1.16: older versions keep a plain row.
        .when(true, el => typeof el.drag_paths === "function" ? el.drag_paths([`${this.root}/${path}`], { on: this.on }) : el)
        .child(entry.dir ? svg(`mods/eva-files/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(svg(`mods/eva-files/${entry.dir ? "folder" : "file"}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  openMenu(path, entry) {
    const mac = window()?.platform === "macos", local = !this.on;
    openOverlay({ mod: "eva-files", kind: "popup", width: 260,
      props: { fileMenu: { abs: `${this.root}/${path}`, rel: path, name: entry.name, dir: entry.dir, mac, local } } });
  }

  menuInit(cx) {
    const m = props().fileMenu;
    this.at = 0;
    this.scroll = ScrollHandle.new();
    this.apps = m.mac && m.local && !m.dir ? null : [];
    this.handle = cx.focus_handle();
    this.handle.focus();
    if (this.apps) return;
    cx.spawn(async cx => {
      try {
        const r = await exec("osascript", ["-l", "JavaScript", "-e", APPS_SCRIPT, m.abs], { timeout: 5000 });
        this.apps = r.code === 0 ? pickApps(JSON.parse(r.stdout), home()) : [];
      } catch { this.apps = []; }
      cx.notify();
    });
  }

  choose(item, cx) {
    if (!item?.action) return;
    const a = item.action;
    closeOverlay(props().overlay);
    if (a.type === "exec") exec(a.argv[0], a.argv.slice(1)).catch(() => {});
    else if (a.type === "copy") cx.write_to_clipboard(a.text);
    else if (a.type === "terminal") run("terminal.open", { folder: a.folder });
  }

  menu(cx) {
    const m = props().fileMenu, t = theme();
    const items = menuItems({ ...m, apps: this.apps });
    const live = items.map((it, i) => (it.action ? i : -1)).filter(i => i >= 0);
    if (!live.includes(this.at)) this.at = live[0] ?? 0;
    const step = (by) => { this.at = live[(live.indexOf(this.at) + by + live.length) % live.length]; this.scroll.scroll_to_item(this.at); };
    // The popup takes its content's size: a set height on the root is what lets the list scroll.
    return v_flex().id("file-menu").track_focus(this.handle).w_full().h(menuHeight(items)).min_h(0).p(5).bg("#0a0a0af0").text_size(12.8).text_color(t.foreground)
      .on_key_down((e, cx) => {
        if (e.key === "down") step(1);
        else if (e.key === "up") step(-1);
        else if (e.key === "enter") return this.choose(items[this.at], cx);
        else if (e.key === "escape") return closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .child(h_flex().h(HEADER).flex_none().px(8).gap(7).items_center().text_size(11)
        .child(div().text_color(C.orange).font_weight(700).child(m.dir ? "FOLDER" : "FILE"))
        .child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(m.name)))
      .child(v_flex().id("file-menu-items").flex_1().min_h(0).overflow_y_scrollbar().track_scroll(this.scroll).children(items.map((it, i) => v_flex()
        .when(i > 0 && items[i - 1].group !== it.group, el => el.child(div().mx(8).my(4).h(1).flex_none().bg("#6b3fa0aa")))
        .when(Boolean(it.heading), el => el.child(div().h(HEADING).flex_none().px(10).pt(4).text_size(10.5).font_weight(700).text_color(C.orange).child(it.label.toUpperCase())))
        .when(!it.heading, el => el.child(h_flex().id(`file-menu-${i}`).relative().h(ROW).flex_none().px(10).items_center()
          .when(!it.action, el => el.text_color(t.dim))
          .when(Boolean(it.action), el => el.cursor_pointer().hover(s => s.bg("#6b3fa033")).on_click((_e, cx) => this.choose(it, cx)))
          .when(i === this.at && Boolean(it.action), el => el.bg("#6b3fa055").text_color(C.white).child(div().absolute().left(0).top(0).bottom(0).w(3).bg(C.orange)))
          .child(div().flex_1().min_w(0).truncate().child(it.label)))))));
  }

  render(cx) {
    if (props()?.fileMenu) return this.menu(cx);
    if (key() !== this.context?.key) this.refresh(cx);
    const t = theme();
    const font = this.code ? settings() : null;
    return v_flex().id("files").size_full().min_h(0).overflow_hidden().bg("#0a0a0ae0").border_1().border_color("#6b3fa0aa").text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color("#ff6a0059")
        .when(Boolean(this.file), el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null); cx.notify(); }).child("←")))
        .child(h_flex().gap(8).items_end().child(div().font_family(MINCHO).font_weight(700).text_size(20).line_height(1).mb(-2).text_color(C.white).child("資料")).child(div().text_size(10).line_height(1).font_weight(700).text_color(C.orange).child("FILES")))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.file ?? this.root?.split(/[\\/]/).pop() ?? "")))
      .when(!this.file, el => el.child(v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(Boolean(this.file), el => el.child(this.code ? Editor.new(this.code).font_family(font.font_family).text_size(font.font_size).flex_1().min_h(0) : div().p(12).text_color(t.dim).child(this.fileError || "Loading file…")));
  }
}
