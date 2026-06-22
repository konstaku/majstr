# Phase 1 cutover runbook — retire the Vite app, serve everything from Next

Branch: `phase1-app-collapse`. Goal: make the Next app (`web/`, Vercel project
**majstr-frontend**) serve the Telegram Mini App surfaces (onboarding / claim /
my-cards / login / profile / admin) at **app.majstr.xyz**, retiring the standalone
Vite app (Vercel project **majstr**).

Key facts this relies on:
- `majstr-frontend` (Next) already serves the catalogue at `majstr.xyz` / `www`.
- `majstr` (Vite) serves the Mini App at `app.majstr.xyz` today.
- Backend `api.majstr.xyz` (Railway) already allows the `app.majstr.xyz` origin
  (CORS) and verifies Telegram initData against the **prod** bot token.
- Bot env `TMA_BASE_URL=app.majstr.xyz`, `FRONTEND_URL=majstr.xyz` — UNCHANGED by
  cutover (same hostnames), so **no BotFather / bot changes are needed**.
- `app.majstr.xyz` DNS already points at Vercel — cutover is a **Vercel project
  reassignment**, not a DNS change.

---

## 1d — CUTOVER

### Step 0 — Pre-flight (do once, before touching prod)
- [ ] Branch is green: `cd web && npm run typecheck && npm test && npm run build`.
- [ ] Open a PR `phase1-app-collapse` → `develop`, review the diff.
- [ ] Confirm `app.majstr.xyz` is in `ALLOWED_ORIGINS` on the prod backend
      (Railway → majstr-api → production → Variables). It is today; just confirm.

### Step 1 — Drop the `SPA_ORIGIN` redirect block (code)
The host-separation `middleware.ts` now owns app↔apex redirects, so the legacy
`next.config.js` `SPA_ORIGIN` redirects are redundant. Remove that block (the
`SPA_ORIGIN` const + the `redirects()` body) from `web/next.config.js`. Safe BEFORE
the domain move: middleware still routes `majstr.xyz/onboard` → `app.majstr.xyz`
(Vite) until the move flips it to Next.
- [ ] Edit `web/next.config.js`, commit on the branch.

### Step 2 — Land the collapse in production
Production = whatever `majstr-frontend` builds from `main`.
- [ ] Merge `phase1-app-collapse` → `develop` → `main` (your normal flow).
- [ ] Watch the `majstr-frontend` production deploy go READY (Vercel dashboard).
- [ ] **Sanity check — nothing user-visible changed yet:**
  - `majstr.xyz` catalogue loads normally (it was already Next).
  - `majstr.xyz/onboard` → 308 redirects to `app.majstr.xyz/onboard` (still Vite — fine).
  - The Mini App in `@majstr_prod_bot` still works (still hitting Vite). ✅ reversible point.

### Step 3 — The switch: move `app.majstr.xyz` to the Next project
In the Vercel dashboard:
1. **majstr-frontend → Settings → Domains → Add Domain →** `app.majstr.xyz`.
2. Vercel detects it's assigned to the `majstr` (Vite) project and offers to
   **move** it — confirm. (DNS is unchanged; only the project assignment moves.)
3. Wait for it to show **Valid Configuration** on `majstr-frontend`.

That's the cutover. `app.majstr.xyz/onboard` now serves the Next `(app)` route.

### Step 4 — Verify end-to-end in `@majstr_prod_bot` (the real env)
This is where authed flows finally work for real (whitelisted origin + prod bot
token → initData validates):
- [ ] Open the bot → Add master (`/onboard`): wizard loads, **name prefills**,
      photo step works (real TG photo fetch), advance through all 5 steps.
- [ ] **Submit** → success screen; admin gets the Telegram moderation message;
      the master appears as `pending`.
- [ ] My cards (`/my-cards`): your submitted/owned cards load and edit/save.
- [ ] Claim deep link: open a `t.me/<bot>?startapp=claim-<id>` link → `/claim`
      lands, claim succeeds, share button works.
- [ ] Admin: `app.majstr.xyz/admin` (logged in as admin) lists pending; `/admin/mining` loads.
- [ ] Catalogue unaffected: `majstr.xyz/uk`, a city page, a master page all load.
- [ ] Cross-host guards: `app.majstr.xyz/uk/nice` → 308 to `majstr.xyz`;
      `majstr.xyz/onboard` → 308 to `app.majstr.xyz`.

### Step 5 — Rollback (if anything above fails)
Instant, no code revert needed — the Vite project is untouched and still deployed:
1. **majstr (Vite) → Settings → Domains → Add** `app.majstr.xyz` (move it back).
2. (Optional) re-add the `SPA_ORIGIN` env on `majstr-frontend` if you reverted Step 1.
Then debug on a preview and retry.

---

## 1e — Cleanup (after a bake period, e.g. a few days stable)
- [ ] Retarget/trim the e2e suite to the Next app (see scope doc — catalogue specs
      need server-side stubbing, not page.route(); claim.spec retargets directly).
- [ ] Delete `frontend/` (the whole Vite app) + `frontend/vercel.json`.
- [ ] In Vercel, delete (or leave paused) the `majstr` (Vite) project.
- [ ] Remove the now-unused `SPA_ORIGIN` env var from `majstr-frontend`.
- [ ] Update `CLAUDE.md`: architecture (web/ now serves catalogue + app surfaces;
      Vite retired), commands (drop `frontend/` scripts), and the e2e note.

---

## 1f — Auth hardening (separate PR, post-cutover; OPTIONAL)
Goal: move the **web** JWT out of localStorage (XSS-exposed) into a first-party
httpOnly cookie. The TMA initData path is unchanged.
- Add a Next route handler (e.g. `app/api/session/route.ts`) that takes the
  bot-issued token, validates it (or proxies the backend), and sets an httpOnly,
  Secure, SameSite cookie on `app.majstr.xyz`.
- The web branch of `apiFetch` then relies on the cookie (same-origin) instead of
  `localStorage.token`; or a Next handler proxies the backend with it attached.
- Keep it isolated from the collapse so it can't add migration risk.

---

## THEN — admin-add feature (`/add` rework)
See `meetings/2026-06-22_admin-add-master-feature.md`. Summary:
- **Backend:** new admin-only submit endpoint (e.g. `POST /api/admin/masters`) that
  creates `source:'admin_created'`, `claimable:true`, `status:'approved'`, no owner
  — reuse the shape of `routes/miningReview.js` `acceptCandidate`.
- **Frontend:** `/add` = admin-gated (check `isAdmin`); mount `OnboardingWizard` in
  an "admin mode" that submits via the new endpoint (not the per-user draft).
- **Inline create:** add a "+ Add new" affordance to `onboarding/ui/PickerSheet`
  for category / profession / city → reuse the existing `components/mining/
  InlineCreate` widget → POST the admin reference endpoints (already exist) →
  refetch + auto-select. (Cities require `countryID`; FR is seeded.)
