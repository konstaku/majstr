import { describe, it, expect, beforeEach } from "vitest";
import {
  tokenFromStartParam,
  captureReferral,
  getActiveReferral,
  clearReferral,
} from "./referral";

describe("tokenFromStartParam", () => {
  it("extracts the token after -c-", () => {
    expect(tokenFromStartParam("onboard-fr-c-a1b2c3d4e5f6a7b8")).toBe(
      "a1b2c3d4e5f6a7b8",
    );
  });

  it("ignores a plain onboarding param", () => {
    expect(tokenFromStartParam("onboard-fr")).toBeNull();
  });

  it("does not confuse the claim param", () => {
    expect(
      tokenFromStartParam("claim-0123456789abcdef01234567"),
    ).toBeNull();
  });

  it("is null for empty input", () => {
    expect(tokenFromStartParam(null)).toBeNull();
    expect(tokenFromStartParam(undefined)).toBeNull();
  });
});

describe("localStorage capture + TTL", () => {
  // happy-dom in this setup doesn't ship a localStorage; provide a minimal
  // Map-backed stub so the capture/TTL branches are exercised.
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    clearReferral();
  });

  it("round-trips a fresh token", () => {
    captureReferral("tok123");
    expect(getActiveReferral()).toBe("tok123");
  });

  it("drops a token older than the 48h window", () => {
    const old = Date.now() - 49 * 60 * 60 * 1000;
    window.localStorage.setItem("majstr_via", JSON.stringify({ token: "stale", ts: old }));
    expect(getActiveReferral()).toBeNull();
    expect(window.localStorage.getItem("majstr_via")).toBeNull();
  });
});
