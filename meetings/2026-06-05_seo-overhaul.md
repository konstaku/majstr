# Meeting: SEO Overhaul — audit, strategy, implementation
Date: 2026-06-05

## What we discussed
Goal: rank Majstr for RU/UK diaspora queries like "маникюр милан" in Google **and Yandex**, landing
users on city×profession pages and individual master cards. Did a full site audit, set strategy,
and implemented Phase 1 + the Phase 2 rendering engine in one session.

## Key audit finding
The site is a pure client-side Vite SPA on Vercel — crawlers (especially Yandex, which barely runs
JS) see an empty `<div id="root">`. No per-query URLs (filters are React state), master cards are
`?card=` modals not pages, no robots/sitemap, hreflang missing `ru`. Competitive SERP is wide open:
only `barb.pro` is structured (RU-only, beauty-only, salon-level); real masters are scattered on
Instagram/forums.

## Options considered (rendering)
- **Next.js public layer (CHOSEN)** — SSG+ISR real HTML; best for Yandex; durable.
- Vite SSG prerender — lower effort, but stale until rebuild.
- Vercel serverless SSR routes — live data, but two rendering systems to maintain.

## Decisions made
- Rendering: **Next.js App Router layer** in `web/`, multi-zone with the existing SPA kept for
  authed routes.
- Languages/geo: **RU + UK first**, EU-ready architecture, publish only city×profession combos
  that have real inventory.
- Sequencing: **quick wins first**, then the rendering layer.
- URLs: `/{lang}/{profession}/{city}` landing, `/{lang}/{city}` & `/{lang}/{prof}` hubs,
  `/{lang}/m/{slug}` master, `/` → `/uk`.
- Title uses nominative city + count; H1 uses prepositional city; per-page canonical/hreflang +
  JSON-LD; cannibalization rule enforced (landing owns "{prof} {city}", hubs avoid that phrase).

## What shipped (verified)
- Phase 1: `frontend/public/robots.txt`, `frontend/index.html` (hreflang+ru, canonical, JSON-LD,
  robots meta fix, verification placeholders).
- Phase 2: `web/` Next.js app — built **1225 static pages** from the live public API; raw-HTML
  `curl` confirms `<h1>Маникюр в Милане</h1>` + title + hreflang + JSON-LD; `sitemap.xml` (1218
  URLs) + `robots.txt` + `/api/revalidate`.
- SEO research persisted to `docs/seo/keyword-research.md`; deploy guide in `docs/seo/IMPLEMENTATION.md`.

## Open questions
- Contact-gating policy for scraped/unclaimed masters (current: nofollow Telegram CTA) vs data-policy.
- How much per-page body uniqueness to invest for competitive Yandex terms.

## Next steps
- [ ] Create Google Search Console + Yandex Webmaster; paste verification tokens; submit sitemap.
- [ ] Deploy `web/` as the apex Vercel project; set `SPA_ORIGIN` to the SPA; swap `majstr.xyz` domain.
- [ ] Set `REVALIDATE_SECRET`; wire `backend/bot.js` to call `/api/revalidate` on master approval.
- [ ] Set Yandex region (Milan 10448) + Yandex Business card.
- [ ] Decide contact-gating; optionally expand landing-page body uniqueness for top terms.
