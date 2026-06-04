// Central config. Server-side fetches hit the public API; SITE_URL is the
// canonical public origin used for canonical/hreflang/sitemap absolute URLs.

export const API_BASE = process.env.API_BASE ?? "https://api.majstr.xyz";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://majstr.xyz"
).replace(/\/$/, "");

// ISR window for live-data fetches (seconds). On-demand revalidation can
// refresh sooner when a master is approved.
export const REVALIDATE_SECONDS = 3600;
