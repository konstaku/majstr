# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Majstr is a platform for finding Ukrainian craftsmen/masters in Italy. Users authenticate via Telegram, and admins approve new master listings through the Telegram bot.

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
