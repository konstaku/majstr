# Meeting: Forward-intake refinements — recommendations, local LLM, dedup

Date: 2026-06-06

## What we discussed
Four corrections to the forward-to-bot intake feature built earlier the same day.

## Decisions made
1. **Auto-miner must NOT reject third-party recommendations.** That rule was only
   ever meant as an exception for one very large chat (ITALIA_CHAT_ID =
   '1441030224'). Removed the global rejection from the classifier prompt; kept the
   one-chat exception, which already lives in `mine-classify.js:217`
   (`chatID === ITALIA_CHAT_ID ? kind === 'announcement' : kind !== 'unknown'`).
2. **Writing to the Mongo cluster is fine** — enabled live testing + the backfill.
3. **Use the local Ollama LLM, not Anthropic** — for both chat parsing (auto-miner,
   already `CLASSIFIER=ollama`) and forwarded-lead extraction. No API spend.
4. **Prevent duplicate masters by shared contact** (phone / @handle / instagram)
   against already-published masters.

## Implementation
**#1 Recommendations:** `mining/classifier/adapters/haiku.js` SYSTEM_PROMPT → v2.0.0
(announcement OR recommendation are both useful; recommendation extracts the named
person). `mapResult` now emits `kind:'recommendation'`. `ollama.js` version → 1.5.0
(tracks the new prompt, shared verbatim). Italia stays announcement-only.

**#3 Local LLM:** `mining/forwardExtract.js` rewritten to call the Ollama HTTP API
(`/api/chat`, `format:SCHEMA`, temp 0, qwen2.5:14b) — dropped the Anthropic client
and budget guard. Keeps the recommendation-friendly prompt, tags, and city hint.

**#4 Duplicate prevention:**
- `Master.contactKeys` (normalized fingerprints) + pre-save hook that derives them
  from `contacts` via `mining/dedup.contactsToKeys`.
- `scripts/backfill-contact-keys.js` — backfilled all 322 existing masters (applied).
- `helpers/masterDuplicates.js` `findDuplicateMasters(contacts, opts)`.
- `acceptCandidate`: returns **409 `duplicate_master`** with the conflicts unless the
  admin passes `force:true`.
- `forwardIntake`: if a forwarded lead's contact already maps to a live master, skip
  queueing and the bot replies "already listed (name)".
- `listCandidates`: annotates each candidate with `duplicateMasters[]` (one extra
  query per page) so the admin sees the clash before clicking Approve.
- Frontend `MiningReview.tsx`: duplicate banner + "Publish anyway" (force) override.

**Bug fixed along the way:** `mining/dedup.classifyContact` tested `/tel/` for phones
BEFORE telegram, so "telegram" matched `tel` → handles were bucketed as phones,
`phoneKey` stripped them to null, and **Telegram handles were never deduped** (in the
auto-miner either). Reordered telegram/instagram before phone.

## Verification
- All touched backend files `node --check` + full require graph loads.
- Frontend `tsc --noEmit` clean; eslint clean on changed files (pre-existing
  MyCards.tsx error untouched).
- Backfill dry-run + apply against Atlas (322/322).
- `findDuplicateMasters` confirmed on real data (master "Ольга" → `tg:sochirca_olga`
  key now present; self-match works; bogus phone matches nothing).
- **Live end-to-end** forward intake via local Ollama on the Milano iPhone example →
  Георгій / ремонт iPhone / Мілано (city inferred from chat title) / phone typed /
  UA description / UA+EN tags / score 0.95. Test candidate deleted afterward.

## Open questions / next steps
- [ ] Real Telegram smoke test through the running bot (forward a live Q+A).
- [ ] Re-run `scripts/mine-classify.js` (CLASSIFIER=ollama) on non-Italia chats to
      see recommendation candidates flow into the queue; sanity-check volume.
- [ ] Optional: also enforce the duplicate guard on `POST /addmaster` / draft submit
      (currently only the mining accept path hard-blocks; self-submit vs. a claimable
      scraped card is intentionally a CLAIM, not a dup — needs thought before adding).
- [ ] Optional: "community-sourced" badge on the public master card.
