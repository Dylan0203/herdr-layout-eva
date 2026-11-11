import { describe, it, expect } from "vitest";
import { look, loginCommand } from "../mods/eva-toast/look.js";

describe("look", () => {
  it("error 是會閃的紅色警告", () => {
    expect(look("error")).toEqual({
      kanji: "警告",
      word: "ALERT",
      plate: "red",
      ink: "white",
      blink: true,
    });
  });

  it("warning 是不閃的紅色注意", () => {
    expect(look("warning")).toEqual({
      kanji: "注意",
      word: "CAUTION",
      plate: "red",
      ink: "white",
      blink: false,
    });
  });

  it("success 是綠色完了，字用墨色", () => {
    expect(look("success")).toEqual({
      kanji: "完了",
      word: "CLEAR",
      plate: "green",
      ink: "ink",
      blink: false,
    });
  });

  it("info 是紫色通報", () => {
    expect(look("info")).toEqual({
      kanji: "通報",
      word: "NOTICE",
      plate: "purple",
      ink: "white",
      blink: false,
    });
  });

  it("不認得或沒給 level 時當成 info", () => {
    expect(look("debug")).toEqual(look("info"));
    expect(look(undefined)).toEqual(look("info"));
  });
});

describe("loginCommand", () => {
  it("從 Herdr 的登入提示取出指令", () => {
    expect(
      loginCommand("devbox needs login; run hc machine login devbox"),
    ).toEqual({
      machine: "devbox",
      command: "hc machine login devbox",
    });
  });

  it("兩個機器名稱不一致時不算", () => {
    expect(
      loginCommand("devbox needs login; run hc machine login other"),
    ).toBeNull();
  });

  it("一般內文或沒有內文時是 null", () => {
    expect(loginCommand("herdr-layout-eva / tb2")).toBeNull();
    expect(loginCommand(undefined)).toBeNull();
  });
});
