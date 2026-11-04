import { describe, it, expect } from "vitest";
import { claudeRate, codexRate, opencodeRate, elapsedMs } from "../mods/eva-agents/sync.js";

const line = (o) => JSON.stringify(o);
const assistant = (usage, extra = {}) => line({ type: "assistant", message: { model: "claude-opus-5-5", usage }, ...extra });

describe("claudeRate", () => {
  it("用最後一則主線 assistant 訊息算出剩餘比例", () => {
    const text = [
      assistant({ input_tokens: 10, cache_read_input_tokens: 0 }),
      assistant({ input_tokens: 100000, cache_read_input_tokens: 150000, cache_creation_input_tokens: 0 }),
    ].join("\n");
    expect(claudeRate(text, {})).toBeCloseTo(75);
  });

  it("略過 sidechain 與 synthetic 訊息", () => {
    const text = [
      assistant({ input_tokens: 500000 }),
      assistant({ input_tokens: 900000 }, { isSidechain: true }),
      line({ type: "assistant", message: { model: "<synthetic>", usage: { input_tokens: 999999 } } }),
    ].join("\n");
    expect(claudeRate(text, {})).toBeCloseTo(50);
  });

  it("尊重 settings 的 autoCompactWindow", () => {
    const text = assistant({ input_tokens: 100000 });
    expect(claudeRate(text, { autoCompactWindow: 200000 })).toBeCloseTo(50);
    expect(claudeRate(text, { modelSettings: { "claude-opus-5-5": { autoCompactWindow: 400000 } } })).toBeCloseTo(75);
  });

  it("沒有可用資料或壞掉的行時回傳 null", () => {
    expect(claudeRate("not json\n{}", {})).toBeNull();
  });

  it("超過 window 時夾在 0", () => {
    expect(claudeRate(assistant({ input_tokens: 2000000 }), {})).toBe(0);
  });
});

describe("codexRate", () => {
  it("用最後一個 token_count 事件", () => {
    const ev = (used) => line({ payload: { type: "token_count", info: { last_token_usage: { input_tokens: used }, model_context_window: 200000 } } });
    expect(codexRate([ev(10000), ev(50000)].join("\n"))).toBeCloseTo(75);
  });
});


describe("opencodeRate", () => {
  it("用 input + cache 算已用 context", () => {
    const tokens = { input: 3, output: 53, reasoning: 0, cache: { write: 535, read: 262462 } };
    expect(opencodeRate(tokens, 1050000)).toBeCloseTo(75, 0);
  });

  it("沒有 tokens 或 window 時回傳 null", () => {
    expect(opencodeRate(null, 1050000)).toBeNull();
    expect(opencodeRate({ input: 10 }, null)).toBeNull();
  });
});

describe("elapsedMs", () => {
  it("解析 macOS ps 的 etime 格式", () => {
    expect(elapsedMs("00:27")).toBe(27000);
    expect(elapsedMs("01:02:03")).toBe(3723000);
    expect(elapsedMs("2-01:00:00")).toBe((2 * 86400 + 3600) * 1000);
    expect(elapsedMs("  05:00\n")).toBe(300000);
  });
});
