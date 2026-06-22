// GA4 (gtag) for the interactive app surfaces. The app and the public web site
// share one GA4 property. Events fire only when NEXT_PUBLIC_GA4_ID is
// configured, so call sites never need to guard. initAnalytics() injects the
// gtag base snippet once; track() emits a custom event.
//
// NOTE: Telegram in-app webviews can restrict third-party requests. If GA4
// events don't appear in DebugView from inside Telegram, the claim/submit funnel
// is also persisted server-side (claim `source`), so the Day-4 gate survives.
type Params = Record<string, unknown>;

const GA_ID = process.env.NEXT_PUBLIC_GA4_ID;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function initAnalytics(): void {
  if (!GA_ID || typeof window === "undefined" || window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

export function track(event: string, params: Params = {}): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", event, params);
}
