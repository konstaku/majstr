# Feature: admin "add master on behalf" (/add rework)
Date: 2026-06-22
Parent: Phase 1 app-collapse (`meetings/2026-06-21_phase1-app-collapse-scope.md`)

## Context
The legacy `/add` web form (frontend `AddNewRecord.tsx`, ~695 lines) is being
RETIRED, not ported. `/add` is reborn as an admin tool: an admin creates a master
card "as if the master did it themselves." Sequenced AFTER the collapse cutover —
built on the unified Next onboarding wizard.

## Requirements
- (a) **Admin-only** — gate `/add` on the authenticated user's admin flag.
- (b) **Fully replicate the master flow** — reuse `OnboardingWizard` (same 5 steps),
  not a separate form.
- (c) **Inline reference creation** — from within /add the admin can add a new
  profession category, profession, and city without leaving the flow.

## Decisions (2026-06-22)
- **Ownership model: claimable `admin_created` card.** On submit, create a Master
  with `source:'admin_created'`, `claimable:true`, `status:'approved'` (admin
  auto-approves), NO `ownerUserID`. The real master can later claim it via the
  existing claim→share loop. Mirrors how mining-accepted cards already work; avoids
  the one-active-card-per-user constraint.
- **Sequencing: after the collapse cutover.** Finish porting Admin + MiningReview +
  middleware, cut over (retire Vite), THEN build this on the stable unified wizard.

## Implementation notes
- Backend reference-create endpoints ALREADY EXIST (admin-gated):
  `POST /api/reference/professions | prof-categories | locations` — `locations`
  validates `countryID` (so FR cities can be added inline now that FR is seeded).
- Submission path: the current draft submit is per-user-owned + one-card constraint,
  so admin-add needs a distinct submit that creates the unowned claimable
  admin_created master (new endpoint e.g. `POST /api/admin/masters`, reusing the
  mining-accept creation shape — see `routes/miningReview.js` acceptCandidate).
- Frontend: reuse `OnboardingWizard` in an "admin mode" prop; pickers
  (`onboarding/ui/PickerSheet`) gain a "+ Add new" affordance → inline form → admin
  reference endpoint → refetch + auto-select.
- Admin gate: reuse `useAuthenticateUser` / `/auth` (returns isAdmin) or the admin
  Telegram ID check.

## Open questions
- Does the admin pick the country in admin-add (IT vs FR), or default IT? (Ties into
  the Phase 3 onboarding country picker — likely share that work.)
