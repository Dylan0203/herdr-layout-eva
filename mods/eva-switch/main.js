// eva-switch: an EVA card near the top center naming where focus went.
// As a 0px layout block with props { watch: true }: checks focused() every
// 200 ms and, on a space change or a move to a different agent, opens itself
// as a frameless window. A 0px block is never rendered, so it can't wait for
// live-data redraws; the check reads only and never redraws.
// As that window (props { hint }): a transparent full-width strip TOP px down,
// with the card centered in it (no window size is known to center it by `at`).
// Hazard bands slide in around the space name and the agent's program, live
// status and title, then it fades and closes. A click on the strip closes it
// early. With MOTION off it appears and leaves without animating.

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import {
  agents,
  closeOverlay,
  focused,
  openOverlay,
  props,
  spaces,
} from "herdr";
import { C, MINCHO, MONO, badge, hazard, motion } from "./eva.js";
import { card, step } from "./plan.js";

const TOP = 64;
const BAND = 6;
const ROW = 64;
const HEIGHT = ROW + 2 * BAND;
const LONG = 3000; // stripe length, wider than any card
const CHECK_MS = 200;
const IN = 250, // bands and text arrive
  HOLD = 900, // then stay this long
  OUT = 250; // then fade

const TITLE = {
  space: ["区画移行", "SPACE TRANSFER"],
  agent: ["接続切替", "AGENT SWITCH"],
};

export default class SwitchHint extends View {
  init(_props, cx) {
    // Layout blocks hand their props through props(), not init's argument.
    const p = props() ?? {};
    this.watch = Boolean(p.watch);
    this.hint = p.hint ?? null;
    this.seen = null;
    this.open = null;
    if (this.watch) cx.timer.every(CHECK_MS, () => this.check());
    if (this.hint) this.play(cx);
  }

  check() {
    const { seen, hint } = step(this.seen, focused(), agents());
    this.seen = seen;
    if (!hint) return;
    if (this.open) closeOverlay(this.open);
    this.open = openOverlay({
      mod: "eva-switch",
      kind: "window",
      frame: "none",
      width: 1,
      height: HEIGHT,
      at: { x: 0, y: TOP },
      props: { hint },
    });
  }

  play(cx) {
    this.animate = motion();
    this.stage = this.animate ? 0 : 1; // 0 before, 1 shown, 2 leaving
    cx.spawn(async (cx) => {
      if (this.animate) {
        await cx.sleep(16);
        this.stage = 1;
        cx.notify();
      }
      await cx.sleep(IN + HOLD);
      this.stage = 2;
      cx.notify();
      if (this.animate) await cx.sleep(OUT);
      this.dismiss();
    });
  }

  dismiss() {
    if (this.closed) return;
    this.closed = true;
    closeOverlay(props().overlay);
  }

  ms(n) {
    return this.animate ? n : 0;
  }

  // A hazard band the card's width that slides in from one side.
  band(id, fromLeft) {
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
          .w(LONG)
          .h(BAND)
          .left(this.stage === 0 ? (fromLeft ? -LONG : LONG) : -LONG / 3)
          .transition("left", { duration: this.ms(IN), easing: "ease-out" })
          .children(
            hazard([
              [0, 0],
              [LONG, 0],
              [LONG, BAND],
              [0, BAND],
            ]),
          ),
      );
  }

  render() {
    return this.hint ? this.strip() : div().size(0);
  }

  strip() {
    return h_flex()
      .id("eva-switch")
      .size_full()
      .justify_center()
      .cursor_pointer()
      .on_click(() => this.dismiss())
      .child(this.card());
  }

  card() {
    const c = card(this.hint, spaces(), agents());
    const a = c.agent;
    const [jp, en] = TITLE[this.hint.kind] ?? TITLE.space;
    const rule = () =>
      div()
        .w(1)
        .h(36)
        .flex_none()
        .bg(C.dim + "88");
    const label = v_flex()
      .flex_none()
      .gap(4)
      .child(
        div()
          .font_family(MINCHO)
          .font_weight(900)
          .text_size(22)
          .line_height(1)
          .text_color(C.white)
          .child(jp),
      )
      .child(
        div().text_size(9.5).font_weight(700).text_color(C.orange).child(en),
      );
    const name = div()
      .flex_none()
      .max_w(520)
      .truncate()
      .text_size(30)
      .font_weight(900)
      .line_height(1)
      .text_color(C.white)
      .child(c.space.toUpperCase());
    const agent = a
      ? v_flex()
          .flex_none()
          .gap(5)
          .child(
            h_flex()
              .gap(8)
              .items_center()
              .child(
                div()
                  .font_family(MONO)
                  .text_size(12)
                  .text_color(C.muted)
                  .child(a.name.toUpperCase()),
              )
              .child(badge(a.status, { filled: true })),
          )
          .when(Boolean(a.title), (el) =>
            el.child(
              div()
                .max_w(240)
                .truncate()
                .font_family(MONO)
                .text_size(11)
                .text_color(C.dim)
                .child(a.title),
            ),
          )
      : null;
    return v_flex()
      .flex_none()
      .h_full()
      .overflow_hidden()
      .bg(C.ink + "eb")
      .opacity(this.stage === 2 ? 0 : 1)
      .transition("opacity", { duration: this.ms(OUT), easing: "ease-in" })
      .child(this.band("switch-band-top", true))
      .child(
        h_flex()
          .id("switch-row")
          .h(ROW)
          .px(24)
          .gap(20)
          .items_center()
          .opacity(this.stage === 1 ? 1 : 0)
          .transition("opacity", {
            duration: this.ms(IN),
            delay: this.ms(80),
            easing: "ease-out",
          })
          .child(label)
          .child(rule())
          .child(name)
          .when(Boolean(agent), (el) => el.child(rule()).child(agent)),
      )
      .child(this.band("switch-band-bottom", false));
  }
}
