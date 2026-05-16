# Meeting: Mini App Ship Audit + Master-Registration Flow Build
Date: 2026-05-16

## What we discussed
Full audit of the Telegram Mini App onboarding spike against the 2026-05-15 plans, driven by three parallel agents (frontend, backend, security). The project board claimed "all Done" but was significantly stale and the core master-registration flow was non-functional. Goal for the day: make "add master via TMA" actually work, functional on dev, prod tomorrow.

## Audit findings (the real state, vs. a board that said "Done")
- **Security:** GitHub issue #1 was a TRUE breach — a scanner connected to the Atlas cluster and enumerated DBs. User rotated the credential the same day. NoSQL injection also found in `patchDraft` (string fields accepted objects → `$gt` injection).
- **Frontend:** wizard had NO submit — it dead-ended on the last step. `StepContact` (B5) was an 8-line stub; no contact data was ever collected. Lint script was misconfigured (`--ext js,jsx` → scanned 0 files → effectively disabled).
- **Backend:** `submitDraft` sent the admin a bare link with no inline keyboard; `bot.js` had no `master:` callback handler → submitted cards sat `pending` forever. No owner confirmation DM on approval (friction #5 / #68 confirmed). Data-contract mismatch: form modelled `telephone/instagram/...` + `tags:{value,label}[]`; schema wanted `contacts:[{contactType,value}]` + `tags:{ua,en}`.

## Decisions made
- Onboarding (self-submission) is the priority flow, ahead of the claim flow (overrides the earlier PM "claim first" sequencing — user's explicit call).
- Target: functional on dev today; real-device QA + production cutover tomorrow.
- Legacy `AddNewRecord` web form fate deferred until the wizard is proven.
- Canonical contact model = `contacts:[{contactType,value}]`; tags transformed form↔server in one place.
- Manual phone entry is the always-works primary path; Telegram `requestContact` is a TMA convenience that fills it when the client returns a number (reliable phone capture across all clients is a follow-up).

## What was built (code complete, verified by build/typecheck/lint/syntax)
- **schema.ts** — replaced contact fields with `contacts[]`; Step 5 zod now requires a valid phone; `serverDraftToForm` passes contacts through; new `formToServerPatch` (tags → `{ua}`).
- **StepContact.tsx** — real implementation: phone (required) + Telegram + Instagram, TMA "share number" button, assembles canonical `contacts`.
- **OnboardingWizard.tsx** — last step calls `submit()`; success screen; error popups (validation / conflict / offline).
- **useDraft.ts** — all PATCHes transformed to server shape; `submit()` flushes pending edits then POSTs `/api/masters/draft/submit`.
- **backend/routes/draft.js** — hardened `validatePatch` (type-strict, kills NoSQL injection, enforces contract); admin notification now carries Approve/Decline inline keyboard.
- **backend/bot.js** — new `handleMasterCallback`: approve/decline → status + audit row + **owner confirmation DM**.
- **package.json** — fixed lint to scan ts/tsx; added `typecheck`.

Verification: backend boots (DB connected, bot polling, routes mounted); frontend build ✓, typecheck ✓, 6 tests ✓, lint 0 errors (5 pre-existing fast-refresh warnings remain).

## Open questions
- Reliable phone capture in TMA across all Telegram clients (requestContact return shape varies) — manual fallback covers it for now.
- `--max-warnings 0` lint config vs 5 pre-existing fast-refresh warnings in surface/ui layer — relax threshold or split files later.
- Whether local `.env` MONGO_PASSWORD matches the rotated credential (backend connected locally, so currently consistent).

## Next steps
- [ ] Restore `gh` auth (`gh auth login -h github.com`) → run board-reconciliation script (`meetings/board-sync-2026-05-16.sh`)
- [ ] Real-device QA: iOS + Android + Telegram Desktop — full wizard → submit → admin approve → owner DM (task #6)
- [ ] Deploy app.majstr.xyz + bot + API to production after QA passes
- [ ] Decide AddNewRecord legacy form fate (redirect vs keep) once wizard proven
- [ ] Follow-up: TMA requestContact deep integration; intro/"what to prepare" screen (#69/#70); wizard unit tests (#50)
