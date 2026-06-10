# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Majstr is a platform for finding Ukrainian craftsmen/masters in Italy. Users authenticate via Telegram, and admins approve new master listings through the Telegram bot.

## Architecture Decisions

- [ADR 0001 — Telegram chat access strategy](docs/adr/0001-telegram-access.md): manual export for history backfill, GramJS (dedicated account) for live watcher only.
- [Data-handling policy for scraped contacts](docs/data-policy.md): lawful basis, minimization, takedown, admin-review safeguard.

Telegram master-mining initiative is tracked on GitHub Project #4; blockers/decisions on pinned issue konstaku/majstr#113.

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
npm run review     # Local LLM review queue (http://127.0.0.1:4300) — auth-free,
                   # localhost-only. Paste chat text → Ollama → review/publish.
                   # Needs `ollama serve` running (OLLAMA_MODEL, default qwen2.5:14b).
npm test           # Vitest + supertest + mongodb-memory-server (first run
                   # downloads a mongod binary, cached afterwards)
npm run test:watch # Vitest in watch mode
```

### Frontend
```bash
cd frontend
npm run dev        # Vite dev server
npm run build      # Production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests (happy-dom + MSW)
npm run preview    # Preview production build
```

### E2E (smoke)
```bash
cd e2e
npm test           # Playwright against the Vite dev server; the API is fully
                   # stubbed via page.route() — no backend/Mongo/bot needed.
                   # One-time: npm install && npx playwright install chromium
```

Backend test notes: tests require app modules with `require()` (the CJS graph
is native — `vi.mock` cannot reach transitive requires). Chromium/S3 stay out
of tests via the `og.impl` seam (`helpers/generateOpenGraph.js`) and the
`_s3` export on `routes/photo.js`.

## Architecture

The project has two Node processes running in production:

| Process | File | Port | Purpose |
|---|---|---|---|
| API server | `backend/index.js` | 5000 (HTTPS) | REST API (`/`, `/auth`, `/addmaster`, `/api/*`) |
| Telegram bot | `backend/bot.js` | 8443 (HTTPS) | Webhook handler for Telegram |

`backend/index.js` is a thin entry: the Express app is built side-effect-free in `backend/app.js` (which is what the test suite imports). The bot implementation lives in `backend/bot/` (instance, transport, router, startFlow, masterStatus, forwardLeads, moderationCallbacks, claimCallbacks); `backend/bot.js` stays as a thin re-export of `{ bot, runBot }`. OG/social previews are rendered by the Next.js layer in `web/` (the old `open-graph-middleware.js` was removed). The API lives at `api.majstr.xyz`.

## Authentication Flow

1. User sends `/start` to the Telegram bot
2. Bot creates a JWT, stores the user in MongoDB, fetches their Telegram profile photo, uploads it to S3
3. Bot sends a login button with a URL: `https://majstr.xyz/login?token=<encoded-jwt>`
4. Frontend `/login` page reads the token from the URL, saves it to `localStorage`
5. On subsequent visits, `useAuthenticateUser` hook reads the token from `localStorage` and hits `GET /auth` with it as the `Authorization` header

## Master Approval Flow

1. Any logged-in user can submit a master via `POST /addmaster`
2. New masters get `approved: false` by default
3. On save, an OG image is rendered with Playwright/Chromium (`helpers/generateOpenGraph.js`) and uploaded to S3 (bucket from `S3_BUCKET` env via `config/s3.js`, default `chupakabra-test`; key `user-og/<master_id>.png`)
4. Admin receives a Telegram message with Approve ✅ / Decline ❌ inline keyboard
5. Admin's Telegram ID `5950535` gets masters auto-approved

## Frontend State

Global state is managed with `useReducer` + React Context (`MasterContext`). The reducer (`reducer.jsx`) handles: `POPULATE`, `SET_CITY`, `SET_PROFESSION`, `RESET_SEARCH`, `LOGIN`, `LOGOUT`. Masters are loaded via a React Router v6 `loader` on the main route, fetching from `https://api.majstr.xyz/?q=masters`.

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
- `WEBHOOK_URL` — Public HTTPS base URL for the Telegram webhook (e.g. `https://majstr.xyz`). When absent, the bot starts in polling mode — no SSL or public URL needed
- `FRONTEND_URL` — Base URL sent in Telegram login links (e.g. `https://majstr.xyz`). Defaults to `http://localhost:5173`

## Local Development

The app can now run locally without SSL certificates:

```bash
# Terminal 1 — backend (HTTP on port 5000)
cd backend && npm run devStart

# Terminal 2 — frontend (Vite dev server on port 5173)
cd frontend && npm run dev
```

The frontend `.env.development` points to `http://localhost:5000` automatically. The Telegram bot starts in polling mode when `WEBHOOK_URL` is not set. Note: the Telegram login flow requires HTTPS and a registered domain, so authentication won't work locally — use `ngrok` if you need to test auth end-to-end.
