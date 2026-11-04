import { div, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, spaces, shared, setShared } from "herdr";
import { C, MINCHO, MONO, line, motion, fill, cut } from "./eva.js";

// Click the field to hold it still; MOTION off stills it too. Kept across restarts.
const flowing = () => shared("eva.signal") !== false;
const toggleSignal = () => setShared("eva.signal", !flowing());

const PAD = 0.5, TRAVEL = 0.6, SPAN = 1 + TRAVEL + 2 * PAD;

function signal(width, height) {
  const w = Math.max(100, width);
  const paths = [];
  for (const [index, color, phase, period] of [[0, C.orange, 0, 42000], [1, "#9a6bd6", 1.8, 57000]]) {
    const strands = [];
    for (let strand = 0; strand < 24; strand++) {
      // Strands run SPAN field widths, starting PAD before the field, so their ends stay hidden.
      const points = Array.from({ length: 121 }, (_, i) => {
        const x = i / 120 * SPAN;
        return [x * w, height / 2 + Math.sin(x * Math.PI * 2 + phase + strand * 0.12) * height * 0.48];
      });
      strands.push(line(points, color + "b8", 0.7));
    }
    // The id carries the width so the loop restarts with new bounds after a resize.
    paths.push(div().id(`signal-wave-${index}-${Math.round(w)}`).absolute().left(-PAD * w).top(0).w(w * SPAN).h(height)
      .when(motion() && flowing(), el => el.loop("left", {
        from: index ? -(PAD + TRAVEL) * w : -PAD * w,
        to: index ? -PAD * w : -(PAD + TRAVEL) * w,
        period,
        easing: "ease-in-out",
      })).children(strands));
  }
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * w;
    paths.push(line([[x, 0], [x, 5]], C.muted, 1));
    paths.push(line([[x, height - 5], [x, height]], C.muted, 1));
    if (i > 0 && i < 8) {
      paths.push(line([[x - 3, height / 2], [x + 3, height / 2]], C.dim, 0.7));
      paths.push(line([[x, height / 2 - 3], [x, height / 2 + 3]], C.dim, 0.7));
    }
  }
  return div().relative().w_full().h(height).overflow_hidden().children(paths);
}

function triad(working, blocked, standby, compact) {
  const width = compact ? 248 : 316;
  const cellWidth = compact ? 110 : 132;
  const cellHeight = compact ? 46 : 52;
  const bottom = cellHeight + 8;
  const right = width - cellWidth;
  const center = (width - cellWidth) / 2;
  const cell = (name, count, x, y, tone) => div().absolute().left(x).top(y).w(cellWidth).h(cellHeight)
    .border(1.5).border_color(tone).bg("#0f0a18").px(9)
    .child(h_flex().h_full().gap(9).items_center()
      .child(div().font_family("Digital-7 Mono").text_size(compact ? 36 : 50).line_height(1).text_color(tone).child(String(count).padStart(2, "0")))
      .child(div().text_size(compact ? 9 : 11).font_weight(700).text_color(tone).child(name)));
  return div().relative().w(width).h(bottom + cellHeight).flex_none()
    .child(line([[cellWidth / 2, cellHeight / 2], [right + cellWidth / 2, cellHeight / 2], [width / 2, bottom + cellHeight / 2], [cellWidth / 2, cellHeight / 2]], C.green, 5))
    .child(cell("ACTIVE", working, 0, 0, C.green))
    .child(cell("HOLD", blocked, right, 0, blocked ? C.red : C.dim))
    .child(cell(compact ? "IDLE" : "STANDBY", standby, center, bottom, C.orange));
}

export function commandDeck(view) {
  const list = agents();
  const working = list.filter(a => a.status === "working").length;
  const blocked = list.filter(a => a.status === "blocked").length;
  const standby = list.filter(a => a.status !== "working" && a.status !== "blocked").length;
  const current = spaces().find(s => s.active);
  return v_flex().id("command-deck").size_full().bg("#0f0a189e").overflow_hidden().border_b(2).border_color(C.purple)
    .on_size_change((size, cx) => {
      if (Math.abs(size.width - view.deckWidth) < 1) return;
      view.deckWidth = size.width;
      cx.notify();
    })
    // The strip is a warning light: a red rule while agents run on their own, solid red when one needs you.
    .child(h_flex().h(18).flex_none().bg(blocked ? C.red : C.deep).border_b(1).border_color(C.red).px(12).items_center().gap(12).text_size(10).font_weight(700).text_color(blocked ? C.ink : C.red)
      .child(div().child("HERDR / COMMAND INTERFACE"))
      .child(div().flex_1().truncate().child(`作戦区域  ${current?.name?.toUpperCase() ?? "NO ACTIVE SPACE"}`))
      .child(div().child(blocked ? "人間の判断が必要 / ACTION REQUIRED" : "自律運転 / AUTONOMOUS OPERATION")))
    .child(h_flex().flex_1().min_h(0).px(16).gap(24).items_center()
      .when(view.deckWidth >= 1150, el => el.child(v_flex().w(255).h_full().flex_none().items_center().justify_center().gap(0)
        .child(div().font_family(MONO).text_size(9).text_color(C.orange).child("汎用作業支援システム / CONTROL 01"))
        .child(div().font_family(MINCHO).font_weight(900).text_size(43).line_height(1.2).text_color(C.white).child("中央管制"))
        .child(h_flex().gap(8).items_center()
          .child(div().h(5).w(33).bg(C.green))
          .child(div().text_size(11).font_weight(700).text_color(C.green).child("MULTI-AGENT OPERATIONS")))))
      .when(view.deckWidth >= 560, el => el.child(v_flex().flex_1().min_w(0).h_full().min_h(0).py(4).gap(3)
        .child(h_flex().h(10).flex_none().justify_between().text_size(8).font_family(MONO).text_color(C.muted)
          .child(div().child("SIGNAL FIELD / PHASE REFERENCE"))
          .child(div().child(flowing() ? "SCHEMATIC" : "SCHEMATIC / HOLD")))
        .child(div().id("signal-size").w_full().flex_1().min_h(0).border_y(1).border_color(C.dim)
          .cursor_pointer().on_click(toggleSignal)
          .on_size_change((size, cx) => {
            const height = Math.max(16, size.height - 2);
            if (Math.abs(size.width - view.signalWidth) < 1 && Math.abs(height - view.signalHeight) < 1) return;
            view.signalWidth = size.width;
            view.signalHeight = height;
            cx.notify();
          }).child(signal(view.signalWidth, view.signalHeight)))
        .child(h_flex().h(10).flex_none().justify_between().text_size(8).font_family(MONO).text_color(C.dim)
          .children(["−4", "−2", "0", "+2", "+4"].map(label => div().child(label))))))
      .when(view.deckWidth < 560, el => el.child(div().flex_1()))
      .child(v_flex().flex_none().px(24).gap(4)
        .child(div().font_family(MONO).text_size(9).text_color(C.orange).child(`DISTRIBUTED CONTROL · ${String(list.length).padStart(2, "0")} AGENTS`))
        .child(triad(working, blocked, standby, view.deckWidth < 800))))
    .child(div().relative().h(5).flex_none().child(fill(cut(view.deckWidth, 5), Background.pattern_slash(C.purple + "88", 6, 14))));
}
