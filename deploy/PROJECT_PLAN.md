# Majstr — Production Deployment Plan
Date: 2026-05-14
Status: IN PROGRESS

---

## Goal
Deploy a hosted dev server (always-on, accessible at a public URL) and a separate production server. The domain `majstr.xyz` is on Vercel. Core functionality required: view main page, search and filter masters.

## Architecture Decision
Frontend: **Vercel** (already own domain there, free SPA hosting, zero-config)
Backend: **Railway** ($5/month starter, simple Node.js deployment, no hidden fees)
Database: **MongoDB Atlas** (already configured, free M0 tier 512MB)
Storage: **AWS S3** (already configured)
Bot: **polling mode** for dev & prod (simpler, no SSL cert setup required for bot)

## Environments

| Env | Frontend | Backend | Bot mode | Domain |
|-----|----------|---------|----------|--------|
| dev | Vercel preview URL or majstr-dev.majstr.xyz | Railway staging service | polling | subdomain or preview |
| prod | majstr.xyz on Vercel | Railway production service | polling (or webhook later) | majstr.xyz / api.majstr.xyz |

---

## Tasks

### Phase 1 — Critical bug fixes (DO FIRST, blocks deploy)
- [x] BUG-001: `handleApproveMaster` auth check does not block unauthorized requests
- [x] BUG-002: `addMaster` validation throws error instead of returning 400
- [x] BUG-003: `handleApiRequests` hangs if `?q=` param is missing (no response sent)
- [x] BUG-004: CORS wildcard `*` — restrict to allowed origins via env var
- [ ] BUG-005: `ipinfo.io` geo-detection has no API key — will rate-limit in production (frontend)

### Phase 2 — Backend deploy on Railway
- [ ] DEPLOY-001: Create Railway account + project
- [ ] DEPLOY-002: Set all env vars in Railway dashboard (see checklist below)
- [ ] DEPLOY-003: Push backend to Railway (connect GitHub repo, set root to /backend)
- [ ] DEPLOY-004: Verify API responds at https://your-app.railway.app/?q=masters
- [ ] DEPLOY-005: Note Railway URL — needed for frontend env config

### Phase 3 — Frontend deploy on Vercel
- [ ] DEPLOY-006: Set VITE_API_URL in Vercel env vars (Railway URL for dev, api.majstr.xyz for prod)
- [ ] DEPLOY-007: Connect GitHub repo to Vercel, set root dir to /frontend
- [ ] DEPLOY-008: Configure majstr.xyz domain in Vercel (it's already registered there)
- [ ] DEPLOY-009: Add CNAME/A records in Vercel DNS for api.majstr.xyz → Railway

### Phase 4 — Production environment
- [ ] PROD-001: Create separate Railway production service (or duplicate + promote)
- [ ] PROD-002: Set production env vars (separate JWT secret, prod S3 bucket, etc.)
- [ ] PROD-003: Configure api.majstr.xyz custom domain in Railway
- [ ] PROD-004: Update frontend .env.production VITE_API_URL = https://api.majstr.xyz
- [ ] PROD-005: End-to-end smoke test: browse masters, filter by city/trade, modal opens

### Phase 5 — OG Middleware (defer until add-master flow is ready)
- [ ] OGM-001: Refactor middleware to use absolute path for index.html (currently relative)
- [ ] OGM-002: Deploy as part of backend or as separate Railway service
- [ ] OGM-003: Configure nginx-equivalent routing in Vercel rewrites (card= → OG server)

---

## Railway Backend Env Vars Checklist
```
MONGO_PASSWORD=
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
JWT_ACCESS_TOKEN_SECRET=
AWS_ACCESS_KEY=
AWS_SECRET_ACCESS_KEY=
FRONTEND_URL=https://majstr.xyz
ALLOWED_ORIGINS=https://majstr.xyz,https://www.majstr.xyz
# Do NOT set WEBHOOK_URL — this keeps bot in polling mode
```

## Vercel Frontend Env Vars Checklist
```
# dev environment:
VITE_API_URL=https://your-app.railway.app
VITE_APP_URL=https://preview.majstr.xyz

# production environment:
VITE_API_URL=https://api.majstr.xyz
VITE_APP_URL=https://majstr.xyz
```

---

## Cost Estimate (monthly)
| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby (free) | $0 |
| Railway | Starter | $5 |
| MongoDB Atlas | M0 (free) | $0 |
| AWS S3 | ~1GB storage + requests | <$1 |
| **Total** | | **~$6/month** |

No hidden fees: Railway charges per actual CPU/RAM usage with a $5 minimum, bills monthly.
