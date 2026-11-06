import { describe, it, expect } from "vitest";
import {
  claudeRate,
  codexRate,
  opencodeRate,
  elapsedMs,
  countCompacts,
  formatSize,
} from "../mods/eva-agents/sync.js";

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

  it('autoCompactWindow 不是正數（例如 "auto"）時往下退回預設 window', () => {
    const text = assistant({ input_tokens: 250000 });
    expect(
      claudeRate(text, {
        modelSettings: { "claude-opus-5-5": { autoCompactWindow: "auto" } },
      }),
    ).toBeCloseTo(75);
    expect(
      claudeRate(text, {
        modelSettings: { "claude-opus-5-5": { autoCompactWindow: "auto" } },
        autoCompactWindow: 500000,
      }),
    ).toBeCloseTo(50);
    expect(claudeRate(text, { autoCompactWindow: null })).toBeCloseTo(75);
  });

  it("usage 缺欄位時回傳 null，不是 NaN", () => {
    expect(claudeRate(assistant({ output_tokens: 10 }), {})).toBeNull();
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

describe("countCompacts", () => {
  it("只算真正的 compact_boundary 系統訊息", () => {
    const text = [
      line({
        type: "system",
        subtype: "compact_boundary",
        compactMetadata: { trigger: "auto", preTokens: 414391 },
      }),
      line({
        type: "user",
        message: { content: 'grep "subtype":"compact_boundary"' },
      }),
      line({
        type: "system",
        subtype: "compact_boundary",
        compactMetadata: { trigger: "manual" },
      }),
      '{"type":"system","subtype":"compact_bou', // a line cut by the scan window
    ].join("\n");
    expect(countCompacts(text)).toBe(2);
  });

  it("沒有就是 0", () => {
    expect(countCompacts("")).toBe(0);
  });
});

describe("formatSize", () => {
  it("用 K / M / G 縮寫檔案大小", () => {
    expect(formatSize(980 * 1024)).toBe("980K");
    expect(formatSize(46979688)).toBe("45M");
    expect(formatSize(489 * 1024 ** 2)).toBe("489M");
    expect(formatSize(4.7 * 1024 ** 3)).toBe("4.7G");
  });
});
