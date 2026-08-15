# Music Room Management System — Architecture Guide

## 1. Project Overview

A full-stack web application for managing music room bookings, slot requests, and user administration at **SWO Kengeri Campus**. Students/staff can view room availability and submit booking requests; admins manage approvals, slot configuration, and bands.

### User Personas

| Role | Capabilities |
|------|-------------|
| **Visitor** (unauthenticated) | View the timetable at `/RoomBooking`, see the landing page at `/home`, sign in |
| **User** (authenticated) | Submit booking requests, view own requests, delete own requests |
| **Admin** (`role: "admin"`) | Approve/deny requests, manage slot configs, manage users/bands |

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 15 (App Router) | React framework with SSR and route rewriting |
| **Language** | TypeScript | Type safety throughout |
| **Backend API** | Hono (Cloudflare Workers) | Serves `/api/*`, handles auth and business logic |
| **Database** | Cloudflare D1 (SQLite) | Relational data with time-range queries |
| **ORM** | Drizzle ORM | Type-safe SQL with schema validation |
| **Auth** | JWT (`jose`) | HttpOnly cookie sessions, per-route middleware guard |
| **Styling** | Tailwind CSS 3 | Utility-first CSS with custom glassmorphism design |
| **Animation** | Framer Motion 11 | UI transitions, modals, dropdowns, page loading |
| **Date/Time** | date-fns 4 | Calendar calculations, formatting |
| **Testing** | Vitest + Playwright | Backend unit tests + API/UI tests |
| **Deployment** | Vercel (frontend) + Cloudflare Workers (backend) | Serverless hosting |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐ │
│  │ Visitor  │  │  User    │  │  Admin    │  │  Mobile Device    │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────────┬──────────┘ │
│       │              │              │                   │            │
│       └──────────────┴──────────────┴───────────────────┘            │
│                              │                                      │
│                              ▼                                      │
│                     ┌────────────────┐                              │
│                     │  Next.js App   │                              │
│                     │  (App Router)  │                              │
│                     └───────┬────────┘                              │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────────┐
              │               │                   │
              ▼               ▼                   ▼
     ┌─────────────────┐ ┌────────────┐ ┌──────────────────┐
     │   middleware.ts  │ │ Static UI  │ │   Backend API    │
     │ (route auth)     │ │ Components │ │   (Hono/Wrangler)│
     └────────┬────────┘ └────────────┘ └────────┬─────────┘
              │                                │
              │ (JWT check)                     │ (proxy via /api rewrite)
              ▼                                ▼
     ┌────────────────┐              ┌──────────────────┐
     │   jose JWT     │              │  Drizzle ORM     │
     │  verification  │              │  (D1 / sqlite)   │
     └────────────────┘              └────────┬─────────┘
                                             │
                                             ▼
                                  ┌──────────────────┐
                                  │   Cloudflare D1  │
                                  └──────────────────┘
