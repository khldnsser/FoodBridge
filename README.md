# FoodBridge 🌱

A peer-to-peer surplus food sharing platform connecting individuals and restaurants with surplus sealed food to community members who can claim and use them — for free.

Built for **INDE 412: Engineering Entrepreneurship** at the American University of Beirut.

---

## Quick Start

### Prerequisites
- Node.js 20+ (tested on v25.7)
- npm 10+

### Installation & Running

```bash
# Clone/navigate to the project
cd foodbridge

# Install all dependencies
npm run install:all

# Start both server and client
npm run dev
```

Then open:
- **App**: `http://localhost:5173`
- **API**: `http://localhost:3001`

---

## How It Works

### For Food Sharers 🥘
1. **Register** with phone number (OTP verification)
2. **Post a listing** with:
   - ✅ Mandatory sealed-packaging photo
   - Expiry date (validated to be in the future)
   - Food category & dietary attributes (Halal, Vegan, etc.)
   - Storage condition (room temp, refrigerated, frozen)
   - Pickup location
3. **Receive notifications** when someone claims your food
4. **Coordinate via chat** and confirm pickup with the claimer
5. **Get rated** by the community

### For Food Claimers 🔍
1. **Browse nearby listings** filtered by:
   - Distance (default 5km radius)
   - Food category (Dairy, Canned goods, Bread, etc.)
   - Dietary preferences (from your profile)
2. **View listing details** with photos, expiry warning, lister info & ratings
3. **One-tap claim** to reserve an item
4. **Chat with lister** to arrange pickup time & exact location
5. **Confirm pickup** (both parties must confirm)
6. **Rate the exchange** to build community trust

---

## Key Features

### Trust & Safety (76% of users require sealed packaging proof)
- **Verified badges**: Phone Verified (automatic) + ID Verified (admin-reviewed)
- **Two-way star ratings** (1-5 stars with optional reviews)
- **Report & flag system** for suspicious listings or users
- **Admin panel** to review reports, remove listings, warn/suspend accounts

### Smart Notifications
- **Push notifications** when new items match your dietary filters
- **SMS fallback** (demo: shown in UI) for unreliable internet (Lebanon-specific)
- **Real-time chat** updates via Socket.io

