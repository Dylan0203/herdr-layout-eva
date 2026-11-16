import { describe, expect, it } from "vitest";
import { appName, menuHeight, menuItems, pickApps } from "../mods/eva-files/open.js";

const HOME = "/Users/me";

describe("appName", () => {
  it("用 .app 資料夾名當顯示名稱", () => {
    expect(appName("/Applications/Visual Studio Code.app")).toBe(
      "Visual Studio Code",
    );
    expect(appName("/System/Applications/TextEdit.app/")).toBe("TextEdit");
  });
});

describe("pickApps", () => {
  const raw = {
    default: "/Applications/Obsidian.app",
    apps: [
      "/Applications/Obsidian.app",
      "/Applications/Zed.app",
      "/Applications/Xcode.app/Contents/Applications/Instruments.app",
      "/System/Applications/TextEdit.app",
      `${HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app`,
      `${HOME}/Applications/Tool.app`,
      "/Volumes/Old/Applications/Zed.app",
    ],
  };

  it("預設 app 排第一，只留一般 Applications 資料夾裡的 app", () => {
    expect(pickApps(raw, HOME)).toEqual([
      { path: "/Applications/Obsidian.app", name: "Obsidian", default: true },
      { path: "/Applications/Zed.app", name: "Zed", default: false },
      {
        path: "/System/Applications/TextEdit.app",
        name: "TextEdit",
        default: false,
      },
      { path: `${HOME}/Applications/Tool.app`, name: "Tool", default: false },
    ]);
  });

  it("預設 app 不在一般位置也照樣保留", () => {
    const apps = pickApps(
      { default: "/opt/Odd.app", apps: ["/Applications/Zed.app"] },
      HOME,
    );
    expect(apps.map((a) => a.name)).toEqual(["Odd", "Zed"]);
    expect(apps[0].default).toBe(true);
  });

  it("沒有預設 app、清單壞掉都不會丟錯", () => {
    expect(pickApps({ default: null, apps: [] }, HOME)).toEqual([]);
    expect(pickApps(null, HOME)).toEqual([]);
  });
});

describe("menuItems", () => {
  const file = { abs: "/repo/src/a.js", rel: "src/a.js", dir: false };
  const labels = (items) => items.map((i) => i.label);

  it("macOS 本機檔案：常用動作在上，其他 app 收在最後的 Open with", () => {
    const apps = [
      { path: "/Applications/Zed.app", name: "Zed", default: true },
      { path: "/System/Applications/TextEdit.app", name: "TextEdit", default: false },
    ];
    const items = menuItems({ ...file, mac: true, local: true, apps });
    expect(labels(items)).toEqual(["Open in Zed", "Reveal in Finder", "Copy path", "Copy relative path", "Open terminal here", "Open with", "TextEdit"]);
    expect(items[0].action).toEqual({ type: "exec", argv: ["open", "-a", "/Applications/Zed.app", "/repo/src/a.js"] });
    expect(items[1].action).toEqual({ type: "exec", argv: ["open", "-R", "/repo/src/a.js"] });
    expect(items[2].action).toEqual({ type: "copy", text: "/repo/src/a.js" });
    expect(items[3].action).toEqual({ type: "copy", text: "src/a.js" });
    expect(items[4].action).toEqual({ type: "terminal", folder: "/repo/src" });
    expect(items[5]).toMatchObject({ heading: true, action: null });
    expect(items[6].action).toEqual({ type: "exec", argv: ["open", "-a", "/System/Applications/TextEdit.app", "/repo/src/a.js"] });
  });

  it("app 清單還在讀：先用預設開啟，Open with 底下標載入中", () => {
    const items = menuItems({ ...file, mac: true, local: true, apps: null });
    expect(items[0]).toMatchObject({ label: "Open", action: { type: "exec", argv: ["open", "/repo/src/a.js"] } });
    expect(labels(items).slice(-2)).toEqual(["Open with", "Finding apps…"]);
    expect(items.at(-1).action).toBeNull();
  });

  it("只有預設 app 或一個都沒有：不出現 Open with", () => {
    const one = [{ path: "/Applications/Zed.app", name: "Zed", default: true }];
    expect(labels(menuItems({ ...file, mac: true, local: true, apps: one }))).not.toContain("Open with");
    expect(labels(menuItems({ ...file, mac: true, local: true, apps: [] }))[0]).toBe("Open");
  });

  it("資料夾：用 Finder 開，不列其他 app，terminal 開在資料夾本身", () => {
    const items = menuItems({ abs: "/repo/src", rel: "src", dir: true, mac: true, local: true, apps: [] });
    expect(labels(items)).toEqual(["Open in Finder", "Reveal in Finder", "Copy path", "Copy relative path", "Open terminal here"]);
    expect(items[0].action).toEqual({ type: "exec", argv: ["open", "/repo/src"] });
    expect(items.at(-1).action).toEqual({ type: "terminal", folder: "/repo/src" });
  });

  it("不是 macOS 或遠端機器：只剩複製路徑（本機才開 terminal）", () => {
    expect(labels(menuItems({ ...file, mac: false, local: true, apps: null }))).toEqual(["Copy path", "Copy relative path", "Open terminal here"]);
    expect(labels(menuItems({ ...file, mac: true, local: false, apps: null }))).toEqual(["Copy path", "Copy relative path"]);
  });

  it("每組開頭標 group，畫分隔線用", () => {
    const items = menuItems({ ...file, mac: true, local: true, apps: [] });
    expect(items.map((i) => i.group)).toEqual(["open", "open", "copy", "copy", "terminal"]);
  });
});

describe("menuHeight", () => {
  const item = (group, more) => ({ group, label: "x", action: {}, ...more });

  it("標題列 + 每列 30 + 換組分隔線 9 + 小標 22 + 上下 padding", () => {
    const items = [item("open"), item("open"), item("copy"), item("with", { heading: true, action: null }), item("with")];
    expect(menuHeight(items)).toBe(10 + 24 + 30 * 4 + 9 * 2 + 22);
  });

  it("app 很多時封頂，剩下的在選單裡捲", () => {
    const items = Array.from({ length: 40 }, () => item("with"));
    expect(menuHeight(items)).toBe(480);
  });
});
