# FoodBridge — Claude Code Guide

## Project overview

FoodBridge is a peer-to-peer food sharing web app built for INDE 412 (Engineering Entrepreneurship). Users post surplus sealed food nearing expiry; nearby community members claim and pick it up for free. The functional requirements live in `../FoodBridge_Functional_Requirements.md`.

## Running the app

```bash
# Install all dependencies (first time only)
npm run install:all

# Start both server and client
npm run dev
```

- **API server** → `http://localhost:3001`
- **Frontend** → `http://localhost:5173`

Or run them separately:
```bash
cd server && node index.js      # API on :3001
cd client && npm run dev        # UI on :5173
```

## Architecture

```
foodbridge/
├── server/                  # Node.js + Express + SQLite backend
│   ├── index.js             # Entry point: Express, Socket.io, cron job
│   ├── db.js                # SQLite schema (better-sqlite3)
│   ├── middleware/
│   │   └── auth.js          # JWT verification + admin guard
│   └── routes/
│       ├── auth.js          # OTP auth, profile, ID upload
│       ├── listings.js      # CRUD + distance/filter search
│       ├── claims.js        # Claim, cancel, confirm pickup
│       ├── messages.js      # In-app chat
│       └── misc.js          # Ratings, reports, notifications, admin
└── client/                  # React 18 + TypeScript + Vite + Tailwind
    └── src/
        ├── pages/           # One file per screen
        ├── components/      # Shared UI (cards, badges, ratings)
        ├── context/         # AuthContext (user, token, socket)
        ├── api.ts           # Axios instance with JWT interceptor
        └── types.ts         # Shared TypeScript types + constants
```

## Key conventions

- **Auth:** JWT stored in `localStorage`, sent as `Authorization: Bearer <token>`. The first account registered automatically receives `is_admin = 1`.
- **OTP (demo mode):** No real SMS is sent. The generated code is returned in the API response as `demo_otp` and displayed in the UI.
- **File uploads:** Multer saves files to `server/uploads/`. The Express server serves them at `/uploads/*`. The Vite dev proxy forwards `/uploads` to `:3001`.
- **Real-time:** Socket.io rooms follow two patterns: `user:<userId>` for notifications, `claim:<claimId>` for chat.
- **Database:** SQLite file at `server/foodbridge.db` (git-ignored). Delete it to reset all data.
- **Auto-expiry:** `node-cron` runs hourly to mark expired listings and notify listers (FR-04-05).
- **Offline caching:** Last feed is stored in `localStorage` under `foodbridge_feed_cache` (FR-03-06).

## API base URL

All API routes are prefixed `/api`. The Vite dev server proxies `/api` and `/uploads` to `http://localhost:3001`.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 25 |
| Backend framework | Express 4 |
| Database | SQLite via `better-sqlite3` |
| Real-time | Socket.io 4 |
| Scheduled jobs | `node-cron` |
| Auth | JWT (`jsonwebtoken`) |
| File uploads | Multer 2 |
| Frontend framework | React 18 + TypeScript |
| Build tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Icons | Lucide React |
| HTTP client | Axios |
| Date utilities | date-fns |

## MVP modules implemented

| ID | Module | Status |
|----|--------|--------|
| 01 | Auth & Onboarding | ✅ |
| 02 | Food Listing Creation | ✅ |
| 03 | Browse & Claim | ✅ |
| 04 | Safety & Trust | ✅ |
| 05 | Notifications | ✅ |
| 06 | Messaging & Pickup | ✅ |
