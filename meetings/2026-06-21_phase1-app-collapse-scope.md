# Phase 1 scope — collapse to one Next app
Date: 2026-06-21
Parent plan: `meetings/2026-06-21_france-launch-multi-country.md`

## Goal
Retire the standalone Vite app (`frontend/`) by migrating its interactive/authed
surfaces (onboarding, claim, my-cards, profile, login, admin, add) into the Next
app (`web/`) as client routes, and unify the duplicated-and-drifted catalogue so
the country work (and everything after) is written once.

## Why now / what it unblocks
- Ends the `web/spa/` ⇄ `frontend/src/` catalogue duplication (context, reducer,
  Root, Main, MasterCard, Modal, i18n, styles — all parallel + ~10–15% drifted).
- Phase 3 (onboarding country picker, unlock `<CountryToggle>`, IT→`it` language
  fallback) then touches ONE codebase instead of two.

## Current bridge (what we're replacing)
- `web/next.config.js`: when `SPA_ORIGIN` is set, Next **redirects** `/login`,
  `/profile`, `/admin`, `/add`, `/onboard` (+ subpaths) to the Vite origin
  (`app.majstr.xyz`). That redirect set is how the two apps coexist today.
- Bot deep-links: `TMA_BASE_URL` (`app.majstr.xyz`) `/onboard`, `/my-cards`
  (`bot/startFlow.js:84,88`); login link → `FRONTEND_URL/login?token=…`.
- `frontend/index.html`: loads `telegram-web-app.js` (classic, pre-app) and
  rewrites Mini-App direct-link `start_param` (`startapp=onboard-<lng>`) → `/onboard`
  before the router mounts.
- `e2e/playwright.config`: `baseURL http://localhost:5173`, `webServer` runs the
  Vite dev server.

## Migration inventory
**Move → Next `(app)` client routes** (from `frontend/src`):
| Vite route (React Router) | Source | New Next route |
|---|---|---|
| `/onboard` | `onboarding/OnboardingWizard.tsx` (+ `steps/`, `ui/`, `useDraft`, `useReferenceData`, `useWizardMachine`, `schema.ts`, `i18n.tsx`, `bioTemplates.ts`, `wizard.css`) | `app/(app)/onboard/page.tsx` |
| `/claim/:masterId` | `pages/ClaimCard.tsx` (+ `surface/useClaimDeepLink`) | `app/(app)/claim/[masterId]/page.tsx` |
| `/my-cards` | `pages/MyCards.tsx` | `app/(app)/my-cards/page.tsx` |
| `/profile` | `pages/Profile.tsx` | `app/(app)/profile/page.tsx` |
| `/login` | `pages/Login.tsx` | `app/(app)/login/page.tsx` |
| `/add` | `pages/AddNewRecord.tsx` | `app/(app)/add/page.tsx` |
| `/admin` | `pages/Admin.tsx` | `app/(app)/admin/page.tsx` |
| `/admin/mining` | `pages/MiningReview.tsx` (+ `api/mining.ts`) | `app/(app)/admin/mining/page.tsx` |

**Move → shared infra** (consumed by both catalogue + app surfaces):
- `surface/` (TG detection, `useTelegramContext`, `telegram-sdk`, globals) → `web/spa/surface/`.
- `ui/` (`ThemeBridge`, `usePopup`, `useHaptic`, `PrimaryCTA`, `BackAffordance`) → `web/spa/ui/` (partly exists).
- `custom-hooks/` (`useAuthenticateUser`, `useTranslation`, `useSlotCount`), `api/client.ts`, `helpers/`, `schema/`.

**Reconcile (de-drift) — pick web/spa as base, fold in frontend deltas:**
- `context.tsx` + `reducer.tsx`: ONE provider supporting both modes — server `initial`
  seed (catalogue) AND client fetch when no seed (app surfaces; port `Root.tsx` loader).
- `i18n/translations.ts` + `lang.ts`: catalogue uses URL lang (uk/ru/en); app surfaces
  use localStorage/initData lang (9 langs incl it/pt/de/…). Unify into one dict + a
  per-surface lang source. (Onboarding keeps its own `onboarding/i18n.tsx`.)
- `styles.css` (web/spa 71k vs frontend 68k) → one file.
- `components/`: `MasterCard`, `Modal`, `Faq`, `Root` — converge on web/spa copies.

**Delete after cutover:** `frontend/` (whole app), `frontend/vercel.json`, `web/next.config.js`
`SPA_ORIGIN` redirect block.

