# Codebase Production Readiness Assessment
Date: 2026-05-14
Reviewer: Claude Code (multi-lens review: backend, frontend, architecture, security, DB)

---

## Summary Verdict

**NOT READY — 4 critical bugs must be fixed first. Core functionality works once bugs are patched.**

The main page, search, and filter flow are functionally complete. The brutalist design system is fully implemented. MongoDB Atlas, S3, and the Telegram bot infrastructure are working. The blockers are all in the backend and are fixable in ~30 minutes.

---

## Critical Issues (block deploy)

### BUG-001 — Admin auth bypass in `handleApproveMaster`
**File:** `backend/index.js:251`
**Severity:** CRITICAL — any user with a valid token can approve or decline masters
```js
if (adminTokens.includes(token)) {
  console.log('auth success');
}
// No else { return res.status(403) } — execution falls through regardless
```

### BUG-002 — Unhandled throw in `addMaster` validation
**File:** `backend/index.js:168`
**Severity:** HIGH — throws an uncaught error instead of sending a 400 response
```js
if (validationError) {
  throw new Error(validationError); // crashes the request, not a user-facing error
}
```
Should be: `return res.status(400).send(validationError.message)`

### BUG-003 — Hanging request when `?q=` is absent
**File:** `backend/index.js:79`
**Severity:** HIGH — GET `/` with no `?q=` param sends no response (connection hangs until timeout)
```js
if (req.query && req.query.q) {
  switch (...) { ... }
}
// No else — nothing sent if q is missing
```

### BUG-004 — CORS wildcard `*` in production
**File:** `backend/index.js:32`
**Severity:** MEDIUM — acceptable for now but should be restricted once deployed
```js
res.setHeader('Access-Control-Allow-Origin', '*');
```

---

## Warnings (should fix, non-blocking for dev launch)

### WARN-001 — Unauthenticated `newmasters` endpoint
`GET /?q=newmasters` returns all unapproved masters with no auth check. Unapproved submissions are visible to anyone who knows the URL.

### WARN-002 — `ipinfo.io` geo-detection without API key
`Root.tsx:42` — `fetch("https://ipinfo.io/json")` will hit rate limits (50k/month on free tier). Add API key or use a self-hosted alternative.

### WARN-003 — OG middleware relative filesystem path
`open-graph-middleware.js:62` — `fs.readFileSync('./../frontend/index.html')` only works if the process is started from `backend/`. Will break on Railway unless working directory is controlled.

### WARN-004 — JWT has no expiry
`bot.js:282` — `jwt.sign(...)` is called with no `expiresIn` option. Tokens are valid forever. Set `{ expiresIn: '90d' }` at minimum.

### WARN-005 — MongoDB username hardcoded
`database/db.js:5` — `mongodb+srv://0864380:${MONGO_PASSWORD}@...` has the username in source code. Not a security issue if repo is private, but bad practice.

### WARN-006 — No rate limiting
`backend/index.js` — No rate limiting on any endpoint. Add `express-rate-limit` before going public.

### WARN-007 — `aws-sdk` v2 (legacy)
`package.json` — `aws-sdk@^2.x` is in maintenance mode. Not urgent but plan migration to `@aws-sdk/client-s3` v3 eventually.

### WARN-008 — Dead code in `Main.tsx`
`Main.tsx:416-434` — `getProfessionCategoryById` function and `TradeChipsProps` type are defined but voided. Harmless but noisy.

---

## What Works Well

- **Frontend SPA**: React Router, global state with useReducer/Context, TypeScript throughout — solid structure.
- **Search & filter**: City and profession-category filters with smart dependency (trade options reset when city has no match) — works correctly.
- **Skeleton loading**: Implemented and correct.
- **Brutalist design system**: Consistent CSS variables, Archivo Black headings, no border-radius anywhere — matches design spec.
- **Responsive layout**: Mobile burger menu and responsive hero section are implemented.
- **Bot polling mode**: The bot correctly falls back to polling when `WEBHOOK_URL` is absent — dev works without SSL certs.
- **MongoDB Atlas**: Connection and all queries work. Schema is reasonable.
- **Multi-language i18n**: UK/EN language switcher and country detection working.
- **Error state**: API error is caught and displayed in the hero section.

---

## Architecture Notes

### 3-process design
The app runs three Node processes from one entry point (`index.js`):
1. API server (port 5000/HTTP)  
2. Telegram bot webhook server (port 8443/HTTPS) — OR polling mode
3. OG middleware (port 5050/HTTP)

For Railway deployment: processes 1 and 3 can co-exist. Bot should use **polling mode** (don't set `WEBHOOK_URL`). OG middleware can be deferred — it's only needed when social card sharing is needed.

### Frontend data fetching
Data is loaded in `Root.tsx` (not a router loader) via parallel `fetch()` calls after geo-detection sets `countryID`. The country detection adds ~200ms latency before data fetch starts — acceptable.

### Static data duplication
`locations.json` and `professions.json` exist in both `backend/data/` and `frontend/src/data/`. They're used differently (backend: DB seeding, frontend: dead import path). The live data comes from the API. Keep in sync when updating.
