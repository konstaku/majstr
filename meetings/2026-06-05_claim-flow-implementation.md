# Meeting: Claim Flow Implementation
Date: 2026-06-05

## What we discussed
Implemented the end-to-end flow for a person to claim a scraped master card if their Telegram handle matches the one on the card, and manage the card (edit/hide/delete) after claiming.

## Options considered
- Telegram handle match (frontend sends username, backend compares against card's telegram contacts) — chosen
- Telegram numeric ID match (`master.telegramID === req.user.telegramID`) — also auto-approves; strongest proof
- Phone match — already existed; kept
- Admin queue — fallback for all cases where no match found

## Decisions made
- Auto-approve when: phone match OR telegram @handle match OR telegramID match (numeric)
- Admin claims always queue for paper trail (existing decision 2026-05-16, unchanged)
- `social_handle` evidence always recorded when user has a username (even if didn't match)
- Management UI lives at `/my-cards` page (not in modal directly for edit — edit is a full form)
- Modal shows: claim button (for claimable cards when logged in), manage bar (edit link + hide/delete) for owned cards
- Ownership check in modal: fetch `/api/masters/mine` lazily on modal open when user is logged in
- Hard delete (not soft-delete) for owner-initiated deletion
- `validatePatch` and `DRAFT_FIELDS` exported from `routes/draft.js` and reused in `routes/ownedMaster.js`

## Open questions
- Should hide restore the card to the approval queue, or directly back to approved? Currently restores to approved directly.
- Profile page or nav link to `/my-cards` not added yet — users reach it via claim success link in modal.

## Next steps
- [ ] Add "My Cards" link in nav or profile page once user session is present
- [ ] Optionally add photo edit on MyCards page (currently skipped — complex upload flow)
- [ ] Test with a real scraped card that has a matching Telegram contact
