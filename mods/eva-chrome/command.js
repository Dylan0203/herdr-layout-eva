import { div, Background } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, spaces, shared, setShared } from "herdr";
import { C, MINCHO, MONO, line, motion, fill, cut } from "./eva.js";
import { machine, formatBytes, countdown } from "./machine.js";

// Hundredths for the 活動限界 clock: one lap a second, run natively by frames().
const CENTI = Array.from({ length: 50 }, (_, i) => `:${String(98 - i * 2).padStart(2, "0")}`);

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

// Host readouts. Green while healthy, red past a threshold; "--" until the first poll lands.
function gauge(percent, tone) {
  const lit = percent == null ? 0 : Math.round(percent / 10);
  return h_flex().gap(2).flex_none().children(Array.from({ length: 10 }, (_, i) =>
    div().w(6).h(9).when(i < lit, el => el.bg(tone)).when(i >= lit, el => el.border(1).border_color(C.dim))));
}

const digits = (text, tone) => div().font_family("Digital-7 Mono").text_size(17).line_height(1).text_color(tone).child(text);
const unit = (text, tone = C.muted) => div().font_family(MONO).text_size(9).text_color(tone).child(text);
const pct = (value) => (value == null ? "--" : String(Math.round(value)).padStart(2, "0"));

function host(m) {
  const row = (kanji, code, ...body) => h_flex().h(18).gap(8).items_center()
    .child(div().w(28).flex_none().font_family(MINCHO).font_weight(700).text_size(12).text_color(C.white).child(kanji))
    .child(div().w(30).flex_none().font_family(MONO).text_size(8).text_color(C.muted).child(code))
    .child(h_flex().flex_1().gap(6).items_center().children(body));
  const meter = (kanji, code, value, alarm) => {
    const tone = value == null ? C.dim : alarm ? C.red : C.green;
    return row(kanji, code, gauge(value, tone), digits(pct(value), tone), unit("%"));
  };
  const rate = (value) => {
    const text = value == null ? "--K" : formatBytes(value);
    return [digits(text.slice(0, -1), value == null ? C.dim : C.green), unit(text.slice(-1))];
  };
  const battery = m?.battery;
  const power = !battery || battery.external
    ? battery?.percent == null
      ? row("電源", "AC", unit("外部電源 / EXTERNAL", C.green))
      : m.charge == null
        ? meter("電源", "AC", battery.percent, false)
        : row("電源", "AC", gauge(battery.percent, C.green), digits(pct(battery.percent), C.green), unit("%"),
          digits(String(Math.round(m.charge)), C.green), unit("W"))
    : (() => {
      // On internal power the row grows into the 活動限界 clock: seconds from render, hundredths native.
      const tone = battery.percent < 20 ? C.red : C.green;
      const clock = m.deadline == null
        ? div().font_family(MINCHO).text_size(12).text_color(C.muted).child("計測中")
        : h_flex().items_end().gap(1)
          .child(div().font_family("Digital-7 Mono").text_size(23).line_height(1).text_color(tone).child(countdown(m.deadline, Date.now())))
          .child(div().id("countdown-centi").font_family("Digital-7 Mono").text_size(13).line_height(1).text_color(tone).frames(CENTI, 20));
      return h_flex().h(33).gap(8).items_center()
        .child(div().w(28).flex_none().font_family(MINCHO).font_weight(700).text_size(12).text_color(C.white).child("電源"))
        .child(v_flex().flex_1().gap(0)
          .child(h_flex().gap(6).items_center()
            .child(div().font_family(MINCHO).font_weight(700).text_size(10).text_color(tone).child("活動限界"))
            .child(unit(`内部電源 BATT ${battery.percent}%`, tone)))
          .child(clock));
    })();
  const thermal = m?.thermal;
  return v_flex().w(244).h_full().flex_none().justify_center().gap(2).px(14).bg("#0f0a18").border_l(1).border_color(C.dim)
    .child(div().font_family(MONO).text_size(9).text_color(C.orange).child("機体状態 / HOST"))
    .child(meter("演算", "CPU", m?.cpu, m?.cpu >= 90))
    .child(meter("記憶", "MEM", m?.memory?.used, m?.memory && m.memory.pressure !== "normal"))
    .child(row("通信", "NET", unit("↓"), ...rate(m?.rate?.rx), unit("↑"), ...rate(m?.rate?.tx)))
    .child(row("冷却", "THERM", unit(!thermal ? "--" : thermal.throttled ? `THROTTLED ${thermal.limit}%` : "NOMINAL", !thermal ? C.dim : thermal.throttled ? C.red : C.green)))
    .child(power);
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
      .when(view.deckWidth >= 1400, el => el.child(host(machine())))
      .child(v_flex().flex_none().px(24).gap(4)
        .child(div().font_family(MONO).text_size(9).text_color(C.orange).child(`DISTRIBUTED CONTROL · ${String(list.length).padStart(2, "0")} AGENTS`))
        .child(triad(working, blocked, standby, view.deckWidth < 800))))
    .child(div().relative().h(5).flex_none().child(fill(cut(view.deckWidth, 5), Background.pattern_slash(C.purple + "88", 6, 14))));
}
