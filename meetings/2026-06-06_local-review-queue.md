# Meeting: Local LLM review queue tool

Date: 2026-06-06

## What we discussed
Where/when the local Ollama processing actually runs, and a request for a local
interface to launch on the machine that waits for LLM results and shows a queue of
extracted masters, with a language selector.

## When does the local LLM run? (the answer)
Ollama runs at three trigger points — the review UI only *reads* the results:
1. **Forwarded messages** — when you forward a chat message to the bot while it's
   running (locally: `npm run devStart` with `WEBHOOK_URL` unset = polling mode;
   receiving forwards needs no HTTPS). The bot calls Ollama → writes a Candidate.
2. **Chat mining** — `CLASSIFIER=ollama node scripts/mine-classify.js`.
3. **Paste box in the new local tool** — paste text, it runs the forward extractor
   (Ollama) right there and adds a Candidate. No Telegram needed.

## Decision
Build a standalone, auth-free, localhost-only review server rather than bolt a
dev-auth bypass onto the React app. Reuses the production handlers verbatim so
dedup / tags / source labelling / accept / decline all behave identically.

## Implementation
`backend/scripts/local-queue-server.js` (+ `npm run review`):
- Express on `127.0.0.1:4300` (`--port` / `REVIEW_PORT` override). Binds localhost
  only; injects a stub admin user (no Telegram login).
- Mounts the real handlers: `GET /api/mining/candidates`, `.../accept`,
  `.../decline`, plus reference GETs and profession/location create.
- `POST /api/local/extract { text, chatTitle }` → runs `ingestForward` (Ollama) and
  drops the result in the queue.
- Self-contained vanilla-JS HTML page (no build step):
  - Paste box (with optional origin-chat-title city hint) → extract.
  - Auto-refreshing queue (polls every 5s) of LLM-extracted master cards: meta,
    forwarded provenance, **duplicate warning** (`duplicateMasters`), message text,
    editable name/profession/city/contacts/tags/description, Approve/Decline/Skip.
  - Approve handles the `duplicate_master` 409 with a "Publish anyway" (force) button.
  - **Language selector (UA/RU/EN/IT, UA+RU checked by default)**, persisted to
    localStorage; drives `pickName` order for profession/city dropdown labels.

## Verification
- `node --check` clean; server boots, connects to Atlas, serves the page, returns
  88 professions.
- Live end-to-end via local Ollama: pasted the Milano iPhone Q+A → candidate
  "Георгій / ремонт iPhone / Мілано (from chat title) / +39… / tags ua+en". Listed
  it from the queue with `duplicateMasters` annotation; declined test candidates to
  clean up. (Existing `new` queue depth ≈ 734 from prior mining runs.)

## Next steps
- [ ] Launch it yourself: `cd backend && npm run review` (with `ollama serve` up).
- [ ] Optional: inline "add profession/city" in the local page (endpoints already
      mounted; UI currently uses existing reference data only).
- [ ] Optional: filter/sort the big 734-item backlog by city or score in the tool.
