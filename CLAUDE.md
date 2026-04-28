# FoodBridge — Claude Code Guide

## Project overview

FoodBridge is a peer-to-peer food sharing web app built for INDE 412 (Engineering Entrepreneurship). Users post surplus sealed food nearing expiry; nearby community members claim and pick it up for free. The functional requirements live in `../FoodBridge_Functional_Requirements.md`.

## Running the app

```bash
# 1. Start local Supabase (Docker required)
supabase start

# 2. Install all dependencies (first time only)
npm run install:all

# 3. Start both admin server and client
npm run dev
```

- **Supabase Studio** → `http://127.0.0.1:54323`
- **Admin server** → `http://localhost:3001`
- **Frontend** → `http://localhost:5173`

Or run separately:

```bash
cd server && node index.js      # Admin API on :3001
cd client && npm run dev        # UI on :5173
```

## Architecture

```
foodbridge/
├── supabase/
│   └── migrations/
│       ├── 20260415000000_initial_schema.sql  # Tables, RLS, RPCs, pg_cron
│       └── 20260415000001_storage.sql          # Storage buckets + policies
├── server/                  # Thin Node.js + Express (admin only)
│   └── index.js             # Single-file: admin user actions via service role
└── client/                  # React 18 + TypeScript + Vite + Tailwind
    └── src/
        ├── lib/supabase.ts  # Supabase client singleton
        ├── pages/           # One file per screen
        ├── components/      # Shared UI (cards, badges, ratings)
        ├── context/         # AuthContext (supabase.auth.onAuthStateChange)
        └── types.ts         # Shared TypeScript types + constants
```

## Key conventions

- **Auth:** Supabase Auth (email + password). First user registered becomes admin (set in `handle_new_user` trigger).
- **Login with username:** `get_email_by_username(p_username)` RPC resolves username → email, then `supabase.auth.signInWithPassword`.
- **File uploads:** Supabase Storage buckets: `listing-photos` (public), `profile-photos` (public), `id-documents` (private).
- **Real-time:** Supabase Realtime (Postgres Changes). Messages subscribe to `claim_id=eq.X`, notifications to `user_id=eq.X`.
- **Database:** PostgreSQL via Supabase local. Reset: `supabase db reset`.
- **Auto-expiry:** pg_cron job runs hourly: `select public.expire_listings()`.
- **Offline caching:** Last feed stored in `localStorage` under `foodbridge_feed_cache`.
- **Admin actions:** Thin Express server (`server/index.js`) uses `SUPABASE_SERVICE_ROLE_KEY` for privileged user updates. Frontend calls it with Bearer token at `/api/admin/*`.
- **Atomic claiming:** `claim_listing(p_listing_id)` RPC uses `FOR UPDATE` lock to prevent race conditions.

## Environment variables

**`client/.env.local`**

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key from supabase status>
VITE_ADMIN_API_URL=http://localhost:3001/api
```

**`server/.env`**

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase status>
CLIENT_URL=http://localhost:5173
PORT=3001
```

## Tech stack

| Layer              | Technology                                  |
| ------------------ | ------------------------------------------- |
| Database & Auth    | Supabase (PostgreSQL + GoTrue)              |
| Real-time          | Supabase Realtime (Postgres Changes)        |
| File storage       | Supabase Storage                            |
| Scheduled jobs     | pg_cron (inside Supabase)                   |
| Admin backend      | Node.js + Express (thin, service role only) |
| Frontend framework | React 18 + TypeScript                       |
| Build tool         | Vite 5                                      |
| Styling            | Tailwind CSS 3                              |
| Icons              | Lucide React                                |
| Supabase client    | @supabase/supabase-js                       |
| Date utilities     | date-fns                                    |

## MVP modules implemented

| ID  | Module                | Status |
| --- | --------------------- | ------ |
| 01  | Auth & Onboarding     | ✅     |
| 02  | Food Listing Creation | ✅     |
| 03  | Browse & Claim        | ✅     |
| 04  | Safety & Trust        | ✅     |
| 05  | Notifications         | ✅     |
| 06  | Messaging & Pickup    | ✅     |
