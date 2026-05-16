# Meeting: Telegram Mini App — Backend Plan
Date: 2026-05-15

## What we discussed
Backend spec for the TMA onboarding spike. Sits alongside the UX wizard spec and the frontend build plan. Goal: pin the API contract, auth model, draft persistence, file upload, and the MasterClaim schema tightly enough that frontend can build against stubs and a single backend dev can ship in 1.5–2 weeks.

## 1. initData verification middleware

Threshold: **24h** for `auth_date`. Telegram's `initData` is intended to be long-lived (the same view can stay open for hours, mobile browsers throttle background JS) and rotating sooner forces a confusing re-launch. 24h is the documented community default and matches Wallet / Tribute behavior. Anything that mutates state must additionally be JWT-grade auditable through `actorTelegramID` in `MasterAudit` — so a stale-but-valid initData still leaves a trail.

```js
// backend/middleware/requireMiniAppAuth.js
const crypto = require('crypto');
const User = require('../database/schema/User');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MAX_AGE_SECONDS = 24 * 60 * 60;

function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;
  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;
  const user = params.get('user');
  if (!user) return null;
  return { user: JSON.parse(user), authDate, startParam: params.get('start_param') };
}

module.exports = async function requireMiniAppAuth(req, res, next) {
  const raw = req.headers['x-telegram-init-data'];
  const parsed = raw && verifyInitData(raw);
  if (!parsed) return res.status(401).json({ error: 'invalid_init_data' });

  const u = parsed.user;
  const user = await User.findOneAndUpdate(
    { telegramID: u.id },
    {
      $set: {
        firstName: u.first_name,
        lastName: u.last_name,
        username: u.username,
        ...(u.photo_url ? { photo: u.photo_url } : {}),
      },
      $setOnInsert: { telegramID: u.id, isAdmin: false },
    },
    { upsert: true, new: true }
  );
  req.user = user;
  req.tgInit = parsed;
  next();
};
```

Header: `X-Telegram-Init-Data: <raw initData string>`. **Never** trust `initDataUnsafe` on the server. **Never** trust `start_param` for auth — it's just a routing hint.

## 2. Unified auth strategy

**Recommendation: Option A — single composite middleware** (`requireUser`) that prefers initData when present, else falls back to JWT. The downstream handlers only know about `req.user`. This collapses the test matrix and means web + TMA share the same endpoint URLs.

```js
// backend/middleware/requireUser.js
module.exports = async function requireUser(req, res, next) {
  if (req.headers['x-telegram-init-data']) return requireMiniAppAuth(req, res, next);
  return requireAuth(req, res, next); // existing JWT middleware
};
```

Wiring:

```js
app.post('/addmaster',                 requireUser, addMaster);          // legacy, kept as alias
app.get ('/api/masters/draft',         requireUser, getDraft);
app.patch('/api/masters/draft',        requireUser, patchDraft);
app.post('/api/masters/draft/submit',  requireUser, submitDraft);
app.delete('/api/masters/draft',       requireUser, deleteDraft);
app.post('/api/masters/draft/photo',   requireUser, uploadDraftPhoto);
app.get ('/api/masters/mine',          requireUser, listMyMasters);
```

`User.token` becomes **optional**. TMA-created users will have no token at all. Drop the `token` requirement from the schema (`token: { type: String, default: null }`) and update `requireAuth` to look up by `telegramID` *and* match `token` only when `token` is non-null in the DB. The current `GET /auth` endpoint stays — bot-login users hit it on web boot to confirm session validity. TMA never calls it (identity is asserted by every request).

## 3. Draft persistence — API contract

One draft per user, enforced by the existing partial unique index on `ownerUserID + status='draft'`. The draft *is* the Master row in `status: 'draft'`.

```
GET    /api/masters/draft           → 200 { draft: <master|null> }
PATCH  /api/masters/draft           → 200 { draft: <master> }
POST   /api/masters/draft/submit    → 200 { masterID } | 422 { errors: {...} }
DELETE /api/masters/draft           → 204
```

**PATCHable whitelist** (anything else is silently dropped):
`name, professionID, locationID, countryID, contacts, about, photo, tags, languages, availability`.

