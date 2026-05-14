# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Majstr is a platform for finding Ukrainian craftsmen/masters in Italy. Users authenticate via Telegram, and admins approve new master listings through the Telegram bot.

# Project Instructions

## Meeting Notes System

After any session where we discuss ideas, make decisions, review options, 
or brainstorm — automatically save a meeting summary.

### When to save
Save a meeting note when the session included:
- discussing approaches or options
- making architectural/design decisions  
- brainstorming features or solutions
- reviewing code structure or plans
- any back-and-forth that produced conclusions

### How to save

1. Create `meetings/` folder if it doesn't exist
2. Filename: `YYYY-MM-DD_short-topic-slug.md`
3. Save without asking me — just do it at the end of the session

### File format

```markdown
# Meeting: <Topic>
Date: YYYY-MM-DD

## What we discussed
<2-3 sentences, context>

## Options considered
- Option A — pros/cons
- Option B — pros/cons

## Decisions made
- <concrete decision>
- <concrete decision>

## Open questions
- <if any>

## Next steps
- [ ] <action item>
```

Save the note before ending the session. No need to ask for permission.

## Commands

### Backend
```bash
cd backend
npm run devStart   # Start with nodemon (auto-reload)
node index.js      # Start without auto-reload
```

### Frontend
```bash
cd frontend
npm run dev        # Vite dev server
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Architecture

The project has three separate Node processes running in production, all requiring SSL certificates:

| Process | File | Port | Purpose |
|---|---|---|---|
| API server | `backend/index.js` | 5000 (HTTPS) | REST API (`/`, `/auth`, `/addmaster`) |
| Telegram bot | `backend/bot.js` | 8443 (HTTPS) | Webhook handler for Telegram |
| OG middleware | `backend/open-graph-middleware.js` | 5050 (HTTP) | SSR for social sharing previews |

Nginx routes traffic: requests with `?card=` in the URL go to the OG middleware (port 5050); everything else goes to the static frontend. The API lives at `api.majstr.com`.

## Authentication Flow

1. User sends `/start` to the Telegram bot
2. Bot creates a JWT, stores the user in MongoDB, fetches their Telegram profile photo, uploads it to S3
3. Bot sends a login button with a URL: `https://majstr.com/login?token=<encoded-jwt>`
4. Frontend `/login` page reads the token from the URL, saves it to `localStorage`
5. On subsequent visits, `useAuthenticateUser` hook reads the token from `localStorage` and hits `GET /auth` with it as the `Authorization` header

## Master Approval Flow

1. Any logged-in user can submit a master via `POST /addmaster`
2. New masters get `approved: false` by default
3. On save, a canvas-based OG image is generated (`helpers/generateOpenGraph.js`) and uploaded to S3 (`chupakabra-test` bucket, key `user-og/<master_id>.jpg`)
4. Admin receives a Telegram message with Approve ✅ / Decline ❌ inline keyboard
5. Admin's Telegram ID `5950535` gets masters auto-approved

## Frontend State

Global state is managed with `useReducer` + React Context (`MasterContext`). The reducer (`reducer.jsx`) handles: `POPULATE`, `SET_CITY`, `SET_PROFESSION`, `RESET_SEARCH`, `LOGIN`, `LOGOUT`. Masters are loaded via a React Router v6 `loader` on the main route, fetching from `https://api.majstr.com/?q=masters`.

Static data (`locations.json`, `professions.json`) is duplicated in both `backend/data/` and `frontend/src/data/` — keep them in sync when updating.

## Environment Variables

Backend requires a `.env` file with:
- `MONGO_PASSWORD` — MongoDB Atlas password
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_ADMIN_CHAT_ID` — Telegram chat ID for admin notifications
- `JWT_ACCESS_TOKEN_SECRET` — Secret for signing JWTs
- `AWS_ACCESS_KEY` / `AWS_SECRET_ACCESS_KEY` — S3 upload credentials
- `CERTIFICATE` / `KEYFILE` — SSL cert paths for the bot server (port 8443)
- `CERTIFICATE_API` / `KEYFILE_API` — SSL cert paths for the API server (port 5000)
- `WEBHOOK_URL` — Public HTTPS base URL for the Telegram webhook (e.g. `https://majstr.com`). When absent, the bot starts in polling mode — no SSL or public URL needed
- `FRONTEND_URL` — Base URL sent in Telegram login links (e.g. `https://majstr.com`). Defaults to `http://localhost:5173`

## Local Development

The app can now run locally without SSL certificates:

```bash
# Terminal 1 — backend (HTTP on port 5000)
cd backend && npm run devStart

# Terminal 2 — frontend (Vite dev server on port 5173)
cd frontend && npm run dev
```

The frontend `.env.development` points to `http://localhost:5000` automatically. The Telegram bot starts in polling mode when `WEBHOOK_URL` is not set. Note: the Telegram login flow requires HTTPS and a registered domain, so authentication won't work locally — use `ngrok` if you need to test auth end-to-end.
