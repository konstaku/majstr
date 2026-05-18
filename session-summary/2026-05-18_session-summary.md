# Session Summary — 2026-05-14 → 2026-05-18

Quick-context doc for future sessions. Detailed notes live in `meetings/`;
durable cross-session facts live in auto-memory
(`project_miniapp_flow_state`, `reference_vercel_deploy`,
`feedback_priorities_and_honesty`, `feedback_git_branches`).

## TL;DR — current state
The Telegram Mini App "add master" onboarding flow is **functional and
live in production**, fully **9-language** (UI + reference data), with
prod/staging isolated. Latest prod (`main`) HEAD ≈ `115ea737`. All session
tasks closed. Remaining work is user-side/native-review only (non-blocking).

## Project
**Majstr** — platform connecting Ukrainian (and other) craftsmen with
clients in Italy/Portugal. Telegram auth; admins approve master listings
via the Telegram bot. Stack: Node/Express backend, React+Vite frontend,
MongoDB Atlas, S3, Telegram Bot API.

## Deployment & infra topology (READ FIRST next session)
- **Branches**: work on `develop`; production is `main`. "dev"=develop,
  "prod"=main. Deploy = merge develop→main and push.
- **Frontend = Vercel**, single project, deploys per-branch:
  `majstr.xyz`/`app.majstr.xyz` → Production (main); `dev.majstr.xyz` →
  "develop" environment. Vercel **develop-scoped env vars** point staging
  at the staging API (`VITE_API_URL=https://majstr-staging.up.railway.app`,
  `VITE_APP_URL=https://dev.majstr.xyz`, `VITE_TMA_BOT_USERNAME=<dev bot>`).
  Vercel password protection on develop must be OFF (blocks the TMA webview).
- **Backend+bot = Railway**, two always-on services: prod (tracks main) and
  staging (`majstr-staging.up.railway.app`, tracks develop). Auto-redeploy
  on push. Bot runs in polling mode.
- **Isolation requirements** (hard-won — see meetings/2026-05-17_*):
  staging needs its OWN bot token (`TELEGRAM_BOT_TOKEN`=dev bot, else
  409 crash-loop vs prod), `TMA_BASE_URL=https://dev.majstr.xyz` (else the
  dev bot silently opens the prod frontend), `MONGO_DB_NAME=majstr_staging`
  (separate DB), `PUBLIC_WEB_URL`, `FRONTEND_URL` set to dev domain.
- `git` remote is SSH but no SSH key here → pushes go via
  `git push https://github.com/konstaku/majstr.git <branch>` (gh is the
  HTTPS credential helper).
- The MongoDB Atlas cluster is **IP-allowlisted** — DB scripts must be run
  by the user (temporary IP allowlist or Railway one-off), not from here.

## What was built/fixed this session
1. **Audit → functional onboarding flow**: wizard had no submit, StepContact
   was a stub, no admin-approval path, no owner DM, data-contract mismatch,
   NoSQL injection in patchDraft — all fixed. Flow: wizard → submit →
   admin Approve/Decline keyboard → status+audit+owner DM.
2. **Security**: leaked Mongo credential (GH issue #1) — user rotated;
   patchDraft input hardened; Mongo connection made env-driven.
3. **GitHub project board** reconciled to reality (script in meetings/).
4. **Deployment isolation saga**: fixed missing Telegram bridge script,
   StepLocation `.city.ua` crash, autosave-401-closes-app, "stored
   locally" 409 (one-active-card), the dev/staging/prod separation, and
   the Direct-Link Mini App `startapp`→`/onboard` routing.
5. **i18n**: bot + wizard + website → **9 languages**
   (en, uk, ru, it, pt, de, fr, tr, es). `localizedName()` for all
   reference data. Reference-data (111 terms) + UI strings translated by
   Content Creator agents, Brand Guardian reviewed.
6. **UX**: language switcher = active-only → full popover menu (web);
   bot switch trimmed to uk/en/ru with "Add master" as the prominent CTA;
   country selector hidden (Italy-only); localized + redesigned join
   modal; nav/footer/burger "Add master" link styling unified; English
   brand-typeface OG image.

## Locked decisions (don't re-litigate)
- Onboarding-first (over claim flow). Blunt go/no-go honesty preferred.
- RU always text "RU", never a flag, everywhere.
- Per-language "card" noun: pt cartão · de Profilkarte · fr fiche ·
  tr profil kartı · es ficha. Formality: pt você, de du, fr vous, tr siz,
  es tú, others informal.
- Reference flagged terms: only `uomini` deleted; other 6 kept as-is.
- Brand Guardian: es glossary as-is; login.error plain-language (done);
  ru/tr punchy-slogan register kept intentionally.

## Ops scripts (backend/scripts — user runs against the DB)
`seed-staging-reference.js`, `seed-staging-masters.js`,
`export-reference.js`, `import-reference-translations.js`,
`delete-location.js`, `generate-site-og.js`, plus
`migrate-master-status.js`. OG source: `design mockups/OG image/og-source.html`
→ export to `frontend/public/og-image.png`.

## Open / deferred (non-blocking, user-side)
- Native-speaker review of agent-drafted pt/de/fr/tr/es copy.
- Refresh social OG cache (FB debugger / @WebpageBot) after deploys.
- Lint `--max-warnings 0` vs pre-existing react-refresh warnings (GH #75).
- Real-device QA whenever convenient (flow verified working on staging).

## Key file pointers
- Lang core: `frontend/src/i18n/lang.ts` (APP_LANGS, localizedName),
  `backend/lang.js`, `frontend/src/i18n/translations.ts` (site dict +
  JOIN_MODAL), `frontend/src/onboarding/i18n.tsx` (wizard), `backend/i18n.js`
  (bot).
- Switcher: `frontend/src/components/Root.tsx` (LanguageSwitcher,
  CountryToggle disabled via COUNTRY_SELECTOR_ENABLED).
- Bot: `backend/bot.js` (buildWelcomeKeyboard, handleUiLangCallback,
  handleMasterCallback), `backend/routes/draft.js` (submit).
- Detailed history: `meetings/2026-05-1[4-8]_*.md`.
