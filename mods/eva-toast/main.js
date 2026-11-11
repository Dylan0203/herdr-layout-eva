// EVA notifications: chosen by the layout's root `"toast": "eva-toast"`.
// Herdr draws the 340×72 frame (rounded border, shadow); this fills it with a
// cut-corner level plate (警告 / 注意 / 完了 / 通報) and the title and body.
// Click runs the notification's action and closes it.

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run } from "herdr";
import { C, MINCHO, MONO, cut, fill, blink } from "./eva.js";
import { look, loginCommand } from "./look.js";

const PLATE_W = 58,
  PLATE_H = 50,
  NOTCH = 9;

export default class Toast extends View {
  plate(p, l) {
    const shape = cut(PLATE_W, PLATE_H, { tl: NOTCH, br: NOTCH });
    const el = v_flex()
      .relative()
      .w(PLATE_W)
      .h(PLATE_H)
      .flex_none()
      .items_center()
      .justify_center()
      .gap(3)
      .child(fill(shape, C[l.plate]))
      .child(
        div()
          .font_family(MINCHO)
          .font_weight(700)
          .text_size(19)
          .line_height(1)
          .text_color(C[l.ink])
          .child(l.kanji),
      )
      .child(
        div()
          .font_family(MONO)
          .font_weight(700)
          .text_size(7)
          .line_height(1)
          .text_color(C[l.ink])
          .child(l.word),
      );
    return l.blink ? blink(`toast-plate-${p.overlay}`, el) : el;
  }

  render() {
    const p = props() ?? {};
    const l = look(p.level);
    const login = loginCommand(p.body);
    const title = login
      ? `${login.machine} needs a login: run`
      : (p.title ?? "");
    return h_flex()
      .id("eva-toast")
      .size_full()
      .px(10)
      .gap(12)
      .items_center()
      .bg(C.deep)
      .cursor_pointer()
      .hover((s) => s.bg(C.slab))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(this.plate(p, l))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(4)
          .child(
            h_flex()
              .gap(6)
              .items_center()
              .min_w(0)
              .when(Boolean(p.icon), (el) =>
                el.child(image(p.icon).w(14).h(14).flex_none()),
              )
              .child(
                div()
                  .flex_1()
                  .min_w(0)
                  .truncate()
                  .font_family(MONO)
                  .font_weight(700)
                  .text_size(12)
                  .text_color(C.text)
                  .child(title.toUpperCase()),
              ),
          )
          .when(!login && Boolean(p.body), (el) =>
            el.child(
              div()
                .truncate()
                .font_family(MONO)
                .text_size(11)
                .text_color(C.muted)
                .child(p.body ?? ""),
            ),
          )
          .when(Boolean(login), (el) =>
            el.child(
              h_flex()
                .gap(8)
                .items_center()
                .child(
                  div()
                    .flex_1()
                    .min_w(0)
                    .truncate()
                    .tooltip(login.command)
                    .font_family(MONO)
                    .text_size(11)
                    .text_color(C.muted)
                    .child(login.command),
                )
                .child(
                  div()
                    .id("toast-login-copy")
                    .flex_none()
                    .px(6)
                    .py(2)
                    .border(1)
                    .border_color(C.purple)
                    .font_family(MONO)
                    .font_weight(700)
                    .text_size(10)
                    .text_color(C.white)
                    .hover((s) => s.bg(C.purple))
                    .on_click((_e, cx) => {
                      cx.stop_propagation();
                      cx.write_to_clipboard(login.command);
                      this.copied = true;
                      cx.notify();
                    })
                    .child(this.copied ? "COPIED" : "COPY"),
                ),
            ),
          )
          // A purple rule with a short level-colored lead.
          .child(
            h_flex()
              .h(2)
              .w_full()
              .child(
                div()
                  .w(22)
                  .h_full()
                  .flex_none()
                  .bg(C[l.plate === "purple" ? "white" : l.plate]),
              )
              .child(
                div()
                  .flex_1()
                  .h_full()
                  .bg(C.purple + "99"),
              ),
          ),
      );
  }
}
