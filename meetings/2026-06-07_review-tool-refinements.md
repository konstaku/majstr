# Meeting: Review-tool refinements — source switch, languages, UA tags

Date: 2026-06-07

## What we discussed
Four follow-ups after first trying the local review tool.

## Q&A / decisions
1. **"Will the bot pick up messages sent while Ollama was off?"** — Yes. The bot no
   longer uses Ollama at all; it only stores RAW forwards to Mongo. Ollama runs only
   at review time on the local machine. Caveat: the *bot process* must be running to
   receive the forward (polling mode holds updates ~24h; webhook retries are
   time-limited). Anything received sits as `status:'raw'` until you Process it.
2. **Per-master language checkboxes** (not the global "display languages" block I'd
   added) — each card now has 4 spoken-language checkboxes UA/RU/EN/IT, UA+RU checked
   by default; written to `Master.languages` on accept. Removed the display-language
   selector; profession/city dropdown labels now use a fixed UA→RU→EN→IT preference.
3. **Source dropdown** — switch the queue between "📨 Forwarded (bot)" and each mined
   chat (Roma/Torino/Milano/…), with counts. Backed by `GET /api/local/sources` +
   new `sourceType`/`chatID` filters on the candidates list. Default = Forwarded.
4. **Tags = UA only, pre-populated** — removed the EN tags field; the single UA tags
   input is pre-filled from the LLM's extraction of the announcement/description.

## Implementation
- `routes/miningReview.js`: `listCandidates` accepts `sourceType` + `chatID`;
  `acceptCandidate` writes `master.languages`.
- `mining/chatRegions.js` (new): chatID→label map (shared with mine-classify intent).
- `scripts/local-queue-server.js`: `GET /api/local/sources`; header Source dropdown
  (persisted to localStorage); per-card Languages checkboxes; UA-only tags; fixed
  pickName preference; removed the display-languages block.
- `frontend/src/api/mining.ts`: `languages?` on MasterPayload.

## Verification (live, Atlas + local Ollama)
- Sources endpoint lists Forwarded + each chat with counts (Roma 223, Torino 171,
  Milano 70, …). Forwarded filter returns only forwarded; Milano filter returns only
  that chat (no forwarded).
- raw forward → process → accept with `languages:['ua','ru']`, `tags.ua:['електрика',
  'проводка']` → Master had `languages:["ua","ru"]`, `tags.ua` set, `tags.en:[]`,
  `source:'community'`. Test master deleted.

## Notes / next
- Only the LOCAL tool got the source dropdown / language checkboxes / UA-tags UI; the
  hosted React `/admin/mining` page is unchanged (backend accept supports languages
  for both).
- `mine-classify.js` still has its own inline CHAT_REGION copy (chatRegions.js added
  for the tool); could DRY later.
