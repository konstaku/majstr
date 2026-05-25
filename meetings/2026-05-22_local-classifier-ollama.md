# Meeting: Local Ollama classifier — Mistral rejected, Qwen2.5 14B adopted
Date: 2026-05-22

## What we discussed
Implementing issue #114 — a zero-cost local classifier for the Telegram
master-mining pipeline, since the $5 Anthropic key is ~80% spent. Installed
Ollama on the Mac Mini M1 (16 GB), built the `ollama.js` adapter, and evaluated
local models against the three human-labeled fixtures (326 units) to compare
with the Haiku 4.5 baseline (≈67%/69%).

## Options considered
- **Mistral 7B** — fast, small (~4.4 GB). Eval: **18.9% precision**, flagged 86%
  of all messages as useful, fabricated contacts/professions to fill required
  schema fields. Rejected.
- **Mistral Small 24B** — better quality expected, but ~14 GB on a 16 GB Mac =
  memory-pressured and slow. Not pursued once Qwen 14B worked.
- **Qwen2.5 14B** — ~9 GB, fits 16 GB comfortably, strong multilingual +
  structured output. Eval: **67.3% precision / 67.3% recall** — parity with
  Haiku. Adopted.
- **Abandon local, refill the Haiku key** — kept as the fallback; not needed.

## Decisions made
- **Qwen2.5 14B is the local classifier**, set as the default `OLLAMA_MODEL` in
  `ollama.js`. Parity with Haiku, zero cost, fully offline.
- **Mistral 7B is rejected** — documented in the adapter header so no one
  re-tries it. Confirms ADR 0001's concern about small models on UA/RU/IT
  code-switched chat.
- `ollama.js` reuses Haiku's prompt/schema/mapping verbatim via new shared
  exports (`_SCHEMA`, `_buildUserContent`, `_mapResult`) — single source of truth.
- `mine-classify.js` now selects the engine via the `CLASSIFIER` env var through
  the classifier registry; per-classifier verdict-cache files so Ollama runs
  never clobber the budget-funded Haiku cache.
- `mine-haiku-eval.js` renamed `mine-classifier-eval.js`, made engine-agnostic.
- Score normalization added to `_mapResult` — Qwen emits 0–100 confidence;
  rescaled to the 0–1 the classifier interface promises.

## Open questions
- Recall fixture: Qwen caught 0 of 3 deliberately-subtle positives. n=3 is
  within noise, but recall on hard recommendations is worth watching.
- Speed: ~16–20 s/unit warm on the M1. Fine for watcher mode; a full ~1,900-unit
  backfill re-run is an ~8–11 h overnight job.

## Next steps
- [ ] Close issue #114 (all tasks done — left open for board owner to close).
- [ ] When re-classifying a full corpus, run `CLASSIFIER=ollama` overnight.
- [ ] Still open on the mining board: dedup engine (#98/#99), full M3 dashboard.
- [ ] M6 GramJS watcher still gated on #103 ADR sign-off.
