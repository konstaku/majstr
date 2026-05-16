import { isTMA } from "../surface/detect";

const BASE = import.meta.env.VITE_API_URL;

export interface ApiOpts {
  // Centralised 401 handling. Mutation/protected flows want it (default).
  // Soft auth checks (e.g. useAuthenticateUser probing /auth) opt out so a
  // normal "not logged in" 401 doesn't trigger a redirect/close loop.
  redirectOn401?: boolean;
}

// Single fetch entry point. Adds the right auth header per surface:
//   TMA  -> X-Telegram-Init-Data (verified server-side via HMAC)
//   web  -> Authorization: <jwt from localStorage>
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  { redirectOn401 = true }: ApiOpts = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (isTMA()) {
    const initData = window.Telegram?.WebApp?.initData;
    if (initData) headers.set("X-Telegram-Init-Data", initData);
  } else {
    const raw = localStorage.getItem("token");
    if (raw) {
      try {
        const token = JSON.parse(raw);
        if (token) headers.set("Authorization", token);
      } catch {
        /* malformed stored token — treat as unauthenticated */
      }
    }
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && redirectOn401) {
    onUnauthorized();
  }
  return res;
}

// 401 means the session is dead. On TMA, closing forces Telegram to hand
// back fresh initData on next open. On web, drop the token and bounce to
// login (unless we're already there).
export function onUnauthorized(): void {
  if (isTMA()) {
    try {
      window.Telegram?.WebApp?.close();
    } catch {
      /* noop */
    }
    return;
  }
  localStorage.removeItem("token");
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}
