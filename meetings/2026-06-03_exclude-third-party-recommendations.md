# Meeting: Exclude Third-Party Recommendations from Mining Pipeline
Date: 2026-06-03

## What we discussed
Decision to narrow the mining algorithm to only surface masters who **personally declare** their own services, dropping candidates where a third party recommends someone else. Previously both `announcement` (self-declaration) and `recommendation` (third-party referral) reached the admin review queue.

## Options considered
- Option A — Filter at the DB query / admin UI level: keep writing all kinds to Candidate, hide recommendations in the UI. Pros: no data loss. Cons: wastes classifier budget, bloats queue.
- Option B — Filter at every pipeline layer (adapters + thread builder + pipeline gate). Pros: cheaper runs, cleaner queue, consistent behavior across heuristic/haiku/ollama classifiers. Cons: version-bumps invalidate cache, need to re-classify.

## Decisions made
- Option B chosen: filter at all layers.
- `thread.js`: standalone `recommendation`-kind messages no longer enter the announcement queue.
- `heuristic.js` (→ v1.3.0): `classify()` maps `recommendation` → `unknown`; `analyze()` unchanged so thread builder still works.
- `haiku.js` (→ v1.6.0): USEFUL definition restricted to `announcement`; bundled-reply instruction updated; "third-party recommendations" added to NOT USEFUL list; `mapResult()` collapses `recommendation` → `unknown`.
- `mine-classify.js`: gate changed from `!== 'unknown'` to `=== 'announcement'` (defence-in-depth).
- Version bumps invalidate classifier cache → next run re-classifies with new rules.

## Open questions
- None.

## Next steps
- [ ] Re-run `mine-classify.js` to rebuild the candidate queue under the new rules.
- [ ] Optionally add an eval fixture covering the "third-party rec with contact" case that should now be excluded.
