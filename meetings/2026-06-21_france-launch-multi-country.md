# Meeting: France launch / multi-country architecture
Date: 2026-06-21

## What we discussed
Planning the launch of Majstr in French cities. Studied the whole codebase
(backend, the Next SEO app `web/`, the Vite Telegram-app `frontend/`, mining)
via three parallel Explore agents to assess how country-ready the architecture
is, then chose an approach for adding France as a separate catalogue and making
new countries cheap to add.

## Assessment — how country-ready is Majstr today
The **data layer is already multi-country**; the Italy assumption lives in the
app/content/URL layers and in mining.

| Layer | State | Evidence |
|---|---|---|
| DB schema | READY | `Country` collection (11-lang names + flag), `Location.countryID`, `Master.countryID`, index `{status, countryID, locationID}` |
| Public API | READY | `/?q=masters&country=FR`, `/?q=locations&country=FR` filter by country (`routes/public.js:24,49`) |
| Admin API | READY | `createLocationDoc` requires + validates `countryID` vs `Country` (`referenceAdmin.js:105`) |
| SPA catalogue (both copies) | ~90% | `countryID` state, `SET_COUNTRY`, `<CountryToggle>` exist but gated by `COUNTRY_SELECTOR_ENABLED=false` (`frontend Root.tsx:249`) |
| SPA onboarding wizard | BLOCKER | country is read-only "🇮🇹 Italy" (`StepLocation.tsx:58`); location picker fetches all locations unfiltered (`useReferenceData.ts:42`) |
| web/ SEO layer | ITALY-LOCKED | `country=IT` hardcoded (`api.ts:92`, `seed.ts:72`, `api/master/[id]/route.ts:30`); "в Італії" copy; `CITY_REGION` = Italian regions; JSON-LD `addressCountry:"IT"` |
| Bot + mining | ITALY-LOCKED | `mining/chatRegions.js` = Italian chat IDs; LLM prompts say "diaspora chats in Italy" (`haiku.js`, `forwardExtract.js`); no French lexicon; 3 silent `|| 'IT'` fallbacks |

### Serving topology (confirmed)
- **`web/`** (Next, `majstr-web`) → Vercel → `majstr.xyz` = public SEO catalogue.
  SSG pages mount `web/spa/*` client components (`Main`, `MasterCard`, `Modal`).
- **`frontend/`** (Vite, `majstr`) → own deploy → `app.majstr.xyz` (`TMA_BASE_URL`,
  `bot/instance.js:16`) = Telegram Mini App: onboarding/edit/claim/my-cards/admin.
- **Duplication:** `web/spa/` and `frontend/src/` are parallel, drifted (~10–15%)
  copies of the catalogue. Onboarding/claim exist only in `frontend/`.

## Decisions made
1. **Collapse to one Next app.** Migrate onboarding/claim/my-cards/admin from the
   Vite `frontend/` into `web/` as client routes; retire `frontend/`. Ends the
   catalogue duplication.
2. **France on a subdomain — `fr.majstr.xyz`.** Country is encoded in the host.
   Key benefit: **existing Italy URLs (`majstr.xyz/<lang>/<city>`) do not change →
   zero redirects / no SEO-migration risk.**
3. **UI stays uk/ru/en.** Audience = Ukrainian/Russian diaspora in France. Only
   data (cities, country name) and "in Italy" copy become country-aware. No French
   UI locale.
4. **Seed France manually first** (admin-created + forwarded community leads).
   Defer the mining-pipeline refactor (chat sources, prompts, lexicon).

## Target architecture
One Next app, **host → country** routing:

| Host | Role | Country |
|---|---|---|
| `majstr.xyz` | public catalogue | IT |
| `fr.majstr.xyz` | public catalogue | FR |
| `app.majstr.xyz` | Telegram Mini App (onboarding/claim/admin) | chosen in-flow |

**Mechanism:** `middleware.ts` reads the request host and rewrites to an internal
country prefix (`majstr.xyz/uk/milan` → internal `/it/uk/milan`; `fr.majstr.xyz/uk/paris`
→ internal `/fr/uk/paris`). Public URLs stay clean; internally the route tree gains
a `[country]` segment so `generateStaticParams` emits per-country pages and ISR caches
per country. `app.*` rewrites to the Mini-App route group. Adding a 3rd country =
add the host + country row + seed data; no structural change.

## Workstreams & phased plan
Sequenced so cheap/high-leverage work lands first and France isn't blocked by the
collapse. Phases 0–1 are invisible to users; the domain cutover is Phase 2.

### Phase 0 — Backend country-hardening + France data (independent, do first)
- Remove/​guard the silent `|| 'IT'` fallbacks: `Master.js:17`, `miningReview.js:305`,
  `generateOpenGraph.js:97`. Require `countryID`, validate against `Country`.
- Seed FR: add France `Country` doc (flag, 11-lang names) + first French cities via
  the existing admin API; mirror `scripts/add-italy-cities.js` → `add-france-cities.js`.
- Confirm `routes/draft.js` accepts + persists `countryID` end-to-end (it already
  references it ~L63/66) and that submit → moderation carries it.
- Acceptance: can create an approved French master via API and fetch it with
  `/?q=masters&country=FR`.

