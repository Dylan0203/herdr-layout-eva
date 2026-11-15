import { describe, it, expect } from "vitest";
import { toUnits } from "../mods/eva-chrome/eva.js";

describe("toUnits", () => {
  it("把 on_size_change 的視窗 px 換成 zoom 後的繪圖單位", () => {
    expect(toUnits(380, 1.25)).toBe(304);
    expect(toUnits(273.6, 0.9)).toBeCloseTo(304);
  });

  it("zoom 不存在、是 0 或不是數字時不換算", () => {
    expect(toUnits(304, undefined)).toBe(304);
    expect(toUnits(304, 0)).toBe(304);
    expect(toUnits(304, "auto")).toBe(304);
  });
});
