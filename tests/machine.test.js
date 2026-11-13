import { describe, it, expect } from "vitest";
import {
  parseBattery,
  parseMemory,
  parseCpu,
  parseNet,
  parseThermal,
  netRate,
  formatBytes,
  snapshot,
  countdown,
  parseCharge,
  SEP,
} from "../mods/eva-chrome/machine.js";

describe("parseBattery", () => {
  it("插電時是外部電源", () => {
    const text =
      "Now drawing from 'AC Power'\n -InternalBattery-0 (id=23986275)\t70%; AC attached; not charging present: true";
    expect(parseBattery(text)).toEqual({
      percent: 70,
      external: true,
      remaining: null,
    });
  });

  it("放電時是內部電源並帶剩餘分鐘", () => {
    const text =
      "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=23986275)\t82%; discharging; 3:12 remaining present: true";
    expect(parseBattery(text)).toEqual({
      percent: 82,
      external: false,
      remaining: 192,
    });
  });

  it("還沒估算出時間時 remaining 是 null", () => {
    const text =
      "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t64%; discharging; (no estimate) present: true";
    expect(parseBattery(text)).toEqual({
      percent: 64,
      external: false,
      remaining: null,
    });
  });

  it("沒有電池的桌機只回報外部電源", () => {
    expect(parseBattery("Now drawing from 'AC Power'")).toEqual({
      percent: null,
      external: true,
      remaining: null,
    });
  });
});

describe("parseMemory", () => {
  it("用 free 百分比算出使用率，並讀出壓力等級", () => {
    const text =
      "The system has 34359738368 (2097152 pages with a page size of 16384).\nSystem-wide memory free percentage: 54%";
    expect(parseMemory(text, "1")).toEqual({ used: 46, pressure: "normal" });
    expect(parseMemory(text, "2").pressure).toBe("warn");
    expect(parseMemory(text, "4").pressure).toBe("critical");
  });

  it("讀不到時回 null", () => {
    expect(parseMemory("", "")).toBeNull();
  });
});

describe("parseCpu", () => {
  it("把各程序 %cpu 加總再除以核心數", () => {
    expect(parseCpu("10", " 120.5\n 80.0\n  0.0\n")).toBeCloseTo(20.05);
  });

  it("不超過 100%", () => {
    expect(parseCpu("2", "300\n")).toBe(100);
  });
});

describe("parseNet", () => {
  it("只讀 <Link#> 那列，不重複計算 IPv6 列", () => {
    const text = [
      "Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll",
      "en0        1500  <Link#14>   62:b7:45:00:01:60 62098239     0 52086794897 31569367     0 10307345294     0",
      "en0        1500  fe80::448:2 fe80:e::448:223a: 62098239     - 52086794897 31569367     - 10307345294     -",
    ].join("\n");
    expect(parseNet(text)).toEqual({ rx: 52086794897, tx: 10307345294 });
  });

  it("沒有介面時回 null", () => {
    expect(parseNet("")).toBeNull();
  });
});

describe("netRate", () => {
  it("用前後兩次取樣算每秒位元組", () => {
    const prev = { rx: 1000, tx: 500, at: 0 };
    const next = { rx: 11000, tx: 1500, at: 5000 };
    expect(netRate(prev, next)).toEqual({ rx: 2000, tx: 200 });
  });

  it("第一次取樣或計數器歸零時沒有速率", () => {
    expect(netRate(null, { rx: 1, tx: 1, at: 1 })).toBeNull();
    expect(
      netRate({ rx: 9, tx: 9, at: 0 }, { rx: 1, tx: 1, at: 5000 }),
    ).toBeNull();
  });
});

describe("parseThermal", () => {
  it("沒有紀錄時是正常", () => {
    const text =
      "Note: No thermal warning level has been recorded\nNote: No performance warning level has been recorded\nNote: No CPU power status has been recorded";
    expect(parseThermal(text)).toEqual({ throttled: false, limit: 100 });
  });

  it("CPU_Speed_Limit 低於 100 是降頻", () => {
    expect(parseThermal("CPU_Speed_Limit \t= 72")).toEqual({
      throttled: true,
      limit: 72,
    });
  });
});