## Hard parts / risks (ranked)
1. **Provider/data unification.** One `MasterContextProvider` must serve seeded
   (SSG catalogue) AND client-fetched (app) modes. Highest-churn, highest-risk file set.
2. **Telegram Mini-App bridge in Next.** `telegram-web-app.js` via `next/script`
   `beforeInteractive` in `(app)/layout.tsx`; replicate the `start_param`→route rewrite
   as a client effect. If wrong, the Mini App opens on the wrong screen.
3. **`'use client'` boundaries.** Every app route + onboarding/surface/ui file needs
   `"use client"`; guard all `localStorage`/`window.Telegram`/`navigator` reads against SSR.
4. **i18n reconciliation** across three sources (2 catalogue + onboarding) with
   different lang-source semantics.
5. **Strict host-separation middleware.** `middleware.ts` must redirect cross-host
   paths (app↔apex) without catching API/asset/`_next` paths or looping. Same file is
   later extended for host→country (Phase 2), so get its host-matching shape right now.
6. **e2e + unit tests.** Retarget Playwright from Vite:5173 → Next; port
   `pages/routeSmoke.test.tsx` + `surface/detect.test` + hook tests into web/.
7. **Assets.** Fonts/icons/favicons + `/img/*` from `frontend/public` → `web/public`;
   GTM snippet (currently in `index.html`) → Next `layout.tsx`.
8. **BotFather Mini-App config.** Registered base URL stays `app.majstr.xyz` (same
   host, now → Next), so no BotFather change — but verify direct-link routing end-to-end.

## Sub-phases (de-risked sequence)
- **1a — Unify catalogue core** in `web/spa` (context/reducer/Root/i18n/styles) to
  support seed + client-fetch, Vite untouched. Verify Next catalogue unchanged. Ship.
- **1b — Build `(app)` group** in Next: client `layout.tsx` (TG providers + bridge +
  client MasterContext), port the 8 routes + onboarding. Add `middleware.ts` with
  **strict host separation** (app.* ↔ apex redirects, replacing the `SPA_ORIGIN`
  block). Test inside Telegram via a **preview deployment pointed at `@majstr_dev_bot`**.
  Do NOT cut over prod yet.
- **1c — Tests:** port unit/route-smoke into web/; retarget e2e to Next; add host-
  separation redirect tests; green.
- **1d — Cutover:** point `app.majstr.xyz` at the Next deployment; remove the
  `next.config` `SPA_ORIGIN` redirects. Keep the Vite deploy alive (rollback) for a
  short bake window.
- **1e — Cleanup:** delete `frontend/`; update `CLAUDE.md` commands + architecture,
  bot env docs, e2e README.
- **1f — Auth hardening (SEPARATE PR, post-cutover):** move the web bearer-JWT into a
  first-party httpOnly session cookie via a Next route handler that proxies the backend
  and validates the bot-issued token. TMA initData path unchanged. Isolated from the
  migration on purpose — ships only once the collapse is stable.

## Rollback
During the bake window: re-set `SPA_ORIGIN` env + repoint `app.majstr.xyz` → Vite.
Both are env/DNS flips, no code revert needed.

## Resolved (2026-06-21)
- **Test bot for 1b:** `@majstr_dev_bot` — point a preview deployment's Mini-App URL at it.
- **`app.majstr.xyz` after collapse: STRICT host separation.** One Next deployment,
  but `middleware.ts` enforces per-host path ownership:
  - `app.*` → serves only the `(app)` surfaces; any catalogue/SEO path (`/`, `/[lang]/…`)
    redirects (308) to the apex equivalent.
  - apex / `fr.*` → serves only the catalogue; any `(app)` path (`/onboard`, `/login`,
    `/profile`, `/admin`, `/add`, `/my-cards`, `/claim/*`) redirects to `app.*`.
  This replaces the current `next.config` `SPA_ORIGIN` redirects (which point at the
  Vite origin) and **front-loads the Phase 2 host middleware** — the same file later
  gains the host→country rewrite, so the work is reused, not thrown away. No
  duplicate-content risk (each host owns its path space), so no `noindex` hack needed.
- **Auth:** KEEP AS-IS during the collapse — port `api/client.ts` (`apiFetch`)
  verbatim. It already does the right thing: TMA requests send `X-Telegram-Init-Data`
  (server-verified by HMAC in `requireMiniAppAuth.js` per Telegram spec, with a
  prev-token rotation fallback); web requests send a bearer JWT from localStorage
  (`requireAuth.js`). The initData path is best-practice. The only soft spot is the
  web JWT living in localStorage (XSS-exposed) — but the API is a separate origin
  (`api.majstr.xyz`), which is exactly why bearer tokens are used. OPTIONAL later
  hardening the Next move unlocks: an httpOnly session cookie set + read via Next
  route handlers proxying the backend (first-party cookie, XSS-safe). COMMITTED as a
  separate post-cutover step (sub-phase 1f) — done, but not bundled into the migration
  so it can't multiply the collapse's risk.

