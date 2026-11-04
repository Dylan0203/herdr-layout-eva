// EVA status bar, cloned from the shipped `workspace-status` mod.
// Machine and branch chips, the agent count, a blinking NEEDS YOU when an
// agent is blocked, the MOTION toggle and the palette key.
import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, run, window, keys } from "herdr";
import { C, MONO, motion, toggleMotion, warning } from "./eva.js";


export default class EvaStatus extends View {
  // The palette as actually bound: this layout's own palette mod if keys.json
  // gives it one (`layout:eva`: "mod.open:<a palette mod>"), else Herdr's.
  palette() {
    const all = keys();
    return all.find((k) => k.section === "layout:eva" && /^mod\.open:.*palette/.test(k.action))
      ?? all.find((k) => k.section === "global" && k.action === "app.palette");
  }

  openPalette() {
    const action = this.palette()?.action ?? "app.palette";
    const [name, value] = action.split(/:(.*)/);
    run(name, value ? { name: value } : {});
  }

  hint() {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = this.palette();
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  COMMANDS` : "COMMANDS";
  }

  render() {
    const space = spaces().find((s) => s.active);
    const list = agents();
    const needs = list.filter((a) => a.status === "blocked").length;
    const chip = (icon, text) => h_flex().h(18).px(8).gap(6).items_center().border(1).border_color(C.purple)
      .child(svg(`mods/workspace-chrome/${icon}.svg`).size(12)).child(text.toUpperCase());
    return h_flex().size_full().px(12).gap(10).items_center().border_t(1).border_color("#f5b44b80")
      .text_size(10.5).font_weight(700).text_color(C.muted)
      .child(chip(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), (el) => el.child(h_flex().gap(6).items_center().text_color(C.dim)
        .child(svg("mods/workspace-chrome/branch.svg").size(12)).child(space.branch.toUpperCase())))
      .child(div().flex_1())
      .child(h_flex().h(18).px(8).items_center().gap(4).bg(C.ink).border(1).border_color(C.green).text_color(C.green)
        .child("AGENTS").child(div().font_family(MONO).child(String(list.length).padStart(2, "0"))))
      .when(needs > 0, (el) => el.child(warning("needs-you", `${needs} NEEDS YOU`, 9.5)))
      .child(div().id("motion").px(6).text_color(motion() ? C.orange : C.dim).hover((s) => s.text_color(C.white))
        .on_click(() => toggleMotion()).child(motion() ? "MOTION ON" : "MOTION OFF"))
      .child(div().id("palette").text_color(C.dim).hover((s) => s.text_color(C.white))
        .on_click(() => this.openPalette()).child(this.hint()));
  }
}
