"use client";

import { apiFetch } from "../api/client";

// Community share-link referral (phase-2 endorsement). A link shared in a
// community group — fr.majstr.xyz/?via=<token> — should let anyone who arrives
// through it and submits a card get the "Рекомендовано спільнотою" badge on
// approval. The token has to survive the jump from the public site (Safari) to
// the Telegram Mini App (a separate webview that does NOT share localStorage),
// so we carry it two ways:
//   • web → localStorage capture here, read by the /add wizard fallback;
//   • web → bot: appended to the Telegram start_param, read in the Mini App.
// Either way the wizard posts it to /api/referral, which validates it
// server-side (the 48h TTL is enforced there, not trusted from the client).

const STORAGE_KEY = "majstr_via";
const TTL_MS = 48 * 60 * 60 * 1000; // mirror server-side window; UI-only hint

type Stored = { token: string; ts: number };

// Persist a token seen in ?via=, stamped with the capture time so a stale
// localStorage entry self-expires even if the server check is bypassed.
export function captureReferral(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, ts: Date.now() }));
  } catch {
    /* storage disabled — referral simply won't carry */
  }
}

// The captured token if still within the client-side window, else null
// (clearing an expired entry on the way out).
export function getActiveReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token, ts } = JSON.parse(raw) as Stored;
    if (!token || typeof ts !== "number" || Date.now() - ts > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function clearReferral(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

// Reads ?via= from the current URL, captures it, and strips it from the
// address bar (so a refresh/share doesn't re-broadcast it). Returns the token
// if one was present.
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const token = url.searchParams.get("via");
  if (!token) return null;
  captureReferral(token);
  url.searchParams.delete("via");
  window.history.replaceState({}, "", url.toString());
  return token;
}

// Pull a referral token out of a Telegram Mini App start_param, e.g.
// "onboard-fr-c-a1b2c3d4e5f6a7b8" → "a1b2c3d4e5f6a7b8". null if none.
export function tokenFromStartParam(sp: string | null | undefined): string | null {
  if (!sp) return null;
  const m = sp.match(/-c[-_]([a-z0-9]{8,40})\b/i);
  return m ? m[1] : null;
}

// Resolve the active token (Mini App start_param first, then web capture) and,
// if any, register it with the backend so a later submit attaches the badge.
// Best-effort and silent: never blocks or breaks onboarding.
export async function registerReferralIfAny(): Promise<void> {
  if (typeof window === "undefined") return;
  const fromTg = tokenFromStartParam(
    window.Telegram?.WebApp?.initDataUnsafe?.start_param,
  );
  const token = fromTg || getActiveReferral();
  if (!token) return;
  try {
    await apiFetch(
      "/api/referral",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      },
      { redirectOn401: false },
    );
    // Consumed — drop the web copy so it can't double-grant on a later visit.
    clearReferral();
  } catch {
    /* leave the token in place to retry on the next onboarding open */
  }
}
