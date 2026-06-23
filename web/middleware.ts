import { NextRequest, NextResponse } from "next/server";
import { isLang, countryForHost } from "@/lib/i18n";

// ── Host separation + host→country rewrite ──────────────────────────────────
// One Next deployment serves two roles, split by host:
//   app.majstr.xyz   → interactive/authed app surfaces only  (the (app) group)
//   majstr.xyz / fr.majstr.xyz → public SEO catalogue only
// A path that belongs to the other host is 308-redirected there, so each host
// owns its path space (no duplicate-content, no SSO-less app pages on the apex).
//
// This replaces the next.config `SPA_ORIGIN` redirects (dropped at cutover).
//
// Phase 2 — host→country: catalogue routes live under an internal `[country]`
// segment (app/[country]/[lang]/...), but public URLs stay country-free. The
// host picks the country (majstr.xyz → it, fr.majstr.xyz → fr), and we REWRITE
// the country-free request onto the internal prefix (/uk/... → /it/uk/...). The
// internal prefix is what keeps two hosts on the same public path from sharing
// one SSG cache entry; the rewrite (not a redirect) keeps the public URL clean.
//
// Unknown hosts (localhost, *.vercel.app previews) get NO host separation —
// every app path is served — and default to Italy for the country rewrite, so
// local dev and preview deployments stay fully testable.

const APP_HOST = "app.majstr.xyz";
const CATALOGUE_HOSTS = new Set([
  "majstr.xyz",
  "www.majstr.xyz",
  "fr.majstr.xyz",
]);

// Path prefixes owned by the (app) surface group.
const APP_PREFIXES = [
  "/onboard",
  "/claim",
  "/my-cards",
  "/profile",
  "/login",
  "/add",
  "/admin",
];

function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function redirectToHost(req: NextRequest, targetHost: string): NextResponse {
  const url = req.nextUrl.clone();
  url.host = targetHost; // also clears any inherited port
  url.protocol = "https:";
  return NextResponse.redirect(url, 308);
}

// Rewrite a country-free catalogue path onto its internal [country] prefix.
//   majstr.xyz/uk/...     → /it/uk/...
//   fr.majstr.xyz/uk/...  → /fr/uk/...
function rewriteToCountry(req: NextRequest, host: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = `/${countryForHost(host)}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export function middleware(req: NextRequest): NextResponse {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  const { pathname } = req.nextUrl;
  const onAppPath = isAppPath(pathname);

  // App host: only app surfaces; a catalogue path is redirected to the apex.
  if (host === APP_HOST) {
    return onAppPath ? NextResponse.next() : redirectToHost(req, "majstr.xyz");
  }

  // App paths never belong on a catalogue host — bounce them to the app host.
  // Unknown hosts (dev/preview) skip this so every surface stays reachable.
  if (onAppPath) {
    return CATALOGUE_HOSTS.has(host)
      ? redirectToHost(req, APP_HOST)
      : NextResponse.next();
  }

  // Catalogue path: a lang-prefixed URL (/uk, /ru/milano, …) gets rewritten onto
  // the host's internal [country] segment. Everything else (e.g. "/", which
  // app/page.tsx redirects to /uk) passes through untouched.
  const seg1 = pathname.split("/")[1] ?? "";
  if (isLang(seg1)) return rewriteToCountry(req, host);

  return NextResponse.next();
}

// Run on everything except Next internals, API routes, and static files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)"],
};
