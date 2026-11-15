import { describe, expect, it } from "vitest";
import { card, step } from "../mods/eva-switch/plan.js";

const claude = {
  address: "t1",
  space: "s1",
  status: "done",
  title: "fix login",
  program: { name: "Claude Code", agent: true },
};
const codex = {
  address: "t2",
  space: "s1",
  status: "working",
  title: "",
  program: { name: "Codex", agent: true },
};
const agents = [claude, codex];
const spaces = [
  { id: "s1", name: "api-service" },
  { id: "s2", name: "web-frontend" },
];
const at = (space, terminal, agent = null) => ({ space, terminal, agent });

describe("step", () => {
  it("第一次看到 focus：只記下來，不提示", () => {
    expect(step(null, at("s1", "t1"), agents)).toEqual({
      seen: { space: "s1", terminal: "t1" },
      hint: null,
    });
  });

  it("換 space：提示，帶上 focus 的 agent", () => {
    const { hint } = step(
      { space: "s1", terminal: "t1" },
      at("s2", "t2"),
      agents,
    );
    expect(hint).toEqual({ kind: "space", space: "s2", agent: "t2" });
  });

  it("換 space 但 focus 在 shell：提示，沒有 agent", () => {
    const { hint } = step(
      { space: "s1", terminal: "t1" },
      at("s2", "t9"),
      agents,
    );
    expect(hint).toEqual({ kind: "space", space: "s2", agent: null });
  });

  it("同 space 換到另一個 agent：提示", () => {
    const { hint } = step(
      { space: "s1", terminal: "t1" },
      at("s1", "t2"),
      agents,
    );
    expect(hint).toEqual({ kind: "agent", space: "s1", agent: "t2" });
  });

  it("同 space 換到 shell：不提示", () => {
    const { seen, hint } = step(
      { space: "s1", terminal: "t1" },
      at("s1", "t9"),
      agents,
    );
    expect(hint).toBeNull();
    expect(seen).toEqual({ space: "s1", terminal: "t9" });
  });

  it("focus 沒變：不提示", () => {
    expect(
      step({ space: "s1", terminal: "t1" }, at("s1", "t1"), agents).hint,
    ).toBeNull();
  });

  it("agent block 顯示的 agent 優先於 terminal", () => {
    const { hint } = step(
      { space: "s1", terminal: "t1" },
      at("s1", null, "t2"),
      agents,
    );
    expect(hint).toEqual({ kind: "agent", space: "s1", agent: "t2" });
  });

  it("沒有 focus（還沒載入）：維持原狀", () => {
    const seen = { space: "s1", terminal: "t1" };
    expect(step(seen, null, agents)).toEqual({ seen, hint: null });
  });
});

describe("card", () => {
  it("space 名稱與 agent 的程式、狀態、標題", () => {
    expect(card({ space: "s1", agent: "t1" }, spaces, agents)).toEqual({
      space: "api-service",
      agent: { name: "Claude Code", status: "done", title: "fix login" },
    });
  });

  it("沒有 agent", () => {
    expect(card({ space: "s2", agent: null }, spaces, agents)).toEqual({
      space: "web-frontend",
      agent: null,
    });
  });

  it("agent 已經不在了：當成沒有 agent", () => {
    expect(card({ space: "s1", agent: "t7" }, spaces, agents).agent).toBeNull();
  });
});
