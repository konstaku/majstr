# Meeting: Production Deployment Plan & Codebase Review
Date: 2026-05-14

## What we discussed
Full production readiness audit of the Majstr codebase. Reviewed backend (index.js, bot.js, schemas, middleware), frontend (React/TS, router, context, components), and deployment architecture. Decided on deployment platform, fixed critical bugs, and created a phased deployment plan.

## Options considered

- **Hosting Option A: Vercel (frontend) + Railway (backend)** — low cost ($6/month), no hidden fees, simple setup, Railway supports Node.js natively. Winner for both dev and prod.
- **Hosting Option B: Vercel (frontend) + Hetzner CX22 VPS (backend)** — €4.51/month, more control but requires manual nginx + PM2 + SSL setup. Better for production phase 2 if scaling.
- **Hosting Option C: Vercel (frontend) + Render (backend)** — free tier but sleeps after 15 min inactivity, $7/month paid. Slower cold starts than Railway.

- **Bot mode A: Webhook mode** — lower latency, requires HTTPS on specific port, complex Railway setup
- **Bot mode B: Polling mode** — slightly higher latency (1-2s), zero configuration, works everywhere. Winner.

## Decisions made
- Deploy frontend to Vercel (domain already managed there, free, zero-config)
- Deploy backend to Railway ($5/month, polling mode for Telegram bot)
- Use MongoDB Atlas M0 (already configured and working)
- Keep S3 for photos/OG images (already configured)
- Bot runs in polling mode — do NOT set WEBHOOK_URL env var
- Defer OG middleware until add-master flow is built
- Fix 4 critical bugs before any deployment attempt

## Bugs found and fixed
- **BUG-001 FIXED**: `handleApproveMaster` auth bypass — any token could approve masters. Fixed: auth check now returns 403 if token not in admin list.
- **BUG-002 FIXED**: `addMaster` validation threw uncaught error instead of returning 400. Fixed: `return res.status(400).send(...)`.
- **BUG-003 FIXED**: `GET /` with no `?q=` param hung the connection. Fixed: early return 400.
- **BUG-004 FIXED**: CORS wildcard `*` now configurable via `ALLOWED_ORIGINS` env var.
- **BUG-005 (not fixed yet)**: `ipinfo.io` geo-detection in frontend has no API key, will rate-limit.

## Open questions
- Should we use Railway for both dev and prod environments, or separate projects?
- When should webhook mode be implemented for the bot (after launch)?
- OG middleware path needs to be absolute — how will `frontend/index.html` be co-located with the backend on Railway?
- Does the S3 bucket name `chupakabra-test` need to change for production?

## Next steps
- [ ] Add `"start": "node index.js"` to `backend/package.json` — DONE
- [ ] Create Railway account and deploy backend (follow `deploy/DEPLOY_GUIDE.md`)
- [ ] Set env vars in Railway dashboard
- [ ] Connect frontend to Vercel, configure domain
- [ ] Add `api.majstr.xyz` CNAME in Vercel DNS → Railway
- [ ] Smoke test: browse masters, filter, open modal
- [ ] Fix WARN-002: add ipinfo.io API key or replace geo-detection
