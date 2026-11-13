import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme, run, props, window, shared, setShared, updates, layout } from "herdr";
import { C, MINCHO, MONO } from "./eva.js";
import { commandDeck } from "./command.js";
import { startMachine, ticking } from "./machine.js";
import { startUpdates } from "./update.js";

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

export default class WorkspaceChrome extends View {
  init(_props, cx) {
    this.signalWidth = 360;
    this.signalHeight = 90;
    this.deckWidth = 1600;
    if (props()?.footer) cx.timer.every(1000, (cx) => cx.notify());
    if (props()?.command) {
      startMachine(cx);
      if (props().updates !== false) startUpdates(cx);
      cx.timer.every(1000, (cx) => ticking() && cx.notify());
    }
  }

  button(id, label, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().text_color(C.orange).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    if (props()?.command) return commandDeck(this);
    if (props()?.footer) {
      const now = new Date();
      const clock = [now.getHours(), now.getMinutes(), now.getSeconds()].map(n => String(n).padStart(2, "0")).join(":");
      const row = (id, icon, label, dim, action) => h_flex().id(id).h(28).px(8).gap(9).items_center().font_weight(700)
        .text_color(dim ? t.dim : t.muted).hover(s => s.bg(t.hover).text_color(t.foreground)).cursor_pointer()
        .on_click(action).child(svg(`mods/eva-chrome/${icon}.svg`).size(14))
        .when(!collapsed, el => el.child(label.toUpperCase()));
      return v_flex().size_full().border_t(1).border_color("#ff6a0059").px(8).pt(4).pb(8).text_size(11.5)
        .when(!collapsed, el => el.child(h_flex().h(42).flex_none().px(8).gap(8).items_center()
          .child(div().font_family(MONO).text_size(9).text_color(C.green).child("LOCAL\nTIME"))
          .child(div().font_family("Digital-7 Mono").text_size(37).text_color(C.orange)
            .child(clock))))
        .child(row("settings", "settings", "Settings", false, () => run("app.settings"))
          .when(Boolean(updates().app.ready), el => el.child(div().size(6).bg(C.orange))))
        .child(row("machine", "plus", "Add machine", true, () => run("mod.open", { name: "machine-add" })));
    }
    return h_flex().size_full().border_b(1).border_color("#ff6a0059").pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().gap(8).items_end().child(div().font_family(MINCHO).font_weight(700).text_size(23).line_height(1).mb(-2).text_color(C.white).child("牧者")).child(div().text_size(10).line_height(1).font_weight(700).text_color(C.orange).child("HERDR"))))
      .when(!collapsed, el => el.child(this.button("search", svg("mods/eva-chrome/search.svg").size(15), () => run("mod.open", { name: "picker" }))))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/eva-chrome/sidebar.svg").size(15), toggleSidebar)));
  }
}
