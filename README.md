# Music Room Management System

A full-stack web application for managing music room bookings, slot requests, and equipment tracking at SWO Kengeri Campus. Built with Next.js 15, a Hono API on Cloudflare Workers (D1), and Playwright.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Backend API:** Hono on Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite) via Drizzle ORM
- **Auth:** JWT (jose) session tokens
- **Styling:** Tailwind CSS 3 + glassmorphism design
- **Animation:** Framer Motion
- **Testing:** Playwright (API tests, UI tests)
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

# Start the backend (Cloudflare Workers local)
cd backend && npm run dev

# Start the frontend dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/RoomBooking`.

### Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@rejoy.local | admin123 |
| User | (create via Register page when logged in as admin) | — |

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test:api` | Run roombooking API tests (no dev server needed) |
| `npm run test:ui` | Run all Playwright UI tests (dev server must be running) |
| `npm run test:ui:headed` | Run Playwright UI tests with visible browser |

## Testing

### API Tests

Run against local dev server (202 tests total):

```bash
# All API tests
npm run test:api
node tests/slotrequests-api.test.mjs
node tests/dashboard-api.test.mjs
node tests/register-api.test.mjs

# Individual suites
node tests/roombooking-api.test.mjs   # Room booking CRUD + validation (50 tests)
node tests/slotrequests-api.test.mjs  # Slot request CRUD + overlap detection (60 tests)
node tests/dashboard-api.test.mjs     # Slot configuration CRUD (32 tests)
node tests/register-api.test.mjs      # User and band management (60 tests)
```

Run against production:

```bash
BASE_URL=https://your-app.vercel.app node tests/roombooking-api.test.mjs
```

### UI Tests (Playwright)

Requires a running dev server:

```bash
npm run dev &
npm run test:ui          # All UI tests
npm run test:ui:headed   # Visible browser
```

Run specific project:

```bash
npx playwright test --project=roombooking   # Table view, modals, booking flow (10 tests)
npx playwright test --project=slotrequests  # Request approval/denial workflow (8 tests)
npx playwright test --project=dashboard     # Slot configuration CRUD (5 tests)
npx playwright test --project=register      # User/band management (6 tests)
npx playwright test --project=responsive    # Mobile/tablet viewports (9 tests)
```

## Project Structure

```
├── app/
│   ├── (root)/
│   │   ├── Dashboard/        # Slot configuration dashboard
│   │   ├── Register/         # User and band management (admin)
│   │   ├── RoomBooking/      # Room booking timetable (public)
│   │   ├── SlotRequests/     # Slot request management (admin)
│   │   ├── home/             # Landing page (Hero, Mission, Branches, Events)
│   │   └── page.tsx          # Redirects to /RoomBooking
│   └── globals.css           # Tailwind + glassmorphism utilities
├── components/
│   ├── Navbar.tsx            # Navigation with auth modals
│   ├── Hero.tsx              # Landing page hero section
│   ├── ui/
│   │   ├── RBTable.tsx       # Room booking timetable with scroll-edge gradient
│   │   ├── SlotsRequestTable.tsx # Slot request admin table with filters
│   │   ├── DashboardTable.tsx    # Slot configuration table
│   │   ├── Modal.tsx         # Reusable glassmorphism modal
│   │   ├── TimePicker.tsx    # 12-hour time selector dropdown (06:00–21:00)
│   │   ├── DatePicker.tsx    # Date picker popover
│   │   ├── ColorPicker.tsx   # HSV canvas + hue slider color selector
│   │   ├── BandMultiSelect.tsx # Multi-select band dropdown with checkboxes
│   │   ├── ProfileDropdown.tsx # User profile popover with colour dots
│   │   ├── RoomDropdown.tsx  # Room selector dropdown
│   │   ├── FilterDropdown.tsx # Filter dropdown component
│   │   ├── MotionWrapper.tsx # Framer Motion animation wrapper
│   │   ├── RegistrationModal.tsx
│   │   ├── MagicButton.tsx
│   │   ├── background-gradient.tsx
│   │   ├── events.tsx        # Events cards component
│   │   ├── focus-cards.tsx
│   │   └── text-generate-effect.tsx
│   └── ...
├── backend/                  # Hono API (Cloudflare Workers + D1)
├── tests/                    # Test suites
│   ├── *-api.test.mjs        # API tests
│   ├── *-ui.spec.ts          # Playwright UI tests
│   ├── responsive-ui.spec.ts # Mobile/tablet viewport tests
│   └── auth.setup.ts         # Playwright auth fixture for admin-only pages
├── middleware.ts              # Route protection (public: /, /RoomBooking, /home, /api)
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

