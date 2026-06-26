# Meeting: Claim flow dead-blocked by an abandoned draft
Date: 2026-06-25

## What we discussed
Claiming a card via the profile banner failed in the Telegram app with
"Не вдалося, у вас вже є активна картка". Traced it to the `active_card_exists`
branch in `backend/routes/claims.js`. DB inspection (telegramID 7875548894,
user `konstaku`) showed the blocker was an empty, unsubmitted `draft` card
("Konstantin ok" — no profession/contacts) left over from a half-started
add-card attempt. Because `draft` is in `Master.ACTIVE_STATUSES` and the
one-card-per-owner partial unique index covers drafts, that cruft permanently
dead-ended the user out of claiming their real card.

## Options considered
- Data fix only (delete the stale draft) — unblocks now, but the pattern recurs
  for any user who pokes at "add card" then later claims.
- Exclude `draft` from the index/active check — can't: the index is a hard DB
  guarantee and the ownership transfer would still E11000.
- Supersede the draft on claim — when the only active card is an unsubmitted
  draft, delete it and proceed; a submitted card (pending/approved) still blocks.
  Chosen.

## Decisions made
- `submitClaim` now distinguishes a real submitted card from an abandoned draft:
  `pending`/`approved` → 409 `active_card_exists`; `draft` → deleted, claim proceeds.
- Added a regression test (claims suite 17/17 green).
- Deleted the stuck prod draft `6a3d55446fcc4de41bd8e529` to unblock immediately.
- Shipped via PR #142 → merged to main → Railway auto-deployed (SUCCESS, 2bf443ac).

## Open questions
- The manual admin-approval path (`claimCallbacks`) keeps its E11000 guard for
  the rare case where a user starts a *new* draft between claim-submit and
  approval. Left as-is (admin gets a clear alert); revisit only if it bites.

## Next steps
- [ ] Konstantin: retry the claim for chatID 7875548894 to confirm end-to-end.