**Server-set, never client-set**:
`status, approved, ownerUserID, telegramID, source, claimable, claimedAt, submittedAt, approvedAt, rejectedAt, archivedAt, OGimage, lastEditedAt, rating, reviewCount`.

**PATCH validation policy:** light only — type checks, length caps (name ≤ 80, about ≤ 1000, tags array ≤ 10 entries, contacts array ≤ 5 entries), enum membership for `availability`. **No required-field checks on PATCH.** Mongoose `validateSync()` runs only on submit.

**Submit pipeline** (`POST /api/masters/draft/submit`):
1. Load draft by `ownerUserID + status='draft'`. 404 if none.
2. Run full Mongoose validation. Return 422 with `{ errors: { fieldName: msg } }` on failure.
3. Regenerate `OGimage` via existing `helpers/generateOpenGraph.js`.
4. Set `status = 'pending'`, `submittedAt = now`.
5. Save.
6. Write `MasterAudit` row (`action: 'submit'`, `from: 'draft'`, `to: 'pending'`).
7. Notify admin via the existing Telegram channel.
8. Auto-approve if user is the admin (preserve current Phase 1 behavior for `5950535`).

**Response shape:** PATCH returns the full draft document. The wizard rarely needs to re-derive state, but having the canonical doc back means the client never has to maintain a local merge model. Cheap on the wire (≤ 2 KB) and removes a class of optimistic-state bugs.

## 4. Photo upload flow

**Pick: server-mediated upload.** Same shape as today (multer-style multipart → resize/normalize via `sharp` → S3 PUT via `aws-sdk` → return URL). Reasons:

- Presigned PUT URLs leak the S3 bucket key shape, and we want server-side resize + EXIF strip before storage. Doing this on the client is fragile and security-sensitive.
- Existing code already does server-mediated to `chupakabra-test`; no new infra and no new IAM surface.
- File sizes are small (profile photos), so the proxy cost is irrelevant.

Endpoint:

```
POST /api/masters/draft/photo   multipart/form-data, field "photo"
  → 200 { photoUrl: "https://...userpics/<userID>.jpg" }
```

Validation:
- MIME: `image/jpeg`, `image/png`, `image/webp` only.
- Max size: 8 MB pre-resize.
- Server resizes to max 1024×1024, re-encodes JPEG quality 85, strips EXIF.
- Key: `userpics/<userID>.jpg` (idempotent overwrite — one profile photo per user).

The "Use my Telegram photo" path is a separate endpoint that takes no body:

```
POST /api/masters/draft/photo/from-telegram   → 200 { photoUrl }
```

Server fetches `req.tgInit.user.photo_url`, pipes through the same resize pipeline, writes to S3. If the user later switches to upload-from-device, that overwrites.

After either endpoint succeeds, the client PATCHes `{ photo: photoUrl }` onto the draft. We deliberately don't auto-update the draft from the photo endpoint — keeps the upload endpoint pure and avoids races with concurrent PATCHes.

**OG image generation stays at submit time only.** Drafts churn fields; regenerating per-keystroke is wasteful and worse, the half-built draft would produce ugly social previews. Confirmed.

## 5. MasterClaim collection — final shape

```js
// backend/database/schema/MasterClaim.js
const STATUS = ['pending', 'approved', 'rejected', 'withdrawn'];
const EVIDENCE_TYPES = ['phone_match', 'social_handle', 'admin_attestation', 'other'];

const claimSchema = new mongoose.Schema({
  masterID:           { type: ObjectId, ref: 'Master',  required: true, index: true },
  claimantUserID:     { type: ObjectId, ref: 'User',    required: true, index: true },
  claimantTelegramID: { type: Number,                   required: true },
  evidence: [{
    type:  { type: String, enum: EVIDENCE_TYPES, required: true },
    value: String,         // normalized phone, social handle, etc.
    notes: String,
  }],
  status:     { type: String, enum: STATUS, default: 'pending', index: true },
  autoApproved: { type: Boolean, default: false },
  reviewedBy: { type: ObjectId, ref: 'User' },
  reviewedAt: Date,
  reason:     String,
}, { timestamps: true });

claimSchema.index({ masterID: 1, status: 1 });
claimSchema.index({ claimantUserID: 1, status: 1 });
claimSchema.index({ status: 1, createdAt: -1 }); // admin queue
claimSchema.index(
  { masterID: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } }
);
```

