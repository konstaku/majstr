# Meeting: Mini App Backend — Ship-Readiness Audit
Date: 2026-05-16

## What we discussed
Read-only evidence-based gap analysis of the TMA "add master" onboarding backend
against the governing specs, to decide if it can ship to production today. Verified
the project board's "B1-B6 + C1-C4 Done" claim against actual code.

## Options considered
- Ship today as-is — rejected: two production-critical chain breaks for non-admin users.
- Ship admin-only — possible but not the goal (admin path auto-approves and works).
- Hold for a minimum fix set — recommended.

## Decisions made (findings)
- BLOCKER 1: TMA-submitted master cards have no admin approval path. submitDraft
  (draft.js:134-139) sends a bare web link, not an inline Approve/Decline keyboard.
  bot.js callback router (bot.js:242-248) handles only `lang:` and `claim:` — no
  `master:` handler exists. Card stays `pending` forever for real users.
- BLOCKER 2 (friction #5 / board #68 CONFIRMED): No owner DM on submit and no
  master-card approval DM from the TMA path. Owner DM exists only in the JWT web
  route handleApproveMaster (index.js:292-303). friction inventory is correct.
- BLOCKER 3: submitDraft validates only name/professionID/contacts (draft.js:91-99).
  Photo is never required; Master schema has no `required` validators so
  validateSync() is a no-op. Missing photo -> broken/500 OG generation.
- BUG: PATCH accepts flat `tags` array (draft.js:25) but schema is `{ua,en}`
  (Master.js:20-23) -> malformed subdocument written.
- BUG: `languages` missing from PATCH DRAFT_FIELDS whitelist (draft.js:8-11).
- DONE & verified correct: routing/middleware/rate-limiter wiring (index.js:73-84),
  initData HMAC + 24h freshness + no dev bypass (requireMiniAppAuth.js:24-39),
  server-mediated photo upload with magic-byte MIME check (photo.js), full claims
  flow C1-C4 incl. admin keyboard + claimant DMs (claims.js, bot.js:388-472).
- VERIFY: ALLOWED_ORIGINS env must include https://app.majstr.xyz (defaults to '*',
  index.js:39-41 — not verifiable from code).

## Open questions
- Should the master-card admin flow reuse the claims inline-keyboard pattern verbatim?
- Confirm prod ALLOWED_ORIGINS value before deploy.

## Next steps
- [ ] Add `master:approve` / `master:decline` inline keyboard in submitDraft + bot.js
      callback handler (mirror handleClaimCallback)
- [ ] Add owner DM on submit ("received, under review") and on approval
- [ ] Require photo server-side in submitDraft (+ location/about); add schema validators
- [ ] Fix tags shape (flat array -> {ua,en}) and add `languages` to PATCH whitelist
- [ ] Confirm ALLOWED_ORIGINS includes https://app.majstr.xyz in prod env