```

### Request Lifecycle

1. **Page request** — Next.js resolves the route, `middleware.ts` checks JWT (if applicable)
2. **API request** — Client calls `/api/*`, which Next.js rewrites to the Hono backend (default `http://localhost:8787`); the backend validates the JWT and queries D1 via Drizzle ORM
3. **Booking write** — POST/PUT to `/api/requests` runs a conflict-overlap check and a `db.batch(...)` insert, relying on the `bookings_room_start_unique` unique index to prevent double-booking
4. **Response** — API returns JSON; React components update optimistically

---

## 4. Directory Structure

```
├── app/                              # Next.js App Router pages
│   ├── (root)/
│   │   ├── Dashboard/                # Slot configuration (admin)
│   │   ├── Register/                 # User & band management (admin)
│   │   ├── RoomBooking/              # Room timetable (public)
│   │   ├── SlotRequests/             # Slot request approval (admin)
│   │   └── home/                     # Landing page (public)
│   │   └── page.tsx                  # Redirects / → /RoomBooking
│   ├── globals.css                   # Tailwind + glassmorphism utilities
│   ├── layout.tsx                    # Root layout (Navbar, providers)
│   └── providers.tsx                 # ThemeProvider
│
├── backend/                          # Hono API (Cloudflare Workers + D1)
│   ├── src/
│   │   ├── db/                       # Drizzle schema + client + repositories
│   │   ├── features/                 # auth, bands, rooms, requests, slots, ...
│   │   ├── middleware/               # auth + rate-limit middleware
│   │   ├── sheets/                   # Weekly Google Sheets export
│   │   ├── email/                    # Booking notification emails
│   │   └── index.ts                  # Hono app + route mounting
│   ├── drizzle.config.ts             # Drizzle Kit configuration (D1)
│   └── package.json                  # Backend deps + scripts
│
├── components/
│   ├── Navbar.tsx                    # Top nav: links, login/logout, mobile menu
│   ├── Branches.tsx                  # Branch info section (home page)
│   ├── Hero.tsx                      # Hero section with glowing stars
│   ├── Mission.tsx                   # Mission statement section
│   ├── ui/
│   │   ├── RBTable.tsx               # Room booking timetable (core component)
│   │   ├── SlotsRequestTable.tsx     # Request management table
│   │   ├── DashboardTable.tsx        # Slot config CRUD table
│   │   ├── Modal.tsx                 # Reusable glassmorphism modal
│   │   ├── TimePicker.tsx            # 12-hour time dropdown (06:00–21:00)
│   │   ├── DatePicker.tsx            # Client-side calendar popover
│   │   ├── ColorPicker.tsx           # HSV canvas + hex input
│   │   ├── BandMultiSelect.tsx       # Multi-band select with checkboxes
│   │   ├── ProfileDropdown.tsx       # Single-band select with colour dots
│   │   ├── RoomDropdown.tsx          # Numeric room selector
│   │   ├── FilterDropdown.tsx        # Generic filter dropdown
│   │   ├── MotionWrapper.tsx         # Fade-in animation wrapper
│   │   ├── RegistrationModal.tsx     # User registration form modal
│   │   ├── MagicButton.tsx           # Shimmer-animated button
│   │   ├── events.tsx               # Event cards with scroll reveal
│   │   ├── focus-cards.tsx           # Hover-reactive image grid
│   │   ├── glowing-stars.tsx         # Animated star background
│   │   ├── background-gradient.tsx   # Animated gradient container
│   │   └── text-generate-effect.tsx  # Word-by-word reveal
│   └── ...
│
├── tests/
│   ├── auth.setup.ts                 # Playwright auth fixture (logs in admin)
│   ├── *-api.test.mjs                # API test suites
│   ├── *-ui.spec.ts                  # Playwright UI tests
│   └── responsive-ui.spec.ts         # Mobile/tablet viewport tests
│
├── middleware.ts                      # Route-level JWT auth guard
├── playwright.config.ts               # Playwright config (6 projects)
├── vercel.json                        # Vercel deployment config
├── next.config.ts                     # Next.js configuration
├── tailwind.config.ts                 # Tailwind CSS configuration
└── lib/utils.ts                       # cn() helper (clsx + tailwind-merge)
```

---

## 5. Database Schema

Cloudflare D1 (SQLite) via Drizzle ORM. All tables live in `backend/src/db/schema.ts`.

### Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ userProfiles : "belongs to"
    profiles ||--o{ userProfiles : "includes"
    bookingPolicies ||--o{ operatingSchedules : "defines hours"
    bookingPolicies ||--o{ rooms : "governs"
    profiles ||--o{ rooms : "priority for"
    rooms ||--o{ bookings : "targeted"
    users ||--o{ bookings : "submits"
    profiles ||--o{ bookings : "books"
    users ||--o{ sessions : "has"
    users ||--o{ auditLogs : "performed by"
```

### Table Details

#### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `username` | `text` | NOT NULL, UNIQUE |
| `email` | `text` | NOT NULL, UNIQUE, default `''` |
| `name` | `text` | NOT NULL, default `''` |
| `password_hash` | `text` | NOT NULL |
| `role` | `text` | NOT NULL (`USER` \| `ADMIN`) |
| `must_change_password` | `integer` (bool) | NOT NULL, default `true` |
| `active` | `integer` (bool) | NOT NULL, default `true` |
| `created_at` | `integer` (epoch) | NOT NULL |
| `updated_at` | `integer` (epoch) | NOT NULL |

#### `profiles`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `name` | `text` | NOT NULL, UNIQUE |
| `color` | `text` | NOT NULL, default `#4F46E5` |
| `created_at` | `integer` (epoch) | NOT NULL |

#### `user_profiles` (many-to-many join)
| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | `text` | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `profile_id` | `text` | NOT NULL, FK → `profiles.id` ON DELETE CASCADE |
| **PK** | | `(user_id, profile_id)` composite |

#### `booking_policies`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `name` | `text` | NOT NULL, UNIQUE |
| `booking_horizon_days` | `integer` | NOT NULL |
| `min_booking_duration_minutes` | `integer` | NOT NULL |
| `max_booking_duration_minutes` | `integer` | NOT NULL |
| `booking_interval_minutes` | `integer` | NOT NULL |
| `active` | `integer` (bool) | NOT NULL, default `true` |

#### `operating_schedules`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `policy_id` | `text` | NOT NULL, FK → `booking_policies.id` ON DELETE CASCADE |
| `day_of_week` | `integer` | NOT NULL |
| `start_time` | `text` | NOT NULL (`HH:mm`) |
| `end_time` | `text` | NOT NULL (`HH:mm`) |
| `enabled` | `integer` (bool) | NOT NULL, default `true` |

#### `system_settings`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `booking_release_day` | `integer` | NOT NULL |
| `booking_release_time` | `text` | NOT NULL |
| `default_policy_id` | `text` | NOT NULL, FK → `booking_policies.id` |
| `notification_email` | `text` | nullable |
| `sheets_spreadsheet_id` | `text` | nullable |
| `sheets_sheet_name` | `text` | nullable |

#### `rooms`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `name` | `text` | NOT NULL, UNIQUE |
| `number` | `integer` | UNIQUE, nullable |
| `created_at` | `integer` (epoch) | NOT NULL |
| `active` | `integer` (bool) | NOT NULL, default `true` |
| `policy_id` | `text` | FK → `booking_policies.id`, nullable |
| `priority_profile_id` | `text` | FK → `profiles.id`, nullable |

**Index:** `rooms_number_unique` on `(number)`.

#### `bookings`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `room_id` | `text` | NOT NULL, FK → `rooms.id` ON DELETE CASCADE |
| `profile_id` | `text` | NOT NULL, FK → `profiles.id` ON DELETE CASCADE |
| `user_id` | `text` | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `start_time` | `integer` (epoch) | NOT NULL |
| `end_time` | `integer` (epoch) | NOT NULL |
| `status` | `text` | NOT NULL (`PENDING` \| `APPROVED` \| `REJECTED` \| `CANCELLED`), default `PENDING` |
| `reason` | `text` | nullable |
| `approved_by` | `text` | FK → `users.id` ON DELETE SET NULL, nullable |
| `approved_at` | `integer` (epoch) | nullable |
| `created_at` | `integer` (epoch) | NOT NULL |

**Indexes:** `bookings_room_time_idx` on `(room_id, start_time, end_time)`, `bookings_profile_idx` on `(profile_id)`, and `bookings_room_start_unique` UNIQUE on `(room_id, start_time)`.

#### `sessions`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `user_id` | `text` | NOT NULL, FK → `users.id` ON DELETE CASCADE |
| `created_at` | `integer` (epoch) | NOT NULL |
| `last_seen_at` | `integer` (epoch) | NOT NULL |
| `expires_at` | `integer` (epoch) | NOT NULL |
| `revoked` | `integer` (bool) | NOT NULL, default `false` |

#### `audit_logs`
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `text` | PK |
| `actor_id` | `text` | FK → `users.id` ON DELETE SET NULL, nullable |
| `action` | `text` | NOT NULL |
| `target_type` | `text` | NOT NULL |
| `target_id` | `text` | nullable |
| `metadata` | `text` (JSON) | NOT NULL |
| `created_at` | `integer` (epoch) | NOT NULL |

---

## 6. Authentication & Authorization

### Backend JWT Auth (`backend/src/features/auth/`)

- **Login:** `POST /api/auth/login` — validates credentials (username or email) against `users`, compares via `bcryptjs`, creates a `sessions` row, and sets an HttpOnly cookie (`token`) signed with `jose` using `JWT_SECRET`
- **Registration:** `POST /api/auth/register` — admin-only (requires auth + admin role + password already changed); new users start with the `changeit` default password and `must_change_password = true`
- **Logout:** `POST /api/auth/logout` — revokes the session and clears the cookie
- **Me:** `GET /api/auth/me` — returns the current user with their profiles
- **Change password:** `PATCH /api/auth/me/password` — requires the current password; clears `must_change_password`

### JWT Flow

```
login(identifier, password)
  ├─ Query user by username OR email
  ├─ bcrypt.compare(password, password_hash)
  ├─ Create session row (expires 24h)
  ├─ Sign JWT with jose (JWT_SECRET)
  └─ Set HttpOnly cookie "token"
        │
middleware (next) ── verify JWT on every non-public route
backend middleware ── requireAuth() verifies JWT + loads user/session
```

### Middleware Route Protection (`middleware.ts`)

`middleware.ts` verifies the JWT on every request using `jose`. The `matcher` config defines which routes require authentication:

```typescript
matcher: ["/((?!api|_next/static|_next/image|favicon.ico|home|RoomBooking).+)"]
```

| Route | Public | Notes |
|-------|--------|-------|
| `/` | ✅ | Redirects to `/RoomBooking` |
| `/RoomBooking` | ✅ | Timetable viewable by anyone |
| `/home` | ✅ | Landing page |
| `/api/*` | ✅ | Backend handles its own auth |
| `/Dashboard` | ❌ | Requires auth + admin role check in component |
| `/Register` | ❌ | Requires auth + admin role check in component |
| `/SlotRequests` | ❌ | Requires auth + admin role check in component |

Unauthenticated requests to protected routes redirect to `/home`.

### Frontend Role Checks

Components check `user?.role === 'admin'` (from the `AuthProvider` context in `lib/auth.tsx`):
- **Navbar**: Admin-only links (`/Register`, `/Dashboard`, `/SlotRequests`) are hidden from non-admins
- **SlotsRequestTable**: Approve/deny/edit buttons only visible to admin
- **RBTable**: Booking modal doesn't show admin-only fields for non-admins
- **Register page**: Entire page checks role before rendering

---

## 7. API Routes Reference

All routes live in the Hono backend (`backend/src/features/*`) and are mounted under `/api`. Next.js rewrites `/api/*` to the backend URL.

### `/api/auth` — login, register, logout, me, password

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | — | Login with username/email + password → HttpOnly `token` cookie |
| `/api/auth/register` | POST | admin | Create user (default password `changeit`, `must_change_password = true`) |
| `/api/auth/logout` | POST | auth | Revoke session + clear cookie |
| `/api/auth/me` | GET | auth | Current user + profiles |
| `/api/auth/me/password` | PATCH | auth | Change own password (clears `must_change_password`) |

### `/api/requests` — GET, POST, PUT, DELETE

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/requests` | GET | auth | List requests; non-admins only see their own |
| `/api/requests` | POST | auth | Create request (conflict detection before insert) |
| `/api/requests` | PUT | auth | Update request (approve/reject/edit) |
| `/api/requests` | DELETE | auth | Delete request |

**Create request flow:**
```
1. Resolve room by number
2. Find exact configured slot (via SlotPolicyService) for the requested time
3. Validate booking horizon + policy constraints
4. Check for active conflict (overlapping booking in same room)
   → If found → throw CONFLICT: message with band name
5. db.batch([ insert booking (PENDING), notification email ])
```

**Approval flow (status → `"APPROVED"`):**
- Re-checks for conflicts (excluding the request being edited) before approving
- On conflict → 409 with the conflicting band name

### `/api/slots` — GET

| Query Param | Type | Description |
|------------|------|-------------|
| `start` | number (epoch) | Return bookings with `start_time >= start` |
| `end` | number (epoch) | Return bookings with `start_time <= end` |
| `roomNumber` | integer | Filter by room number |

**Response:** Active bookings (`PENDING`/`APPROVED`) for the given range/room.

### `/api/slotconfig` — GET, POST, PUT, DELETE

Full CRUD on `slot_config`. Admin-only for writes. Simple operations with existence checks on PUT/DELETE (404 if not found).

### `/api/bands` — GET, POST, PUT, DELETE

Full CRUD on `band`. Admin-only for writes. Simple operations with existence checks.

### `/api/users` — GET, PUT, DELETE

Admin-only. GET lists users with their profiles; PUT updates a user (including role and profile links); DELETE removes a user.

### `/api/rooms` — GET

Returns all active rooms ordered by `number ASC`.

### `/api/entrylogs` — GET, POST

Admin-only. GET returns entry logs; POST records a scan (writes an `audit_logs` entry with action `ENTRY_SCAN`).

### `/api/system-settings` — GET, PUT

Admin-only. Reads/writes the single `system_settings` row (notification email, booking release day/time, sheets config).

### `/api/sheets/weekly` — POST

Admin-only. Manually triggers the weekly Google Sheets export. Optional `date` (ISO) overrides the target week.

---

## 8. Frontend Pages & Components

### Page Summary

| Page | Route | Access | Key Feature |
|------|-------|--------|-------------|
| **Room Booking** | `/RoomBooking` | Public | Weekly timetable, room selector, booking modal |
| **Slot Requests** | `/SlotRequests` | Admin | Approve/deny/edit, filters, search, pagination |
| **Dashboard** | `/Dashboard` | Admin | Slot config CRUD, time pickers, enable/disable |
| **Register** | `/Register` | Admin | User + band management, ColorPicker, BandMultiSelect |
| **Home** | `/home` | Public | Hero, Mission, Branches, Events sections |
| **Root** | `/` | Public | Redirects to `/RoomBooking` |

### Key Components

#### `Navbar.tsx`
- Fixed top bar, hides on scroll-down, shows on scroll-up
- Desktop links with active indicator (purple dot)
- Mobile hamburger menu with `AnimatePresence` animation
- Inline login modal + RegistrationModal
- Admin-only links conditionally rendered

#### `RBTable.tsx` (Room Booking Table — core component)
- **Week navigation:** prev/next chevrons, "Today" button, date picker trigger
- **Room selector:** `RoomDropdown` to switch between rooms
- **Grid layout:** Rows = time slots (from `slotConfig`), Columns = days of week
- **Booking display:** Cells coloured by band colour, row-span merged for consecutive same-band bookings
- **Booking modal:** Opens on cell click — shows band selector (ProfileDropdown), date+time fields, reason
- **Week cache:** `useRef<Map<string, CacheEntry>>` — max 20 entries, cache-first, cleared on new booking
- **Scroll-edge gradient:** Right-edge gradient overlay when table overflows horizontally
- **Animation:** `AnimatePresence mode="wait"` around table with 0.1s crossfade on week navigation

#### `SlotsRequestTable.tsx`
- **Filters:** Room, status (pending/approved/rejected), date, text search
- **Action buttons:** Admin sees approve/deny/edit; all users see delete
- **Edit modal:** Room/Date/Time in `flex-col sm:flex-row`, Status + Reason full-width
- **Pagination:** 7 per page, ellipsis truncation
- **Error display:** 409 conflict errors show conflicting band name

#### `DashboardTable.tsx`
- **Add row:** Two TimePicker inputs + "Add Slot" button at top
- **Table columns:** ID, Start, End, Status badge, Actions (toggle enabled/disabled, delete)
- **12-hour display:** All times converted via `to12Hour` helper

#### `Modal.tsx` (Reusable)
- `AnimatePresence` with scale + opacity animation (0.2s)
- Backdrop click to close (with `e.stopPropagation()`)
- Glassmorphism styling: `bg-black/50 backdrop-blur-xl border-white/20 rounded-3xl`

#### `TimePicker.tsx`
- Generates times from 06:00 to 21:30 in 30-minute increments
- Displays in 12-hour AM/PM format
- Click-outside-to-close, `AnimatePresence` dropdown
- Custom scrollbar: `max-h-40 overflow-y-auto`

#### `DatePicker.tsx` (Custom)
- Pure client-side calendar (no external library)
- Month navigation, today highlight, selected highlight
- Grid calculated from `date-fns` helpers

#### `ColorPicker.tsx`
- HSV canvas (saturation-value square) drawn via `<canvas>` API
- Hue slider: native `<input type="range">` with rainbow gradient
- Hex text input with validation
- Marker position tracks s/v coordinates
- Click-outside-to-close

#### `BandMultiSelect.tsx`
- Multiple band selection with checkbox UI
- Display: comma-joined selected band names
- Click-outside-to-close, animated dropdown

#### `ProfileDropdown.tsx`
- Single band selection with colour dot + name
- Used for booking modal (selecting which band is booking)

### Reusable UI Patterns

All dropdowns follow the same pattern:

```typescript
// 1. Click-outside-to-close
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  function handleClick(e: MouseEvent) {
    if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
  }
  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
}, []);

// 2. AnimatePresence dropdown
<AnimatePresence>
  {isOpen && (
    <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}>
      ...options...
    </motion.div>
  )}
</AnimatePresence>
```

Scroll-edge gradient indicator:

```typescript
const [isScrolled, setIsScrolled] = useState(false);
const handleScroll = (e: React.UIEvent) => {
  const t = e.currentTarget;
  setIsScrolled(t.scrollLeft + t.clientWidth < t.scrollWidth - 2);
};
// Renders: absolute right-edge gradient when isScrolled is true
```

Pagination ellipsis pattern:

```typescript
const getPageNumbers = (current: number, total: number) => {
  const range: (number | "...")[] = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) range.push(i);
    else if (range[range.length - 1] !== "...") range.push("...");
  }
  return range;
};
```

---

## 9. Data Flows

### Booking Flow (End-to-End)

```
 USER                           BROWSER                         API                          DB
  │                               │                              │                            │
  │ 1. Select room + week         │                              │                            │
  │───→                          │                              │                            │
  │                               │──GET /api/slots?start=...──→─│                            │
  │                               │                              │──SELECT slot, band, room──→│
  │                               │←──────── JSON ──────────────│←────── booked slots ───────│
  │                               │                              │                            │
  │ 2. Click empty cell           │                              │                            │
  │───→                          │                              │                            │
  │                               │  Open booking modal          │                            │
  │                               │  (check auth → login prompt  │                            │
  │                               │   if unauthenticated)         │                            │
  │ 3. Fill form + submit         │                              │                            │
  │───→                          │                              │                            │
  │                               │──POST /api/requests─────────→│                            │
  │                               │                              │──findExactSlot + conflict──→│
  │                               │                              │  check                     │
  │                               │                              │  db.batch([insert, email]) │
  │                               │←── 201 / 409 ───────────────│←───────── done ────────────│
  │  ←── success / error msg      │                              │                            │
  │                               │                              │                            │
 ```

### Approval Flow (Admin)

```
 ADMIN                          BROWSER                         API                          DB
  │                               │                              │                            │
  │ 1. Open /SlotRequests         │                              │                            │
  │───→                          │                              │                            │
  │                               │──GET /api/requests───────────→│                            │
  │                               │                              │──SELECT request + joins───→│
  │                               │←────── all requests ────────│←───── JSON ────────────────│
  │                               │                              │                            │
  │ 2. Click ✅ Approve           │                              │                            │
  │───→                          │                              │                            │
  │                               │──PUT /api/requests?id=...───→│                            │
  │                               │  { status: "approved" }      │                            │
  │                               │                              │  re-check conflict         │
  │                               │                              │  db.batch([update booking, │
  │                               │                              │             email])        │
  │                               │←── 200 + updated request ───│←───────── done ────────────│
  │  ←── table updates            │                              │                            │
  │                               │                              │                            │
  │ 3. Click ❌ Deny              │                              │                            │
  │───→                          │                              │                            │
  │                               │──PUT /api/requests?id=...───→│                            │
  │                               │  { status: "rejected" }      │                            │
  │                               │                              │  UPDATE booking status     │
  │                               │←── 200 ─────────────────────│                            │
```

### Overlap Detection Logic

```mermaid
sequenceDiagram
    participant Client
    participant API as POST /api/requests
    participant DB as D1 (SQLite)

    Client->>API: POST { room_id, date, start_time, end_time, band_id, reason }
    API->>DB: SELECT room by number
    API->>DB: findExactSlot (policy schedule + release window)
    alt Slot not available
        DB-->>API: no exact slot
        API-->>Client: 400 "Slot is not available for booking"
    end
    API->>DB: SELECT * FROM bookings WHERE room_id=$1 AND status IN ('PENDING','APPROVED')<br/>AND start_time < $3 AND end_time > $2
    alt Overlapping active booking found
        DB-->>API: Found conflict
        API-->>Client: 409 CONFLICT: "Time slot already booked by [band]"
    end
    API->>DB: db.batch([ INSERT booking (PENDING), notification email ])
    API-->>Client: 201 Created
```

### Week Cache Strategy (RBTable)

```typescript
type WeekCacheKey = `${weekStartISO}-${roomNumber}`;  // e.g. "2026-06-22-1"
interface WeekCacheEntry {
  days: Day[];
  timeSlots: TimeSlot[];
  bookings: Booking[];
}

const cache = useRef<Map<WeekCacheKey, WeekCacheEntry>>(new Map());
const MAX_CACHE = 20;

function loadWeek(weekStart: Date, roomNumber: number) {
  const key = `${weekStart.toISOString().slice(0,10)}-${roomNumber}`;
  if (cache.current.has(key)) {
    skipAnimation.current = true;
    setState(cache.current.get(key)!);
    return;
  }
  fetchData(weekStart, roomNumber).then((data) => {
    if (cache.current.size >= MAX_CACHE) cache.current.delete(cache.current.keys().next().value);
    cache.current.set(key, data);
    setState(data);
  });
}

// On booking: cache.current.clear()
```

---

## 10. Design System

### Glassmorphism Tokens

| Element | Classes |
|---------|---------|
| **Card/Container** | `bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl` |
| **Input** | `bg-white/10 border-white/20 rounded-xl text-white font-mono` |
| **Primary Button** | `bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white` |
| **Ghost Button** | `hover:bg-white/10 transition-colors` |
| **Modal** | `bg-black/50 backdrop-blur-xl border border-white/20 rounded-3xl` |
| **Table Header** | `bg-gray-900 sticky top-0 z-10` |
| **Table Cell** | `font-mono` + `gray-400` (band/user columns) or `gray-500` (date columns) |
| **Dropdown** | `bg-gray-900 border border-white/10 rounded-xl` |

### Typography

- **`font-mono` everywhere** — table cells, form inputs, labels, action buttons, time displays
- **Responsive headings** — `text-xl sm:text-2xl` for page titles, `text-[28px] sm:text-[40px] md:text-5xl lg:text-6xl` for hero

### Time Format

| Context | Format | Example |
|---------|--------|---------|
| **Frontend (display)** | 12-hour AM/PM | `7:30 AM` |
| **Frontend (internal value)** | 24-hour HH:mm | `07:30` |
| **Backend (schedule)** | text HH:mm | `07:30` |
| **Backend (timestamp)** | epoch ms (integer) | `1782034200000` |

The `to12Hour` helper converts `"HH:mm"` → `"h:mm AM/PM"`:
```typescript
const to12Hour = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m.toString().padStart(2, "0")} ${ampm}`;
};
```

### Responsive Breakpoints (Default Tailwind)

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Horizontal layouts, larger padding |
| `md` | 768px | Tablet column layouts |
| `lg` | 1024px | Desktop hero text size |
| `xl` | 1280px | Full width containers |

Key patterns across all pages:
- `px-4 sm:px-10` — responsive horizontal padding on `<main>`
- `flex-col sm:flex-row` — column on mobile, row on desktop for modal fields
- `p-2 sm:p-4` — responsive padding in table cells
- `py-3 sm:py-2.5` — responsive tap targets on mobile

---

## 11. Testing Strategy

### Test Stack

- **Backend unit tests:** Vitest (88 tests across 11 suites)
- **UI tests:** Playwright
- **API tests:** Node.js scripts using `fetch`/`axios`
- **Projects:** 6 (shared auth setup + 5 test projects)

### Playwright Configuration

```typescript
projects: [
  { name: "setup", testMatch: "auth.setup.ts" },       // Admin login fixture
  { name: "roombooking", dependencies: ["setup"] },    // UI tests
  { name: "slotrequests", dependencies: ["setup"] },   // UI tests
  { name: "dashboard", dependencies: ["setup"] },      // UI tests
  { name: "register", dependencies: ["setup"] },       // UI tests
  { name: "responsive", dependencies: ["setup"] },     // viewport tests
]
```

### API Tests (Pure Node.js, no Playwright)

Each `*-api.test.mjs` file uses `fetch()`/`axios` directly against the dev server or production URL. No dev server dependency — they can run against any running instance by setting `BASE_URL` env var.

| Suite | File | What It Covers |
|-------|------|----------------|
| Room Booking | `roombooking-api.test.mjs` | Room listing, slot queries, direct booking, overlap detection |
| Slot Requests | `slotrequests-api.test.mjs` | CRUD + conflict detection 409 on POST + PUT |
| Dashboard | `dashboard-api.test.mjs` | Slot config CRUD, validation, 404 handling |
| Register | `register-api.test.mjs` | User CRUD, band CRUD, user-profile relationships |

### API Test Pattern

```javascript
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function test(name, fn) {
  try { await fn(); console.log(`  ✅ ${name}`); }
  catch (e) { console.log(`  ❌ ${name}: ${e.message}`); process.exitCode = 1; }
}

// Tests use fetch() + .json() directly
await test("GET /api/rooms returns rooms", async () => {
  const res = await fetch(`${BASE}/api/rooms`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert(Array.isArray(body));
});
```

### UI Tests (Playwright)

| Suite | What It Covers |
|-------|----------------|
| Room Booking | Table render, week nav, booking flow, cache, mobile |
| Slot Requests | Filtering, approve/deny, edit, delete |
| Dashboard | Add/edit/toggle/delete slot configs |
| Register | User CRUD, band CRUD, ColorPicker, BandMultiSelect |
| Responsive | Mobile (390×844) + Tablet (768×1024) viewports |

### Running Tests

```bash
# Backend unit tests
cd backend && npm run test

# API tests (any running instance)
npm run test:api                               # roombooking tests
node tests/slotrequests-api.test.mjs           # slot requests tests
node tests/dashboard-api.test.mjs              # dashboard tests
node tests/register-api.test.mjs               # register tests

# UI tests (require dev server)
npm run dev &                                  # Start server
npm run test:ui                                # All UI tests
npx playwright test --project=roombooking      # Single project
npx playwright test --headed                    # Visible browser

# Against production
BASE_URL=https://your-app.vercel.app node tests/roombooking-api.test.mjs
```

### Known Test Quirks

- Playwright `getByText` is case-insensitive and fails on multiple matches → use heading roles or `locator("button").filter({ hasText: })`
- ColorPicker trigger targeted via `locator("button").filter({ hasText: "#ffffff" })` because `getByText` matches both trigger and table cells
- `/api/users` returns `bands` (lowercase b), while register returns `Bands` (capital B)
- PostgreSQL `TIME` type returns `06:00:00` (with `:00` suffix) not `06:00`

---

## 12. Deployment

### Vercel Configuration

**`vercel.json`:**
```json
{
  "framework": "nextjs",
  "installCommand": "npm install --legacy-peer-deps"
}
```

**`next.config.ts`** key settings:
```typescript
eslint: { ignoreDuringBuilds: true },   // ESLint flat config incompatibility workaround
rewrites: [{ source: "/api/:path*", destination: "${backendUrl}/api/:path*" }],
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BACKEND_URL` | Deployed Hono backend URL (default `http://localhost:8787`) |
| `JWT_SECRET` | Secret used by the backend to sign session JWTs |

### Backend Database Pattern (`backend/src/db/client.ts`)

```typescript
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
export type DbClient = ReturnType<typeof getDb>;
export { schema };
```

### Migration Strategy

- **Local:** `wrangler d1 migrations apply DB --local`
- **Production:** `wrangler d1 migrations apply DB --remote`
- **New migrations:** `drizzle-kit generate` (run from `backend/`)

### Build Command

```bash
npm install --legacy-peer-deps   # --legacy-peer-deps required for React 19 RC peer conflicts
npx next build                    # Production build
```

---

## 13. Key Technical Decisions

### 13.1 Race Condition Protection — conflict check + unique index

**Problem:** Two concurrent POST requests to `/api/requests` could both pass the overlap check before either inserts, resulting in double-booking.

**Solution:** Run a conflict-overlap check before insert and rely on the `bookings_room_start_unique` unique index (`room_id`, `start_time`) to reject the second concurrent insert:

```typescript
const conflict = await this.findActiveConflict(this.db, room.id, exactSlot.startTime, exactSlot.endTime);
if (conflict) {
  throw new Error(`CONFLICT:${conflict.band_name}`);
}
await this.db.batch([
  this.db.insert(schema.bookings).values({ /* ... */ }),
  // ...
]);
```

**Alternatives considered vs chosen:**
- **Option A (FOR UPDATE row lock):** Postgres-only; not available on SQLite/D1
- **Option B (unique index):** Chosen — D1-compatible, no lock, sufficient for expected load

### 13.2 Serverless Database Connection

**Problem:** The API runs on Cloudflare Workers (serverless); connections must be lightweight and per-request.

**Solution:** Each request obtains a D1 binding and wraps it via `drizzle-orm/d1` in `backend/src/db/client.ts`. D1 handles connection pooling internally on Cloudflare's side — no app-level pool needed.

### 13.3 Middleware vs `withAuth`

**Problem:** Need to protect admin routes while keeping `/RoomBooking`, `/home`, and `/api/*` public.

**Solution:** Custom `middleware.ts` using `jose` to verify the JWT instead of NextAuth's `withAuth` middleware. This gives explicit per-route control via the `matcher` config and avoids wrapping every page in `getServerSession` calls.

### 13.4 Scrollbar Flicker Fix

**Problem:** Navigation between pages causes a brief layout shift as scrollbars appear/disappear.

**Solution:** `overflow-y: hidden` on mount → `overflow-y: auto` after mount, applied via `useEffect` + state toggle. This prevents the initial flicker while maintaining scrollability once the page is rendered.

### 13.5 Routing Architecture

**Problem:** The original home page (Hero, Mission, Branches, Events) needed to coexist with the room booking timetable as the default landing page.

**Solution:**
- `/` redirects to `/RoomBooking` (most-visited page)
- `/home` serves the original marketing content
- Navbar "Home" link points to `/home`
- Both `/RoomBooking` and `/home` are public (unauthenticated)

### 13.6 Time Format Split

**Problem:** Users prefer 12-hour AM/PM for readability, but the database stores time values as `HH:mm`.

**Solution:** All frontend displays use `to12Hour` conversion. All internal state/storage uses `HH:mm` for compatibility with the stored time format.

### 13.7 Week Cache Strategy

**Problem:** Navigating between weeks in the timetable re-fetches the entire week's data, causing visible loading states.

**Solution:** `useRef<Map>` with a key of `${weekISO}-${roomNumber}`, max 20 entries. Cache is checked on week navigation; if found, data is loaded instantly and animation is skipped. Cache is cleared on any successful booking mutation (so the updated timetable is fetched fresh).

### 13.8 ESLint Flat Config Incompatibility

**Problem:** `eslint.config.mjs` uses `FlatCompat` to bridge old-style `.eslintrc` configs. Next.js's ESLint runner passes `useEslintrc` and `extensions` options valid only for ESLint 8, which fail against ESLint 9's flat config format.

**Solution:** `eslint: { ignoreDuringBuilds: true }` in `next.config.ts`. Linting runs separately via `npm run lint` with the same config, which works correctly when invoked directly.

---

## 14. Component Tree

```
<RootLayout>
  <AuthProvider>                        ← JWT session context
    <ThemeProvider attribute="class" defaultTheme="dark">
      <Navbar>                              ← Fixed top nav
        ├── Logo + "Home" link             → /home
        ├── Desktop nav links              → conditional on role
        ├── Auth buttons (Login / Logout)  → opens Modal or signs out
        └── Mobile hamburger menu          → AnimatePresence panel (same links)
      </Navbar>
      <main>                                ← px-4 sm:px-10
        {children}                           ← Page content
      </main>
    </ThemeProvider>
  </AuthProvider>
</RootLayout>

┌── Page: /RoomBooking ─────────────────────────────────────────────────┐
│  <MotionWrapper>                                                       │
│    <h1> + <AnimatePresence mode="wait">                               │
│      <RBTable>                                                         │
│        ├── RoomDropdown                     ← Room selector           │
│        ├── Week navigation bar              ← Prev/Today/Next/Date    │
│        ├── <div onScroll={handleScroll}>                              │
│        │   ├── Table header (days of week)  ← sticky bg-gray-900     │
│        │   └── Table body                   ← time slots × days      │
│        │       └── Booked cells             ← band colour bg,        │
│        │            row-span merged          ← consecutive same-band   │
│        └── Gradient overlay (if scrolled)   ← pointer-events-none     │
│      </RBTable>                                                        │
│    </AnimatePresence>                                                  │
│  </MotionWrapper>                                                      │
│                                                                        │
│  <Modal> ← Booking / Status / Login-Required                           │
│    ├── "Book Slot": TimePicker, DatePicker, ProfileDropdown, Reason    │
│    ├── "Status": booked info + optional delete                         │
│    └── "Login Required": prompt to sign in                             │
│  </Modal>                                                              │
└────────────────────────────────────────────────────────────────────────┘

┌── Page: /SlotRequests ────────────────────────────────────────────────┐
│  <SlotsRequestTable>                                                   │
│    ├── RoomDropdown + FilterDropdown + DatePicker + Search input      │
│    ├── <div onScroll={handleScroll}>                                  │
│    │   └── Table (User, Band, Room, Slot, Status, Actions)            │
│    └── Pagination (prev / ... / pages / ... / next)                    │
│                                                                        │
│    <Modal> ← Edit Request                                              │
│      └── EditRequestForm: RoomDropdown, DatePicker, TimePicker,        │
│          Status toggle, Reason input                                   │
│    </Modal>                                                            │
│  </SlotsRequestTable>                                                  │
└────────────────────────────────────────────────────────────────────────┘

┌── Page: /Dashboard ───────────────────────────────────────────────────┐
│  <DashboardTable>                                                      │
│    ├── Add row: TimePicker(Start) + TimePicker(End) + Add button      │
│    ├── Table (ID, Start, End, Status, Actions)                         │
│    └── Pagination                                                      │
│  </DashboardTable>                                                     │
└────────────────────────────────────────────────────────────────────────┘

┌── Page: /Register ────────────────────────────────────────────────────┐
│  Two-panel glassmorphism layout                                        │
│  ├── Panel 1: "Register User"                                         │
│  │   ├── Name, Email, Password inputs                                 │
│  │   ├── BandMultiSelect                                               │
│  │   └── Gradient "Register" button                                    │
│  ├── Panel 2: "Users" table                                            │
│  │   └── Table with edit/delete                                        │
│  ├── Panel 3: "Create Band"                                            │
│  │   ├── Name input                                                    │
│  │   └── ColorPicker                                                   │
  │  └── Panel 4: "Bands" table                                            │
  │      └── Table with edit/delete                                        │
  └────────────────────────────────────────────────────────────────────────┘

┌── Page: /home ────────────────────────────────────────────────────────┐
│  <Hero>                                                                │
│    ├── GlowingStarsBackground                                          │
│    ├── TextGenerateEffect ("Student Welfare Office Kengeri")           │
│    └── Subtitle                                                        │
│  <Mission />                                                           │
│  <Branches />                                                          │
│  <EventsPage />                                                        │
│    └── Event cards with scroll-triggered fade-in                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 15. Error Handling Patterns

### API Error Handling

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Missing required field | 400 | `{ error: "Validation failed" }` |
| Resource not found | 404 | `{ error: "Not found" }` |
| Overlapping booking | 409 | `{ error: "CONFLICT: Band X already has a pending request" }` |
| Invalid credentials | 401 | `{ error: "Invalid username or password" }` |
| Server error | 500 | `{ error: "Internal server error" }` |

### Conflict Safety

When approving or editing a booking, the service re-runs the active-conflict check (excluding the request being edited) before updating the status. If a conflict is found it returns 409 with the conflicting band name, leaving the existing booking untouched.

### Frontend Error Display

- **Inline error messages:** Shown below the submit button in modals
- **Conflict formatting:** `formatError` helper in `SlotsRequestTable.tsx` strips the `CONFLICT:` prefix and displays just the human-readable message
- **Toast patterns:** Not used — errors are displayed inline in the modal or as alert text

---

## 16. Performance Considerations

### Database

- **Indexes** on `bookings(room_id, start_time, end_time)` and `bookings(profile_id)` accelerate overlap detection queries
- **Unique index** `bookings_room_start_unique` (`room_id`, `start_time`) prevents concurrent double-booking
- **No N+1 queries** — Drizzle relations and explicit joins batch related data

### Frontend

- **Week cache** avoids redundant API calls for previously-viewed week + room combinations
- **`useMemo`** for row-span merging calculations in RBTable, preventing recalculation on unrelated re-renders
- **`MotionWrapper`** uses simple `framer-motion` fade-in (not layout animations) for performance
- **Pagination** limits DOM rendering to 7–10 items per page on all table components
- **Font-mono** on all text avoids layout shift from font loading (monospace has consistent character width)

### Serverless (Cloudflare Workers)

- **D1** handles connection pooling on Cloudflare's side — no app-level pool to manage
- **`--legacy-peer-deps`** resolves React 19 RC peer dependency conflicts without affecting production bundle size

---

## 17. Dependencies Scripts Guide

| Script | What It Does | Notes |
|--------|-------------|-------|
| `npm run dev` | `next dev` — starts dev server |
| `npm run build` | `next build` — production build | Runs ESLint (ignored), generates static pages |
| `npm run start` | `next start` — starts production server |
| `npm run lint` | `next lint` — runs ESLint | Works standalone despite build flag |
| `npm run test:api` | Runs roombooking API tests | Run others individually |
| `npm run test:ui` | `playwright test` — runs all UI projects |
| `npm run test:ui:headed` | `playwright test --headed` — visible browser |

### Backend Scripts (`backend/`)

| Script | What It Does |
|--------|-------------|
| `npm run dev` | Starts the Hono API locally via Wrangler |
| `npm run test` | Runs the Vitest suite (backend unit tests) |
| `npm run db:generate` | Generates a new Drizzle migration |
| `npm run db:migrate` | Applies migrations to the local D1 database |
| `npm run db:migrate:prod` | Applies migrations to the remote D1 database |

---

*This document describes the system as of August 2026. For the latest changes, see `git log`.*
