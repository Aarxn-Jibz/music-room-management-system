# Music Room Management System

A full-stack web application for managing music room bookings, slot requests, and user administration at SWO Kengeri Campus. Built with Next.js 15, a Hono API on Cloudflare Workers (D1), and Playwright.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Backend API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite) via Drizzle ORM
- **Auth:** JWT (jose) session tokens, bcryptjs password hashing
- **Styling:** Tailwind CSS 3 (dark theme + glassmorphism + gradient accents)
- **Animation:** Framer Motion
- **Testing:** Vitest (backend unit tests) + Playwright (API tests, UI tests)
- **Email:** SMTP via Cloudflare Sockets (booking notifications)
- **Sheets:** Weekly Google Sheets export (service-account JWT, admin-triggered + cron)
- **Deployment:** Vercel (frontend) + Cloudflare Workers (backend)

## Prerequisites

- Node.js 20+
- npm
- Wrangler CLI for local backend dev

## Getting Started

```bash
# Install dependencies
npm install --legacy-peer-deps
cd backend && npm install

# Optional: configure local backend secrets (SMTP, Google Sheets)
cp backend/.dev.vars.example backend/.dev.vars   # then fill in values

# Start the backend (Cloudflare Workers local)
cd backend && npm run dev

# Start the frontend dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/RoomBooking`. The frontend rewrites `/api/*` to the backend (default `http://localhost:8787`, override with `BACKEND_URL`).

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rejoy.local | admin123 |
| User | (create via Register page when logged in as admin) | — |

## Available Scripts

### Root (`rejoy/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test:api` | Run roombooking API tests (needs a running server at `BASE_URL`) |
| `npm run test:ui` | Run all Playwright UI tests (dev server must be running) |
| `npm run test:ui:headed` | Run Playwright UI tests with visible browser |
| `npm run test` | Alias for `playwright test` |

