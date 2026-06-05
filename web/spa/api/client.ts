// Web-only API client for the Next app (no Telegram-surface coupling — that
// lives in the app routes which stay on the SPA in Phase A). Server-side reads
// are done in lib/; this is the client-side fetch used by reused components
// (e.g. Root's hydration-time refetch and auth-aware calls).
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.majstr.xyz";

export interface ApiOpts {
  redirectOn401?: boolean;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  _opts: ApiOpts = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("token");
      if (raw) {
        const token = JSON.parse(raw);
        if (token) headers.set("Authorization", token);
      }
    } catch {
      /* malformed stored token — treat as unauthenticated */
    }
  }
  return fetch(`${BASE}${path}`, { ...init, headers });
}
