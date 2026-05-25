# Meeting: M3 review-pipeline buildout — dashboard, dedup, cross-border, TG photos
Date: 2026-05-25
(Multi-day session: 2026-05-23 → 2026-05-25)

## What we discussed
Closed out the bulk of the M3 milestone (Admin Review Dashboard) and shipped
the practical fixes the user needed to actually clear the candidate queue at
scale: dedup, policy filters on cross-border transport, and auto-fetched
profile photos for scraped masters. Also ingested two new chats (Torino,
Napoli) through the now-clean pipeline.

## Options considered

- **Auto-spawn lexicon rebuild on every Profession-create** vs an **explicit
  rebuild endpoint** the dashboard calls after a batch.
- **Dashboard frontend** vs **CLI tool** for adding the inline-create
  profession/category/city flows. The dashboard wasn't end-to-end tested
  (needs HTTPS Telegram auth); the CLI is the actively-used surface.
- **Bot API `getChat('@handle')`** vs **t.me public profile page scrape**
  for fetching scraped-master photos. Bot API failed empirically (0/49 — it
  needs the user to have started the bot first; mined masters never have).
- **Aggressive pre-LLM dedup** vs **review-time dedup**. Pre-LLM saves Qwen
  time (modest on local Ollama), review-time saves the human's eyes (the
  actual UX pain).
- **Hard-rejecting cross-border transport in the heuristic** vs **prompt-level
  policy + review-time regex filter**. Prompt is canonical (correct
  decisions on future runs), filter cleans the existing queue.

## Decisions made

- **M3 backend (#116, #93, #94, #95, lexicon rebuild) shipped.** API has the
  full vocabulary the dashboard needs.
- **CLI mine-review.js is the production review surface today.** Web
  dashboard at `/admin/mining` is built but untested end-to-end; the user
  works through the CLI. So the inline-create profession/category/city
  flows + Rebuild lexicon button were ported into the CLI's HTML/JS, using
  the same core functions (`routes/referenceAdmin.js` refactored to expose
  `*Doc` plain async functions).
- **Lexicon rebuild = explicit endpoint** (`POST /api/admin/lexicon/rebuild`),
  single-flight via in-process mutex, env-scrubbed spawn. Lets the admin
  batch creates and rebuild once. Chosen over auto-spawn.
- **Cross-border transport between countries is NOT useful.** Classifier
  prompt v1.4.0 (haiku) / ollama v1.2.0 — explicit NOT USEFUL bullet with
  examples and a local-trasloco carve-out. Plus `mining/dedup.js`
  `isCrossBorderTransport()` review-time regex filter (border-place +
  transport-verb minus a LOCAL_MOVE whitelist). 34 of 388 candidates in the
  existing queue auto-hidden.
- **"I'll DM you the contact" pattern is NOT useful.** The deeplink follow-up
  workflow is deferred until there is more moderation capacity. (This
  decision was finalised in the 2026-05-23 session — see that note.)
- **Review-time dedup** (`mining/dedup.js` `applyDedup`): phone (last 9
  digits) + handle (lowercased, prefix-stripped) + soft (name+profId+city)
  tuple. Three suppression reasons: `existing-master` (cross-DB Master
  collision), `cross-border-transport`, `duplicate-of`. Stateless — sup­
  pressed candidates keep `status:'new'`. 133 of 388 duplicates and 55 of
  431 existing-Master collisions hidden at end of day.
- **#115 structural recall gap fixed** (heuristic v1.2.0). `isInquiry`
  excludes `hasOffer && (hasContact || profId)`; added first-person offer
  verbs (роблю / займа / делаю / знімаю) and photographer noun aliases
  (зйомка / зйомки / зйомок). +99 announcement units corpus-wide.
- **Scraped-master profile photos** (#117): Bot API approach rejected after
  0/49 success; switched to the **t.me public profile page scrape** —
  parse `og:image`, filter Telegram's default logo, download + S3 upload.
  Backfill ran on 49 eligible masters: **32 photos to S3 (65%)**, 12 users
  with no public photo, 5 with mis-classified phone-as-handle contacts
  (filed as #119).
- **Ingestion done for Torino (332 candidates, 12h Qwen run) and Napoli
  (44 candidates, 80 min).** Both used the same `majstr_mining` DB; the
  prompt + heuristic improvements all kicked in for Napoli; Torino was
  classified pre-#115, so a future re-run would surface ~20-60 more
  announcements.

## End-of-day pipeline numbers

- All-time candidates classified: ~500+ (Veneto + Milano + Torino + Napoli)
- Live Masters (`status:'approved'`): 149
- Queue (`status:'new'`): 431
- **After dedup + cross-border filter → 230 visible to review**
- Hidden: 201 = 112 duplicates + 55 existing-Master + 34 cross-border
- Profile photos on scraped Masters: 32 backfilled today

## Open questions

- **Web-scraping fragility for TG photos.** If Telegram changes the t.me
  page layout the og:image regex breaks. Acceptable for now; layout has
  been stable for years.
- **Dashboard vs CLI long-term.** The web dashboard is shipped but not
  used. Whether to invest in HTTPS / ngrok / staging-deploy testing of
  it, or to keep enriching the CLI, is unanswered.
- **Torino re-classification under v1.2.0 heuristic.** Would surface
  ~20-60 missed announcements. Not urgent — admin can re-run any time.
- **API budget.** ~$1.10 of $5 left on the Anthropic key, but all runs
  since 2026-05-22 have used local Qwen. Key may be untouched for weeks.

## Next steps

- [ ] **Today's primary objective**: the user reviews the 230-candidate
  deduped Napoli + Torino + Veneto + Milano queue via the CLI.
- [ ] **#119**: data-quality cleanup — phone-as-telegram-handle. Three
  layers spec'd (validation + prompt + one-shot backfill).
- [ ] **#96**: feedback-loop tuning from MiningFeedback (collection is
  now populated by the accept/decline endpoints).
- [ ] **#97**: metrics panel.
- [ ] **#99 / #100 polish**: fuzzy name matching, side-by-side merge UI.
- [ ] **Web dashboard E2E**: needs HTTPS auth path verified before
  switching from CLI.
- [ ] **Push develop -> main** when the user is ready (Vercel deploys
  from main only).

## Commits this session (on `develop`, not pushed)
- `9c5deb8d feat(mining): local Qwen2.5 classifier via Ollama adapter`
- `7deb333f feat(mining): pre-classification filters + repost dedup + lexicon enrichment`
- `22837dc0 fix(mining): treat DM-promise replies as not-useful; safer thread-aware prefilter`
- `2814dd03 feat(api): admin-create Profession / ProfCategory / Location (M3 #116)`
- `51498ad5 feat(api): mining review queue + accept/decline endpoints, lexicon rebuild (M3 #93 #94)`
- `af2c550d feat(frontend): admin mining-review dashboard at /admin/mining (M3 #95)`
- `248a8bfb fix(mining): specialist self-announcements with a request cue (#115)`
- `4aee30cd feat(mining-cli): inline-create profession / category / city + rebuild lexicon`
- `c5e5c387 feat(mining): review-time dedup + cross-border-transport filter + classifier v1.4.0`
- `598feb60 feat(masters): auto-fetch Telegram profile photo for scraped masters on approval (#117)`
- `0c80a433 fix(masters): switch scraped-master photo fetch from Bot API to t.me scrape (#117)`
- Plus meeting/session notes.
