# Meeting: Telegram Master-Mining System — Plan & Board
Date: 2026-05-19

## What we discussed
Designing a system that mines public Telegram chats for master recommendations
and specialist self-announcements, classifies them, lets an admin review/correct
them, turns approved ones into `scraped` Master cards, and surfaces analytics as
a public "tip of the day". Two operating modes: one-shot research backfill of
<1yr history, and an ongoing watcher. End goal is eventual autonomy; v1 is
human-in-the-loop. Output: a GitHub Projects v2 board with full dev/test/launch
timeline (Project #4) plus milestones and issues.

## Options considered
- **Telegram history access** — MTProto user account (full auto backfill, ToS/ban
  risk) vs manual Telegram Desktop export (no risk, manual step) vs hybrid.
  Chosen: **manual export for history backfill + GramJS user account for live
  monitoring only** (risk isolated to the M6 watcher).
- **Classifier** — heuristic-only (cheap, weak) vs Ollama local LLM (free but
  CPU-only inference too slow for backfill, weak structured extraction on
  UA/RU/IT code-switching) vs heuristic pre-filter + Claude Haiku (cheap because
  the regex gate kills ~85–95% of volume, strong extraction). Chosen:
  **heuristic >30% pre-filter + Haiku**, behind a pluggable classifier interface
  so Ollama can be a future offline fallback.
- **v1 autonomy** — human-in-loop vs auto-create+audit vs confidence-tiered.
  Chosen: **human-in-loop at v1**; autonomy is a later phase gated by measured
  precision.
- **Scope** — chosen: **one pilot chat end-to-end first**, then scale.

## Decisions made
- History = manual Telegram Desktop JSON export (no MTProto/ToS risk).
- Live monitor = GramJS user account, risk-gated, M6 only, single pilot chat.
- Classifier = heuristic >30% pre-filter + Haiku; Ollama kept as pluggable fallback.
- New Mongo collections: RawMessage, Candidate, MiningFeedback, MiningRun.
- Scraped masters reuse existing schema: `source:'scraped'`, `status:'pending'`,
  `claimable:true`, `sourceMetadata`.
- Timeline: 9 milestones M0–M8, due weekly-ish 2026-05-26 → 2026-08-18, on
  GitHub Project #4. Blockers tracked on pinned issue #113.

## Open questions
- Which specific pilot chat, and when the export file will be delivered (blocker).
- Anthropic API budget ceiling value.
- GDPR/takedown policy specifics (lawful basis, retention, store raw text or not).
- GramJS burner-number provisioning + explicit risk sign-off.

## Next steps
- [ ] User: pick pilot chat + deliver Telegram Desktop JSON export (issue #105-ish)
- [ ] User: provision ANTHROPIC_API_KEY + agree budget cap
- [ ] User: sign off GramJS ToS/ban risk + burner number (gates M6)
- [ ] Then start M0: ADR, schemas, classifier interface, GDPR policy
- Board: https://github.com/users/konstaku/projects/4 · Blockers: konstaku/majstr#113