## Progress / refined boundary (2026-06-21)
- **1a linchpin DONE + verified** on branch `phase1-app-collapse`: unified the
  catalogue core's state layer in `web/spa` — added `SET_LANGUAGE` (action + reducer
  case) and an SSR-safe client lang-sync in `context.tsx` so the provider serves both
  the server-seeded catalogue (byte-identical) AND the no-seed app surfaces. State
  schema + `i18n/lang.ts` were already identical. Verified: `tsc --noEmit` clean +
  full `next build` (≈1,700 SSG pages, incl. live FR data) succeeds; Vite untouched.
- **Refinement:** the remaining "shared infra" (the 122-line `translations.ts`
  superset merge, `surface/`, `ui/`, app `custom-hooks/`, `styles.css`) is consumed
  ONLY by the app surfaces. Moving it now = dead code with no end-to-end check. So
  **fold those merges into 1b** (land each with its consumer, verifiable in-app),
  and treat 1a as complete at the state-layer unification. Tightens the boundary,
  avoids speculative drift.

### 1b progress (branch `phase1-app-collapse`)
Shared layer DONE + tsc-verified (catalogue build unchanged):
- ✅ foundation: `surface/detect` + `telegram-global.d.ts`; unified surface-aware
  `api/client.ts` (Next-adapted, SSR-guarded); `useTranslation` gained `setLang`.
- ✅ providers + UI: `surface/useTelegramContext` (+`telegram-sdk`, minus the unused
  `@telegram-apps/sdk` dep), `ui/{ThemeBridge,usePopup,useHaptic,PrimaryCTA,
  BackAffordance}`, `useAuthenticateUser`.
- ✅ i18n: web/spa is now the single translations superset (added `nav.myCards`).

- ✅ onboarding wizard ported → `/onboard` builds in the (app) route group.
  `(app)/layout.tsx` owns `<html>/<body>`, loads the TG bridge in `<head>`,
  noindex; `AppProviders` = Telegram/Theme/Popup/Master(no-seed) stack. Ported
  `useClaimDeepLink` (router→next), `analytics`, tag-suggestions; reconciled
  `master.schema`; added `react-hook-form` to web/.

- ✅ claim flow + auth pages ported: Login, Profile, ClaimCard, MyCards →
  routes /login, /profile, /claim/[masterId], /my-cards. (Dependency-complete;
  react-router→next/navigation.) Build green, catalogue unchanged.

VERIFICATION NOTE (2026-06-22): tried verifying /onboard live via a Vercel preview
+ @majstr_dev_bot. Hit walls that are ENVIRONMENTAL, not port bugs: (1) Vercel
deployment protection on preview URLs, (2) prod API CORS allowlist excludes the
preview origin, (3) dev-bot initData can't validate against the prod bot token.
Confirmed working: SSR render of /onboard + catalogue, Telegram bridge, hydration,
name prefill (after the bridge-resilience fix). The CORS-blocked autosave is what
pinned the wizard's Next button. DECISION (option B): bank the structural
verification (nav + writes are verbatim Vite logic that runs fine at app.majstr.xyz)
and do the true end-to-end test at CUTOVER on app.majstr.xyz (whitelisted origin +
prod bot). Prod ALLOWED_ORIGINS was temporarily widened then reverted — confirmed clean.

REMAINING:
- ⬜ port Admin (+ NewMasterPreview), MiningReview (+ mining/ components, api/mining),
  AddNewRecord (+ check MasterCardPreview / new-master-form) — note: decide whether
  /add is legacy (superseded by /onboard) and can be dropped instead of ported.
- ⬜ Next error boundary (app)/error.tsx (replaces React Router ErrorPage).
- ⬜ `middleware.ts` strict host separation + Direct-Link `start_param` root routing
  (startapp=onboard / claim-<id>).
- ⬜ 1c tests, 1d cutover (point app.majstr.xyz at Next, drop SPA_ORIGIN redirects) —
  cutover is where end-to-end Mini-App verification happens, 1e delete frontend/,
  1f auth hardening.

## Estimate
The single largest step in the France initiative — multi-day, best split across a
short PR series (1a / 1b / 1c–1e). Not gating the France *data* (already live); it
gates the clean single-codebase that Phases 2–3 build on.
