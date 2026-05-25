# Meeting: Cutting classifier volume — prefilter, repost dedup, lexicon enrichment
Date: 2026-05-22

## What we discussed
The local Qwen classifier is accurate but slow (~16–20 s/unit), so a full
~1,900-unit run is an overnight job. Looked at how to reduce how much data
reaches the LLM, and enriched the profession lexicon to grow the detectable
masters base. Key insight: ~94% of units historically came back "unknown" —
that noise is the target.

## Options considered
- **Content-hash dedup** — free, zero recall risk. Adopted.
- **Heuristic score-floor gate** — biggest cut but trades recall; not chosen,
  user picked explicit rule-based filters instead.
- **Profession-signal + pure-ack filters** — chosen. Drop thread answers with
  no profession/contact/link/lead-cue, and pure acknowledgement replies.
- **Lexicon enrichment** — hand-maintained alias file vs editing the generated
  lexicon. Alias file chosen (the lexicon is regenerated from the DB).

## Decisions made
- **Prefilter** (`mining/prefilter.js`): drop `pure-ack` and `no-thread-signal`
  thread answers before the LLM. The no-signal rule explicitly KEEPS the
  "I'll DM you the contact" pattern, links and self-offers — first cut lost
  19/97 real candidates; after adding lead-cue detection it lost 0/97.
- **Repost dedup**: content-hash verdict cache in `mine-classify.js` — identical
  reposted text reuses one verdict, no extra classifier call.
- **Lexicon enrichment**: `mining/data/profession-aliases.json`, hand-maintained,
  merged on top of the generated lexicon by `heuristic.js` (survives
  `mine-build-lexicon.js` rebuilds). Colloquial/misspelled/specialty terms
  across UA/RU/IT. Added mining-only signal buckets: caregiver, nurse, mover,
  realtor, guide, singer, driver, event_host, gardener, it_specialist.
- **Measurement gate**: `mine-prefilter-eval.js` — recall/volume vs fixtures.

## Results (measured, 2026-05-22)
- Corpus units to Qwen: **1,946 → 983 (49% fewer)**.
- Real candidate recall: **0 of 97 thread-answer candidates dropped**.
- Fixture check: 3 "useful"-labeled answers dropped, all uncl­assifiable
  mislabels (reply text was ".", "Так", "В газенваген?").

## Open questions
- Filter volume cut depends on the lexicon staying current — re-run
  `mine-prefilter-eval.js` whenever the lexicon or filters change.

## Next steps
- [x] Issue #115 filed — specialist self-announcements with a request cue are
  misfiled as inquiries and never classified (structural recall gap).
- [ ] Dedup engine #99 (near-identical reposts) still open.
- [ ] Next full corpus re-classification: run `CLASSIFIER=ollama` overnight —
  now ~half the units.
