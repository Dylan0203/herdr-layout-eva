// Shared EVA look. Each eva-* mod carries its own copy: mods load modules
// only from their own folder. Edit one, then copy it to the others.
import { div, PathBuilder, Background } from "gpui-kit";
import { shared, setShared } from "herdr";

export const C = {
  ink: "#0a0a0a",
  deep: "#101710",
  slab: "#172017",
  purple: "#436c35",
  orange: "#f5b44b",
  green: "#8cbe55",
  red: "#ef492f",
  white: "#ecebd5",
  text: "#e6e5d3",
  muted: "#b0b69b",
  dim: "#78856b",
};
export const MINCHO = "Hiragino Mincho ProN";
export const MONO = "JetBrains Mono";

// What each agent status reads as on screen.
export const LABEL = {
  working: "ACTIVE",
  blocked: "WARNING",
  done: "COMPLETE",
  idle: "STANDBY",
  unknown: "STANDBY",
};
export const TONE = {
  working: C.green,
  blocked: C.orange,
  done: C.white,
  idle: C.dim,
  unknown: C.dim,
};

// Animation is on unless the person turned it off (status bar: MOTION).
export const motion = () => shared("eva.motion") !== false;
export const toggleMotion = () => setShared("eva.motion", !motion());

// A w×h polygon with 45° cuts of the given size at each corner, in px.
export function cut(w, h, { tl = 0, tr = 0, br = 0, bl = 0 } = {}) {
  return [
    [tl, 0],
    [w - tr, 0],
    [w, tr],
    [w, h - br],
    [w - br, h],
    [bl, h],
    [0, h - bl],
    [0, tl],
  ];
}

// herdr also exports `window`; the drawing one is gpui-kit's global.
const paint = (path, bg) =>
  globalThis.window.paint_path(path, bg).absolute().inset_0();

export function fill(points, color) {
  return paint(PathBuilder.fill().add_polygon(points, true).build(), color);
}

export function stroke(points, color, width = 1) {
  return paint(
    PathBuilder.stroke(width).add_polygon(points, true).build(),
    color,
  );
}

// An open polyline (tick marks, underlines).
export function line(points, color, width = 1.5) {
  return paint(PathBuilder.stroke(width).add_polygon(points, false).build(), color);
}

// Orange/black hazard stripes clipped to the polygon.
export function hazard(points) {
  const path = () => PathBuilder.fill().add_polygon(points, true).build();
  return [paint(path(), C.ink), paint(path(), Background.pattern_slash(C.orange, 5, 12))];
}

// Fades `el` in and out while motion is on; still otherwise.
export function blink(id, el, period = 900) {
  return div()
    .id(id)
    .when(motion(), (d) => d.loop("opacity", { from: 0.35, to: 1, period }))
    .child(el);
}

// A small status badge: outlined, or filled for emphasis.
export function badge(status, { filled = false, size = 10 } = {}) {
  const tone = TONE[status] ?? C.dim;
  return div()
    .flex_none()
    .px(5)
    .h(size + 6)
    .flex()
    .items_center()
    .border(1)
    .border_color(tone)
    .when(filled, (d) => d.bg(tone).text_color(C.ink))
    .when(!filled, (d) => d.text_color(tone))
    .text_size(size)
    .font_weight(700)
    .child(LABEL[status] ?? "STANDBY");
}

// The blocked badge: hazard frame around WARNING, blinking.
export function warning(id, text = "WARNING", size = 10) {
  const w = text.length * (size * 0.72) + 16,
    h = size + 8;
  return blink(
    id,
    div()
      .relative()
      .w(w)
      .h(h)
      .flex_none()
      .children([
        ...hazard(cut(w, h)),
        div().absolute().top(2).left(3).right(3).bottom(2).bg(C.ink),
        div()
          .absolute()
          .inset_0()
          .flex()
          .items_center()
          .justify_center()
          .text_size(size)
          .font_weight(700)
          .text_color(C.orange)
          .child(text),
      ]),
  );
}