### Backend (`rejoy/backend/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | `wrangler dev` — local Hono API on port 8787 |
| `npm run deploy` | `wrangler deploy` — deploy the worker |
| `npm run test` | Run the Vitest backend unit test suite |
| `npm run test:watch` | Vitest watch mode |
| `npm run typecheck` | `tsc --noEmit` for the backend |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:migrate:prod` | Apply migrations to remote D1 |
| `npm run db:seed` | Seed local D1 with policy/rooms/admin |
| `npm run sheets:dry-run` | Run the weekly sheet build without calling Google (test harness) |

## Testing

### Backend Unit Tests (Vitest)

```bash
cd backend && npm run test    # 88 tests across 11 suites
```

### API Tests

Run against a running instance (dev or production). Set `BASE_URL` to point at the frontend (which proxies `/api/*` to the backend):

```bash
npm run test:api                                 # roombooking suite
node tests/slotrequests-api.test.mjs             # slot requests suite
node tests/dashboard-api.test.mjs                # dashboard suite
node tests/register-api.test.mjs                 # register suite
```

Run against production:

```bash
BASE_URL=https://your-app.vercel.app node tests/roombooking-api.test.mjs
```

> **Note:** The slotrequests and dashboard API suites depend on live seeded data (existing pending/approved requests, slot configs) and will report failures when the DB lacks that state. Only the roombooking suite is wired to `npm run test:api`.

### UI Tests (Playwright)

Requires a running dev server:

```bash
npm run dev &
npm run test:ui          # All UI tests
npm run test:ui:headed   # Visible browser
```

Run specific project:

```bash
npx playwright test --project=roombooking   # Table view, modals, booking flow
npx playwright test --project=slotrequests  # Request approval/denial workflow
npx playwright test --project=dashboard     # Slot configuration CRUD
npx playwright test --project=register      # User/band management
npx playwright test --project=responsive    # Mobile/tablet viewports
```

UI tests run with admin auth (via `playwright/.auth/admin.json`); several tests skip when the required data (pending requests, enough configs, bands) is absent.

## Project Structure

```
├── app/
│   ├── (root)/
│   │   ├── layout.tsx        # Root layout: Geist fonts, Providers, ForcePasswordChange
│   │   ├── Dashboard/        # Slot configuration dashboard (admin)
│   │   ├── Register/         # User and band management (admin)
│   │   ├── RoomBooking/      # Room booking timetable (public)
│   │   ├── SlotRequests/     # Slot request management (auth required)
│   │   ├── home/             # Landing page (Hero, Mission, Branches, Events)
│   │   └── page.tsx          # Redirects to /RoomBooking
│   ├── providers.tsx         # AuthProvider + ThemeProvider
│   ├── globals.css           # Tailwind + dark theme utilities
│   └── fonts/                # Geist font files
├── components/
│   ├── Navbar.tsx            # Nav with auth modals + mobile hamburger (per-page, no SSR)
│   ├── Hero.tsx              # Landing page hero with glowing-stars background
│   ├── Mission.tsx           # Auto-rotating mission/vision slideshow
│   ├── Branches.tsx          # Team cards (Cultural, Choir, Natyarpana)
│   ├── ui/
│   │   ├── RBTable.tsx       # Room booking timetable (core component)
│   │   ├── SlotsRequestTable.tsx # Slot request table with filters
│   │   ├── DashboardTable.tsx    # Slot configuration table
│   │   ├── Modal.tsx         # Reusable glassmorphism modal
│   │   ├── TimePicker.tsx    # 12-hour time dropdown (06:00–21:00)
│   │   ├── DatePicker.tsx    # Client-side calendar popover
│   │   ├── ColorPicker.tsx   # HSV canvas + hue slider color selector
│   │   ├── BandMultiSelect.tsx # Multi-select band dropdown with checkboxes
│   │   ├── ProfileDropdown.tsx # Single-band select with colour dots
│   │   ├── RoomDropdown.tsx  # Room selector dropdown
│   │   ├── FilterDropdown.tsx # Generic filter dropdown
│   │   ├── ForcePasswordChange.tsx # Forced first-login password change modal
│   │   ├── NotificationSettings.tsx # Admin email notification settings card
│   │   ├── WeeklySheetSettings.tsx  # Google Sheets config + manual export
│   │   ├── MotionWrapper.tsx # Framer Motion fade-in wrapper
│   │   ├── MagicButton.tsx   # Shimmer-animated button
│   │   ├── events.tsx        # Home page event cards
│   │   ├── background-gradient.tsx
│   │   ├── focus-cards.tsx
│   │   ├── glowing-stars.tsx
│   │   └── text-generate-effect.tsx
│   └── ...
├── backend/                  # Hono API (Cloudflare Workers + D1)
│   └── src/
│       ├── features/         # auth, users, bands, rooms, slotconfig, slots, requests, entrylogs, settings, sheets
│       ├── db/               # Drizzle schema + client + repositories
│       ├── middleware/       # auth + rate-limit middleware
│       ├── sheets/           # Google Sheets export (grid, service-account JWT, time)
│       ├── email/            # SMTP notifications (raw SMTP via Cloudflare Sockets)
│       ├── audit/            # audit_logs helper
│       └── lib/              # jwt, password helpers
├── tests/                    # Test suites
│   ├── *-api.test.mjs        # API tests
│   ├── *-ui.spec.ts          # Playwright UI tests
│   ├── responsive-ui.spec.ts # Mobile/tablet viewport tests
│   └── auth.setup.ts         # Playwright auth fixture for admin-only pages
├── middleware.ts              # Route protection (public: /, /RoomBooking, /home, /api, static assets)
├── playwright.config.ts       # Playwright config (6 projects)
└── vercel.json                # Vercel deployment config
```

## Pages

### Public (No Auth Required)
| Route | Description |
|-------|-------------|
| `/` | Redirects to `/RoomBooking` |
| `/RoomBooking` | Weekly room booking timetable with room selector, week navigation, and booking modal |
| `/home` | Landing page (Hero, Mission, Branches, Events) |

### Authenticated (Any Signed-In User)
| Route | Description |
|-------|-------------|
| `/SlotRequests` | View slot requests with filters (status, date, room, search); non-admins see only their own requests and cannot approve/deny |

### Admin (Auth + `role: "admin"`)
| Route | Description |
|-------|-------------|
| `/Dashboard` | Slot configuration CRUD + notification email settings + weekly sheets settings |
| `/Register` | User management + band management with ColorPicker and BandMultiSelect |

Admin pages redirect to `/` when a non-admin is signed in.

## API Endpoints

All routes live in the Hono backend and are proxied via Next.js rewrites (`/api/*` → `BACKEND_URL`).

| Endpoint | Methods | Auth | Description |
|----------|---------|------|-------------|
| `/health` | GET | — | Liveness check `{ status: "ok" }` |
| `/api/auth/login` | POST | — | Login with username/email + password → HttpOnly `token` cookie |
| `/api/auth/register` | POST | admin | Create a user (default password `changeit`, `must_change_password = true`) |
| `/api/auth/logout` | POST | auth | Revoke session + clear cookie |
| `/api/auth/me` | GET | auth | Current user + profiles |
| `/api/auth/me/password` | PATCH | auth | Change own password (clears `must_change_password`) |
| `/api/users` | GET, PUT, DELETE | admin | List users (with bands); update/delete via `?id=` |
| `/api/bands` | GET, POST, PUT, DELETE | public GET; admin writes | Profiles/bands CRUD; update/delete via `?id=` |
| `/api/rooms` | GET | — | List rooms |
| `/api/slotconfig` | GET, POST, PUT, DELETE | public GET; admin writes | Slot config CRUD; PUT sends `id` in body, DELETE via `?id=` |
| `/api/slots` | GET | — | Query bookings by `start`/`end` (epoch) and `roomNumber` |
| `/api/requests` | GET, POST | auth | List (non-admins see only their own) and create slot requests |
| `/api/requests` | PUT, DELETE | auth | Update/delete via `?id=`; only admins can change status |
| `/api/entrylogs/entrylogs` | GET, POST | admin | Read/write entry-scan audit logs |
| `/api/system-settings` | GET, PUT | admin | Notification email, booking release day/time, sheets config |
| `/api/sheets/weekly` | POST | admin | Manually trigger the weekly Google Sheets export |

# Race Condition Protection

Booking requests run an active-conflict overlap check before insert and rely on the `bookings_room_start_unique` unique index (`room_id`, `start_time`) to prevent double-booking under concurrent requests.

## Design System

- **Cards:** `bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl`
- **Inputs:** `bg-white/10 border-white/20 rounded-xl text-white font-mono`
- **Buttons (primary):** `bg-gradient-to-r from-purple-600 to-purple-500 text-white` (hover `from-purple-700 to-purple-600`)
- **Buttons (danger):** `bg-gradient-to-r from-red-600 to-red-500`
- **Buttons (ghost):** `hover:bg-white/10 transition-colors`
- **Accent bars:** `bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600` (top-of-table loading bars)
- **Typography:** `font-mono` in table cells, form inputs, labels, and action buttons
- **Tables:** Sticky headers with `bg-gray-900`, scroll-edge gradient indicators
- **Time display:** 12-hour AM/PM in frontend; 24-hour internally for backend

## Deployment

### Vercel (Automatic via Git)

1. Push to GitHub and import the repo into Vercel
2. Set environment variables in Vercel dashboard:
   - `BACKEND_URL` — deployed Hono/Cloudflare Workers URL (default `http://localhost:8787`)
3. Deploy — Vercel detects Next.js automatically and runs `npm install --legacy-peer-deps` (via `vercel.json`)

### Backend Environment Variables (`backend/.dev.vars` locally, Worker secrets in Cloudflare)

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret used to sign session JWTs |
| `SMTP_HOST` / `SMTP_PORT` | SMTP server for booking notification emails (e.g. Gmail `465`) |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP credentials (Gmail requires an app password) |
| `GOOGLE_SERVICE_ACCOUNT` | Full service-account JSON (or a single-line JSON string) for the weekly Google Sheets export |

### Vercel (CLI)

```bash
npx vercel login
npx vercel pull        # Pull environment variables
npx vercel build       # Build locally
npx vercel deploy --prebuilt    # Deploy preview
npx vercel deploy --prod        # Deploy production
```

## Key Design Decisions

- **Forced first-login password change** — new users start with the `changeit` default password and `must_change_password = true`; the backend 403s all endpoints (except logout/password change) until changed, and the frontend shows a non-dismissible `ForcePasswordChange` modal
- **`overflow-y: hidden` before mount → `overflow-y: auto` after mount** — prevents scrollbar flicker
- **12-hour time in frontend, 24-hour in backend** — user-friendly display without changing DB schema
- **`font-mono` everywhere** — consistent monospace typography across tables, forms, and buttons
- **Click-outside-to-close** — all dropdowns (TimePicker, ColorPicker, BandMultiSelect, ProfileDropdown) close on outside click
- **Scroll-edge gradient** — visual hint when table content is scrollable horizontally
- **Pagination ellipsis** — shows first, last, and ±1 from current page with "..." for gaps
- **Week cache** — `useRef<Map>` with max 20 entries, cache-first, cleared on booking
- **Middleware protection** — `jose` JWT verification guards non-public routes; `/`, `/RoomBooking`, `/home`, `/api/*`, and static assets are public; unauthenticated visitors are redirected to `/home?callbackUrl=...`
