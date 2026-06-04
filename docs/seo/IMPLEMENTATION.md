# Majstr SEO — Implementation & Deployment

Status as of 2026-06-05. Plan: `~/.claude/plans/streamed-beaming-pancake.md`.
Keyword research: `docs/seo/keyword-research.md`.

## What was built

### Phase 1 — technical quick wins (existing Vite SPA, `frontend/`)
- `frontend/public/robots.txt` — allow crawl, disallow app routes, declares sitemap.
- `frontend/index.html` — added `ru` hreflang, `canonical`, switched robots meta from
  `noarchive` to `index, follow, max-image-preview:large`, added `Organization` + `WebSite`
  JSON-LD, and **commented placeholders** for Google/Yandex verification tokens.

### Phase 2 — Next.js public SEO layer (`web/`, Next 15 App Router)
Server-rendered (SSG + ISR) pages built from the **live public API** (`api.majstr.xyz`), so
crawlers — including Yandex, which barely runs JS — get real HTML. Verified locally: 1225 static
pages.

| Route | URL example | Purpose |
|---|---|---|
| `/` | `/` → 308 → `/uk` | apex redirect to default locale |
| `/[lang]` | `/ru` | localized home + city/profession link mesh |
| `/[lang]/[term]` | `/ru/milan`, `/ru/manikyur` | city hub **or** profession hub (term auto-resolved) |
| `/[lang]/[term]/[city]` | `/ru/manikyur/milan` | **landing page** — the ranking engine |
| `/[lang]/m/[slug]` | `/ru/m/toma-manicurist-milan-916cb0` | master page |
| `/sitemap.xml`, `/robots.txt` | — | native, hreflang-annotated, 1218 URLs |
| `/api/revalidate` | POST `?secret=…` | on-demand ISR |

Per page: keyword-mapped `<title>` (nominative city + count) and `<h1>` (prepositional city),
canonical + ru/uk/x-default hreflang, and JSON-LD (`BreadcrumbList`, `ItemList`, `FAQPage` on
landings; `Person` + `PostalAddress` on master pages; `Organization` + `WebSite` on home).
Content templates/slugs/declensions live in `web/lib/seo-data.ts`, `web/lib/content.ts`.

Verification (raw HTML, no JS):
```
curl -s https://majstr.xyz/ru/manikyur/milan | grep -E '<h1|<title'
# <title>Маникюр Милан — русскоязычные мастера | Majstr</title>
# <h1 class="title">Маникюр в Милане</h1>
```

## Deploy (Vercel multi-zone)

The Next app (`web/`) becomes the **apex** project; the existing Vite SPA keeps running and is
rewritten in for the interactive/authed routes.

1. **New Vercel project** → root directory `web/`, framework Next.js. Env vars:
   - `NEXT_PUBLIC_SITE_URL=https://majstr.xyz`
   - `API_BASE=https://api.majstr.xyz`
   - `SPA_ORIGIN=` the existing SPA deployment origin (e.g. `https://app.majstr.xyz` or its
     `*.vercel.app`) — enables the `/login /profile /admin /add /onboard` rewrites.
   - `REVALIDATE_SECRET=` a random string (also set in the bot, step 4).
2. **Domain swap:** move `majstr.xyz` to the Next project. Give the existing SPA project a stable
   origin (subdomain or vercel.app) and put that in `SPA_ORIGIN`. The Telegram Mini App keeps
   working at `majstr.xyz/onboard` (rewritten to the SPA).
3. **Submit:** add the property in Google Search Console + Yandex Webmaster (paste tokens into
   `frontend/index.html` placeholders *and* set Next metadata `verification` if desired), submit
   `https://majstr.xyz/sitemap.xml`, set Yandex region (Milan = 10448, Rome = 10445).
4. **On-demand ISR:** in `backend/bot.js`, after a master is approved, fire
   `POST https://majstr.xyz/api/revalidate?secret=$REVALIDATE_SECRET` so the new master appears
   within seconds (otherwise picked up at the 1h revalidate).

## Open decisions / follow-ups
- **Contact gating:** master pages currently expose a `nofollow` Telegram CTA (`t.me/<handle>`)
  for scraped/unclaimed masters. Confirm against `docs/data-policy.md`; option to route through
  the app instead. (`web/app/[lang]/m/[slug]/page.tsx`)
- **Yandex uniqueness:** landing intros are templated with a per-profession subtopic line. For
  competitive RU terms, expand to ≥60% unique body (city-specific context) — see research §7/§9.
- **Multi-country EU:** architecture already keys off `countryID`/city; pages publish only where
  inventory exists. Add cities/countries by adding masters — no code change needed.
- **`<html lang>`** is statically `uk` (SSG constraint); per-page language is conveyed via
  content, `lang` attr on `<main>`, hreflang, `og:locale`, and JSON-LD `inLanguage`.