### Admin (Auth Required)
| Route | Description |
|-------|-------------|
| `/SlotRequests` | Approve/deny slot requests with filters (status, date, room, search) |
| `/Dashboard` | Slot configuration CRUD with time pickers and enable/disable toggles |
| `/Register` | User management + band management with ColorPicker and BandMultiSelect |

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/auth/register` | POST | Register a new user |
| `/api/auth/login` | POST | Log in and issue a JWT session |
| `/api/bands` | GET, POST | List and create bands |
| `/api/bands/[id]` | PUT, DELETE | Update and delete bands |
| `/api/entrylogs` | POST | Record an equipment entry scan |
| `/api/requests` | GET, POST | List and create slot requests (atomic transactions) |
| `/api/requests/[id]` | PUT, DELETE | Update and delete slot requests |
| `/api/rooms` | GET | List rooms |
| `/api/slotconfig` | GET, POST | List and create slot configs |
| `/api/slotconfig/[id]` | PUT, DELETE | Update and delete slot configs |
| `/api/slots` | GET | Query slots by date range and room |
| `/api/system-settings` | GET, PUT | Read and update system settings (admin) |
| `/api/users` | GET, POST | List and create users |
| `/api/users/[id]` | PUT, DELETE | Update and delete users |

# Race Condition Protection

Booking requests run an active-conflict overlap check before insert and rely on the `bookings_room_start_unique` unique index (`room_id`, `start_time`) to prevent double-booking under concurrent requests.

## Design System

- **Glassmorphism:** `bg-white/5 backdrop-blur border-white/10 rounded-3xl` for cards
- **Inputs:** `bg-white/10 border-white/20 rounded-xl text-white font-mono`
- **Buttons (primary):** `bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white`
- **Buttons (ghost):** `hover:bg-white/10 transition-colors`
- **Typography:** `font-mono` in table cells, form inputs, labels, and action buttons
- **Tables:** Sticky headers with `bg-gray-900`, scroll-edge gradient indicators
- **Time display:** 12-hour AM/PM in frontend; 24-hour internally for backend

## Deployment

### Vercel (Automatic via Git)

1. Push to GitHub and import the repo into Vercel
2. Set environment variables in Vercel dashboard:
   - `BACKEND_URL` — deployed Hono/Cloudflare Workers URL (default `http://localhost:8787`)
   - `JWT_SECRET` — random secret used to sign session JWTs
3. Deploy — Vercel detects Next.js automatically
4. Vercel runs `npm install --legacy-peer-deps` followed by the build

### Vercel (CLI)

```bash
npx vercel login
npx vercel pull        # Pull environment variables
npx vercel build       # Build locally
npx vercel deploy --prebuilt    # Deploy preview
npx vercel deploy --prod        # Deploy production
```

## Key Design Decisions

- **`overflow-y: hidden` before mount → `overflow-y: auto` after mount** — prevents scrollbar flicker
- **12-hour time in frontend, 24-hour in backend** — user-friendly display without changing DB schema
- **`font-mono` everywhere** — consistent monospace typography across tables, forms, and buttons
- **Click-outside-to-close** — all dropdowns (TimePicker, ColorPicker, BandMultiSelect, ProfileDropdown) close on outside click
- **Scroll-edge gradient** — visual hint when table content is scrollable horizontally
- **Pagination ellipsis** — shows first, last, and ±1 from current page with "..." for gaps
- **Week cache** — `useRef<Map>` with max 20 entries, cache-first, cleared on booking
- **Middleware protection** — `jose` JWT verification guards non-public routes; `/`, `/RoomBooking`, `/home`, `/api/*` are public
