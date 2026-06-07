# Meeting: Next.js web app load-speed optimization
Date: 2026-06-07

## What we discussed
Audited the `web/` Next.js app (the public SEO surface, separate from the Vite
SPA in `frontend/`) for mobile load speed. Ran a real `next build` to get hard
numbers, then implemented the two highest-impact tiers.

## Key findings (from a fresh production build)
- **Every page shipped the entire dataset.** `lib/seed.ts:buildSeed()` seeded all
  321 masters (incl. `about` bios + `contacts` PII) into MasterContext on every
  route → RSC/hydration payload ~398 KB on *every* page, even single-master
  detail pages (which were 519 KB HTML). This was the #1 problem.
- Fonts loaded via a render-blocking Google Fonts `<link>` (4 families, 2 extra
  round-trips). Local TTFs in `public/fonts/` were dead/unused.
- GTM loaded synchronously inline in `<head>`, blocking the parser.
- Images use CSS `background-image` with raw S3 URLs (no next/image) — deferred.
- `/og-image.png` and `/favicon.png` referenced in layout but 404 — deferred.
- First Load JS 160 KB (react-select is ~35 KB of it) — deferred.

## Decisions made
- **P0 — slim per-page seed.** Grid/cards only read 8 fields; `buildSeed` now
  ships a slim projection and drops `about`/`contacts`. The master detail page
  keeps its one open master full (4th arg `fullMasterId`) so its pre-opened modal
  still SSR-renders complete. Confirmed only `about`+`contacts` are read from
  context masters (both in Modal) before stripping anything.
- **Lazy details on modal open.** New route `app/api/master/[id]/route.ts` serves
  one full master from the ISR-cached dataset (~888 B, 12 ms, no extra upstream).
  `Main.tsx` fetches it when a card modal opens; `Modal.tsx` tolerates missing
  contacts and shows skeletons while they stream in. Modal opens instantly with
  slim fields (name/photo/profession/city/tags/languages already present).
- **P1 — fonts + GTM.** Migrated to `next/font/google` (self-hosted .woff2,
  preloaded, `display:swap`, Cyrillic subset on Golos/JetBrains). GTM moved to
  `next/script strategy="afterInteractive"`.

## Results (gzip transfer)
- Master detail page: ~519 KB HTML / 398 KB RSC → **34.6 KB** total.
- City page: ~80 KB → **39.5 KB**. RSC payload 398 → 141 KB everywhere.
- Home (renders all 321 cards): ~95 KB → **60.3 KB**.
- Build passes (937 static pages); detail HTML keeps contacts, city HTML carries 0.

## Open questions
- Home still renders all 321 cards (~60 KB gzip). Pagination/virtualization would
  cut it further but changes UX — deferred pending product call.

## Follow-up session (same day): P2 + P3/P4 attempt

### Done & committed on develop
- **Font fixes** (regressions from the next/font migration, all deployed to prod):
  - `18e48eec` Cyrillic display fell to Arial — disabled Archivo Black's injected
    metric fallback (no unicode-range) so Cyrillic flows to Golos Text.
  - `a82aa9ac` Cyrillic professions lost weight — pinned Golos to 800 (display CSS
    sets no explicit weight; old Google link only loaded Golos@800, which masked it).
- **P2 next/image** `59c6ad90` — card + modal photos via next/image (fill +
  object-fit, duotone preserved), AVIF/WebP, lazy (cards) / priority (modal).
  Measured 37 KB JPEG → 10 KB AVIF (~72%). remotePatterns for chupakabra-test bucket.
- **P4 partial** `d1fef4f9` — added missing favicon.png; removed dead /og-image.png ref.
- Note: **preconnect dropped as a no-op** — with self-hosted fonts + next/image
  proxying photos through /_next/image, the browser no longer hits S3 or the API
  on load, so there are no cross-origin connections left to preconnect.

### Deployment note
Vercel was building `frontend/` (Vite SPA), so the web/ Next app + perf work
weren't actually live despite earlier main pushes. Owner repointed the Vercel
domain/root to the Next app; **`develop` now deploys Next**. Going forward all
web perf work lands on `develop` only — not `main`.

### OG images — FIXED (commit 1a1b9c44, on develop)
`public/fonts/*.ttf` were EOT files mislabeled `.ttf`; satori couldn't read
them, crashing BOTH `/api/og?id=` (per-master, 500 in prod) and any default OG.
Two further latent satori bugs surfaced once fonts loaded (a name <div> missing
display:flex; the Golos *variable* TTF tripping satori's name-table parser).
Fix: valid static Archivo Black + static Golos Text subsets (Cyrillic+Latin,
800) with per-glyph fallback; display:flex on the name row; new
app/opengraph-image.tsx default. Both verified rendering Cyrillic at 1200×630.

### Still open — needs decision
- **P3 react-select (~35 KB First Load JS).** Replace with native <select> =
  loses the brutalist dropdown look; lazy-load = delays hero-filter
  interactivity (the primary above-the-fold CTA); leave as-is = keep both at a
  modest JS cost. Recommendation: leave as-is — the big wins (payload, images,
  fonts) are landed and 35 KB isn't the bottleneck.
  - Server-Component split of HowItWorks/Footer is infeasible: both depend on
    client-context i18n (live language switch without reload).
