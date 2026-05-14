# Deployment Guide
Date: 2026-05-14

## Stack
- Frontend → Vercel (free, you already own majstr.xyz there)
- Backend → Railway ($5/month, no hidden fees)
- DB → MongoDB Atlas (free M0 tier already configured)
- Storage → AWS S3 (already configured)

---

## Step 1 — Deploy Backend on Railway

1. Go to https://railway.app and create an account (GitHub login recommended)
2. New Project → Deploy from GitHub repo
3. Select the `majstr` repo
4. Set **Root Directory** to `/backend`
5. Railway auto-detects Node.js and runs `npm start` — add a start script first:
   - In `backend/package.json`, add: `"start": "node index.js"` to scripts
6. In Railway project → Variables tab, add all env vars (see checklist below)
7. Deploy — Railway gives you a URL like `https://majstr-backend-production.up.railway.app`

### Railway Env Vars to set:
```
MONGO_PASSWORD=<your atlas password>
TELEGRAM_BOT_TOKEN=<bot token>
TELEGRAM_ADMIN_CHAT_ID=<your telegram id>
JWT_ACCESS_TOKEN_SECRET=<random 32-char string>
AWS_ACCESS_KEY=<aws key>
AWS_SECRET_ACCESS_KEY=<aws secret>
FRONTEND_URL=https://majstr.xyz
ALLOWED_ORIGINS=https://majstr.xyz,https://www.majstr.xyz
# WEBHOOK_URL — leave blank to keep bot in polling mode (simpler, works fine)
```

### Verify backend works:
```
curl https://your-app.railway.app/?q=masters
```
Should return JSON array.

---

## Step 2 — Deploy Frontend on Vercel

1. Go to https://vercel.com, connect GitHub repo
2. Set **Root Directory** to `/frontend`
3. Framework: Vite (auto-detected)
4. Add env vars in Vercel → Settings → Environment Variables:

For **Preview** (dev) environment:
```
VITE_API_URL=https://your-app.railway.app
VITE_APP_URL=https://majstr-preview.vercel.app
```

For **Production** environment:
```
VITE_API_URL=https://api.majstr.xyz
VITE_APP_URL=https://majstr.xyz
```

5. Assign `majstr.xyz` domain to the Production deployment (it's already managed by Vercel DNS)

---

## Step 3 — Configure api.majstr.xyz subdomain

In Vercel DNS (since majstr.xyz is managed there), add a CNAME record:
```
api.majstr.xyz → your-app.railway.app
```

Then in Railway → your project → Settings → Domains, add `api.majstr.xyz` as a custom domain. Railway will issue an SSL cert automatically.

---

## Step 4 — Add start script to backend/package.json

The `package.json` currently has no `start` script. Railway needs it:

In `backend/package.json`, add to scripts:
```json
"start": "node index.js"
```

---

## Telegram Bot in Polling Mode

Do **not** set `WEBHOOK_URL` in Railway. Without it, the bot starts in polling mode — it connects to Telegram's API and polls for updates. This works fine for dev and production at this scale. No SSL certs, no extra port, no Telegram webhook registration needed.

If you later want webhook mode (for lower latency), you'll need:
- A dedicated HTTPS URL (Railway provides this)
- Update `WEBHOOK_URL` env var to the Railway URL (without the port)
- Refactor `runBot()` in bot.js to not append `:8443` to the webhook URL

---

## OG Middleware (defer until add-master flow is needed)

The OG middleware (`open-graph-middleware.js`) requires:
1. Access to `frontend/index.html` (currently reads via relative path — needs fix for Railway)
2. Nginx-style routing to redirect `?card=` requests to port 5050

For now, social sharing previews won't work. This is acceptable for the dev launch — focus on core browse/filter functionality first.

---

## Cost Breakdown (monthly, no surprises)
| Service | Cost |
|---------|------|
| Vercel Hobby (frontend) | $0 |
| Railway Starter (backend) | $5 |
| MongoDB Atlas M0 | $0 |
| AWS S3 (~1GB storage + requests) | <$1 |
| **Total** | ~$6/month |

Railway bills by actual resource usage with a $5 monthly minimum. No surprise overages unless you get massive traffic (then it scales linearly).
