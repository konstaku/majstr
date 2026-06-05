// Central config. Server-side fetches hit the public API; SITE_URL is the
// canonical public origin used for canonical/hreflang/sitemap absolute URLs.

// Defensive: strip quotes, whitespace, and trailing commas/slashes that creep
// in via dashboard copy-paste (a trailing comma => ENOTFOUND at build time).
function cleanUrl(value: string | undefined, fallback: string): string {
  const raw = (value ?? fallback).trim().replace(/^["']|["']$/g, "");
  return raw.replace(/[\s,]+$/g, "").replace(/\/+$/g, "");
}

export const API_BASE = cleanUrl(process.env.API_BASE, "https://api.majstr.xyz");
export const SITE_URL = cleanUrl(
  process.env.NEXT_PUBLIC_SITE_URL,
  "https://majstr.xyz"
);

// ISR window for live-data fetches (seconds). On-demand revalidation can
// refresh sooner when a master is approved.
export const REVALIDATE_SECONDS = 3600;
