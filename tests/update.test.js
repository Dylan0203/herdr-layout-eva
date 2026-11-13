import { describe, it, expect } from "vitest";
import {
  releaseVersion,
  isNewer,
  due,
  DAY,
} from "../mods/eva-chrome/update.js";
import { VERSION } from "../mods/eva-chrome/version.js";

describe("releaseVersion", () => {
  it("從 GitHub /releases/latest 的 tag_name 去掉 v", () => {
    const release = {
      tag_name: "v0.7.0",
      name: "v0.7.0",
      html_url: "https://github.com/x/y/releases/tag/v0.7.0",
      draft: false,
      prerelease: false,
    };
    expect(releaseVersion(release)).toBe("0.7.0");
  });

  it("沒有 tag 或格式不對就回 null（rate limit 的錯誤回應也是）", () => {
    expect(releaseVersion({ message: "API rate limit exceeded" })).toBeNull();
    expect(releaseVersion({ tag_name: "nightly" })).toBeNull();
    expect(releaseVersion(null)).toBeNull();
  });
});

describe("isNewer", () => {
  it("逐段用數字比", () => {
    expect(isNewer("0.10.0", "0.9.0")).toBe(true);
    expect(isNewer("1.0.0", "0.9.9")).toBe(true);
    expect(isNewer("0.6.0", "0.6.0")).toBe(false);
    expect(isNewer("0.5.9", "0.6.0")).toBe(false);
  });

  it("任一邊不知道就不算新", () => {
    expect(isNewer(null, "0.6.0")).toBe(false);
    expect(isNewer("0.7.0", undefined)).toBe(false);
  });
});

describe("due", () => {
  it("從沒檢查過就該檢查", () => {
    expect(due(null, 1000)).toBe(true);
    expect(due("garbage", 1000)).toBe(true);
  });

  it("一天內不重複檢查", () => {
    expect(due(0, DAY - 1)).toBe(false);
    expect(due(0, DAY)).toBe(true);
  });
});

describe("VERSION", () => {
  it("是 x.y.z 格式，不帶 v", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("VERSION vs git tags", () => {
  it("不比最新的 release tag 舊（忘了 bump 會讓每個人永遠收到更新通知）", async () => {
    const { execSync } = await import("node:child_process");
    const tag = execSync("git tag -l 'v*' --sort=-v:refname", { encoding: "utf8" }).split("\n")[0];
    if (!tag) return;
    expect(isNewer(tag.replace(/^v/, ""), VERSION)).toBe(false);
  });
});
