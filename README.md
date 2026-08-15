# Music Room Management System

A full-stack web application for managing music room bookings, slot requests, and equipment tracking at SWO Kengeri Campus. Built with Next.js 15, Drizzle ORM, PostgreSQL (Supabase), and Playwright.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (Supabase) via Drizzle ORM
- **Auth:** NextAuth.js v4 (Credentials provider, JWT)
- **Styling:** Tailwind CSS 3 + glassmorphism design
- **Animation:** Framer Motion
- **Testing:** Playwright (202 API tests, 38 UI tests)
- **Deployment:** Vercel

## Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase recommended)
- npm

## Environment Variables

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://user:password@host:6543/postgres?pgbouncer=true
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (use Supabase pooler port 6543 with `?pgbouncer=true`) |
| `NEXTAUTH_SECRET` | Encryption key for NextAuth JWT (run `openssl rand -base64 32` to generate) |
| `NEXTAUTH_URL` | Application URL (`http://localhost:3000` for dev, Vercel domain for production) |

## Getting Started

```bash
# Clone the repo
git clone https://github.com/notpest/music-room-management-system.git
cd music-room-management-system

# Install dependencies
npm install --legacy-peer-deps

# Run database migrations
npx drizzle-kit migrate

# Start the dev server
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
| `npm run db:generate` | Generate a new Drizzle migration |
| `npm run db:migrate` | Apply pending Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio (GUI DB browser) |

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
│   ├── (auth)/SignIn/        # Sign-in page with glassmorphism form
│   ├── (root)/
│   │   ├── Dashboard/        # Slot configuration dashboard
│   │   ├── EntryLog/         # Equipment entry logs
│   │   ├── EquipmentBooking/ # Equipment booking pages
│   │   ├── Register/         # User and band management (admin)
│   │   ├── RoomBooking/      # Room booking timetable (public)
│   │   ├── SlotRequests/     # Slot request management (admin)
│   │   ├── home/             # Landing page (Hero, Mission, Branches, Events)
│   │   └── page.tsx          # Redirects to /RoomBooking
│   ├── api/                  # REST API routes
│   │   ├── auth/             # NextAuth + registration
│   │   ├── bands/            # Band CRUD
│   │   ├── entrylogs/        # Entry log queries
│   │   ├── equipment/        # Equipment management
│   │   ├── requests/         # Slot request CRUD (with atomic transaction locking)
│   │   ├── rooms/            # Room listing
│   │   ├── slotconfig/       # Slot configuration CRUD
│   │   ├── slots/            # Slot querying
│   │   └── users/            # User CRUD
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
│   │   ├── EntryLogTable.tsx # Entry log table with glassmorphism
│   │   ├── TableEquip.tsx    # Equipment table
│   │   ├── MotionWrapper.tsx # Framer Motion animation wrapper
│   │   ├── RegistrationModal.tsx
│   │   ├── MagicButton.tsx
│   │   ├── background-gradient.tsx
│   │   ├── events.tsx        # Events cards component
│   │   ├── focus-cards.tsx
│   │   └── text-generate-effect.tsx
│   └── ...
├── db/
│   ├── index.ts              # DB connection (global singleton Pool for serverless)
│   ├── schema/               # Drizzle schema (12 tables)
│   │   ├── index.ts          # Schema barrel export
│   │   ├── relations.ts      # Table relations
│   │   ├── user.ts, band.ts, userBand.ts
│   │   ├── room.ts, slot.ts, slotConfig.ts
│   │   ├── request.ts, equipment.ts, entryLog.ts
│   │   └── loginHistory.ts
│   └── migrations/           # SQL migration files
├── tests/                    # Test suites
│   ├── *-api.test.mjs        # API tests (202 total)
│   ├── *-ui.spec.ts          # Playwright UI tests (38 total)
│   ├── responsive-ui.spec.ts # Mobile/tablet viewport tests
│   └── auth.setup.ts         # Playwright auth fixture for admin-only pages
├── middleware.ts              # Route protection (public: /, /RoomBooking, /home, /SignIn, /api)
├── playwright.config.ts       # Playwright config (6 projects)
├── vercel.json                # Vercel deployment config
└── drizzle.config.ts          # Drizzle Kit config
```