**Lifecycle:**

| From | To | Trigger |
|---|---|---|
| (none) | `pending` | Claimant submits via `POST /api/claims` |
| `pending` | `approved` | (a) server-side phone match in the same request → autoApproved=true, OR (b) admin clicks Approve in Telegram |
| `pending` | `rejected` | Admin clicks Decline |
| `pending` | `withdrawn` | Claimant calls `DELETE /api/claims/:id` before review |

On approval (either path):
- `Master.ownerUserID = claim.claimantUserID`
- `Master.telegramID = claim.claimantTelegramID`
- `Master.claimable = false`
- `Master.claimedAt = now`
- `MasterAudit` row: `action: 'edit'`, `diff: { ownerUserID: [null, newId] }`, `reason: 'claim approved'`.

**Race condition:** the partial unique index on `{ masterID, status: 'pending' }` guarantees only one open claim per master. Second claimant gets a 409 on submission with `{ error: 'claim_already_pending' }`. UX shows "Someone else is claiming this card — please wait or contact support."

**Phone match logic** (runs synchronously in `POST /api/claims` when claimant provides phone via `requestContact`):

```js
function normalizePhone(p) {
  return String(p).replace(/[^\d]/g, '');           // digits only
}
const claimantDigits = normalizePhone(requestContact.phone_number);
const cardPhones = master.contacts
  .filter(c => /phone|tel|whatsapp/i.test(c.contactType))
  .map(c => normalizePhone(c.value));
const match = cardPhones.some(p =>
  p === claimantDigits || p.endsWith(claimantDigits) || claimantDigits.endsWith(p)
);
```

The suffix check handles `+39` vs no-prefix variants. If `match`, set `status='approved'` and `autoApproved=true` in the same insert; skip admin notification. Else `status='pending'` and notify admin via existing Telegram channel.

