import { describe, it, expect, vi, beforeEach } from "vitest";

// A plain recorder, not vi.fn: vi.fn reports a rejected result as unhandled even
// when the caller catches it.
const calls = [];
let answer = async () => ({ stdout: "" });
vi.mock("herdr", () => ({
  terminals: () => [],
  exec: (...args) => {
    calls.push(args);
    return answer(...args);
  },
  home: () => "/nonexistent",
  readTextFile: async () => null,
}));

const { transcript } = await import("../mods/eva-agents/sync.js");

const compact = JSON.stringify({ type: "system", subtype: "compact_boundary" });
const isStat = (cmd) => cmd === "stat";
const script = (args) => args[1];

// Answers stat with `size`, and every scan with `lines` compactions (or a rejection).
function machine({ size, lines = 0, scan }) {
  answer = async (cmd, args, options) => {
    if (isStat(cmd)) return { stdout: String(size()) };
    if (scan) return scan(args, options);
    return { stdout: Array(lines).fill(compact).join("\n") };
  };
}

let n = 0;
const file = () => `/t/${++n}.jsonl`;

const scansRun = () => calls.filter(([cmd]) => !isStat(cmd));

beforeEach(() => {
  calls.length = 0;
});

describe("transcript", () => {
  it("第一次直接 grep 整個檔案，並給 exec 最長的 timeout", async () => {
    machine({ size: () => 4e9, lines: 3 });
    expect(await transcript(file())).toEqual({ compacts: 3, bytes: 4e9 });
    const [, args, options] = scansRun()[0];
    expect(script(args)).toContain('grep -F -- "$1" "$2"');
    expect(script(args)).not.toContain("head -c");
    expect(options).toEqual({ timeout: 600000 });
  });

  it("之後只掃新增的位元組，累加次數", async () => {
    let size = 1000;
    machine({ size: () => size, lines: 2 });
    const f = file();
    await transcript(f);
    size = 1500;
    expect(await transcript(f)).toEqual({ compacts: 4, bytes: 1500 });
    const [, args] = scansRun().at(-1);
    expect(args.slice(3)).toEqual([
      "1001",
      f,
      "500",
      '"subtype":"compact_boundary"',
    ]);
  });

  it("大小沒變時不再掃描", async () => {
    machine({ size: () => 1000, lines: 1 });
    const f = file();
    await transcript(f);
    calls.length = 0;
    expect(await transcript(f)).toEqual({ compacts: 1, bytes: 1000 });
    expect(scansRun()).toHaveLength(0);
  });

  it("第一次掃描逾時就記下來，之後不再重掃整份，但仍回報大小", async () => {
    let size = 5e9;
    machine({
      size: () => size,
      scan: () => {
        throw new Error("timed out");
      },
    });
    const f = file();
    expect(await transcript(f)).toEqual({ compacts: null, bytes: 5e9 });
    calls.length = 0;
    size = 5.1e9;
    expect(await transcript(f)).toEqual({ compacts: null, bytes: 5.1e9 });
    expect(scansRun()).toHaveLength(0);
  });

  it("增量掃描失敗時保留原本的次數，下次重試同一段", async () => {
    let size = 1000;
    let fail = false;
    machine({
      size: () => size,
      scan: async () =>
        fail ? Promise.reject(new Error("boom")) : { stdout: compact },
    });
    const f = file();
    await transcript(f);
    size = 2000;
    fail = true;
    expect(await transcript(f)).toEqual({ compacts: 1, bytes: 2000 });
    fail = false;
    await transcript(f);
    const [, args] = scansRun().at(-1);
    expect(args.slice(3, 6)).toEqual(["1001", f, "1000"]);
  });

  it("檔案變小代表換了新檔，重新整份掃", async () => {
    let size = 2000;
    machine({ size: () => size, lines: 2 });
    const f = file();
    await transcript(f);
    size = 300;
    expect(await transcript(f)).toEqual({ compacts: 2, bytes: 300 });
    const [, args, options] = scansRun().at(-1);
    expect(script(args)).not.toContain("head -c");
    expect(options).toEqual({ timeout: 600000 });
  });
});
