# Meeting: "I'll DM you the contact" reclassified as NOT useful
Date: 2026-05-23

## What we discussed
User correction to the previous design (2026-05-22 prefilter/lexicon session):
a bare "I'll DM you the contact" reply ("написала вам", "можу дати контакт",
"скину в приват") **is not useful** — it has no public mention of a master
and the contact exchange happens in private where the pipeline can't record
it. This overrides both the old classifier prompt and the lead-cue rescue in
the prefilter.

## Options considered
- **Encode in classifier prompt only** — leaves wasted Qwen calls on DM-promise
  units that the prefilter would still rescue. Rejected.
- **Aggressive answer-centric prefilter (name detection)** — tried; brittle
  (false-drops on self-offers like "я займаюся брейдами", on bare instagram
  handles, on first-person verbs). Heuristic name detection produces too many
  false drops to ship. Rejected.
- **Thread-aware prefilter, classifier as precision gate** — adopted. Clean
  separation of concerns.

## Decisions made
- **Classifier prompt** (`haiku.js` SYSTEM_PROMPT v1.3.0): DM-promise without
  a name or link is now in NOT USEFUL. Self-offering responders and named /
  linked recommendations remain useful.
- **`ollama.js` VERSION → 1.1.0** to track the shared prompt change. Cached
  verdicts under the old prompt are invalidated and re-classified.
- **Prefilter architecture clarified** (`mining/prefilter.js`):
  - It is a SAFE volume cut. It does NOT try to identify the DM-promise
    pattern (that needs context). The classifier is the precision gate.
  - Drop only: `pure-ack` (only chatter/emoji) and `no-thread-signal` (no
    profession anywhere, no contact, no link, no self-offer).
  - Added social-platform mentions (instagram/телеграм/viber/...) as link
    signals — catches "В instagram artcake_by_natty".
  - Broader self-offer cues for verbs the heuristic misses (роблю, займаюся,
    даю уроки, наберіть мене); also reuse `analyze().hasOffer`.
  - Removed DM-promise lead-cues. Removed the (fragile) name detector.

## Measured (2026-05-23)
- Corpus: **1,946 → 965 units to Qwen (50% fewer)**.
- Real candidates (classified under the OLD prompt): **91 / 97 thread-answers
  kept; 6 dropped — all 6 are textbook DM-promise** ("Написала вам",
  "Скинула в приват", "Можу дати контакт"). Under the new prompt those 6
  would not have been candidates in the first place.
- Fixtures: **93.8% recall kept**. The 2 dropped "useful" answers are
  uncl­assifiable mislabels (reply text is "Так" and "В газенваген?").

## Open questions
- The 168 existing Candidate docs in `majstr_mining` were classified under the
  old prompt. They include ~22 DM-promise units that are now stale (the
  reviewer can decline them manually). A re-classify under the new prompt
  would re-write them as `unknown`, but `mine-classify.js` upserts only on
  kept verdicts — stale Candidate docs would persist until manually cleaned.
  Not urgent; reviewer can simply decline as they go.

## Next steps
- [ ] Whenever the lexicon or prefilter changes, re-run
  `mine-prefilter-eval.js` and the real-candidates spot-check.
- [ ] On the next overnight Ollama run the prompt change kicks in — DM-promise
  units that survive the prefilter will be classified `unknown`, keeping the
  queue clean.
