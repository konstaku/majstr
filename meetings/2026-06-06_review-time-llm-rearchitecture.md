# Meeting: Move LLM from bot-intake to review-time (+ screenshot OCR)

Date: 2026-06-06

## What we discussed
The bot runs on a server; Ollama runs on the user's home machine. So the earlier
design (bot calls Ollama at intake) is broken in production — the server can't
reach `localhost:11434` at home. Re-architected to the user's desired flow:

1. Forwarded messages → bot stores RAW text/screenshots in Mongo (no LLM).
2. User opens the local review page (home machine) → it runs THEIR Ollama to turn
   raw items into cards (one at a time, or "process all").
3. Accept → live master; Decline → removed.

Plus: OCR screenshots, because people share contacts as images.

## Decisions
- LLM moves from intake (server bot) to review-time (reviewer's machine).
- New Candidate status `raw` = stored but not LLM-processed. `raw → new` on process.
- Screenshots: bot downloads to S3 at intake; OCR at process time via a local
  Ollama VISION model (`OLLAMA_VISION_MODEL`, default `qwen2.5vl`). Graceful: if no
  vision model, image is still saved + shown for manual reading.
- qwen2.5:14b (text) cannot read images — a vision variant must be pulled
  (`ollama pull qwen2.5vl`).

## Implementation
- `Candidate.js`: status `raw` added; `images:[{url,fileId,ocrText}]`, `processedAt`;
  `text`/`score`/`classifier*` relaxed (raw has none yet). Serializer exposes
  `images` + `processedAt`.
- `mining/forwardIntake.js` split:
  - `storeRawForward()` (bot) — saves raw Candidate, no LLM.
  - `processCandidate(id)` (reviewer machine) — OCRs screenshots, runs Ollama text
    extractor on text+OCR, fills extraction/score/kind, flips `raw→new`, annotates
    duplicate.
- `mining/visionOcr.js` (new) — `ocrImageUrl()` via Ollama vision model; graceful ''.
- `helpers/telegramFileToS3.js` (new) — download Telegram file_id → S3 (`forward-images/`).
- `bot.js`: captures forwarded photos, downloads to S3, calls `storeRawForward`
  (no Ollama). New reply `forward.savedRaw`. Removed intake-time LLM/dedup/summary.
- `scripts/local-queue-server.js`: `POST /api/local/process/:id`; paste box now
  stores+processes; UI split into "Unprocessed (raw)" (Process / Process-all /
  Discard, with screenshot thumbnails) and "Ready to review" (full editable card,
  + "Re-run LLM"). Reads both `status=raw` and `status=new`.
- `frontend/src/api/mining.ts`: `raw` status, `images`, `processedAt` on the type.

## Verification (live, against Atlas + local Ollama)
- `storeRawForward` (bot path) → raw Candidate, score 0, no extraction, status `raw`;
  appeared in the `status=raw` queue.
- `processCandidate` via `/api/local/process/:id` → Ollama extracted
  "Андрій / ремонт пральної машини / Турин (from chat title) / @andriy_fix_to
  (telegram-typed) / score 1", flipped to `new`; left the raw queue, entered ready.
- Cleanup done. All backend files `node --check`; frontend `tsc` clean.
- Image OCR path: code in place + graceful fallback, NOT live-tested (no vision
  model pulled here, no real screenshot).

## How it runs (the answer to "when does my LLM start working")
- Server: `bot.js` only stores raw. No Ollama needed there.
- Home machine: `cd backend && npm run review` (needs `ollama serve` with a text
  model + a vision model). Open http://127.0.0.1:4300 → Process raw → review →
  Approve/Decline. Paste box works without Telegram at all.

## Next steps
- [ ] `ollama pull qwen2.5vl` (or set OLLAMA_VISION_MODEL) to enable screenshot OCR.
- [ ] Real Telegram smoke test: forward text + a screenshot to the bot, then
      Process in the local tool; confirm OCR text + extraction.
- [ ] Decide retention for `forward-images/` in S3 (cleanup after carded/declined?).
- [ ] Optional: a "process all raw" cap / batching if the raw queue gets large.
