# Meeting: Onboarding UX Friction Inventory
Date: 2026-05-16

## What we discussed
UX audit of the current web onboarding flow and the planned TMA wizard for Ukrainian craftsperson listing. Reviewed code (bot.js, AddNewRecord.tsx, draft.js, Root.tsx, Login.tsx) and all prior research notes. Produced a severity-ranked friction inventory as input for sprint planning.

## Options considered
- Accept the current web flow as-is (baseline)
- TMA wizard (already specced and approved)
- Incremental web improvements alongside TMA

## Decisions made
- 8 friction points identified and ranked
- 3 HIGH severity, 3 MEDIUM severity, 2 LOW severity

## Friction points (summary)

| # | Point | Severity |
|---|---|---|
| 1 | No explanation before web-to-Telegram redirect fires | HIGH |
| 2 | No "what to prepare" preamble before form starts | HIGH |
| 3 | TMA pattern unfamiliar to older, non-technical users | MEDIUM |
| 4 | No unified experience across the multiple entry points | MEDIUM |
| 5 | Post-submission notification promise not backed by code | HIGH |
| 6 | Bio field has no scaffolding or examples | MEDIUM |
| 7 | Phone checkboxes imply multiple separate numbers | LOW |
| 8 | Web form has no draft persistence or cross-device recovery | LOW |

## Open questions
- Is approval DM notification wired for master cards (not just claims)? Code audit suggests it is not.
- Should the pre-departure modal be added to web before or after TMA ships?

## Next steps
- [ ] Fix post-submission notification: add bot.sendMessage on master card approval (HIGH, ~0.5 day)
- [ ] Add pre-departure modal on web "Add Master" CTA + improve bot /start first message (HIGH, ~1 day)
- [ ] Add "what to prepare" screen before TMA wizard Step 1 (HIGH, ~0.5 day, part of TMA sprint)
- [ ] Instrument Step 4 (bio) drop-off rate once TMA ships to determine if scaffolding fix is needed (MEDIUM, 1 hour after launch)
- [ ] Update phone checkbox labels on web form to "on this number" phrasing (LOW, 30 min)