## Pages

### Public (No Auth Required)
| Route | Description |
|-------|-------------|
| `/` | Redirects to `/RoomBooking` |
| `/RoomBooking` | Weekly room booking timetable with room selector, week navigation, and booking modal |
| `/home` | Landing page (Hero, Mission, Branches, Events) |
| `/SignIn` | Login form |

### Admin (Auth Required)
| Route | Description |
|-------|-------------|
| `/SlotRequests` | Approve/deny slot requests with filters (status, date, room, search) |
| `/Dashboard` | Slot configuration CRUD with time pickers and enable/disable toggles |
| `/Register` | User management + band management with ColorPicker and BandMultiSelect |
| `/EntryLog` | Equipment entry log viewer |
| `/EquipmentBooking` | Equipment management tables |

## API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/auth/register` | POST | Register a new user |
| `/api/auth/[...nextauth]` | * | NextAuth authentication |
| `/api/bands` | GET, POST | List and create bands |
| `/api/bands/[id]` | PUT, DELETE | Update and delete bands |
| `/api/entrylogs` | GET | Query entry logs |
| `/api/equipment` | GET, POST | List and create equipment |
| `/api/equipment/[id]` | PUT, DELETE | Update and delete equipment |
| `/api/requests` | GET, POST | List and create slot requests (atomic transactions) |
| `/api/requests/[id]` | PUT, DELETE | Update and delete slot requests |
| `/api/rooms` | GET | List rooms |
| `/api/slotconfig` | GET, POST | List and create slot configs |
| `/api/slotconfig/[id]` | PUT, DELETE | Update and delete slot configs |
| `/api/slots` | GET | Query slots by date range and room |
| `/api/users` | GET, POST | List and create users |
| `/api/users/[id]` | PUT, DELETE | Update and delete users |

# Race Condition Protection

Booking requests use `SELECT ... FOR UPDATE` within database transactions to prevent double-booking under concurrent requests. The room row is locked before the overlap check + insert, ensuring atomicity in serverless environments.

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
   - `DATABASE_URL` — Supabase connection string (pooler port 6543 with `?pgbouncer=true`)
   - `NEXTAUTH_SECRET` — Random base64 string
   - `NEXTAUTH_URL` — Your Vercel domain (e.g., `https://music-room-management-system.vercel.app`)
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

### Database Migrations on Deploy

Migrations run automatically via the `postinstall` script (`npx drizzle-kit migrate`). If the database is unreachable during build (e.g., Supabase IP restrictions), the migration script gracefully fails with `|| echo` and you can run it manually:

```bash
npx drizzle-kit migrate
```

To generate a new migration after schema changes:

```bash
npm run db:generate   # npx drizzle-kit generate
```

## Key Design Decisions

- **`overflow-y: hidden` before mount → `overflow-y: auto` after mount** — prevents scrollbar flicker
- **12-hour time in frontend, 24-hour in backend** — user-friendly display without changing DB schema
- **`font-mono` everywhere** — consistent monospace typography across tables, forms, and buttons
- **Click-outside-to-close** — all dropdowns (TimePicker, ColorPicker, BandMultiSelect, ProfileDropdown) close on outside click
- **Scroll-edge gradient** — visual hint when table content is scrollable horizontally
- **Pagination ellipsis** — shows first, last, and ±1 from current page with "..." for gaps
- **Week cache** — `useRef<Map>` with max 20 entries, cache-first, cleared on booking
- **Global singleton Pool** — `pg.Pool` stored on `globalThis` for Vercel serverless hot module reuse
- **Middleware protection** — `getToken` from next-auth/jwt guards admin routes; `/`, `/RoomBooking`, `/home`, `/SignIn`, `/api/*` are public
