# Meeting: Onboarding draft chooser + why FR still showed Italy
Date: 2026-06-26

## What we discussed
After shipping the host→country plumbing (PR #143), opening onboarding from
fr.majstr.xyz still showed Italy with Italian cities. Root cause: the tester
(konstaku) had a pre-existing **IT draft**, and the wizard silently auto-resumed
it — `useDraft` re-hydrates the form from the saved draft, so its `countryID:IT`
overrode the FR default from the entry host. A brand-new FR user already worked;
only users with a stale draft were stuck.

The user then asked for a better UX: when a draft exists, show it and let them
edit / delete / create a new entry.

## Options considered
- Force the entry-host country to override a saved draft's country — fragile
  (a bot-direct open has no host signal and would wrongly reset to IT); also
  hides that a draft exists.
- **Draft chooser at onboarding entry** (chosen) — surfaces the draft and lets
  the user decide. Cleanly fixes the country complaint: "Start over" makes a
  fresh entry that picks up the host country.

## Decisions made
- One active card per owner stays. "Create a new entry" therefore **replaces**
  the existing draft (confirm → delete → fresh wizard). (User chose this over
  lifting the rule to allow multiple drafts.)
- `/onboard` entry now branches: owner of a live card → /my-cards; a draft →
  chooser (Continue editing / Start over / Delete draft); fresh user → wizard.
- "Continue editing" keeps the draft as-is (its own country). "Start over" and
  "Delete" call `DELETE /api/masters/draft`; start-over then mounts a fresh
  wizard whose `countryID` comes from the entry host (FR).
- Country stays host-driven and read-only in the wizard (not user-editable);
  `entryCountrySignal` kept internal to country.ts.

## Open questions
- Telegram caches Mini App bundles aggressively — after deploy the tester may
  need to fully close/reopen Telegram (or clear cache) to get the new JS.
- No component-render tests exist in web/; the chooser is covered by typecheck +
  manual smoke only. Revisit if we add RTL.

## Next steps
- [ ] Ship (branch → PR → main; Vercel auto-deploys web/).
- [ ] Smoke: fr.majstr.xyz → add card → (with a draft) see chooser; Start over →
      wizard shows France + FR cities; submitted master lands in FR catalogue.
