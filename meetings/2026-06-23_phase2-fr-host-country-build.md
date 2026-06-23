# Meeting: Phase 2 — fr.majstr.xyz host→country build
Date: 2026-06-23

## What we discussed
Implemented the full Phase 2 routing + SEO slice for the France launch: serving
`fr.majstr.xyz` as a second country off the one Next deployment, with clean
country-free public URLs. Architecture was confirmed in the earlier scope note
(2026-06-23_phase2-fr-host-country-scope.md); this session was the build.

## What was built (all on branch `phase2-fr-host-country`)
- **2a-2 route restructure** (commit 4e1f320c): `app/[lang]/*` → `app/[country]/[lang]/*`.
  Country threaded through every catalogue page (home, [city], [city]/[category],
  m/[slug], about, faq, privacy, layout): params gain `country`,
  generateStaticParams loops COUNTRIES × …, getDataset/findMasterBySlug/
  allMasterParams/buildSeed take the per-host countryID.
- **middleware host→country rewrite**: on a catalogue host a lang-prefixed
  request (/uk/…) is *rewritten* (not redirected) onto the host's internal
  `[country]` segment — majstr.xyz → /it/uk/…, fr.majstr.xyz → /fr/uk/…. The
  internal prefix gives each host its own SSG cache entry; the rewrite keeps the
  public URL clean. Unknown hosts (localhost, previews) default to Italy.
- **2b–2d** (commit f3918507): country-aware copy + URLs.
  - 2b: /api/master/[id] reads the Host header → country (FR modals resolve FR data).
  - 2c: COUNTRY_IN / COUNTRY_CITIES / COUNTRY_ISO in i18n drive home + hub titles/
    descriptions and schema.org areaServed/addressCountry. FR city→region map added
    (Côte d'Azur / Provence / Occitanie).
  - 2d: COUNTRY_ORIGIN (it→majstr.xyz, fr→fr.majstr.xyz); abs()/languageAlternates()/
    defaultOgImage() take country; sitemap.xml + robots.txt read Host header and
    emit per-country URLs on the right origin (now dynamic ƒ).

## Decisions made
- Public URLs stay country-free; the internal `[country]` segment exists only to
  separate the SSG path cache between hosts (the key architectural insight).
- Rewrite, not redirect, for host→country (clean URLs, per-host cache).
- France city→region grouping confirmed: Nice/Cannes/Menton/Fréjus/Toulon/
  Saint-Tropez → Côte d'Azur; Marseille → Provence; Montpellier → Occitanie.
- Empty FR catalogue is fine: only the FR home renders; FR city/category/master
  pages 404 + are absent from the FR sitemap until masters are seeded (manual seed).

## Verification
- `next build`: both IT + FR generate; IT output and public URLs unchanged.
- `next start` curl checks: IT host → majstr.xyz canonical + "в Італії"; FR host →
  fr.majstr.xyz canonical + "у Франції"; per-host sitemap/robots correct.
- Web unit (19) + e2e smoke (9, 1 pre-existing skip) green.

## Open questions / known nits (non-blocking)
- not-found page title still shows the IT default on the FR host (404s only).
- app/layout.tsx metadataBase stays IT (only a fallback; we emit absolute URLs).
- StepLocation onboarding hardcodes "🇮🇹 Italy" — that's Phase 3 (country picker).

## Next steps
- [ ] 2e (USER): add `fr.majstr.xyz` DNS CNAME + assign the domain to the
      `majstr-frontend` Vercel project; set NEXT_PUBLIC_SITE_URL_FR if overriding.
- [ ] Seed France masters (manual) so FR city/master pages + sitemap populate.
- [ ] Merge `phase2-fr-host-country` → main once 2e domain is wired (Vercel = prod).
- [ ] Later: Phase 3 onboarding country picker; 1f auth hardening.
