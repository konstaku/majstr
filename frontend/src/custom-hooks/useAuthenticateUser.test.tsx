import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../test/server";
import useAuthenticateUser from "./useAuthenticateUser";

const API = "http://localhost:5001";

const VALID_USER = {
  telegramID: 123,
  token: "jwt-abc",
  firstName: "Олена",
  lastName: "Ш",
  username: "olena",
  photo: null,
  isAdmin: false,
};

beforeEach(() => localStorage.clear());

describe("useAuthenticateUser", () => {
  it("starts in the loading state", () => {
    server.use(http.get(`${API}/auth`, () => HttpResponse.json(VALID_USER)));
    const { result } = renderHook(() => useAuthenticateUser());
    expect(result.current).toEqual({ user: null, loading: true, error: null });
  });

  it("resolves to the user on a valid 200", async () => {
    server.use(http.get(`${API}/auth`, () => HttpResponse.json(VALID_USER)));
    const { result } = renderHook(() => useAuthenticateUser());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toMatchObject({ telegramID: 123, firstName: "Олена" });
    expect(result.current.error).toBeNull();
  });

  it("flags an invalid payload shape as an error", async () => {
    server.use(
      http.get(`${API}/auth`, () => HttpResponse.json({ totally: "wrong" }))
    );
    const { result } = renderHook(() => useAuthenticateUser());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe("Invalid user data received");
  });

  it("treats 401 as a quiet not-logged-in state (no error, no redirect)", async () => {
    localStorage.setItem("token", JSON.stringify("stale"));
    server.use(http.get(`${API}/auth`, () => new HttpResponse(null, { status: 401 })));
    const { result } = renderHook(() => useAuthenticateUser());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ user: null, loading: false, error: null });
    // redirectOn401:false → the stored token must survive the probe
    expect(localStorage.getItem("token")).toBe(JSON.stringify("stale"));
  });

  it("surfaces network failures as an error message", async () => {
    server.use(http.get(`${API}/auth`, () => HttpResponse.error()));
    const { result } = renderHook(() => useAuthenticateUser());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.error).toMatch(/^Failed to authenticate/);
  });

  it("aborts the request on unmount without a state update crash", async () => {
    server.use(
      http.get(`${API}/auth`, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json(VALID_USER);
      })
    );
    const { unmount } = renderHook(() => useAuthenticateUser());
    unmount(); // abort fires; the hook must swallow the AbortError
    await new Promise((r) => setTimeout(r, 80));
  });
});
