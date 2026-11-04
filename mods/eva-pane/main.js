// EVA pane header, cloned from the shipped `pane` mod.
// A slanted label slab on the left (orange when focused): PANE NN, the
// program, the folder. The agent's status on the right; hover for split,
// zoom and close. Props from the app: { pane, terminal }. Click: focus.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home } from "herdr";
import { C, MONO, fill, badge, warning } from "./eva.js";

const H = 30,
  SLANT = 18;

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint
    ? svg(p.icon).size(size).flex_none().text_color(color)
    : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h
    ? "~"
    : cwd.startsWith(h + "/")
      ? "~" + cwd.slice(h.length)
      : cwd;
}

export default class Pane extends View {
  init() {
    this.hovered = false;
    this.width = 0;
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .text_color(C.orange)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/eva-pane/${icon}.svg`).size(14));
  }

  render() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const siblings = panes().filter((x) => x.tab === p.tab);
    const number = String(
      siblings.findIndex((x) => x.pane === p.pane) + 1,
    ).padStart(2, "0");
    const name =
      ((p.program?.agent || p.program?.shell) && p.program.name) ||
      p.title ||
      p.program?.name ||
      "shell";
    const on = p.focused;
    const ink = on ? C.ink : C.muted;
    // The slab covers the label; its right edge slants down to the left.
    const slab = Math.min(Math.max(this.width * 0.4, 260), 480);
    const st = p.status;
    const pane = p.pane;
    return h_flex()
      .id(`pane-head-${pane}`)
      .relative()
      .size_full()
      .pr(10)
      .gap(8)
      .items_center()
      .bg("#0a0a0acc")
      .border_b(1)
      .border_color(on ? "#ff6a0059" : "#6b3fa066")
      .text_size(12)
      .on_size_change((size, cx) => {
        if (Math.abs(size.width - this.width) < 1) return;
        this.width = size.width;
        cx.notify();
      })
      .on_hover((hovered, cx) => {
        this.hovered = hovered;
        cx.notify();
      })
      .on_click(() => run("pane.focus", { pane }))
      .child(
        fill(
          [
            [0, 0],
            [slab, 0],
            [slab - SLANT, H],
            [0, H],
          ],
          on ? C.orange : C.slab,
        ),
      )
      .child(
        h_flex()
          .w(slab - SLANT - 6)
          .flex_none()
          .min_w(0)
          .pl(12)
          .gap(8)
          .items_center()
          .child(
            div()
              .flex_none()
              .font_family(MONO)
              .font_weight(700)
              .text_color(on ? C.ink : C.orange)
              .child(`PANE ${number}`),
          )
          .when(Boolean(p.program?.icon), (el) =>
            el.child(icon(p.program, 13, ink)),
          )
          .child(
            div()
              .flex_none()
              .max_w(200)
              .truncate()
              .font_weight(700)
              .text_color(on ? C.ink : C.text)
              .child(name.toUpperCase()),
          )
          .child(
            div()
              .flex_1()
              .min_w(0)
              .truncate()
              .font_weight(600)
              .text_color(ink)
              .child(folder(p.cwd).toUpperCase()),
          ),
      )
      .child(div().flex_1())
      .when(st === "blocked", (el) => el.child(warning(`ph-w-${pane}`)))
      .when(st === "working" || st === "done", (el) => el.child(badge(st)))
      .when(this.hovered, (el) =>
        el
          .child(
            this.button(t, `ph-r-${pane}`, "split-right", "pane.split", {
              direction: "right",
              pane,
            }),
          )
          .child(
            this.button(t, `ph-d-${pane}`, "split-down", "pane.split", {
              direction: "down",
              pane,
            }),
          )
          .child(
            this.button(
              t,
              `ph-z-${pane}`,
              p.zoomed ? "unzoom" : "zoom",
              "pane.zoom",
              { pane },
            ),
          )
          .child(
            this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane }),
          ),
      );
  }
}
