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

## Next steps (deferred tiers, not yet done)
- [ ] P2: migrate avatars/card photos to `next/image` (AVIF/WebP, srcset, fixed
      dims → kill CLS, `priority` on above-the-fold). Biggest mobile LCP lever left.
- [ ] P3: lazy-load or replace react-select (~35 KB); move static sections
      (HowItWorks, Footer) to Server Components.
- [ ] P4: add real `/og-image.png` + `/favicon.png`; `preconnect` to S3 host.
