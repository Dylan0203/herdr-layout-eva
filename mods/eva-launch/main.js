// 作戦開始: a full-window card played once when a new agent starts.
// Opened by eva-agents with props { name, pane }; closes itself after about
// 1.8 s, or on click. eva-agents skips it while MOTION is off.
// Layout is flex-centred: on_size_change reports unzoomed px, so px offsets
// drift off-centre at any zoom but 1.

import { View, div, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, closeOverlay } from "herdr";
import { C, MINCHO, MONO, fill } from "./eva.js";

// The card's one accent: bands, rules and the caption.
const ACCENT = C.white;

const IN = 320, // bands and title arrive
  HOLD = 1150, // then stay this long
  OUT = 300, // then fade
  BAND = 22;

// Accent-and-ink stripes clipped to the polygon.
const stripes = (points) => [
  fill(points, C.ink),
  fill(points, Background.pattern_slash(ACCENT, 5, 12)),
];

export default class Launch extends View {
  init(_props, cx) {
    this.stage = 0; // 0 before, 1 shown, 2 leaving
    this.size = { width: 1600, height: 1000 };
    cx.spawn(async (cx) => {
      await cx.sleep(16);
      this.stage = 1;
      cx.notify();
      await cx.sleep(IN + HOLD);
      this.stage = 2;
      cx.notify();
      await cx.sleep(OUT);
      this.close();
    });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    const id = props()?.overlay;
    if (id != null) closeOverlay(id);
  }

  // A hazard band the width of the window that slides in from one side.
  band(id, fromLeft) {
    const long = this.size.width * 3; // longer than any zoom makes the window
    const off = fromLeft ? -long : long;
    return div()
      .relative()
      .w_full()
      .h(BAND)
      .flex_none()
      .overflow_hidden()
      .child(
        div()
          .id(id)
          .absolute()
          .top(0)
          .w(long)
          .h(BAND)
          .left(this.stage === 0 ? off : -this.size.width)
          .transition("left", { duration: IN, easing: "ease-out" })
          .children(
            stripes([
              [0, 0],
              [long, 0],
              [long, BAND],
              [0, BAND],
            ]),
          ),
      );
  }

  // A thin orange rule that grows out from the centre.
  rule(id) {
    return h_flex()
      .w_full()
      .flex_none()
      .justify_center()
      .child(
        div()
          .id(id)
          .h(2)
          .w(this.stage === 0 ? 0 : this.size.width * 0.6)
          .bg(ACCENT)
          .transition("width", { duration: IN, delay: 80, easing: "ease-out" }),
      );
  }

  render() {
    const { width, height } = this.size;
    const p = props() ?? {};
    const name = (p.name || "AGENT").toUpperCase();
    const pane = p.pane ? `PANE ${String(p.pane).padStart(2, "0")}` : "";
    const big = Math.round(Math.min(height * 0.2, width * 0.13));
    return v_flex()
      .id("launch")
      .size_full()
      .overflow_hidden()
      .cursor_pointer()
      .on_size_change((size, cx) => {
        if (
          Math.abs(size.width - width) < 1 &&
          Math.abs(size.height - height) < 1
        )
          return;
        this.size = size;
        cx.notify();
      })
      .on_click(() => this.close())
      .child(
        v_flex()
          .id("launch-bg")
          .size_full()
          .justify_center()
          .gap(Math.round(big * 0.22))
          .bg(C.ink + "eb")
          .opacity(this.stage === 2 ? 0 : 1)
          .transition("opacity", { duration: OUT, easing: "ease-in" })
          .child(this.band("launch-band-top", true))
          .child(this.rule("launch-rule-top"))
          .child(
            v_flex()
              .id("launch-title")
              .w_full()
              .flex_none()
              .items_center()
              .gap(Math.round(big * 0.12))
              .opacity(this.stage === 1 ? 1 : 0)
              .transition("opacity", {
                duration: IN,
                delay: 120,
                easing: "ease-out",
              })
              .child(
                div()
                  .font_family(MINCHO)
                  .font_weight(900)
                  .text_size(big)
                  .line_height(1)
                  .text_color(C.white)
                  .child("作戦開始"),
              )
              .child(
                h_flex()
                  .gap(14)
                  .items_center()
                  .child(
                    div()
                      .text_size(Math.max(12, big * 0.13))
                      .font_weight(700)
                      .text_color(ACCENT)
                      .child("OPERATION START"),
                  )
                  .child(
                    div()
                      .font_family(MONO)
                      .text_size(Math.max(10, big * 0.09))
                      .text_color(C.muted)
                      .child([p.program?.toUpperCase(), name, pane].filter(Boolean).join("  /  ")),
                  ),
              ),
          )
          .child(this.rule("launch-rule-bottom"))
          .child(this.band("launch-band-bottom", false)),
      );
  }
}
