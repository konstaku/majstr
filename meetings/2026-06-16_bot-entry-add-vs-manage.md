# Meeting: Bot entry — Add card vs Manage card by ownership
Date: 2026-06-16

## What we discussed
Opening the bot always showed the "add master" screen. Wanted: a user with no
card sees Add; a user who already owns a card sees Manage (edit/delete). Mapped
the two entry points and implemented both layers.

## How it worked before
The Mini App always opens at `${TMA_BASE_URL}/onboard` (the add wizard),
referenced from two independent places:
1. The bot's welcome inline button (`bot/startFlow.js`).
2. The Telegram menu button / Main Mini App — set in BotFather (NOT in code), a
   static URL.

## Decisions / implementation
- **Layer 1 — app-side dispatcher (covers the menu button, no BotFather change).**
  `frontend/src/onboarding/OnboardingWizard.tsx` now checks `GET /api/masters/mine`
  on launch (`useOwnedCardRedirect`): if the user owns a submitted card
  (status pending/approved/archived — NOT draft, so a half-finished wizard
  resumes) it `navigate("/my-cards", { replace })`; otherwise the wizard renders.
  Shows a skeleton while deciding. Claim deep links still win (checked first).
- **Layer 2 — bot welcome button label.** `bot/startFlow.js` `buildWelcomeKeyboard`
  now takes `hasCard`; an owner gets "🛠 Manage my card" → `/my-cards`, others
  get "➕ Add my master card" → `/onboard`. Ownership via new `userOwnsCard()`
  (`Master.exists({ ownerUserID, status ∈ [...] })`). `handleStart` and the
  language-switch callback both compute it; the website fallback link path also
  switches add ↔ my-cards. New i18n string `btn.manageCard` (uk/en).

## Why these statuses
"Owns a card" deliberately excludes `draft` in BOTH layers, so a user who
started but didn't finish the add wizard resumes it instead of bouncing to
Manage.

## Verification
- frontend: tsc + eslint clean, vitest 39/39 (added an /onboard→/my-cards
  redirect smoke test).
- backend: 168/168, bot 26/26 (new `test/bot/startFlow.test.js`).
- e2e: 10/10.

## Deploy note
Layer 1 ships with the frontend; Layer 2 is in the backend (Railway — see
[[reference_backend_deploy]]). Backend must redeploy for the welcome-button
label to change. The Telegram menu button text is static (BotFather); set it to
something neutral if it still reads "add"-specific.
