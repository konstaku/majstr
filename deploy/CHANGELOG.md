# Deployment Changelog

## 2026-05-14 — Initial production readiness pass

### Code changes (backend/index.js)
- FIXED: Admin auth bypass in `handleApproveMaster` — now returns 403 for non-admin tokens
- FIXED: `addMaster` validation error now returns HTTP 400 instead of throwing uncaught error
- FIXED: `handleApiRequests` returns HTTP 400 when `?q=` param is missing (was hanging)
- FIXED: CORS now configurable via `ALLOWED_ORIGINS` env var (comma-separated list); defaults to `*` if not set

### Code changes (backend/package.json)
- ADDED: `"start": "node index.js"` script (required for Railway deployment)

### Files created
- `deploy/ASSESSMENT.md` — full production readiness audit with all issues listed
- `deploy/PROJECT_PLAN.md` — phased deployment task breakdown
- `deploy/DEPLOY_GUIDE.md` — step-by-step instructions for Railway + Vercel setup
- `deploy/CHANGELOG.md` — this file
- `meetings/2026-05-14_production-deployment-plan.md` — session summary

### Remaining before deployment
- [ ] Create Railway account, create project, set env vars, push backend
- [ ] Connect frontend to Vercel, set env vars, assign majstr.xyz domain
- [ ] Add api.majstr.xyz CNAME in Vercel DNS → Railway URL
- [ ] Fix ipinfo.io rate-limit warning (WARN-002) — add API key or replace
- [ ] Smoke test end-to-end on hosted URLs
