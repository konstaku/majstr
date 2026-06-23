# Phase 2 scope — fr.majstr.xyz + host→country in web/
Date: 2026-06-23
Parent: `meetings/2026-06-21_france-launch-multi-country.md`

## Goal
Serve the **France catalogue at `fr.majstr.xyz`**, keep Italy at `majstr.xyz`,
with the country encoded in the **host** (clean, country-free public URLs). This
surfaces the already-seeded FR data (8 cities) to users. Italy URLs DON'T change.

## The core architecture decision: internal `[country]` prefix via middleware rewrite
Next caches SSG/ISR pages by **path**, so `majstr.xyz/uk/nice` and
`fr.majstr.xyz/uk/nice` (same path, different host) would **collide in the cache**
— one country's page served to the other. The fix is to give each country a
distinct internal path:

- Restructure the catalogue route tree: `app/[lang]/…` → **`app/[country]/[lang]/…`**.
- `middleware.ts` **rewrites** (not redirects) per host so the public URL stays clean:
  - `majstr.xyz/uk/nice` → internal `/it/uk/nice`
  - `fr.majstr.xyz/uk/nice` → internal `/fr/uk/nice`
- `generateStaticParams` for `[country]` = `["it","fr"]` → per-country SSG/ISR,
  distinct cache entries, correct data.

Public URLs are unchanged for Italy (apex stays `/uk/nice`); the `[country]` is an
internal rewrite target only. This extends the host-separation middleware we
already shipped (same file gains the rewrite).

(Rejected: force-dynamic per-host — kills SSG/ISR, bad for an SEO catalogue.
Rejected: header/cookie country — the path-cache collision remains.)

## Change surface (grounded in survey)
**Routes (restructure under `[country]`):** `app/[lang]/{page, [city]/page,
[city]/[category]/page, m/[slug]/page, about, faq, privacy, layout}` →
`app/[country]/[lang]/…`. Each reads `params.country`; `generateStaticParams` yields country×… tuples.

**Data (parametrize by country):**
- `web/lib/api.ts:92,97` — `country=IT` → the route's country.
- `web/lib/seed.ts:72` — `countryID:"IT"` → route country.
- `web/lib/data.ts` `getDataset` — take country.
- `web/app/api/master/[id]/route.ts:30` — `country=IT`.

**Copy / SEO (country-aware):**
- `web/lib/i18n.ts` — `italy` key + `masonryTagline` ("…в Італії") per lang → country name.
- `web/lib/seo-data.ts` — add `CITY_REGION` entries for the 8 FR cities (Côte d'Azur /
  PACA / Occitanie). `content.ts` `regionSentence` reads them.
- `app/[country]/[lang]/page.tsx` `areaServed` + `m/[slug]` `addressCountry` → country.
- home/landing titles ("в Італії") → country-aware.

**Host-aware absolute URLs (canonical / hreflang / OG / sitemap):**
- `web/lib/config.ts` `SITE_URL` is single-origin. Add a **country→host** map
  (IT→majstr.xyz, FR→fr.majstr.xyz); `urls.ts abs()/languageAlternates()` become
  country-aware so canonical/hreflang/OG point at the right host.
- `app/sitemap.ts` — emit per-host (each host its country's URLs); hreflang
  alternates stay **within a country** (uk/ru/en variants), NOT cross-country.
- `app/robots.ts` — per-host sitemap reference.

**Infra:** add `fr.majstr.xyz` domain to the `majstr-frontend` Vercel project + DNS
CNAME (you). `ALLOWED_ORIGINS` already includes the real domains; add fr if the
Mini App ever calls from there (not in Phase 2 — catalogue only).

**Out of scope (Phase 3):** the Mini App country (onboarding picker) + the
`<CountryToggle>`. app.* host is unaffected by Phase 2.

## Phasing (each build-verifiable; IT stays correct throughout)
- **2a — Route restructure + middleware rewrite.** Move tree under `[country]`,
  add host→country rewrite. IT keeps working (apex → /it rewrite); FR builds but
  isn't reachable until the domain is added. Verify: majstr.xyz pages byte-same.
- **2b — Parametrize data** by the country param (api/seed/data/route).
- **2c — Copy + region data** (i18n country name, CITY_REGION_FR, JSON-LD).
- **2d — Host-aware canonical/hreflang/OG/sitemap/robots.**
- **2e — fr.majstr.xyz domain + DNS + go-live** (seed real FR listings exist; verify
  fr catalogue renders French cities + copy; submit sitemap to Search Console).

## Decisions to confirm
1. **Architecture = internal `[country]` rewrite** (above). Recommend yes.
2. **FR region names** for `CITY_REGION` (need a native check, like the city
   declensions): Nice/Cannes/Menton/Fréjus/Toulon/Saint-Tropez → "Лазурний берег"
   (Côte d'Azur); Marseille → "Прованс"; Montpellier → "Окситанія". (Draft.)
3. **hreflang model:** within-country language variants only; IT and FR are
   separate sites, not hreflang alternates. Recommend yes.
4. Apex `majstr.xyz` stays IT permanently, URLs unchanged. (Confirmed earlier.)
