# Meeting: Forward-to-bot lead intake (community-sourced masters)

Date: 2026-06-06

## What we discussed
A way to forward one or several Telegram messages (e.g. a "who can fix my iPhone?"
question + an "ask Georgy, +39…" answer) to the Majstr bot and have them turned
into a pre-filled master card. Discovered the existing **mining pipeline** already
provides ~80% of the machinery — the auto-miner deliberately *rejects* third-party
recommendations, which is exactly the content this feature captures. So instead of
a new backlog/UI, we added a new ingest source that feeds the existing Candidate
queue + `/admin/mining` review screen.

## Options considered
- **Reuse the Candidate queue + mining-review UI** (chosen) — zero new review UI;
  the queue's unused `kind:'recommendation'` is finally produced. Adds only an
  ingest path + a recommendation-friendly extractor.
- Build a parallel "forward backlog" store + screen — rejected as duplication of
  the mining review loop.
- Bot writes Candidates directly vs. bot → internal HTTP API — chose direct write
  via a shared `mining/forwardIntake.js` service, since the bot already shares the
  API process's Mongo connection (runDB → runBot in index.js).
- LLM extract at intake vs. at review — chose intake, so the bot can reply with a
  summary and the card is pre-filled (name / phone / profession / city / tags).

## Decisions made
- **Access:** anyone who messages the bot may forward. Non-admin submissions are
  **deprioritized** in the queue (`reviewPriority = -1`) and **rate-limited**
  (12 bundles/hour, admins exempt, in-memory sliding window).
- **Publishing:** always to the review queue — nothing auto-publishes. Admin cards
  it manually, same as auto-mined leads.
- **Source label:** new `Master.source = 'community'` (distinct from `scraped` /
  `self_submitted`). Derived server-side from `Candidate.sourceType = 'forwarded'`.
- **Tags:** LLM suggests UA+EN tags; review UI gained editable comma-separated tag
  fields; `acceptCandidate` writes them to `Master.tags`.
- **City:** best-effort from `forward_from_chat.title` ("Ukrainians in Milano" →
  Milano) as an LLM hint; admin confirms in review. Title is only present for
  channels/public supergroups — graceful fallback otherwise.
- **Bundling:** Telegram sends each forward as a separate update, so the bot
  buffers per-chat with a 4s debounce and combines the burst into one Candidate.

## Implementation (shipped this session)
Backend:
- `database/schema/Master.js` — `'community'` added to `SOURCE_VALUES`.
- `database/schema/Candidate.js` — `sourceType:'forwarded'`, `extracted.tags`,
  `submittedBy`, `originChatTitle`, `reviewPriority`.
- `mining/forwardExtract.js` (new) — Claude Haiku 4.5 structured extractor that
  *embraces* third-party recs; emits tags + UA description; budget-guarded.
- `mining/forwardIntake.js` (new) — bundle → extract → idempotent Candidate write.
- `bot.js` — forward detection, debounce buffer, rate limiter, admin ping,
  confirmation replies.
- `i18n.js` — `forward.*` keys (uk/en/it/ru; others fall back to EN).
- `routes/miningReview.js` — accept derives source + writes tags; list sorts by
  `reviewPriority` (aggregation + `$ifNull` so legacy docs stay in the normal tier);
  serializer exposes new fields; `tgLink` nulled for synthetic forward chat ids.

Frontend:
- `api/mining.ts` — types for tags, submitter, `forwarded` sourceType, nullable tgLink.
- `pages/MiningReview.tsx` — forwarded-lead provenance banner, editable UA/EN tag
  fields, tags in accept payload, nullable tgLink guard.

Verified: backend modules load, `node --check` on bot.js, schema `validateSync`
accepts new shapes, helper unit checks, frontend `tsc --noEmit` clean, no new lint
errors.

## Open questions / not done
- **No live end-to-end test** against Mongo Atlas + Anthropic (would write to the
  real mining cluster / spend API budget). Recommend a manual smoke test: forward a
  real Q+A to the bot in polling mode, confirm a `forwarded` candidate appears in
  `/admin/mining`, card it, confirm a `source:'community'` master is published.
- Forwarded **photos/screenshots** (no text) are not OCR'd — bot asks for text.
- Tag editing is comma-separated free text (no autocomplete against a tag lexicon).
- Rate-limit + debounce state is in-memory (fine for the single bot process;
  resets on restart).

## Next steps
- [ ] Manual smoke test of the full forward → review → publish flow.
- [ ] Decide whether community masters need a visible "community-sourced" badge on
      the public card (frontend `MasterCard` / schema already carries `source`).
- [ ] Consider a tag lexicon / autocomplete if tag quality matters.
- [ ] Optional: handle forwarded images via OCR or an attach-to-existing flow.