### Phase 1 — Collapse to one Next app (invisible refactor)
- Move onboarding/claim/my-cards/admin from `frontend/src/*` into `web/` as a
  client route group (e.g. `app/(app)/...`, all `'use client'`, auth-gated, no SSG).
- Unify the catalogue: make `web/spa/` the single source; delete the `frontend/src`
  copy. Reconcile the two `context.tsx`/`reducer.tsx` variants (server-seed vs
  localStorage-lang) into one that supports both entry modes.
- Point `app.majstr.xyz` at the Next app (Vercel domain), keep behaviour identical,
  verify the Mini App in Telegram, then retire `frontend/` + its `vercel.json`.
- Acceptance: onboarding/claim/my-cards/admin work from `app.majstr.xyz` on the Next
  app; Vite `frontend/` deleted; e2e + unit suites green.

### Phase 2 — Country as a first-class web/ dimension + fr.majstr.xyz
- `middleware.ts`: host → country rewrite (above). `lib/config.ts`/`i18n.ts`: add
  `COUNTRIES`, `DEFAULT_COUNTRY`, host↔country map, `isCountry()`.
- Parametrize data fetches by country: `lib/api.ts`, `lib/data.ts`, `lib/seed.ts`,
  `app/api/master/[id]/route.ts` (drop hardcoded `country=IT`). ISR/revalidate keyed
  per country.
- Parametrize copy: `lib/i18n.ts` `T` strings ("Italy"/taglines), `lib/content.ts`
  (`landingTitle/Description/Intro`), `app/[lang]/page.tsx` titles, JSON-LD
  `addressCountry`. Add `CITY_REGION_FR` / French prepositional city names in
  `lib/seo-data.ts`.
- `sitemap.ts`/`robots.ts`: emit per host/country; hreflang stays within a country.
- Vercel: add `fr.majstr.xyz` domain to the project; DNS.
- Acceptance: `fr.majstr.xyz/uk/paris` renders French cities with French copy;
  `majstr.xyz` Italy pages byte-for-byte unchanged.

### Phase 3 — Mini-App country selection
- Unlock catalogue country bits (now single copy): flip `COUNTRY_SELECTOR_ENABLED`,
  generalize IT→`it` language fallback in `MasterCard`/`Modal` to `[uk, countryID.toLowerCase()]`,
  country-aware phone placeholder.
- Onboarding: replace the read-only "Italy" with a country step (or derive country
  from the deep-link payload — extend `parseLangFromPayload` in `bot/startFlow.js`
  to also carry country, e.g. `start=add-fr`). Country-filter the location picker
  (`useReferenceData.ts` → `?country=`).
- Acceptance: a user entering from a French diaspora chat link submits a master that
  lands with `countryID:FR` and the correct French city.

### Phase 4 — France go-live
- Seed real French listings (admin + forwarded community leads), generate OG cards,
  submit `fr.majstr.xyz` sitemap to Search Console, set geo-targeting.
- Reuse the partner-outreach model (cf. `Untitled.txt` / Санремо "рекомендовано
  спільнотою" badge) with French diaspora groups.

### Phase 5 — Deferred: France mining
- New French diaspora chat sources → `chatRegions.js`; parametrize LLM prompts
  (`haiku.js`, `forwardExtract.js`) to be country-agnostic + fix cross-border rules;
  add French profession-lexicon terms.

## Resolved (2026-06-21)
- **Routing:** middleware host→country rewrite (not Multi-Zones).
- **Onboarding default country:** derive from deep-link payload when present,
  explicit picker step as fallback.
- **Launch cities (FR):** Nice, Marseille, Cannes, Saint-Tropez, Menton, Fréjus,
  Toulon, Montpellier. Region: Provence-Alpes-Côte d'Azur (Côte d'Azur) for all
  except Montpellier (Occitanie).
- **Italy host:** keep apex `majstr.xyz` = IT permanently (preserve authority);
  no `it.` alias.

## Still open
- Slavic prepositional declensions of the French city names need a native pass
  before publishing (SEO copy renders prepositional forms, e.g. "майстри у Ніцці").

## Next steps
- [x] Phase 0 (code): `helpers/validateCountry.js` (cached known-country check) wired into
      `draft.js` patch (rejects unknown countryID 422); `scripts/add-france-cities.js`
      (FR Country + 8 cities, idempotent); clarifying comment on the intentional IT-only
      mining fallback. Verified draft→submit carries countryID. Backend suite green
      (171 tests, +2 new in draft.test.js).
- [ ] Phase 0 (data): native-speaker pass on the `*_alt` declensions, THEN run
      `node scripts/add-france-cities.js` against prod Atlas (irreversible — awaiting OK).
- [ ] Phase 1: migrate onboarding/claim/admin into web/, unify catalogue, retire Vite frontend/
- [ ] Phase 2: middleware host→country, parametrize web/ data + copy, add fr.majstr.xyz
- [ ] Phase 3: unlock country toggle, onboarding country step, country-filtered pickers
- [ ] Phase 4: seed French listings, sitemap/Search Console, partner outreach
- [ ] Phase 5 (deferred): France mining pipeline
- [ ] Decide launch cities; confirm routing mechanism
