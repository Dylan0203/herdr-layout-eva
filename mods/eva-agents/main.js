// Agents in grouped or priority views; parents take their most urgent sub-agent's place.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, terminals, panes, focused, spaces, run, theme, shared, setShared, setAgentOrder, openOverlay, closeOverlay, props, window, layout } from "herdr";
import { C, MINCHO, MONO, TONE, LABEL, cut, fill, stroke, line, hazard, blink, motion } from "./eva.js";
import { startSync, syncRate, transcriptStats, agentVersion, formatSize } from "./sync.js";

const DIGITAL = "Digital-7 Mono";
const STATES = ["working", "done", "idle", "blocked"];

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 304) : window()?.platform === "macos" ? 76 : 44 });
}

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function leadPanes(all) {
  const leads = new Map();
  for (const p of all) {
    if (!p.terminal) continue;
    const current = leads.get(p.tab);
    // First agent, else first focused terminal, else first terminal in the tab.
    if (!current || (!current.program?.agent && (p.program?.agent || (!current.focused && p.focused)))) leads.set(p.tab, p);
  }
  return leads;
}

function title(tab, l) {
  const prog = l?.program?.name;
  const live = clean(l?.title);
  // clean() would strip a path's leading ~ or /: test the title with only its status glyph gone.
  const path = /^[~/]|^[A-Za-z]:\\/.test((l?.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== prog && !path && !live.includes("@") && live.toLowerCase() !== l?.program?.key;
  return (tab.name === prog || !tab.named) && telling ? live : tab.name;
}
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};
const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
];
const sortOf = () => SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[0];
const SECTION = { 4: "警告", 3: "完了", 2: "稼働", 1: "待機" };
const SECTION_STATUS = { 4: "blocked", 3: "done", 2: "working" };

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// The agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Agents extends View {
  init(_props, cx) {
    if (props()?.sortMenu) return;
    this.folded = new Set();
    // Each agent's last state and when it changed (ms), kept across restarts.
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    this.pendingPins = JSON.parse(localStorage.getItem("pins") ?? "[]");
    if (!this.pendingPins.length) localStorage.removeItem("pins");
    this.migratingPins = new Set();
    cx.timer.every(30000, (cx) => cx.notify());
    this.width = 304;
    startSync(cx);
    this.announced = new Set();
    this.bornAt = Date.now();
  }

  // 作戦開始 for each new top-level agent. Agents seen in the first seconds
  // after load were already running, so they only get remembered.
  announce(list, all) {
    const settling = Date.now() - this.bornAt < 3000;
    const parentOf = new Map(all.map(t => [t.address, t.parent]));
    for (const a of list) {
      if (this.announced.has(a.address)) continue;
      this.announced.add(a.address);
      if (settling || !motion() || parentOf.get(a.address)) continue;
      const index = panes().filter(p => p.tab === a.tab).findIndex(p => p.pane === a.pane) + 1;
      openOverlay({
        mod: "eva-launch", kind: "window", width: 1, height: 1, at: { x: 0, y: 0 }, frame: "none",
        props: { name: a.space_name, program: a.program?.name, pane: index || null },
      });
    }
  }

  // The lit status tab; with `all`, the four of them, unlit ones outlined.
  tabs(status, all) {
    const tab = (s) => div().flex_none().px(6).h(20).flex().items_center()
      .font_family(MINCHO).font_weight(700).text_size(13).line_height(1)
      .when(s === status, (d) => d.bg(TONE[s]).text_color(C.ink))
      .when(s !== status, (d) => d.border(1).border_color(C.dim + "66").text_color(C.dim))
      .child(LABEL[s]);
    return h_flex().flex_none().gap(2).children((all ? STATES : [status]).map(tab));
  }

  // Stamps agents whose state changed. Done and idle count as one: looking at a
  // finished agent turns done into idle, and looking isn't the agent doing anything.
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now };
      dirty = true;
    }
    if (!dirty) return;
    // Gone and old: the list alone is empty right after a start.
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(this.changed)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete this.changed[k];
    localStorage.setItem("changed", JSON.stringify(this.changed));
  }

  // Keep offline pins until their terminal returns, and keep each pending until
  // core echoes the label so a failed write doesn't erase the old pin.
  migratePins(all) {
    const listed = new Map(all.filter((t) => t.state === "live").map((t) => [t.address, t]));
    const pending = this.pendingPins.filter((address) => {
      const terminal = listed.get(address);
      if (!terminal) return true;
      if (terminal.labels?.["herdr.pinned"]) return false;
      if (!this.migratingPins.has(address)) {
        this.migratingPins.add(address);
        run("terminal.pin", { terminal: address, pinned: true });
      }
      return true;
    });
    if (pending.length === this.pendingPins.length) return;
    this.pendingPins = pending;
    if (pending.length) localStorage.setItem("pins", JSON.stringify(pending));
    else localStorage.removeItem("pins");
  }

  since(a) {
    return this.changed[a.address]?.at ?? 0;
  }

  rank(a) {
    return RANK[a.status] ?? 0;
  }

  sortMenu(t) {
    const on = sortOf().id;
    return v_flex()
      .w_full()
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .child(div().px(8).pt(4).pb(6).text_size(11).text_color(t.dim).child("Sort agents"))
      .children(SORTS.map((s) => h_flex()
        .id(`sort-${s.id}`)
        .h(31)
        .px(8)
        .gap(9)
        .rounded(7)
        .items_center()
        .text_color(t.foreground)
        .hover((el) => el.bg(t.hover))
        .on_click(() => {
          setShared("agents.sort", s.id);
          closeOverlay(props().overlay);
        })
        .child(svg(`mods/workspace-chrome/${s.icon}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().child(s.label))
        .when(s.id === on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.foreground)))));
  }

  peek(addr) {
    run("terminal.peek", { terminal: addr });
  }

  // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
  tree(all, addr, lead = []) {
    const kids = all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        { t: k, lines: [...lead, last ? "└" : "├"] },
        ...this.tree(all, k.address, [...lead, last ? "" : "│"]),
      ];
    });
  }

  // A sub-agent: a slim cut-corner plate under its parent's card, led by its program icon.
  subRow(t, s, shown, compact) {
    const k = s.t;
    const st = kidStatus(k, this.listed);
    const on = k.address === shown;
    const plate = Math.max(this.width - 22, 120) - 18 - s.lines.length * 13;
    const shape = cut(plate, 24, { tr: 8 });
    const head = icon(k.program, 14, t.foreground);
    return h_flex()
      .id(`sub-${k.address}`)
      .pl(18)
      .h(28)
      .flex_none()
      .items_center()
      .on_click(() => (this.listed.has(k.address) ? run("pane.focus", { terminal: k.address }) : this.peek(k.address)))
      .children(s.lines.map(l => div().self_start().mt(-4).w(9).h(18).mr(4).flex_none()
        .when(Boolean(l), el => el.border_l(1).border_color(C.purple))
        .when(l === "└" || l === "├", el => el.border_b(1))))
      .child(h_flex().relative().w(plate).h(24).flex_none().px(6).gap(7).items_center()
        .child(fill(shape, on ? "#1c1230f0" : "#110c1acc"))
        .child(stroke(shape, on ? C.orange : "#6b3fa0aa"))
        .when(Boolean(head), el => el.child(head))
        .child(div().flex_1().min_w(0).truncate().text_size(11).font_weight(700).text_color(on ? C.white : C.muted)
          .child((k.name || k.template || k.program?.name || k.address).toUpperCase()))
        .child(this.status(t, { status: st }, compact)));
  }

  // compact: a ! for blocked where a header already says 警告.
  status(t, a, compact = false) {
    const color = t[a.status] ?? t.dim;
    if (a.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
    if (a.status === "blocked" && compact) return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (a.status === "blocked") return div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
    // Idle: a ring; done: a dot.
    if (a.status === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return div().size(7).mx(3).flex_none().rounded(4).bg(a.status === "done" ? color : t.dim + "00");
  }

  card(t, a, { name, more, pic, machine, subs, fold, pin, when, now, idle }) {
    const w = Math.max(this.width - 22, 120);
    const big = a.focused || a.status === "working" || a.status === "blocked";
    const h = big ? 152 : 112;
    const inner = h - 22;
    const blocked = a.status === "blocked";
    const status = STATES.includes(a.status) ? a.status : "idle";
    const shape = cut(w, h, { tr: 14, br: 14 });
    const rate = syncRate(a.address);
    const tone = rate == null ? C.dim : rate > 50 ? C.green : rate > 20 ? C.orange : C.red;
    const value = rate == null ? "---.-" : rate.toFixed(1).padStart(5, "0");
    const cells = rate == null ? 0 : Math.round(rate / 10);
    const frame = blocked
      ? [...hazard(shape), div().absolute().top(5).left(5).w(w - 10).h(h - 10).child(fill(cut(w - 10, h - 10, { tr: 11, br: 11 }), "#120808"))]
      : [fill(shape, a.focused ? "#1c1230f0" : "#110c1acc"), stroke(shape, a.focused ? C.orange : "#6b3fa0aa", a.focused ? 1.5 : 1)];
    const since = div().flex_none().font_family(MONO).text_size(10).line_height(1).text_color(C.dim)
      .child(when ? `T+${duration(now - when)}` : "");
    const corner = this.hovered === a.address ? pin : since;
    const title = h_flex().h(18).flex_none().gap(7).items_center().min_w(0)
      .when(Boolean(pic), el => el.child(div().id(`agent-fold-${a.address}`)
        .when(subs.length > 0, el => el.on_click((_e, cx) => {
          cx.stop_propagation();
          this.folded.has(a.address) ? this.folded.delete(a.address) : this.folded.add(a.address);
          cx.notify();
        })).child(pic)))
      .child(div().flex_1().min_w(0).truncate().font_weight(700).text_size(12)
        .text_color(idle ? C.muted : C.white).child(name.toUpperCase()))
      .when(subs.length > 0, el => el.child(fold(a, subs)));
    const detail = div().flex_1().min_w(0).truncate().text_size(10.5).text_color(C.muted)
      .child((more || a.program?.name || a.address).toUpperCase());
    const host = div().flex_none().text_size(9).text_color(C.dim).child(machine ?? "");
    const gauge = h_flex().h(big ? 9 : 6).mt(3).flex_none().gap(3)
      .children(Array.from({ length: 10 }, (_, i) => div().flex_1().h_full()
        .when(i < cells, el => el.bg(tone))
        .when(i >= cells, el => el.border(1).border_color(tone + "55"))));
    // Blocked, the number gives way to a blinking 警告; the gauge still shows the rate.
    const number = (size) => blocked
      ? blink(`warn-${a.address}`, h_flex().gap(6).items_end()
        .child(div().font_family(MINCHO).font_weight(700).text_size(Math.round(size * 0.62)).line_height(1).text_color(C.red).child("警告"))
        .child(div().pb(2).text_size(11).font_weight(700).line_height(1).text_color(C.orange).child("WARNING")))
      : h_flex().gap(3).items_end()
        .child(div().font_family(DIGITAL).text_size(size).line_height(1).whitespace_nowrap().text_color(tone).child(value))
        .child(div().pb(3).font_family(MONO).text_size(10).line_height(1).text_color(tone).child("%"));
    const card = div()
      .id(`ag-${a.address}`)
      .relative()
      .w(w)
      .h(h)
      .mb(8)
      .flex_none()
      .cursor_pointer()
      .on_hover((on, cx) => {
        if (on) this.hovered = a.address;
        else if (this.hovered === a.address) this.hovered = null;
        cx.notify();
      })
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .children(frame);
    const g = big ? 9 : 6;
    const col = w - 36;
    const rh = inner - 18 - 20 - 15 - g;
    const fit = (label) => Math.floor((col - (label ? 54 : 0) - 17) / 2.5);
    const cap = Math.min(big ? 60 : 32, rh);
    // The label sits left of the number where that costs the number nothing;
    // on tall cards it otherwise sits above it; short narrow cards go without.
    const label = !blocked && fit(true) >= cap;
    const above = !blocked && !label && big;
    const size = Math.min(cap, fit(label), above ? rh - 15 : Infinity);
    // Claude Code only: compactions so far and the transcript's size, on every card
    // (idle ones are the ones people look at). Muted, no gauge: when auto-compact fires isn't known.
    const counts = transcriptStats(a.address);
    const record = (kanji, text) => h_flex().gap(4).items_end().line_height(1)
      .child(div().font_family(MINCHO).font_weight(700).text_size(9).text_color(C.muted).child(kanji))
      .child(div().font_family(MONO).text_size(9).text_color(C.muted).child(text));
    const records = counts && [record("圧縮", counts.compacts == null ? "--" : String(counts.compacts).padStart(2, "0")), record("記録", formatSize(counts.bytes))];
    // The session's CLI version beside T+, orange once the installed claude is newer (restart to update).
    const version = agentVersion(a.address);
    const tag = version && div().flex_none().font_family(MONO).text_size(10).line_height(1)
      .text_color(version.stale ? C.orange : C.dim).child(`v${version.version}`);
    return card
      .child(v_flex().absolute().left(14).right(22).top(10).bottom(12).gap(3)
        .child(title.when(Boolean(tag), el => el.child(tag)).child(corner))
        .child(h_flex().h(20).flex_none().gap(8).items_center().min_w(0)
          .child(detail).when(Boolean(machine), el => el.child(host))
          .when(Boolean(records), el => el.child(h_flex().flex_none().gap(7).children(records ?? [])))
          .child(this.tabs(status, col >= 280)))
        .child(div().flex_1())
        .when(above, el => el.child(h_flex().h(12).flex_none().gap(6).items_end()
          .child(div().font_family(MINCHO).font_weight(700).text_size(12).line_height(1).text_color(C.white).child("同調率"))
          .child(div().text_size(8).font_weight(700).line_height(1).text_color(C.orange).child("SYNC RATE"))))
        .child(h_flex().h(above ? rh - 15 : rh).flex_none().gap(8).items_end().min_w(0)
          .when(label, el => el.child(v_flex().w(46).flex_none().pb(3).gap(3).line_height(1)
            .child(div().font_family(MINCHO).font_weight(700).text_size(12).text_color(C.white).child("同調率"))
            .child(div().text_size(8).font_weight(700).text_color(C.orange).child("SYNC RATE"))))
          .child(h_flex().flex_1().min_w(0).justify_end().child(number(size))))
        .child(gauge));
  }

  render(cx) {
    const t = theme();
    if (props()?.sortMenu) return this.sortMenu(t);
    const collapsed = narrow();
    const sort = sortOf();
    let list = agents();
    this.listed = new Map(list.map((a) => [a.address, a.status]));
    const all = terminals();
    this.announce(list, all);
    this.migratePins(all);
    const shown = focused()?.agent;
    const now = Date.now();
    this.track(list, now);
    // A kept sub-agent (one with a pane) is in agents() too: where a tree shows
    // it, it gets no row of its own, unless it's pinned.
    const nested = new Set(collapsed ? [] : list.flatMap((a) => this.tree(all, a.address).map((s) => s.t.address)));
    list = list.filter((a) => a.pinned || !nested.has(a.address));
    const tabCounts = new Map();
    for (const a of list) tabCounts.set(a.tab, (tabCounts.get(a.tab) ?? 0) + 1);
    const byPriority = sort.id === "priority";
    const urgency = new Map(list.map((a) => [a.address, Math.max(this.rank(a), ...this.tree(all, a.address).map((s) => RANK[kidStatus(s.t, this.listed)] ?? 0))]));
    const rankOf = (a) => urgency.get(a.address);
    if (byPriority) list = [...list].sort((x, y) => rankOf(y) - rankOf(x) || this.since(y) - this.since(x) || y.seq - x.seq);
    const pinned = list.filter((a) => a.pinned);
    const rest = list.filter((a) => !a.pinned);
    list = [...pinned, ...rest];
    setAgentOrder(list.map((a) => a.address));

    const withKids = (a, i) => {
      const subs = collapsed ? [] : this.tree(all, a.address);
      const r = row(a, i, subs);
      if (this.folded.has(a.address)) return [r];
      return [r, ...subs.map((s) => this.subRow(t, s, shown, byPriority))];
    };

    // The fold chevron; folded, the count too, colored by the most urgent one.
    const fold = (a, subs) => {
      const sts = subs.map((s) => kidStatus(s.t, this.listed));
      const top = sts.reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null);
      const open = !this.folded.has(a.address);
      return div()
        .id(`fold-${a.address}`)
        .h(18)
        .px(3)
        .gap(3)
        .flex()
        .items_center()
        .rounded(4)
        .text_size(11)
        .text_color(open ? t.dim : (t[top] ?? t.dim))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          open ? this.folded.add(a.address) : this.folded.delete(a.address);
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none())
        .when(!open, (el) => el.child(String(subs.length)));
    };

    // A row reads "space \u00b7 detail": the detail is a tab someone named or the
    // agent's own title, never an automatic tab number unless two rows would
    // otherwise read the same.
    // Read the pane snapshot once: every host read copies the whole list into JS.
    const leads = leadPanes(panes());
    const tabs = new Map(spaces().flatMap(s => s.tabs).map(tab => [tab.id, tab]));
    const labels = new Map(list.map(a => {
      const tab = tabs.get(a.tab);
      const many = tabCounts.get(a.tab) > 1;
      return [a.address, tab ? title(many ? { ...tab, named: false } : tab, many ? a : leads.get(a.tab)) : (a.title || a.program?.name || "")];
    }));
    const label = (a) => labels.get(a.address);
    const detail = new Map(list.map(a => [a.address, /^\d+$/.test(label(a)) ? null : label(a)]));
    const seen = {};
    for (const a of list) { const k = `${a.space_name}\u0000${detail.get(a.address) ?? ""}`; seen[k] = (seen[k] ?? 0) + 1; }
    for (const a of list) {
      if (detail.get(a.address) == null && seen[`${a.space_name}\u0000`] > 1) detail.set(a.address, label(a));
    }

    const row = (a, i, subs = []) => {
      const pic = icon(a.program, 16, t.foreground);
      const more = detail.get(a.address);
      // An agent on another machine (`vps/t7`) says which.
      const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
      if (collapsed) {
        return h_flex()
          .id(`ag-${a.address}`)
          .h(26)
          .px(8)
          .flex_none()
          .items_center()
          .gap(4)
          .hover((s) => s.bg(t.hover))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(div().flex_1().min_w(0).whitespace_nowrap().text_right().text_color(t.muted).child(String(i + 1)))
          .child(h_flex().w(14).flex_none().items_center().justify_center().child(this.status(t, a, true)));
      }
      const when = this.since(a);
      const idle = a.status === "idle" && !a.focused;
      const isPinned = a.pinned;
      const pin = div()
        .id(`pin-${a.address}`)
        .flex_none()
        .p(2)
        .rounded(4)
        .text_color(t.dim)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(isPinned ? "Unpin" : "Pin to the top")
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("terminal.pin", { terminal: a.address, pinned: !isPinned });
          // The row moves away from under the pointer, and no hover-out comes.
          this.hovered = null;
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/${isPinned ? "pin-off" : "pin"}.svg`).size(13));
      const name = a.space_name || label(a);
      return this.card(t, a, { name, more: more ?? label(a), pic, machine, subs, fold, pin, when, now, idle });
    };

    // Groups in list order: spaces (grouped) or priority sections. Agents of a
    // space are next to each other in agents(), so neighbours make a group.
    const groups = pinned.length ? [{ id: "pinned", label: "固定", status: null, members: pinned }] : [];
    for (const a of rest) {
      const r = rankOf(a) || RANK.idle;
      const id = byPriority ? `sec-${r}` : `sp-${a.space}`;
      if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
      else groups.push({ id, label: byPriority ? SECTION[r] : a.space_name || "", status: byPriority ? SECTION_STATUS[r] : null, members: [a] });
    }

    // A group's header; it folds the group. Folded, it says how many and the most urgent state.
    const header = (g) => {
      const open = !this.folded.has(g.id);
      const top = g.members.reduce((m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m), null);
      return h_flex()
        .id(g.id)
        .px(8)
        .pt(8)
        .h(30)
        .flex_none()
        .gap(6)
        .items_center()
        .text_size(11)
        .font_medium()
        .cursor_pointer()
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => {
          open ? this.folded.add(g.id) : this.folded.delete(g.id);
          cx.notify();
        })
        .child(div().truncate().font_weight(700).text_size(10.5).text_color(t[g.status] ?? t.dim)
          .when(byPriority || g.id === "pinned", (el) => el.font_family(MINCHO).text_size(13))
          .child((g.label ?? "").toUpperCase()))
        .when(byPriority || !open, (el) => el.child(div().text_color(t.dim).child(String(g.members.length))))
        .child(div().flex_1())
        .when(!open, (el) => el
          .when(!byPriority && top && top !== "idle", (el) => el.child(this.status(t, { status: top }, true)))
          .child(svg("mods/workspace-chrome/chevron-right.svg").size(11).flex_none().text_color(t.dim)));
    };
    const rows = collapsed
      ? list.flatMap(withKids)
      : groups.flatMap((g) => [header(g), ...(this.folded.has(g.id) ? [] : g.members.flatMap(withKids))]);

    return v_flex()
      .id("eva-agents")
      .size_full()
      .min_h(0)
      .border_t(1)
      .border_color("#ff6a0059")
      .text_size(13)
      .on_size_change((size, cx) => {
        if (Math.abs(size.width - this.width) < 1) return;
        this.width = size.width;
        cx.notify();
      })
      .when(!collapsed, (el) =>
        el.child(
          h_flex()
            .relative()
            .px(14)
            .h(56)
            .pt(10)
            .pb(10)
            .flex_none()
            .items_end()
            .gap(8)
            .child(div().font_family(MINCHO).font_weight(700).text_size(32).line_height(1).mb(-2).text_color(C.white).child("稼働体"))
            .child(div().text_size(10.5).line_height(1).font_weight(700).text_color(C.orange).child("AGENTS"))
            .child(div().flex_1())
            .child(div().absolute().left(14).right(14).bottom(4).h(10).child(line([[0, 9], [this.width - 46, 9], [this.width - 30, 0]], C.orange)))
            .child(
              div()
                .id("ag-sort")
                .text_size(11)
                .text_color(t.dim)
                .hover((s) => s.text_color(t.foreground))
                .on_click(() => openOverlay({ mod: "eva-agents", kind: "popup", width: 200, height: 140, props: { sortMenu: true } }))
                .tooltip(`Sort agents: ${sort.label}`)
                .child(svg(`mods/workspace-chrome/${sort.icon}.svg`).size(14)),
            ),
        ),
      )
      .when(list.length === 0 && !collapsed, (el) =>
        el.child(div().px(12).text_size(12).text_color(t.dim).child("No agent status yet. Agents show up here when they report their status. Older versions and agents inside tmux may not.")),
      )
      .child(v_flex().id("ag-list").flex_1().min_h(0).px(collapsed ? 0 : 8).overflow_y_scrollbar().mode("always").children(rows))
      .when(collapsed, (el) =>
        el.child(
          h_flex()
            .h(28)
            .items_center()
            .justify_center()
            .child(
              div()
                .id("collapse")
                .text_size(13)
                .text_color(t.dim)
                .hover((s) => s.text_color(t.foreground))
                .on_click(toggleSidebar)
                .child("»"),
            ),
        ),
      );
  }
}
