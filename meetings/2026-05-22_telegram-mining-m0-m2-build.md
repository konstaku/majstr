# Meeting: Telegram Master-Mining — M0–M2 Build & Pilot Review Tool
Date: 2026-05-22

## What we discussed
Executed the mining initiative from foundations through a working pilot:
ingested two chat exports, built and tuned the classifier, ran the full
corpus, and built a review tool that publishes scraped masters live. Spanned
2026-05-19 → 2026-05-22. Pilot scope grew from one chat (Veneto) to two
(Veneto + Milano) as a generalization check.

## Options considered
- **Labeling unit** — single message vs inquiry→reply thread. Chose
  **thread-aware**: most master data lives in the replies to "who knows a…"
  questions, assembled via same-author windowing.
- **Poster identity for self-offering replies** — store full Telegram identity
  vs hash-only vs display-name-only. Chose **display name only** (`fromName`):
  numeric id / @username never stored; contact still admin-fetched at review.
- **Classifier** — heuristic-only vs Ollama vs heuristic pre-filter + Haiku.
  Chose **Haiku 4.5**; Haiku prompt iterated v1.0→1.2 (F1 0.36→~0.69) by
  inspecting false positives/negatives.
- **Review → master** — create as `pending` for a second gate, vs publish
  live. Chose **publish live**: the in-tool review IS the quality gate, so
  Approve creates `status:'approved'` directly (with audit).
- **Mining DB** — isolated `majstr_mining` vs prod. Chose **isolated**;
  accepted masters cross over to the production DB on approval.

## Decisions made
- Pipeline is thread-aware (`backend/mining/thread.js`): inquiry → direct
  replies → same-author windowed bundles + standalone announcements.
- `RawMessage.fromName` persisted; `Candidate` schema reworked thread-aware
  (keyed by chatID + anchorMessageID).
- Haiku 4.5 classifier, v1.2 — JSON-schema output, prompt caching,
  `MINING_BUDGET_USD=5` hard guard. Cross-region ≈67% precision / 69% recall.
- Batch runner `mine-classify.js` ran the full corpus → **168 candidates**
  (Veneto 42, Milano 126). Verdicts cached for free re-runs.
- Review tool `mine-review.js`: per-candidate editable card; Approve publishes
  a `scraped`/`approved`/`claimable` Master to production with a MasterAudit;
  no Telegram bot involved. Instagram added as a contact type.
- Total Anthropic API spend ≈ $3.9 of the $5 key.

## Open questions
- **Dedup** — reposts produce multiple candidates for one master (e.g. barber
  "Марк" ×3). The M4 dedup engine (#98) is not built.
- **Recall** — pre-filter misses ~4–8% of useful messages (M7 metric work).
- **Full M3 dashboard** — metrics panel + decline-reason feedback loop unbuilt;
  only the minimal review tool exists.
- **GramJS watcher (M6)** — still gated on the ToS/ban-risk ADR sign-off.

## Next steps
- [ ] Continue reviewing the 168 candidates in the tool (publishes live)
- [ ] Build the M4 dedup engine (#98) to collapse reposts
- [ ] Decide whether to scale to more chats or harden first (M7)
- Board: https://github.com/users/konstaku/projects/4 · Tracking: konstaku/majstr#113
