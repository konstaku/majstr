# Meeting: Phase 1 Implementation — Backend Foundations
Date: 2026-05-15

## What we discussed
Built Phase 1 of the master-card lifecycle plan: data model migration to a status enum, audit collection, JWT-verifying middleware, and hardening of the legacy `/addmaster` and `/approve-master` endpoints. No user-visible changes — existing flow still works end-to-end but is now properly authenticated.

## Decisions made
- `Master.approved` (boolean) kept as a synced mirror via pre-save hook for one transition release; will be dropped in a later phase.
- Migration script disables `autoIndex` so existing duplicates can't crash the run. Indexes will sync on next normal app boot.
- `loadOwnedMaster` middleware accepts both `ownerUserID` and `telegramID` ownership checks during the transition window — drop the telegram fallback after the migration runs on prod.
- Declining a master is now soft (`status: 'rejected'` + `rejectedAt`), not a hard delete. Optional `reason` field surfaces in audit log + rejected record.
- Frontend AddNewRecord and NewMasterPreview now send the JWT via `Authorization` header. Body-token pattern in `/approve-master` is gone.

## Files changed
- `backend/database/schema/Master.js` — status enum, ownerUserID, lifecycle timestamps, 5 indexes, pre-save mirror
- `backend/database/schema/MasterAudit.js` — new
- `backend/scripts/migrate-master-status.js` — new, idempotent
- `backend/middleware/requireAuth.js` — new
- `backend/middleware/requireAdmin.js` — new
- `backend/middleware/loadOwnedMaster.js` — new (unused in Phase 1; ready for Phase 2)
- `backend/index.js` — middleware wiring, read paths use status, `addMaster` derives identity from JWT, `handleApproveMaster` writes audit rows + soft-rejects
- `backend/bot.js` — 7 query sites switched from `approved: true` to `status: 'approved'`
- `frontend/src/pages/AddNewRecord.tsx` — Authorization header on POST
- `frontend/src/components/NewMasterPreview.tsx` — Authorization header, no body token

## Open questions
- Existing prod records with no User row matching their `telegramID` will be flagged as orphaned by the migration. Decision deferred until we see counts on real data.
- `loadOwnedMaster`'s telegramID fallback — exact removal timing depends on when the migration backfills ownerUserID on prod.

## Next steps
- [ ] User: start bot locally (`cd backend && npm run devStart`) with .env
- [ ] User: run migration against local DB (`node backend/scripts/migrate-master-status.js`), verify counts
- [ ] User: smoke-test end-to-end on real Telegram device — `/start` → login → submit master → admin approve in `/admin` UI → confirm master appears in feed
- [ ] After local pass: snapshot Atlas, run migration on prod
- [ ] Move to Phase 2 (owner CRUD API + admin updates writing audit rows for resubmissions)
