# Meeting: Claim-flow bug fixes (verification menu, edit-profession crash, re-claim error)
Date: 2026-06-15

## What we discussed
Walked through three bugs hit while going through the master-card claim process.
Investigated root causes and fixed all three.

## Bugs & root causes
- **Delete button too easy to mishit** — In `MyCards.tsx` the edit/hide/delete
  actions all shared `flex: 1 1 auto`, so Delete was as large as Edit.
- **"Edit profession" → website error, can't advance** — `PickerSheet` calls
  `useOnbT()`, which throws outside `<OnboardingI18nProvider>`. The standalone
  `/my-cards` route never wrapped the provider (only the wizard does), so opening
  the category/profession picker crashed into the router `errorElement`. (For a
  claimed card the category is pre-derived, so the profession picker is enabled
  directly — hence the symptom appeared on "edit profession".)
- **Re-opening own claim link → "вже має власника"** — In `claims.js` the
  `not_claimable` check ran BEFORE the `already_owner` check. Claiming sets
  `claimable:false`, so a returning owner hit the dead-end error instead of being
  routed to `/my-cards`.

## Decisions made
- Make **Edit** the primary action (full-width, larger); **Hide**/**Delete**
  become compact secondary buttons (`wizard-ghost-btn--primary` / `--compact`).
- Wrap `MyCards` in `OnboardingI18nProvider` (TelegramContext/Popup are already
  global in `main.tsx`, so only the i18n provider was missing).
- Reorder the claim checks: ownership before claimability, so `already_owner`
  wins and the client routes to `/my-cards`.

## Verification
- Backend: added a regression test (owner re-opens claimed card → `already_owner`);
  `claims.test.js` 16/16 pass.
- Frontend: `tsc --noEmit` and eslint clean.

## Testing safety net (added same session)
Goal: stop hunting these bugs by hand. Built two rings on top of the existing
Vitest + MSW + Playwright setup.

- **Route-smoke harness** (`frontend/src/test/renderRoute.tsx`): mounts a route
  through the *real* provider stack (main.tsx) + *real* route tree (router.tsx
  now exports `routes`). Faithful by design — a route forgetting a provider
  reproduces the production crash instead of being masked by a test wrapper.
  Tests in `frontend/src/pages/routeSmoke.test.tsx` cover /my-cards (opens the
  profession picker → the exact bug-2 path), /onboard, /claim. Verified it FAILS
  when the provider wrap is removed, then passes with it.
- **Playwright claim journey** (`e2e/tests/claim.spec.ts`): full claim → success
  → manage → open picker, plus the re-open → /my-cards loop. Fakes the Telegram
  bridge by intercepting telegram-web-app.js (the real script installs an empty
  initData on the web and would defeat isTMA()).

Result: bug-2 class (missing provider / bad API shape) and bug-3 (claim
ordering) are now covered at unit + e2e. Bug-1 has a cheap class-presence guard;
true visual regression was deliberately skipped.

Suite status: frontend 38/38, e2e 10/10, backend claims 16/16. Typecheck clean.

## Next steps
- [ ] Manually re-test once in the real TMA as a final sanity check (auth can't
      run in CI).
- [ ] When adding a new standalone route, add a one-line smoke test for it.
