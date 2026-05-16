# Meeting: Provenance & Claim Architecture
Date: 2026-05-15

## What we discussed
User raised a business requirement that breaks the original ownership model: masters can be **created without a telegramID**, including by scraping open sources (Telegram chats for craftsman recommendations). Some of those subjects may later "claim" their card by proving identity through a verification flow. The data model and middleware must reflect that ownership ≠ telegramID match.

## Decisions made

### Master schema — new fields
- `source: enum['self_submitted','scraped','admin_created']` (default `self_submitted`)
- `sourceMetadata: Mixed` — free-form provenance (URL, channel name, scrape run ID, etc.)
- `claimable: Boolean` (default `false`, explicit flag — not derived)
- `claimedAt: Date` — moment current owner became owner (createdAt for self-submitted, claim approval time for claimed)

### loadOwnedMaster middleware
- **Dropped the telegramID fallback.** Ownership is `ownerUserID` match only (or admin). A telegramID on a master is *contact data*, not proof of identity — keeping the fallback would let scraped data create silent impersonation paths.

### Provenance backfill (migration Pass 2)
- Records with `ownerUserID` (8 total) → `source: 'self_submitted'`, `claimable: false`, `claimedAt: submittedAt`
- Records without `ownerUserID` (38 total) → `source: 'scraped'`, `claimable: true`

### Cleanup (migration Pass 3)
- Deleted test master `65db591b5b8e70b3e0c42856` (plumber-in-porto test card, was a dup-blocked record).

### MasterClaim collection — designed, not yet implemented
```
{
  masterID:          ObjectId ref Master,
  claimantUserID:    ObjectId ref User,
  claimantTelegramID: Number,
  evidence: [{
    type:  'phone_match' | 'social_handle' | 'admin_attestation' | 'other',
    value: String,
    notes: String,
  }],
  status:    'pending' | 'approved' | 'rejected' | 'withdrawn',
  reviewedBy: ObjectId ref User,
  reviewedAt: Date,
  reason:    String,
  // timestamps: true
}
```

Verification methods to consider when claim flow ships:
- Phone match: card has `+39 abc` in contacts, user's Telegram phone is `+39 abc` → auto-pass.
- Social handle match: card lists `@instagram_handle`, user proves they own it → admin review.
- Admin attestation: manual approval based on offline verification.
- SMS verification to the phone listed in card contacts.

## DB state after migration
- Total masters: 46
- All status: approved
- 8 self_submitted with ownerUserID
- 38 scraped, claimable, no ownerUserID

## Open questions
- Exact "approval" rule for claims when multiple candidates compete for the same scraped card (e.g., two phone numbers in contacts, two people claim) — defer until first incident.
- Whether scraped data with a `telegramID` field should keep that field even though it doesn't grant ownership — leaning yes (it's contact data the public sees), but flag if confusion arises.
- Multi-card per user (v2): the partial unique index on `ownerUserID` for active states blocks one user from owning two active masters. Will need to be dropped when we support multi-card profiles.

## Next steps
- [ ] User: start the Telegram bot locally and run the existing-flow smoke test (`/start` → submit → admin approve → public listing)
- [ ] When Phase 2 lands: scope owner CRUD endpoints so they only act on `ownerUserID`-matched records (already enforced by `loadOwnedMaster`)
- [ ] When Phase 3 lands: create `MasterClaim` schema + endpoints + admin review UI; tighten OG image generation to refresh only on relevant edits
