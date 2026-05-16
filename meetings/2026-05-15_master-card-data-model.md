# Meeting: Master Card Lifecycle Data Model
Date: 2026-05-15

## What we discussed
Designed the MongoDB / Mongoose data model for the full master-card lifecycle (draft → pending → approved/rejected → archived), ownership linkage, edit-after-approval policy, indexing, audit trail, and migration of existing records.

## Options considered
- **State field**: `approved: Boolean` vs `status: enum`. Chose enum — boolean can't express draft/rejected/archived.
- **Drafts**: separate `MasterDraft` collection vs single collection with `status: 'draft'`. Chose single collection — one source of truth, one index set, simpler state transitions.
- **Edit-after-approval**: (a) live immediately, (b) shadow version with copy-on-write, (c) field-tier re-approval. Chose (c) — public-content fields (name, profession, about, tags, photo) re-trigger pending; operational fields (availability, contacts, languages, locationID) go live.
- **Delete semantics**: hard delete vs soft archive. Chose soft archive (`status: 'archived'`) to preserve Review refs and OG image cleanup window.
- **Ownership**: keep `telegramID` only vs add `ownerUserID: ObjectId`. Chose both — `ownerUserID` is canonical, `telegramID` denormalized for bot lookups.

## Decisions made
- `status` enum replaces `approved` with states: draft, pending, approved, rejected, archived. Explicit transition list enforced in controllers.
- Add `ownerUserID: ObjectId ref 'User'` alongside `telegramID`.
- Single `Master` collection holds drafts; required-field validators are conditional on `status !== 'draft'`.
- Field-tier re-approval: edits to name/professionID/about/tags/photo transition `approved → pending`; edits to availability/contacts/languages/locationID stay approved.
- New `MasterAudit` collection captures every status transition + admin action with actor, from/to, diff, reason.
- Soft delete only (`status: 'archived'`, `archivedAt` timestamp). Nightly job purges S3 OG images > 30d archived.
- Add `{ timestamps: true }` plus explicit `submittedAt`, `approvedAt`, `rejectedAt`, `archivedAt`, `lastEditedAt`.
- Partial unique index on `ownerUserID` filtered to active statuses — enforces v1's one-card-per-user rule while allowing multiple historical rejected/archived rows.
- Migration: `approved: true → status: approved`; `approved: false → status: pending`. Idempotent script keyed on `status: { $exists: false }`. Keep `approved` mirror for one release.

## Indexes finalised
- `{ status, countryID, locationID }` — public listing
- `{ status, submittedAt }` — admin queue FIFO
- `{ ownerUserID, status }` — owner dashboard
- `{ telegramID, status }` — bot lookups
- `{ ownerUserID }` partial unique where `status ∈ {draft, pending, approved}` — v1 one-card rule

## Open questions
- Notification UX for rejection: bot message with `rejectionReason` field — exact wording TBD with PM.
- Whether locationID belongs in "operational" tier (current decision) or "public content" tier — moving cities feels material; revisit if admins complain.
- v2 multi-card per user: partial unique index will need to be dropped; controller permission checks already key on `ownerUserID` so logic survives.

## Next steps
- [ ] Implementer writes new `Master.js` schema per spec
- [ ] Implementer adds `MasterAudit.js` schema
- [ ] Implementer writes `backend/scripts/migrate-master-status.js` and runs against staging
- [ ] Update `addMaster` controller to set `status: draft` by default, gate `validateSync()` on submit
- [ ] Add `submitMaster`, `approveMaster`, `rejectMaster`, `archiveMaster` controller actions
- [ ] Update bot inline keyboard handler to write `MasterAudit` rows
- [ ] Frontend: owner dashboard surfaces `draft` and `rejected` states with edit affordance
