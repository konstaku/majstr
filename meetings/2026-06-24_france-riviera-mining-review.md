# Meeting: France Riviera chat mining + incremental review
Date: 2026-06-24

## What we discussed
Process the `chat-history/france` export (УКРАЇНСЬКІ КРАСУНІ — Côte d'Azur beauty
services, chat 1678212416, 904 entries / 556 text) through local Ollama into the
review queue, same as the Italian batch. Requirement: review candidates *while*
Ollama is still classifying the rest, not only after the whole batch finishes.

## Key finding — incremental review was already supported
No architecture change was needed for the "review while processing" part. The
pipeline is two independent processes sharing the `majstr_mining` Mongo DB:
- `mine-classify.js` writes each Candidate the moment Ollama finishes it
  (per-batch checkpoint, upsert per unit, status `new`).
- `local-queue-server.js` (npm run review) auto-refreshes every 6s and lists
  candidates by source. So processed cards are reviewable immediately while the
  classifier keeps running. Resumable/cached, so a stop+resume is free.

## The real gap — country was hardcoded to Italy
The review tool assumed Italy. Fixed it to be country-aware, keyed by chat:
- New `mining/chatCountries.js` — `CHAT_COUNTRY` map (chatID→countryID, default IT).
- `local-queue-server.js`: derive `country` per candidate from `c.chatID`; use it
  for the accept payload `countryID`, filter the city dropdown to that country's
  cities, swap the 4th "languages spoken" flag (🇮🇹/🇫🇷), and default the
  Add-city modal country.
- Registered the France chat label "Nice" in `mining/chatRegions.js` and
  `scripts/mine-classify.js` CHAT_REGION (default city hint).

## Decisions made
- France chat 1678212416 → country FR, default city Nice.
- Reuse mine-import + mine-classify (CLASSIFIER=ollama) path, not the paste/forward
  path — identical to the Italian workflow.
- Keep the country map in code (one small file), default IT, so adding a country
  chat is a one-line edit.

## Run state (this session)
- `mine-import` → 556 text messages into `majstr_mining`.
- `mine-classify --chatId 1678212416 CLASSIFIER=ollama` → 147 units to classify;
  running in background, candidates landing under source "Nice".
- `npm run review` up at http://127.0.0.1:4300. Filter Source = "Nice" to review FR.

## Review UI rework (same session, second round)
Three operator requests against `scripts/local-queue-server.js`:
1. **Intent-first layout** — paste-snippet / raw-queue / process-all / rebuild-lexicon
   were on every screen. Split into two tabs: **Review** (default; only source +
   current card + prev/next) and **Tools** (everything secondary). Followed the
   user's own principle: one intent → only relevant info.
2. **Light theme + switcher** — light is now the default (dark was illegible);
   persisted toggle (☀️/🌙) flips `html[data-theme="dark"]`. All hardcoded field
   colours moved to CSS tokens so both themes are legible.
3. **Sender / handle finder** — per-card block: "Open message" (t.me link), sender
   display name, and the **@handles this author used**, each linking straight to the
   Telegram profile (`t.me/<handle>`), ranked by frequency.

## Correction — @handles ARE recoverable (my first read was wrong)
First pass I said usernames were impossible. Wrong: I only checked for a `username`
*field* (exports have none) and missed that exports carry **@handles in message
text** (71 in this chat, as `mention` entities → preserved in the stored `text`).
And the stored salted `fromHash` is exactly an author-clustering key. So
`/api/local/sender/:id` now: (a) regexes @handles + `t.me/<handle>` from the
candidate text, (b) finds all RawMessages with the same `fromHash` and harvests
their handles too, (c) returns them frequency-ranked. Verified: Екатерина 🥰 →
`@monaco_hair_nice` (×6), Yurii Voron → `@voronanskie` (×6). Caveat surfaced in the
UI: a handle in someone's message may be a referral, not them (e.g. Дмитро Огір
posted both `@dmytro_ogir` and `@Chala_Olena`) — so it's a verify-able lead, not
gospel. No data-policy change needed; `fromHash` used for its intended purpose.

## Bulk decline by handle (third round)
The decline `prompt()` is now a modal: reason dropdown + checkbox **"Decline all
other messages featuring this master"** + a handle field (prefilled from the
sender block's top discovered handle, or an extracted Telegram contact). On
confirm with the box checked → `POST /api/local/decline-by-handle` declines the
current card AND every queued (raw/new) candidate whose **text or contacts feature
that handle** — clears a repeat poster in one action. Mirrors `declineCandidate`
(status `declined` + MiningFeedback per item). Guards: bad reason / handle <3 chars
rejected; bogus handle = 0 declines (verified non-destructively). Caveat: decline
is not trivially reversible (a re-run of mine-classify won't resurrect declined
candidates — `$setOnInsert` only), so the handle is editable before confirming.

## Next steps
- [ ] Manually review the "Nice" source in the queue; Approve publishes a live FR
      master (countryID FR), Decline drops it.
- [ ] FR catalogue stays empty until masters are approved here — this is the seed.
- [ ] Add more FR chats later by extending CHAT_COUNTRY + CHAT_REGION.
- [ ] Decide if auto-@username is worth the data-policy change (re-import + GramJS).
