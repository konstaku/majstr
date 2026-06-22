// @vitest-environment node
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function run(url: string, host: string) {
  const req = new NextRequest(new URL(url), { headers: { host } });
  return middleware(req);
}

const location = (url: string, host: string) =>
  run(url, host).headers.get("location");
const isRedirect = (url: string, host: string) => {
  const res = run(url, host);
  return res.status === 308 && !!res.headers.get("location");
};

describe("host-separation middleware", () => {
  it("app host: catalogue path → 308 to apex", () => {
    expect(isRedirect("https://app.majstr.xyz/uk/nice", "app.majstr.xyz")).toBe(true);
    expect(location("https://app.majstr.xyz/uk/nice", "app.majstr.xyz")).toBe(
      "https://majstr.xyz/uk/nice"
    );
  });

  it("app host: app path → passes through (no redirect)", () => {
    expect(location("https://app.majstr.xyz/onboard", "app.majstr.xyz")).toBeNull();
    expect(location("https://app.majstr.xyz/claim/abc123", "app.majstr.xyz")).toBeNull();
  });

  it("apex host: app path → 308 to app host", () => {
    expect(location("https://majstr.xyz/onboard", "majstr.xyz")).toBe(
      "https://app.majstr.xyz/onboard"
    );
    expect(location("https://majstr.xyz/my-cards", "majstr.xyz")).toBe(
      "https://app.majstr.xyz/my-cards"
    );
  });

  it("apex host: catalogue path → passes through", () => {
    expect(location("https://majstr.xyz/uk/nice", "majstr.xyz")).toBeNull();
    expect(location("https://majstr.xyz/", "majstr.xyz")).toBeNull();
  });

  it("country host (fr): app path → 308 to app host; catalogue passes", () => {
    expect(location("https://fr.majstr.xyz/login", "fr.majstr.xyz")).toBe(
      "https://app.majstr.xyz/login"
    );
    expect(location("https://fr.majstr.xyz/uk/paris", "fr.majstr.xyz")).toBeNull();
  });

  it("unknown host (localhost/preview): no separation — everything passes", () => {
    expect(location("http://localhost:3000/onboard", "localhost:3000")).toBeNull();
    expect(location("http://localhost:3000/uk/nice", "localhost:3000")).toBeNull();
  });

  it("preserves query string on cross-host redirects", () => {
    expect(
      location("https://majstr.xyz/login?token=x&path=my-cards", "majstr.xyz")
    ).toBe("https://app.majstr.xyz/login?token=x&path=my-cards");
  });
});
