// Thin GA4 (gtag) event wrapper for the public site. The gtag base snippet is
// loaded in app/[lang]/layout.tsx only when NEXT_PUBLIC_GA4_ID is set, so this
// is a no-op until analytics is configured — call sites never need to guard.
type Params = Record<string, unknown>;

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

export function track(event: string, params: Params = {}): void {
  if (typeof window === "undefined") return;
  (window as GtagWindow).gtag?.("event", event, params);
}
