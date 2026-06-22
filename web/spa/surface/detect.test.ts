import { describe, it, expect, afterEach } from "vitest";
import { isTMA, getSurface } from "./detect";

describe("surface detection", () => {
  afterEach(() => {
    delete (window as unknown as { Telegram?: unknown }).Telegram;
  });

  it("is web when no Telegram bridge", () => {
    expect(isTMA()).toBe(false);
    expect(getSurface()).toBe("web");
  });

  it("is web when initData is empty", () => {
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: { initData: "" },
    };
    expect(isTMA()).toBe(false);
  });

  it("is tma when initData is a non-empty signed string", () => {
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: { initData: "user=%7B%7D&hash=abc" },
    };
    expect(isTMA()).toBe(true);
    expect(getSurface()).toBe("tma");
  });
});
