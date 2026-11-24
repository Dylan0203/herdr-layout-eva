import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fitFolder } from "../mods/eva-files/tree.js";

const e = (name, dir = false) => ({ name, dir });

describe("fitFolder", () => {
  // Herdr's script engine compares code points in localeCompare: "branch" sorts after "Brand".
  const real = String.prototype.localeCompare;
  beforeAll(() => { String.prototype.localeCompare = function (o) { return this < o ? -1 : this > o ? 1 : 0; }; });
  afterAll(() => { String.prototype.localeCompare = real; });

  // The shell lists in C-locale order: every uppercase name before any lowercase one.
  const listed = [e("Brand", true), e("CalculatorService", true), e("README.md"), e("branch-ordering", true), e("cart-optimization", true), e("app.rb")];

  it("資料夾在前、名稱不分大小寫排（像 Finder），不靠 localeCompare", () => {
    expect(fitFolder(listed, 100).map((x) => x.name)).toEqual(["branch-ordering", "Brand", "CalculatorService", "cart-optimization", "app.rb", "README.md"]);
  });

  it("額度不夠時先排序再截斷，小寫開頭的不會整批消失", () => {
    expect(fitFolder(listed, 3).map((x) => x.name)).toEqual(["branch-ordering", "Brand", "CalculatorService"]);
  });

  it("額度用完或是負的：空清單", () => {
    expect(fitFolder(listed, 0)).toEqual([]);
    expect(fitFolder(listed, -5)).toEqual([]);
  });
});
