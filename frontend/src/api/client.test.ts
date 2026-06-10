import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import { apiFetch } from "./client";

const API = "http://localhost:5001";

// Assigned through `unknown` so the partial test double doesn't have to
// satisfy the full global TgWebApp type.
function setTelegram(webApp?: { initData?: string; close?: () => void }) {
  (window as unknown as { Telegram?: unknown }).Telegram = webApp
    ? { WebApp: webApp }
    : undefined;
}

// Captures the auth-relevant headers of the last request MSW saw.
function captureHeaders(path = "/probe") {
  const seen: { authorization: string | null; initData: string | null }[] = [];
  server.use(
    http.get(`${API}${path}`, ({ request }) => {
      seen.push({
        authorization: request.headers.get("Authorization"),
        initData: request.headers.get("X-Telegram-Init-Data"),
      });
      return HttpResponse.json({ ok: true });
    })
  );
  return seen;
}

beforeEach(() => {
  localStorage.clear();
  setTelegram(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiFetch — web surface", () => {
  it("sends the JSON-parsed localStorage token as Authorization", async () => {
    localStorage.setItem("token", JSON.stringify("jwt-abc"));
    const seen = captureHeaders();

    await apiFetch("/probe");
    expect(seen[0]).toEqual({ authorization: "jwt-abc", initData: null });
  });

  it("sends no auth header when the stored token is malformed JSON", async () => {
    localStorage.setItem("token", "{not json");
    const seen = captureHeaders();

    await apiFetch("/probe");
    expect(seen[0].authorization).toBeNull();
  });

  it("sends no auth header when there is no token", async () => {
    const seen = captureHeaders();
    await apiFetch("/probe");
    expect(seen[0].authorization).toBeNull();
  });

  it("drops the token on 401 (default redirect behavior)", async () => {
    localStorage.setItem("token", JSON.stringify("jwt-dead"));
    server.use(
      http.get(`${API}/probe`, () => new HttpResponse(null, { status: 401 }))
    );

    const res = await apiFetch("/probe");
    expect(res.status).toBe(401);
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("keeps the token on 401 when redirectOn401 is false", async () => {
    localStorage.setItem("token", JSON.stringify("jwt-dead"));
    server.use(
      http.get(`${API}/probe`, () => new HttpResponse(null, { status: 401 }))
    );

    const res = await apiFetch("/probe", {}, { redirectOn401: false });
    expect(res.status).toBe(401);
    expect(localStorage.getItem("token")).toBe(JSON.stringify("jwt-dead"));
  });
});

describe("apiFetch — Telegram Mini App surface", () => {
  it("sends initData as X-Telegram-Init-Data instead of Authorization", async () => {
    setTelegram({ initData: "query_id=AA&hash=ff", close: vi.fn() });
    localStorage.setItem("token", JSON.stringify("jwt-abc")); // must be ignored
    const seen = captureHeaders();

    await apiFetch("/probe");
    expect(seen[0]).toEqual({
      authorization: null,
      initData: "query_id=AA&hash=ff",
    });
  });

  it("closes the WebApp on 401 so Telegram re-issues fresh initData", async () => {
    const close = vi.fn();
    setTelegram({ initData: "query_id=AA&hash=ff", close });
    server.use(
      http.get(`${API}/probe`, () => new HttpResponse(null, { status: 401 }))
    );

    await apiFetch("/probe");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not close the WebApp when redirectOn401 is false", async () => {
    const close = vi.fn();
    setTelegram({ initData: "query_id=AA&hash=ff", close });
    server.use(
      http.get(`${API}/probe`, () => new HttpResponse(null, { status: 401 }))
    );

    await apiFetch("/probe", {}, { redirectOn401: false });
    expect(close).not.toHaveBeenCalled();
  });
});
