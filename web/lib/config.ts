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

// Per-country public origin. Public URLs are country-free (the same path lives
// on every host); the host is the country, so canonical/hreflang/sitemap must
// pin each country's pages to its own origin. SITE_URL stays the IT origin.
export const COUNTRY_ORIGIN: Record<"it" | "fr", string> = {
  it: SITE_URL,
  fr: cleanUrl(process.env.NEXT_PUBLIC_SITE_URL_FR, "https://fr.majstr.xyz"),
};

// ISR window for live-data fetches (seconds). On-demand revalidation can
// refresh sooner when a master is approved.
export const REVALIDATE_SECONDS = 3600;
