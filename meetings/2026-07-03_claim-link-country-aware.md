# Meeting: Country-aware claim links

Date: 2026-07-03

## What we discussed
An ownership claim came in from `@TKrie` for a card that wouldn't open from the
admin notification link. Investigated the DB, found the claim + master, diagnosed
why the link was dead, and fixed the notification + claimant share links to be
country-aware.

## Findings
- Claimant: user `@TKrie` (tg `387945330`) — two duplicate User docs for the same
  Telegram ID (TMA upsert race noted in `User.js`). Claim
  `6a479d52f712459d0e1f0420`, status `pending`, source `organic`, evidence =
  single `social_handle` "TKrie" (no phone/id → didn't auto-approve).
- Master: **Tetiana** (`6a3bf619db9574d86b8c3bde`) — beautician in **Menton,
  France** (`countryID: FR`), scraped card from community `beauty-ukrainians`.
- ⚠️ Evidence mismatch: claimant handle `@TKrie` ≠ card's Telegram `@ttetiana1989`.
  Claim rests only on self-assertion — confirm phone/photo before approving.

## Why the link was dead
- Admin notification hardcoded `https://majstr.xyz/?card=<id>` (Italy apex).
- The `?card=` handler (`web/app/page.tsx`) always resolves against the **IT**
  dataset (`getDataset()` defaults to `country="IT"`), regardless of host — so a
  France card is never found → silent `permanentRedirect('/uk')` to the IT home.
- Swapping only the host wouldn't help: `fr.majstr.xyz/?card=` still hits the same
  IT-only handler. Canonical `/{lang}/m/{slug}` IS host-rewritten by middleware
  (`fr.majstr.xyz/uk/m/... → /fr/uk/m/...`), so it renders correctly.

## Decisions made
- Fix `routes/claims.js`: add `siteForCountry(countryID)` (mirror of
  `scripts/set-community-invite.js`), and build both the admin notification link
  and the claimant `shareUrl` via
  `masterWebUrl(master, 'uk', siteForCountry(master.countryID))`.
- Use the canonical `/{lang}/m/{slug}` form, not the legacy `?card=` param.

## Follow-up (same session) — fixed everywhere
Extracted `siteForCountry` + `masterCardUrl` into `helpers/masterUrl.js` and routed
ALL user-facing card links through it (legacy `?card=` removed from live links):
`claimCallbacks.js`, `moderationCallbacks.js`, `verifyCallbacks.js`, `sharePack.js`,
`claims.js` (both), `draft.js` (/my-cards), `masterModeration.js`. Added 4 helper
unit tests. Full suite: 211 passing. `growthLoops.js` left alone (site-level
broadcast link, not a card).

## Open questions
- Duplicate User docs per Telegram ID — dedup pass still pending.

## Next steps
- [ ] Review/approve or reject the pending Tetiana claim given the handle mismatch
