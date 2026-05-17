# Meeting: Staging Isolation + TMA Entry Points (debugging arc)
Date: 2026-05-17

## What we discussed
After i18n shipped, a long debugging arc to make the TMA onboarding flow
actually work on a real device, isolate dev/staging from prod, and fix
every Mini App launch path. Ended with the full flow working end-to-end on
staging and all three entry points reaching the wizard in the right
language.

## Root causes found (in order)
1. **Telegram bridge script missing** from index.html → `isTMA()` always
   false. Fixed earlier (08f4d2bb).
2. **`StepLocation` used `l.city.ua`** but the Location schema is
   `{name:{ua}}` → crash on the city step. Fixed.
3. **409 "session not verified"** on the draft autosave closed the whole
   Mini App (apiFetch `onUnauthorized` → `WebApp.close()` on a background
   PATCH). Fixed: draft autosave/submit use `redirectOn401:false`; 401
   surfaces as a banner.
4. **"data stored locally" forever** = `useDraft` retried/queued 4xx as if
   transient. Fixed: 4xx is permanent + surfaced; 409 = already-has-card.
5. **The big one — staging was never isolated:** prod & staging shared one
   bot token (409 crash loop) AND `TMA_BASE_URL` was unset on staging so
   the dev bot opened the *prod* frontend → prod backend. So all "staging"
   testing actually hit prod. Plus shared Mongo DB.
6. **No `initData`** = Mini App not launched as a true Web App.
7. **Website link → homepage** = `startapp` opens the Mini App at its
   BotFather base URL (root); start_param wasn't routed to `/onboard`.

## Decisions / fixes made
- `db.js` env-driven: `MONGO_URI` + `MONGO_DB_NAME` → staging uses
  `majstr_staging` (separate DB, same cluster). Seed script
  `scripts/seed-staging-reference.js` copies reference collections.
- Bot URLs env-driven: `TMA_BASE_URL`, `PUBLIC_WEB_URL` (prod defaults
  preserve behaviour); `VITE_TMA_BOT_USERNAME` for the site's bot link.
- Diagnostics added: `[boot]` env fingerprint, granular
  `[miniapp-auth]`/`[auth]`/`[auth-jwt]` reject logs.
- `index.html` pre-router script routes `startapp=onboard-<lng>` → `/onboard`.
- Isolation model: separate dev bot token + `TMA_BASE_URL=dev.majstr.xyz`
  + Vercel develop-scoped `VITE_API_URL/VITE_APP_URL/VITE_TMA_BOT_USERNAME`
  + `MONGO_DB_NAME=majstr_staging` + Vercel password protection off on dev.

## Status
End-to-end onboarding works on staging; all 3 entry points (inline /start
button, Menu Button, website startapp link) reach the wizard in the right
language; prod re-enabled and isolated from staging.

## Open / deferred (needs the user)
- [ ] Full prod validation: complete a submission → admin Approve/Decline
      → localized owner DM, in a non-Ukrainian language.
- [ ] Native review of EN/IT/RU copy (backend/i18n.js, onboarding/i18n.tsx).
- [ ] Prod bot Mini App registered via BotFather `/newapp` (so website
      `startapp` opens a webview, not the chat) — verify.
- [ ] GH #75: lint `--max-warnings 0` vs pre-existing react-refresh
      warnings (cosmetic).
- [ ] Optional: Railway staging single-replica to silence 409 restart noise.