**Index needs covered:** lookup by master (claim history per card), by claimant (user's own claims), admin queue (status + recency), uniqueness of pending claim per master.

## 6. Endpoint inventory

Style: REST, plural nouns, `/api/` prefix for all new endpoints. The existing `/`, `/auth`, `/addmaster`, `/approve-master`, `/review` endpoints stay (don't break web in flight). One new `/api/...` namespace for everything TMA needs.

| Method | Path | Auth | Body / Query | Response | Purpose |
|---|---|---|---|---|---|
| GET | `/api/reference/professions` | none | — | `Profession[]` | Replaces `/?q=professions` |
| GET | `/api/reference/prof-categories` | none | — | `ProfCategory[]` | Replaces `/?q=prof-categories` |
| GET | `/api/reference/locations` | none | `?country=IT` | `Location[]` | Replaces `/?q=locations` |
| GET | `/api/reference/countries` | none | — | `Country[]` | Replaces `/?q=countries` |
| GET | `/api/masters/draft` | requireUser | — | `{ draft }` | Read current draft or null |
| PATCH | `/api/masters/draft` | requireUser | partial draft (whitelist) | `{ draft }` | Upsert + light validation |
| POST | `/api/masters/draft/submit` | requireUser | — | `{ masterID }` or 422 | Promote draft → pending |
| DELETE | `/api/masters/draft` | requireUser | — | 204 | Discard draft |
| POST | `/api/masters/draft/photo` | requireUser | multipart `photo` | `{ photoUrl }` | Upload from device |
| POST | `/api/masters/draft/photo/from-telegram` | requireUser | — | `{ photoUrl }` | Copy Telegram avatar |
| GET | `/api/masters/mine` | requireUser | — | `Master[]` | All masters owned by `req.user._id` |
| GET | `/api/me` | requireUser | — | `User` | Echo current user (TMA bootstrap) |
| POST | `/api/claims` | requireUser | `{ masterID, phone?, notes? }` | `{ claim, autoApproved }` | Submit claim |
| GET | `/api/claims/mine` | requireUser | — | `Claim[]` | Claimant's own claims |
| DELETE | `/api/claims/:id` | requireUser | — | 204 | Withdraw pending claim |

**Auth bootstrap on TMA:** `GET /api/me` is the first call on launch. Frontend caches `req.user` in React context. Every subsequent request carries `X-Telegram-Init-Data` so the server re-verifies on each call — no session, no cookie. This is the standard TMA pattern.

**Reference endpoints are public** (no auth). The existing `/?q=...` switch stays as an alias for one release so the current web build doesn't break. Deprecate after the unified frontend lands.

**`GET /api/masters/mine` semantics for TMA:** same query (`ownerUserID: req.user._id`), but include `draft` and `pending` so the wizard "I already started one" branch works. Web Phase 2 plan called for the same — no change.

## 7. Security checklist — TMA-specific

- **initData replay**: 24h `auth_date` window enforced; older requests 401.
- **Bot token rotation**: if `TELEGRAM_BOT_TOKEN` changes, all live initData becomes invalid. Document this as a manual user-facing event ("re-open the Mini App").
- **`start_param` is untrusted input**: it's a routing hint only. Never SQL it, never use it for auth, validate as `/^[a-z0-9_-]{1,64}$/`. Used for things like `claim_<id>` or `resume_<draft>` — verify the referenced record matches `req.user` before returning data.
- **Per-user rate limiting**: TMA users behind Telegram CDN look identical from an IP perspective. Key the limiter by `req.user._id`. Recommend `express-rate-limit` with a Redis store later; in-memory MemoryStore is fine for the spike. Limits: PATCH draft 60/min, submit 5/min, claims 3/hour, photo upload 10/hour.
- **CORS**: the Mini App is served from majstr.xyz (your origin), so same-origin. Add the TMA URL to `ALLOWED_ORIGINS` env var. Telegram itself doesn't enforce CORS — its webview is just a browser. Don't allow `*` once auth headers are sent.
- **Header sniffing**: `X-Telegram-Init-Data` is long (~600 chars). Make sure no proxy strips it; nginx default header size is fine but document this.
- **Reject mixed auth**: if both `Authorization` and `X-Telegram-Init-Data` are present, prefer initData and ignore JWT to remove confusion (already the composite middleware behavior).
- **Photo MIME sniffing on the server** (don't trust `Content-Type`). Use `sharp` or `file-type` to detect from magic bytes.
- **Audit every write**: every state transition (draft→pending, claim submit, claim approve) writes a `MasterAudit` row. Already the pattern.

## 8. Integration with existing web flow

**Pick: (a) `/addmaster` becomes a thin wrapper that calls the new draft endpoints.**

Specifically: web's "Add new record" form switches to PATCH-draft-as-you-type + submit, same as TMA. The legacy `POST /addmaster` endpoint stays alive as a compatibility alias that internally does `upsert draft → submit` in one shot, so any unreleased web build keeps working through one deploy cycle, then gets removed.

Why not (b): forking creates two validation paths and double the bug surface. Why not (c): "deprecate web" is too strong — the web form is the non-Telegram-user fallback per the PM note, it needs to keep working long-term, just on the new endpoints. The Phase 2 web CRUD plan gets *re-scoped* to "wire the existing web form into the new draft API," which is smaller than the original Phase 2 plan and ships with the TMA work for free.

## 9. Phasing — backend work items

**Sub-phase A — Auth & scaffolding (2–3 days).** Independently shippable; no client work needed.
1. Add `requireMiniAppAuth` middleware. **(0.5 day, pure code)**
2. Compose `requireUser` middleware; wire onto `/addmaster` as a no-op test. **(0.5 day, pure code)**
3. Drop `User.token` required-ness; update `requireAuth` to handle null tokens. **(0.5 day, pure code + migration check)**
4. Add `GET /api/me`, `GET /api/reference/*`. **(0.5 day, pure code)**
5. User: register BotFather Mini App, set menu button URL, add TMA hostname to `ALLOWED_ORIGINS`. **(user task, ~1 hour)**

**Sub-phase B — Drafts & photos (3–4 days).** Depends on A.
6. `GET / PATCH / DELETE /api/masters/draft` with whitelist + light validation. **(1 day, pure code)**
7. `POST /api/masters/draft/submit` — full validation, OG image, audit row, admin notify. **(1 day, pure code)**
8. `POST /api/masters/draft/photo` — multer + sharp resize + S3 upload. **(0.5 day, pure code)**
9. `POST /api/masters/draft/photo/from-telegram` — fetch + pipe to same pipeline. **(0.5 day, pure code)**
10. Per-user rate limiter on draft endpoints. **(0.5 day, pure code)**
11. `GET /api/masters/mine` including draft + pending. **(0.5 day, pure code)**

**Sub-phase C — Claims (3–4 days).** Depends on A. Can run in parallel with B by a different dev.
12. `MasterClaim` schema + indexes. **(0.5 day, pure code)**
13. `POST /api/claims` with phone-match auto-approval. **(1 day, pure code)**
14. `GET /api/claims/mine`, `DELETE /api/claims/:id`. **(0.5 day, pure code)**
15. Admin Telegram inline keyboard for non-auto-approved claims (reuse existing approve-master pattern). **(1 day, pure code)**
16. Audit + Master state mutations on claim approval. **(0.5 day, pure code)**

**Sub-phase D — Cleanup (1 day, after frontend cuts over).**
17. Remove `/addmaster` shim, remove `/?q=...` reference aliases. **(0.5 day)**
18. Drop `Master.approved` boolean mirror (Phase 1 said "later release"; this is later). **(0.5 day)**

Total backend: **9–12 dev-days**, fits the PM's 1.5–2 week spike envelope. A and B alone unblock the onboarding-only MVP; C is needed for the claim flow that the PM identifies as the highest-leverage shipment.

## 10. Open questions for the user

1. **TMA hostname.** Is the Mini App served from `majstr.xyz/app` (subpath) or `app.majstr.xyz` (subdomain)? Affects BotFather config, nginx routing, and CORS allowlist. Recommend subpath — fewer moving parts.
2. **Bot token rotation policy.** If/when you rotate `TELEGRAM_BOT_TOKEN`, all initData signatures invalidate atomically. Are we OK with that ("everyone re-opens the app"), or do we need a grace period with dual-secret verification? Recommend the simple invalidation — token rotations should be rare.
3. **Admin auto-approve for claims.** Today the admin's *own* submissions auto-approve. Should claims by the admin also auto-approve, or always go through review for paper trail?
4. **Claim with no phone match: queue or hard-fail?** Right now I'm specifying "submit → pending → admin reviews." Alternative: hard-fail "we can't verify you, contact support" — strictly fewer admin tickets but worse claim conversion. Recommend queue (admin volume will be tiny: 38 scraped cards total).
5. **Phone normalization edge cases.** Italy mobile numbers vs landlines, leading zeros, occasional WhatsApp Business links written as `wa.me/39...`. Want a quick audit of the 38 scraped contact strings to make sure the suffix-match heuristic actually fires? I can spec a one-off script.

## Decisions made
- 24h `auth_date` window on initData; reject older.
- Single composite `requireUser` middleware (initData preferred, JWT fallback).
- `User.token` becomes optional to support tokenless TMA users.
- Drafts are server-side, one per user, enforced by existing partial unique index.
- PATCH whitelist; full validation only at submit; PATCH returns full draft.
- Server-mediated photo upload (not presigned URLs); sharp-based normalization; EXIF stripped.
- OG image generation stays at submit time, not draft time.
- `MasterClaim` schema as specified; partial unique index prevents concurrent pending claims; phone-match auto-approves synchronously.
- Web `/addmaster` becomes a thin wrapper over the new draft endpoints; legacy endpoint kept for one release.
- New endpoints live under `/api/...`, RESTful, plural nouns; reference endpoints public.

## Open questions
- TMA hostname (subpath vs subdomain)
- Bot token rotation grace policy
- Whether admin's own claims auto-approve
- Whether non-phone-match claims queue to admin or hard-fail
- Phone normalization audit against the 38 scraped contact strings

## Next steps
- [ ] User: pick TMA hostname and answer Q1–Q4 above
- [ ] User: register Mini App in BotFather, capture URL
- [ ] Dev: start sub-phase A (auth & scaffolding) — branch off `main`
- [ ] Dev: parallel sub-phase B (drafts) and sub-phase C (claims) once A merges
- [ ] Frontend: build wizard against the documented API surface; mock the endpoints if backend hasn't landed yet