describe("formatBytes", () => {
  it("用 K / M / G 縮寫", () => {
    expect(formatBytes(0)).toBe("0K");
    expect(formatBytes(340 * 1024)).toBe("340K");
    expect(formatBytes(1.25 * 1024 * 1024)).toBe("1.3M");
    expect(formatBytes(2 * 1024 ** 3)).toBe("2.0G");
  });
});

describe("snapshot", () => {
  it("把一次 shell 輸出拆成全部欄位", () => {
    const stdout = [
      "Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t70%; AC attached; not charging present: true",
      "System-wide memory free percentage: 54%",
      "1",
      "10",
      "50\n50",
      "en0  1500  <Link#14>  62:b7  1  0  6000  1  0  3000  0",
      "Note: No thermal warning level has been recorded",
    ].join(`\n${SEP}\n`);
    const prev = { net: { rx: 1000, tx: 1000, at: 0 } };
    const state = snapshot(stdout, prev, 5000);
    expect(state.battery.percent).toBe(70);
    expect(state.memory).toEqual({ used: 46, pressure: "normal" });
    expect(state.cpu).toBeCloseTo(10);
    expect(state.rate).toEqual({ rx: 1000, tx: 400 });
    expect(state.thermal.throttled).toBe(false);
  });
});

describe("battery deadline", () => {
  const batt = (est) => `Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t64%; discharging; ${est} present: true`;
  const out = (est) => [batt(est), "", "", "", "", "", ""].join(`\n${SEP}\n`);

  it("拿到估計值時設下截止時間", () => {
    expect(snapshot(out("3:12 remaining"), null, 1000).deadline).toBe(1000 + 192 * 60000);
  });

  it("10 分鐘內沿用原本的截止時間，不理會估計值的跳動", () => {
    const first = snapshot(out("3:12 remaining"), null, 0);
    expect(snapshot(out("2:00 remaining"), first, 9 * 60000).deadline).toBe(first.deadline);
  });

  it("滿 10 分鐘用新的估計值重新對時", () => {
    const first = snapshot(out("3:12 remaining"), null, 0);
    expect(snapshot(out("2:00 remaining"), first, 10 * 60000).deadline).toBe(10 * 60000 + 120 * 60000);
  });

  it("估計值暫時消失時沿用原本的截止時間", () => {
    const first = snapshot(out("3:12 remaining"), null, 0);
    expect(snapshot(out("(no estimate)"), first, 5000).deadline).toBe(first.deadline);
  });

  it("沒有估計值或插電時沒有截止時間", () => {
    expect(snapshot(out("(no estimate)"), null, 0).deadline).toBeNull();
    const first = snapshot(out("3:12 remaining"), null, 0);
    const ac = ["Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t64%; AC attached; not charging present: true", "", "", "", "", "", ""].join(`\n${SEP}\n`);
    expect(snapshot(ac, first, 5000).deadline).toBeNull();
  });
});

describe("countdown", () => {
  it("格式化成 HH:MM:SS，不會變成負數", () => {
    expect(countdown(3 * 3600000 + 12 * 60000 + 5000, 0)).toBe("03:12:05");
    expect(countdown(0, 5000)).toBe("00:00:00");
  });
});

describe("parseCharge", () => {
  const ioreg = (charging, power) =>
    `    "IsCharging" = ${charging}\n    "BatteryData" = {"CurrentCapacity"=32,"BatteryPower"=${power},"FullyCharged"=0}`;

  it("充電中回傳充進電池的瓦數", () => {
    expect(parseCharge(ioreg("Yes", 101199))).toBeCloseTo(101.199);
  });

  it("沒在充電就是 null", () => {
    expect(parseCharge(ioreg("No", 0))).toBeNull();
  });

  it("沒有電池（桌機）就是 null", () => {
    expect(parseCharge("")).toBeNull();
  });
});
