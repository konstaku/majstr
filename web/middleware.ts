import { NextRequest, NextResponse } from "next/server";

// ── Strict host separation ──────────────────────────────────────────────────
// One Next deployment serves two roles, split by host:
//   app.majstr.xyz   → interactive/authed app surfaces only  (the (app) group)
//   majstr.xyz / fr.majstr.xyz → public SEO catalogue only
// A path that belongs to the other host is 308-redirected there, so each host
// owns its path space (no duplicate-content, no SSO-less app pages on the apex).
//
// This replaces the next.config `SPA_ORIGIN` redirects (dropped at cutover).
// Phase 2 extends this same file with the host→country rewrite.
//
// Unknown hosts (localhost, *.vercel.app previews) get NO separation — every
// path is served — so local dev and preview deployments stay fully testable.

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

export function middleware(req: NextRequest): NextResponse {
  const host = (req.headers.get("host") || "").toLowerCase().split(":")[0];
  const onAppPath = isAppPath(req.nextUrl.pathname);

  // App host: only app surfaces; a catalogue path is redirected to the apex.
  if (host === APP_HOST) {
    return onAppPath ? NextResponse.next() : redirectToHost(req, "majstr.xyz");
  }

  // Catalogue hosts (apex + country): only catalogue; app paths go to the app host.
  if (CATALOGUE_HOSTS.has(host)) {
    return onAppPath ? redirectToHost(req, APP_HOST) : NextResponse.next();
  }

  // Unknown host (localhost, vercel preview) — no separation, serve everything.
  return NextResponse.next();
}

// Run on everything except Next internals, API routes, and static files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)"],
};
