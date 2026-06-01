# Meeting: Roma classification — running in background, handoff for next session
Date: 2026-05-25

## What we discussed
Roma (Lazio) chat ingested and the local Qwen classification started before
the user clears this context. This note exists so the next session can pick
up cleanly without re-reading the whole transcript.

## What is running
- **Chat:** "Чат українців у Римі 🇮🇹"
- **chatID:** `1513619004`
- **Ingested:** 22,631 RawMessages (from 24,158 raw entries; the rest are
  service / empty).
- **Units to Qwen after the prefilter:** 1,243 (1,061 dropped — 65 pure-ack,
  1,464 no-thread-signal of 2,304 answers; plus 468 announcements).
- **Process:** `node scripts/mine-classify.js --chatId 1513619004` with
  `MONGO_DB_NAME=majstr_mining` and `CLASSIFIER=ollama`.
- **Started:** 2026-05-25, around the time of this note.
- **ETA:** ~9h 40m at the observed ~28 s/unit warm rate. May finish faster
  if repost-dedup hits anything.
- **Output (this-session-only):** `/private/tmp/.../tasks/bhg51vdi0.output`
  — that path will likely be gone in a future session. The CANONICAL state
  is the database + the verdict cache file.

## How to check status from a fresh session

```bash
# 1. Is the process still alive?
pgrep -fl "mine-classify.*1513619004"

# 2. From the DB — finishedAt populated means done:
cd backend
MONGO_DB_NAME=majstr_mining node -e '
require("dotenv").config();
const m = require("mongoose");
const {runDB} = require("./database/db");
const MiningRun = require("./database/schema/MiningRun");
const Candidate = require("./database/schema/Candidate");
(async () => {
  await runDB();
  const run = await MiningRun.findOne({chatID:"1513619004"}).sort({startedAt:-1}).lean();
  console.log("run:", run && run.finishedAt ? "DONE at " + run.finishedAt : "in progress");
  console.log("counts:", run && run.counts);
  console.log("candidates in DB:", await Candidate.countDocuments({chatID:"1513619004"}));
  await m.disconnect();
})();
'

# 3. Verdict cache (resumable progress):
ls -la chat-history/mining-cache/1513619004*.json
```

## If the run crashes (network blip etc.)

Just restart the same command — verdicts are cached per anchorMessageID, so
classified units skip Qwen. Crashes don't lose work:

```bash
cd backend
MONGO_DB_NAME=majstr_mining CLASSIFIER=ollama node scripts/mine-classify.js --chatId 1513619004
```

## When Roma is done — pick up the review

The Roma candidates flow into the same queue as Veneto / Milano / Torino /
Napoli. They'll appear in the CLI review tool, deduped + cross-border-filtered
automatically.

```bash
cd backend
node scripts/mine-review.js
# open http://localhost:4102
```

The header banner shows the suppression breakdown
(`duplicate-of` + `existing-master` + `cross-border-transport`).

End-of-day-before-Roma queue numbers (for comparison):
- 431 candidates with `status:'new'`
- 230 visible after dedup + filter
- 201 hidden (112 duplicates · 55 already published · 34 cross-border)

After Roma, expect roughly +200–350 new candidates (Roma is 2-3× Napoli's
size and similarly cleaner-than-Torino because it runs under
heuristic v1.2.0 + classifier prompt v1.4.0).

## Profile photos for new approvals

When you approve a scraped master with a public Telegram @handle, their
profile photo is fetched from the `t.me/<handle>` public page and uploaded
to S3 (key `scraped-photos/<masterId>.jpg`). No Bot API token needed for
this path (the helper was rewritten 2026-05-25 after the Bot API approach
failed 0/49). Fire-and-forget — admin's flow stays snappy; the photo
appears on the card a few seconds after approve.

## Active issues on the board
- **#119** open — phone numbers mis-classified as `contactType:'telegram'`
  (10% of scraped masters). Three-layer fix spec'd (validation, prompt,
  one-shot backfill). Not blocking review work.
- **#96 / #97 / #99 / #100** still open — feedback-loop tuning, metrics
  panel, fuzzy name dedup, merge/link UI. None blocking.
- **#103** still open — GramJS ToS/ban-risk ADR sign-off, gates M6 only.

## Decisions made
- Roma chat (`1513619004`) registered in `mine-classify.js` CHAT_REGION
  and default chat list — pending commit alongside this note.
- The user is clearing context; Roma keeps running detached. Next session
  starts from this note + the project memory.

## Open questions
- None blocking. The next session just needs to wait for Roma to finish,
  then review.

## Next steps
- [ ] Wait for Roma to finish (~9h 40m total runtime; check via the DB
      query in this note's "How to check status" block).
- [ ] Restart `mine-review.js`, work through the merged queue.
- [ ] When ready, push develop → main again to deploy any new mining work.
