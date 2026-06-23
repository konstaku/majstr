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

### Web (Next.js — catalogue + Telegram Mini App)
```bash
cd web
npm run dev        # next dev (http://localhost:3000)
npm run build      # next build (SSG/ISR)
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
npm test           # Vitest (happy-dom) — reducer/detect/middleware unit tests
```
The standalone Vite SPA (`frontend/`) was retired in the Phase 1 collapse
(2026-06); all its surfaces now live in `web/` (see Architecture below).

### E2E (smoke)
```bash
cd e2e
npm test           # Playwright against the Next dev server (web/); API served
                   # from in-memory fixtures (global-setup.ts) + page.route() —
                   # no real backend/Mongo/bot needed.
                   # One-time: npm install && npx playwright install chromium
```

Backend test notes: tests require app modules with `require()` (the CJS graph
is native — `vi.mock` cannot reach transitive requires). Chromium/S3 stay out
of tests via the `og.impl` seam (`helpers/generateOpenGraph.js`) and the
`_s3` export on `routes/photo.js`.

## Architecture

Two Node processes on Railway (backend) + one Next app on Vercel (web):

| Process | File / dir | Purpose |
|---|---|---|
| API server | `backend/index.js` → `backend/app.js` | REST API at `api.majstr.xyz` (`/`, `/auth`, `/addmaster`, `/api/*`) |
| Telegram bot | `backend/bot.js` → `backend/bot/` | Telegram webhook/polling handler |
| Web (Next.js) | `web/` (Vercel project `majstr-frontend`) | Public SEO catalogue **and** the Telegram Mini App surfaces |

`backend/index.js` is a thin entry: the Express app is built side-effect-free in `backend/app.js` (what the test suite imports). The bot implementation lives in `backend/bot/` (instance, transport, router, startFlow, masterStatus, forwardLeads, moderationCallbacks, claimCallbacks); `backend/bot.js` is a thin re-export of `{ bot, runBot }`.

**Web layer (`web/`):** one Next app, split by host via `web/middleware.ts`:
- `majstr.xyz` (+ `fr.majstr.xyz` later) → the public SEO catalogue (App Router `app/[lang]/…`, SSG/ISR). The interactive catalogue UI lives in `web/spa/` (client components mounted by the SSG pages).
- `app.majstr.xyz` → the Telegram **Mini App** surfaces under `app/(app)/…`: `/onboard`, `/claim/[masterId]`, `/my-cards`, `/login`, `/profile`, `/admin`, `/admin/mining`. These reuse `web/spa/` (onboarding, components, surface detection, providers).

OG/social previews are rendered by `web/` and by the backend OG generator. The old Vite SPA (`frontend/`) and `open-graph-middleware.js` were removed.

## Authentication Flow

1. User sends `/start` to the Telegram bot
2. Bot creates a JWT, stores the user in MongoDB, fetches their Telegram profile photo, uploads it to S3
3. Bot sends a login button with a URL: `https://majstr.xyz/login?token=<encoded-jwt>`
4. The Next `/login` page (`app/(app)/login`, on `app.majstr.xyz`) reads the token from the URL, saves it to `localStorage`
5. `apiFetch` (`web/spa/api/client.ts`) attaches auth per surface: inside Telegram it sends `X-Telegram-Init-Data` (verified server-side by HMAC); on the web it sends the `localStorage` JWT as `Authorization`. `useAuthenticateUser` probes `GET /auth`.

## Master Approval Flow

1. Any logged-in user can submit a master via `POST /addmaster`
2. New masters get `approved: false` by default
3. On save, an OG image is rendered with Playwright/Chromium (`helpers/generateOpenGraph.js`) and uploaded to S3 (bucket from `S3_BUCKET` env via `config/s3.js`, default `chupakabra-test`; key `user-og/<master_id>.png`)
4. Admin receives a Telegram message with Approve ✅ / Decline ❌ inline keyboard
5. Admin's Telegram ID `5950535` gets masters auto-approved

## Web state

Global state is `useReducer` + React Context (`web/spa/context.tsx`, `MasterContext`). The reducer (`web/spa/reducer.tsx`) handles `POPULATE`, `SET_COUNTRY`, `SET_CITY`, `SET_PROFESSION`, `RESET_SEARCH`, `LOGIN`, `LOGOUT`, `ERROR`, `SET_LANGUAGE`. The provider serves two modes: **server-seeded** for the SSG catalogue (data fetched server-side, passed as `initial`) and **no-seed** for the Mini App surfaces (client lang from `localStorage`). `web/spa/components/Root.tsx` also client-refetches reference data on mount.

Reference data (countries, locations, professions, categories) is served from MongoDB via the API (`/?q=…`, `/api/reference/…`) — the old static `locations.json`/`professions.json` JSON files are gone.

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
- `FRONTEND_URL` — Base URL for Telegram login links / public site (e.g. `https://majstr.xyz`)
- `TMA_BASE_URL` — Base URL of the Telegram Mini App surfaces (e.g. `https://app.majstr.xyz`); the bot's web_app buttons point here (`/onboard`, `/my-cards`)
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist for the API (e.g. `https://majstr.xyz,https://app.majstr.xyz`); defaults to `*` when unset

## Local Development

The app can now run locally without SSL certificates:

```bash
# Terminal 1 — backend (HTTP on port 5000)
cd backend && npm run devStart

# Terminal 2 — web (Next dev server on port 3000)
cd web && npm run dev
```

Point the web app at the local API via `NEXT_PUBLIC_API_URL` / `API_BASE` (e.g. `http://localhost:5000`); both default to `https://api.majstr.xyz`. The Telegram bot starts in polling mode when `WEBHOOK_URL` is not set. Note: the Telegram login + Mini App flows require HTTPS and a registered domain, so auth won't work on plain localhost — use `ngrok` to test end-to-end. On localhost the host-separation middleware is inert (unknown host → everything served), so `/onboard` etc. are reachable directly.