### Offline-First Design
- Last-loaded feed cached locally
- Works even when internet drops (critical for Lebanon's ~12-20hr daily outages)

### Impact Tracking
- Personal counter: items shared/claimed, estimated kg saved, CO₂ offset
- Gamification to reinforce sustainability mission (89% of users care about food waste)

---

## Demo Mode

- **OTP**: No SMS sent. Code is displayed on-screen and returned in API response
- **Location**: Uses browser Geolocation API. Can manually enter address
- **First account registered automatically becomes admin** — access admin panel via profile gear icon

### Test Admin Features
1. Register as first user → auto-admin access
2. Go to Profile → Settings icon → Admin Panel
3. Review pending reports, verify ID documents, manage users

---

## Project Structure

```
foodbridge/
├── CLAUDE.md                    # Claude Code guide & conventions
├── README.md                    # This file
├── package.json                 # Root scripts (npm run dev)
│
├── server/                      # Express + SQLite API
│   ├── index.js                 # Entry point, Socket.io, cron jobs
│   ├── db.js                    # Database schema
│   ├── middleware/auth.js       # JWT & admin middleware
│   └── routes/
│       ├── auth.js              # Phone OTP, profile, ID upload
│       ├── listings.js          # Post, browse, search, filter
│       ├── claims.js            # Claim, cancel, confirm pickup
│       ├── messages.js          # In-app chat
│       └── misc.js              # Ratings, reports, notifications, admin
│
└── client/                      # React + TypeScript + Vite
    └── src/
        ├── pages/               # 10 screens (Landing, Register, Home, etc.)
        ├── components/          # Shared UI (cards, badges, ratings)
        ├── context/AuthContext  # User & socket state
        ├── api.ts               # Axios + JWT interceptor
        └── types.ts             # TypeScript types & constants
```

---

## Functional Requirements Coverage

| Module | Feature | Status |
|--------|---------|--------|
| **01 Auth** | Phone OTP + ID verification | ✅ MVP |
| | Profile creation & role selection | ✅ MVP |
| **02 Listings** | Sealed-packaging photo (mandatory) | ✅ MVP |
| | Expiry date validation & warning | ✅ MVP |
| | Category tagging & dietary attributes | ✅ MVP |
| | Storage condition & pickup location | ✅ MVP |
| **03 Browse** | Location-based feed (5km default) | ✅ MVP |
| | Multi-filter panel (category, diet, distance) | ✅ MVP |
| | Listing detail with swipeable photos | ✅ MVP |
| | One-tap claim with confirmation | ✅ MVP |
| | Offline-first caching | ✅ MVP |
| **04 Safety** | Two-way star ratings & reviews | ✅ MVP |
| | Report/flag system | ✅ MVP |
| | Admin review queue & actions | ✅ MVP |
| | Verified badge display | ✅ MVP |
| | Auto-delisting of expired items | ✅ MVP |
| **05 Notifications** | Push for nearby listings | ✅ MVP |
| | SMS fallback (demo) | ✅ MVP |
| | Claim & cancellation alerts | ✅ MVP |
| **06 Messaging** | In-app chat thread | ✅ MVP |
| | Dual pickup confirmation | ✅ MVP |
| | Pickup-only mode (no delivery) | ✅ MVP |

---

## Tech Stack

**Backend**
- Node.js 25 + Express 4
- SQLite (better-sqlite3)
- Socket.io 4 (real-time chat & notifications)
- node-cron (auto-expiry jobs)
- Multer 2 (file uploads)

**Frontend**
- React 18 + TypeScript
- Vite 5 (dev server & build)
- Tailwind CSS 3 (styling)
- Lucide React (icons)
- date-fns (date utilities)

---

## Development

### API Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/auth/request-otp` | — | Request OTP |
| `POST` | `/api/auth/verify-otp` | — | Verify OTP, get JWT |
| `GET` | `/api/listings` | ✅ | Browse with filters |
| `POST` | `/api/listings` | ✅ | Create listing (multipart) |
| `POST` | `/api/claims` | ✅ | Claim a listing |
| `POST` | `/api/claims/{id}/confirm` | ✅ | Confirm pickup |
| `GET` | `/api/messages/{claimId}` | ✅ | Get chat messages |
| `POST` | `/api/messages/{claimId}` | ✅ | Send message |
| `POST` | `/api/ratings` | ✅ | Submit rating |
| `GET` | `/api/admin/reports` | ✅👮 | List flagged content |
| `PATCH` | `/api/admin/users/{id}` | ✅👮 | Suspend/warn user |

**Auth header format:** `Authorization: Bearer <jwt-token>`

### Database

SQLite file: `server/foodbridge.db` (git-ignored)

To reset data:
```bash
rm server/foodbridge.db
rm server/foodbridge.db-shm server/foodbridge.db-wal  # journal files
npm run dev  # recreates schema
```

### Socket.io Events

- `join-claim` / `leave-claim` — enter/exit chat room
- `message` — new message in chat
- `pickup_confirmed` — user confirmed pickup
- `pickup_complete` — both users confirmed (triggers rating)
- `notification` — new notification for user

---

## Design Philosophy

- **Mobile-first**: Bottom navigation bar, card-based layout, touch-optimized buttons
- **Accessibility**: High contrast, clear labels, semantic HTML
- **Offline resilience**: Critical for Lebanon's infrastructure constraints
- **Trust-centric**: Sealed packaging + ID verification at the core
- **Zero intermediaries**: Direct P2P messaging & coordination

---

## Known Limitations (Phase 2+)

- No delivery integration (pickup-only at launch)
- No payment system (fully free MVP)
- No search/autocomplete (Phase 2)
- No restaurant-specific analytics dashboard (Phase 3)
- No premium tier (Phase 2)

---

## Team

**INDE 412 – Engineering Entrepreneurship**
- Najla Sadek
- Kassem Yassine
- Mohamad Lakkis
- Jad Shaker
- Khaled Nasser

**Built with Claude Code** (AI-assisted development)

---

## License

Educational project — INDE 412 Spring 2026, American University of Beirut

---

## For Claude Code Users

See `CLAUDE.md` for:
- Architecture deep-dive
- Key conventions (JWT, OTP demo, Socket.io rooms)
- Running server & client separately
- Database schema reference
