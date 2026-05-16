# Meeting: Auth + Master Card CRUD Flow — Implementation Plan
Date: 2026-05-15

## What we discussed
Planned the full lifecycle for master cards on Majstr: Telegram-based auth hardening, draft creation, owner CRUD (create/update/delete), submit-for-approval, admin queue, and inline-login UX. Synthesized input from Database Optimizer, Senior Developer, and Senior PM agents into a single phased plan.

## Decisions made

### Data model
- Replace `approved: Boolean` with `status` enum: `draft | pending | approved | rejected | archived`. Explicit transition table enforced in controllers.
- Add `ownerUserID: ObjectId ref 'User'` alongside existing `telegramID` (denormalized for bot lookups).
- Single `Master` collection holds drafts; required-field validators are conditional on `status !== 'draft'`.
- **Edit-after-approval = field-tier**: edits to name / professionID / about / tags / photo flip `approved → pending`; edits to availability / contacts / languages / locationID stay approved.
- **Delete = soft only**: status flips to `archived` + `archivedAt`. Nightly job purges S3 OG images > 30d archived. Decline no longer hard-deletes — moves to `rejected`.
- **Audit trail = yes**: new `MasterAudit` collection logs every status transition + admin action with `actor`, `from`, `to`, `reason`, `diff`.
- Add `{ timestamps: true }` + explicit `submittedAt`, `approvedAt`, `rejectedAt`, `archivedAt`, `lastEditedAt`.
- Partial unique index on `ownerUserID` filtered to `status ∈ {draft, pending, approved}` — enforces v1 one-card-per-user rule.

### Migration
- `approved: true → status: approved`; `approved: false → status: pending`.
- Idempotent script keyed on `status: { $exists: false }`.
- Keep `approved` mirror for one release, then drop.

### Auth
- New `requireAuth` middleware: verifies JWT signature first, then looks up user (token in DB column kept only for revocation handle).
- All write endpoints derive `telegramID` / `ownerUserID` from `req.user`, never from the request body.
- New `requireAdmin` chains after `requireAuth`.
- New `loadOwnedMaster` middleware asserts `master.ownerUserID === req.user._id || req.user.isAdmin` on every mutation.

### API surface
RESTful under two namespaces:
- `/api/masters` — owner-scoped CRUD (`GET /mine`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /:id/submit`)
- `/api/admin/masters` — admin queue (`GET ?status=pending`, `POST /:id/approve`, `POST /:id/decline`)
- Legacy `/?q=masters` and `/?q=newmasters` read-only routes kept; legacy `/addmaster` and `/approve-master` become deprecation shims for one release.

### Frontend UX
- **`/add` = form-first + localStorage draft**: form renders unconditionally. Anonymous users can fill fields; on submit/save-draft without auth, data stashed in `localStorage`, user sent to Telegram bot, returns via `/login?token=...&path=add`, form rehydrates. Key wiped after first server save.
- "Save draft" button alongside "Submit for approval" — both require auth.
- New `/edit/:id` route reuses the AddNewRecord form in edit mode.
- `/profile` rebuilt as "my cards" dashboard: list of own masters with status badges, edit / delete / submit actions.

### Bot
- `/start <payload>` parses deep-link payload (e.g. `add`, `edit-<id>`, `profile`) and passes it as `path` in the login URL. Whitelist allowed values server-side.
- `/login` command added as alias for `/start` (no payload).
- New `notifyOwner(masterID, kind, message)` helper for decline / change-requested notifications.

## Open questions
- Exact wording for rejection bot message (deferred — copy decision).
- v2 multi-card-per-user: partial unique index will need to be dropped. Controller permission checks already key on `ownerUserID` so logic survives.

## Phases & sequenced task list
See [/Users/futura/Code/stuff/majstr/meetings/2026-05-15_master-card-data-model.md](2026-05-15_master-card-data-model.md) for the data-model deep-dive. Implementation order:

**Phase 1 — Backend foundations** (no user-visible changes; existing flow keeps working)
1. Add `status` enum to Master schema, keep `approved` mirror
2. Create `MasterAudit` schema
3. Write idempotent migration script
4. Update read paths (`/?q=masters`, `/?q=newmasters`) to query by `status`
5. Write `requireAuth` + `requireAdmin` + `loadOwnedMaster` middleware
6. Apply middleware to legacy `/addmaster`; derive identity from JWT
7. Run migration against local DB; smoke-test old flow

**Phase 2 — Owner CRUD API** (curl/Postman-testable)
8. `POST /api/masters` (supports `status: draft | pending`)
9. `PATCH /api/masters/:id` (owner-scoped, field-tier re-approval)
10. `DELETE /api/masters/:id` (soft archive)
11. `POST /api/masters/:id/submit` (draft → pending, regenerate OG, notify admin)
12. `GET /api/masters/mine`
13. Update admin approve/decline to write `status` + write `MasterAudit` rows

**Phase 3 — Frontend auth wiring**
14. Refactor `useAuthenticateUser` to return `{ user: null }` quietly instead of throwing
15. Telegram login CTA component (reusable)
16. Inline login on `/add`: render form unconditionally, hydrate from localStorage
17. Bot: parse `/start <payload>`, whitelist paths, add `/login` alias

**Phase 4 — Save draft**
18. "Save draft" button on `/add`
19. Wire to `POST /api/masters` with `status: draft`

**Phase 5 — My cards page**
20. `/profile` rebuilt as dashboard listing user's masters
21. Edit affordance → `/edit/:id` route reusing AddNewRecord form
22. Delete with confirm modal
23. Submit-for-approval CTA on drafts
24. End-to-end smoke test on real device

## Next steps
- [ ] User: start backend locally with bot env vars (see "User-action checklist" below)
- [ ] User: confirm rejection bot message wording when Phase 2 lands
- [ ] Implementer: begin Phase 1 task 1 (status enum + audit schema)

## User-action checklist
**Before Phase 1:**
- [ ] Provide `.env` for backend with `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `JWT_ACCESS_TOKEN_SECRET`, `MONGO_PASSWORD`, AWS keys
- [ ] Start bot locally (`cd backend && npm run devStart`) in polling mode

**During Phase 1:**
- [ ] Snapshot Mongo Atlas before running migration on prod
- [ ] Smoke-test legacy `/addmaster` + admin approve flow on a real Telegram device after middleware lands

**Before Phase 3 (inline login on real device):**
- [ ] Set up ngrok (or a dev deploy) so Telegram login widget can hit a public HTTPS origin
- [ ] Register that domain with BotFather (`/setdomain`) — or run a separate dev bot

**After Phase 5:**
- [ ] Full end-to-end on phone: login on `/add` → save draft → submit → admin approve → edit → delete
- [ ] Verify admin Telegram notifications fire on every submit (including resubmissions)
- [ ] Verify bot availability / language commands still work on approved cards post-migration
