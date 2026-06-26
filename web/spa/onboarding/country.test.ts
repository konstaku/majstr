import { describe, it, expect } from "vitest";
import { resolveOnbCountry } from "./country";

describe("resolveOnbCountry", () => {
  it("reads the country from the Telegram start_param", () => {
    expect(resolveOnbCountry("", "onboard-uk-co-fr")).toBe("FR");
    expect(resolveOnbCountry("", "onboard-uk-co-fr-c-a1b2c3d4e5f6a7b8")).toBe("FR");
  });

  it("reads the country from the web fallback query", () => {
    expect(resolveOnbCountry("?country=FR", null)).toBe("FR");
    expect(resolveOnbCountry("?country=fr&via=tok", null)).toBe("FR");
  });

  it("prefers the explicit query over the start_param", () => {
    expect(resolveOnbCountry("?country=IT", "onboard-uk-co-fr")).toBe("IT");
  });

  it("defaults to IT when nothing is specified", () => {
    expect(resolveOnbCountry("", null)).toBe("IT");
    expect(resolveOnbCountry("", "onboard-uk")).toBe("IT");
    expect(resolveOnbCountry("", "onboard-uk-c-a1b2c3d4e5f6a7b8")).toBe("IT");
  });

  it("ignores an unknown country code", () => {
    expect(resolveOnbCountry("?country=zz", null)).toBe("IT");
    expect(resolveOnbCountry("", "onboard-uk-co-zz")).toBe("IT");
  });
});
