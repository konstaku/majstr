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

## Deploy (Vercel multi-zone) — step by step

Model: the existing **Vite SPA moves to a subdomain** (`app.majstr.xyz`); the new **Next app takes
the apex** (`majstr.xyz`). The Next app *redirects* app/auth routes to the SPA (no rewrites → no
Vite asset-path problems; query strings preserved). Nothing breaks if done in this order.

### Step 0 — Phase 1 is independent
Merging Phase 1 (`frontend/`) to `main` deploys the robots.txt + metadata to the live SPA. It does
**not** touch routing or the domain — safe to do first, and it starts indexing.

### Step 1 — give the SPA its own domain (existing Vercel project)
In the **existing** SPA Vercel project → Settings → Domains → add `app.majstr.xyz`. Leave
`majstr.xyz` attached for now. Confirm `https://app.majstr.xyz` loads the app, login, and `/onboard`.

### Step 2 — point Telegram + bot at the SPA subdomain (CRITICAL — or the Mini App breaks)
The Telegram Mini App's registered Web App URL is currently the **apex root**, which the Next app
will take over. Before swapping:
- **BotFather** → your bot → Mini App / Web App URL → set to `https://app.majstr.xyz/onboard`.
- **Bot env** `FRONTEND_URL=https://app.majstr.xyz` so Telegram login links
  (`/login?token=…`) point straight at the SPA. (As a safety net the apex also redirects
  `/login?token=…` → `app.majstr.xyz/login?token=…` with the query preserved.)

### Step 3 — create the Next project (`web/`)
New Vercel project → import the repo → **Root Directory = `web`**, framework Next.js.
Environment variables (set for **Production**, available at **build time**):
- `NEXT_PUBLIC_SITE_URL=https://majstr.xyz`
- `API_BASE=https://api.majstr.xyz`
- `SPA_ORIGIN=https://app.majstr.xyz`  ← **must exist at build time** (redirects are baked at build)
- `REVALIDATE_SECRET=<random string>` (also set in the bot, step 6)

Deploy and test on the project's `*.vercel.app` URL **before** swapping the domain:
```
curl -s <preview>/ru/manikyur/milan | grep -E '<h1|<title'   # real HTML
curl -sI <preview>/onboard            # 307 -> https://app.majstr.xyz/onboard
curl -sI '<preview>/?card=<known-id>' # 307 -> /uk/m/<slug>
```

### Step 4 — swap the apex domain
Move `majstr.xyz` (and `www`) from the SPA project to the Next project. DNS/SSL propagates in
minutes. The SPA keeps serving on `app.majstr.xyz`.

### Step 5 — submit to search engines
Google Search Console + Yandex Webmaster: verify (paste tokens into `frontend/index.html`
placeholders, or add Next metadata `verification`), submit `https://majstr.xyz/sitemap.xml`, set
Yandex site region (Milan = 10448). Optionally create a Yandex Business card.

### Step 6 — on-demand ISR (optional but nice)
In `backend/bot.js`, after a master is approved, fire
`POST https://majstr.xyz/api/revalidate?secret=$REVALIDATE_SECRET` so the new master appears in
seconds instead of at the hourly revalidate.

### Link-preservation matrix
| Link / entry point | After swap | Handled by |
|---|---|---|
| `majstr.xyz/ru/manikyur/milan` etc. | served by Next (SEO) | new app |
| `majstr.xyz/?card=<id>` (old shares) | 307 → `/uk/m/<slug>` | `web/app/page.tsx` |
| `majstr.xyz/login?token=…` | 307 → `app.majstr.xyz/login?token=…` | `next.config` redirects |
| `/profile /admin /add /onboard` | 307 → `app.majstr.xyz/…` | `next.config` redirects |
| Telegram Mini App | opens `app.majstr.xyz/onboard` directly | BotFather (step 2) |
| Telegram login deep link | `app.majstr.xyz/login?token=…` | bot `FRONTEND_URL` (step 2) |
| `api.majstr.xyz/*` | unchanged (separate VPS) | — |

### Rollback
Move `majstr.xyz` back to the SPA project and revert the BotFather URL + `FRONTEND_URL`. Full
restore in minutes; the Next project keeps running on its `*.vercel.app`.

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
