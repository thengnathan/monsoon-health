# Monsoon Health — Clinical Trial Screening Tracker

## Project Overview

Monsoon Health is a clinical trial screening platform designed for Clinical Research Coordinators (CRCs), CROs, and Sponsors. It manages patient screening workflows — tracking patients, trials, screening cases, pending items, visits, and notifications. The app features a public-facing landing page, an About page, and a full authenticated dashboard with a "stormy morning" dark theme and dark/light mode support.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 6, React Router 6, TypeScript |
| **Styling** | Vanilla CSS with CSS custom properties (dark/light themes) |
| **Authentication** | Clerk (`@clerk/clerk-react` frontend, `@clerk/express` backend) |
| **Backend** | Node.js, Express 4, TypeScript (`ts-node-dev`) |
| **Database** | Supabase (PostgreSQL via `pg` pool) |
| **File Storage** | Supabase Storage (protocol PDFs, patient documents) |
| **Scheduling** | `node-cron` (background notification jobs) |

---

## Project Structure

```
Monsoon Health/
├── client/                          # React frontend (Vite + TypeScript)
│   ├── public/
│   │   └── images/                  # Hero video/images (waves-clouds-bg.mp4)
│   ├── .env                         # VITE_CLERK_PUBLISHABLE_KEY
│   ├── package.json
│   ├── vite.config.ts               # Proxy /api → localhost:3001
│   └── src/
│       ├── main.tsx                 # ReactDOM entry
│       ├── App.tsx                  # ClerkProvider, ThemeProvider, Router
│       ├── api.ts                   # API client (fetch wrapper with Clerk token)
│       ├── index.css                # App styles (~1400 lines, CSS variables)
│       ├── landing.css              # Landing & About page styles
│       ├── utils.tsx                # StatusBadge, formatDate, isOverdue helpers
│       ├── contexts/
│       │   ├── AuthContext.tsx      # Maps Clerk user → internal user, token mgmt
│       │   └── ToastContext.tsx     # Toast notification system
│       ├── components/
│       │   └── Layout.tsx           # Sidebar nav, UserButton, theme toggle, floating note
│       └── pages/
│           ├── LandingPage.tsx      # Public landing page (hero, glitch title, dropdown nav)
│           ├── AboutPage.tsx        # Public About page (editorial content, founder cards)
│           ├── LoginPage.tsx        # Clerk <SignIn>
│           ├── SignUpPage.tsx       # Clerk <SignUp>
│           ├── DashboardPage.tsx    # "Today" — stats, active cases, pending items
│           ├── PatientsPage.tsx     # Patient list with search/filter/create
│           ├── PatientDetailPage.tsx # Patient profile, signals, documents
│           ├── TrialsPage.tsx       # Trial list with filtering
│           ├── TrialDetailPage.tsx  # Trial config, criteria, signal rules, protocols
│           ├── ScreeningCasesPage.tsx       # Screening case list
│           ├── ScreeningCaseDetailPage.tsx  # Full case workflow, status, pending items
│           └── NotesPage.tsx        # Personal notes with floating popup, pin, color
│
└── server/                          # Express backend (TypeScript)
    ├── .env                         # CLERK keys, SUPABASE_URL, DATABASE_URL
    ├── package.json
    ├── src/
    │   ├── index.ts                 # Express app, CORS, middleware, route mounting
    │   ├── middleware/
    │   │   └── auth.ts              # Clerk verifyToken, auto-provision users
    │   ├── routes/
    │   │   ├── auth.ts              # GET /api/auth/me
    │   │   ├── patients.ts          # CRUD + document upload/download
    │   │   ├── trials.ts            # CRUD + protocol upload, signal rules, visits
    │   │   ├── screeningCases.ts    # CRUD + enrollment + visit tracking
    │   │   ├── pendingItems.ts      # CRUD for case pending items
    │   │   ├── signals.ts           # Patient signal recording
    │   │   ├── signalTypes.ts       # Signal type config
    │   │   ├── visits.ts            # Visit template CRUD + upcoming visits
    │   │   ├── screenFailReasons.ts # Fail reason catalog
    │   │   ├── referralSources.ts   # Referral source catalog
    │   │   ├── users.ts             # User listing
    │   │   ├── notifications.ts     # Notification events
    │   │   ├── notes.ts             # Personal notes CRUD
    │   │   └── today.ts             # Dashboard aggregate data
    │   ├── services/
    │   │   ├── notificationService.ts  # Background job: check for alerts
    │   │   └── scheduler.ts            # node-cron setup
    │   └── types/
    │       └── index.ts             # Shared TypeScript types
    └── db/
        ├── schema.sql               # 18 tables, all indexes (run once in Supabase)
        └── seed.sql                 # site-001, signal types, screen fail reasons
```

---

## Database Schema (18 tables — Supabase PostgreSQL)

### Core Entities
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sites` | Multi-tenancy | `id`, `name`, `timezone` |
| `users` | CRCs/managers | `id`, `site_id`, `name`, `email`, `role` (CRC/MANAGER/READONLY), `clerk_id` |
| `patients` | Patient records | `id`, `site_id`, `first_name`, `last_name`, `dob`, `referral_source_id` |
| `trials` | Clinical trials | `id`, `site_id`, `name`, `protocol_number`, `recruiting_status` (ACTIVE/PAUSED/CLOSED) |

### Screening Workflow
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `screening_cases` | **Core entity** — links patient↔trial | `patient_id`, `trial_id`, `assigned_user_id`, `status`, `fail_reason_id`, `revisit_date` |
| `pending_items` | Checklist items per case | `screening_case_id`, `type` (LAB/IMAGING/RECORDS/PROCEDURE/CONSULT), `status`, `due_date` |
| `screen_fail_reasons` | Catalog of why patients fail | `code`, `label`, `explanation_template` |

### Signals & Rules
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `signal_types` | Signal definitions (e.g. "FibroScan") | `name`, `label`, `value_type` (NUMBER/STRING/ENUM), `unit` |
| `patient_signals` | Time-series signal values | `patient_id`, `signal_type_id`, `value_number`, `collected_at` |
| `trial_signal_rules` | Auto-match thresholds per trial | `trial_id`, `signal_type_id`, `operator` (GTE/LTE/EQ/IN), `threshold_number` |

### Visits
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `visit_templates` | Visit schedule blueprint per trial | `trial_id`, `visit_name`, `day_offset`, `window_before/after` |
| `patient_visits` | Actual scheduled visits | `screening_case_id`, `visit_template_id`, `scheduled_date`, `status` |

### Documents & Files
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `trial_protocols` | Uploaded protocol PDFs | `trial_id`, `filename`, `storage_path` (Supabase Storage) |
| `patient_documents` | Patient files (labs, imaging) | `patient_id`, `document_type`, `storage_path` (Supabase Storage) |

### Notes
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notes` | Personal user notes | `user_id`, `title`, `content`, `color`, `is_pinned` |

### Notifications & Audit
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notification_events` | System alerts | `type` (REVISIT_DUE/THRESHOLD_CROSSED/etc), `screening_case_id`, `dedup_key` |
| `email_logs` | Email delivery tracking | `user_id`, `event_id`, `status` (QUEUED/SENT/FAILED) |
| `audit_logs` | Change tracking | `entity_type`, `entity_id`, `action` (CREATE/UPDATE/DELETE), `diff` |

### Screening Case Status Flow
```
NEW → IN_REVIEW → PENDING_INFO → LIKELY_ELIGIBLE → ENROLLED
                                                 → SCREEN_FAILED (with fail_reason)
                                                 → FUTURE_CANDIDATE (with revisit_date)
                                                 → DECLINED
                                                 → LOST_TO_FOLLOWUP
```

---

## Authentication Flow

**Frontend (Clerk React):**
1. `App.tsx` wraps everything in `<ClerkProvider>` with theme-aware appearance
2. `LoginPage.tsx` renders Clerk `<SignIn>`
3. `AuthContext.tsx` calls `getToken()` from Clerk, stores in `localStorage` as `monsoon_clerk_token`
4. `api.ts` reads `monsoon_clerk_token` and sends as `Authorization: Bearer <token>` header

**Backend (Clerk Express):**
1. `middleware/auth.ts` uses `verifyToken(token, { secretKey })` to verify the Bearer token
2. Extracts `payload.sub` (Clerk user ID)
3. Looks up internal user by `clerk_id`
4. If not found → auto-provisions a new internal user (role: CRC, site: site-001)
5. Sets `req.user` with internal user data for route handlers

**Environment Variables:**
```
# client/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# server/.env
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
```

---

## API Endpoints

All routes are prefixed with `/api` and require authentication (Bearer token).

### Auth
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Get current user's internal profile |

### Patients
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/patients` | List patients (supports `?search=`, `?referral_source_id=`) |
| GET | `/api/patients/:id` | Get patient detail (includes signals, documents) |
| POST | `/api/patients` | Create patient |
| PATCH | `/api/patients/:id` | Update patient |
| POST | `/api/patients/upload-document` | Upload patient document (multipart) |
| GET | `/api/patients/:id/documents` | List patient documents |
| GET | `/api/patients/:id/documents/:docId/download` | Download a document |
| DELETE | `/api/patients/:id/documents/:docId` | Delete a document |

### Trials
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trials` | List trials (supports `?recruiting_status=`) |
| GET | `/api/trials/:id` | Get trial detail |
| POST | `/api/trials` | Create trial |
| PATCH | `/api/trials/:id` | Update trial |
| GET/POST | `/api/trials/:id/signal-rules` | Get/create signal threshold rules |
| DELETE | `/api/trials/signal-rules/:id` | Delete signal rule |
| POST | `/api/trials/:id/protocol` | Upload protocol PDF |
| GET | `/api/trials/:id/protocol/download` | Download protocol |
| DELETE | `/api/trials/:id/protocol` | Delete protocol |
| GET/POST | `/api/trials/:id/visit-templates` | Get/create visit templates |

### Screening Cases
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/screening-cases` | List cases (supports `?status=`, `?trial_id=`, `?patient_id=`) |
| GET | `/api/screening-cases/:id` | Get case detail |
| POST | `/api/screening-cases` | Create case |
| PATCH | `/api/screening-cases/:id` | Update case status, assignment, notes |
| POST | `/api/screening-cases/:id/enroll` | Enroll patient (creates scheduled visits) |
| GET | `/api/screening-cases/:id/visits` | Get case visits |

### Notes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List user's notes |
| POST | `/api/notes` | Create note |
| PATCH | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |

### Other Resources
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/today` | Dashboard aggregate: stats, active cases, pending items, revisits, alerts |
| GET | `/api/upcoming-visits` | Visits in next 7 days |
| GET | `/api/users` | List all active users |
| GET/POST | `/api/signal-types` | List/create signal type definitions |
| GET/POST | `/api/signals/patient/:id` | Get/record patient signals |
| GET/POST | `/api/pending-items` | List/create pending items |
| PATCH/DELETE | `/api/pending-items/:id` | Update/delete pending item |
| GET | `/api/screen-fail-reasons` | List screen fail reason catalog |
| GET/POST | `/api/referral-sources` | List/create referral sources |
| GET | `/api/notifications` | List notification events |
| PATCH/DELETE | `/api/visit-templates/:id` | Update/delete visit template |
| PATCH | `/api/patient-visits/:id` | Update visit status |

---

## Frontend Architecture

### Routing
| Path | Component | Auth Required |
|------|-----------|---------------|
| `/landing` | `LandingPage` | No |
| `/about` | `AboutPage` | No |
| `/login` | `LoginPage` | No |
| `/sign-up` | `SignUpPage` | No |
| `/` | `DashboardPage` | Yes |
| `/patients` | `PatientsPage` | Yes |
| `/patients/:id` | `PatientDetailPage` | Yes |
| `/trials` | `TrialsPage` | Yes |
| `/trials/:id` | `TrialDetailPage` | Yes |
| `/screening` | `ScreeningCasesPage` | Yes |
| `/screening/:id` | `ScreeningCaseDetailPage` | Yes |
| `/notes` | `NotesPage` | Yes |

### Theming System
- `ThemeProvider` in `App.tsx` manages dark/light mode via `ThemeContext`
- CSS uses `[data-theme="dark"]` and `[data-theme="light"]` attribute selectors
- All colors use CSS variables (e.g., `--bg-root`, `--text-primary`, `--accent`)
- Clerk appearance is dynamically generated via `getClerkAppearance(theme)`
- Toggle in `Layout.tsx` sidebar

### Design Tokens (Dark Mode — "Stormy Morning")
```
--bg-root:         #1a2530
--bg-surface:      #212f3b
--bg-surface-raised: #283846
--text-primary:    #e4edf5
--text-secondary:  #9ab0c4
--text-tertiary:   #6A89A7
--accent:          #88BDDF
--accent-hover:    #BDDDFC
```

### Landing Page Design
- Hero background: video (`waves-clouds-bg.mp4`) with dark overlay
- Title: "Monsoon Health" in Friz Quadrata Std with CSS glitch animation
- Typing animation cycling between two phrases (2.5s hold, 35–55ms per character)
- Navbar: brand left, Products/Company dropdowns centered, "Schedule a Demo" CTA right
- Dropdowns: fade-in with translateY -8px→0, 150ms close delay, one open at a time

### Notes Feature
- Floating draggable popup (`NotePopup`) shared between `NotesPage` and `Layout`
- Notes support title, content, 6 color themes, pin-to-top
- `Layout` handles API calls; `NotesPage` registers a `fetchNotes` refresh callback via outlet context so the list updates immediately on save/delete

---

## Running Locally

```bash
# Terminal 1 — Backend
cd server
npm install
npm run dev
# → http://localhost:3001

# Terminal 2 — Frontend
cd client
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:3001` (configured in `vite.config.ts`).

### First-time Supabase setup
1. Go to Supabase dashboard → SQL Editor
2. Run `server/db/schema.sql` (creates all 18 tables)
3. Run `server/db/seed.sql` (creates site-001, signal types, screen fail reasons)
4. Your user is auto-provisioned on first login via Clerk

---

## Key Design Decisions

1. **Supabase (PostgreSQL)**: Hosted database with connection pooling. Schema is fully normalized with FK constraints.
2. **Multi-tenant by site_id**: Every table has `site_id`. All queries are scoped to the user's site.
3. **Clerk for auth**: No custom password handling. Backend verifies tokens with `verifyToken()`, auto-provisions users on first login.
4. **Supabase Storage for files**: Protocol PDFs and patient documents stored in Supabase Storage buckets (not database BLOBs).
5. **Signal-based matching**: Trials define threshold rules. When a patient's signal crosses a threshold, a `THRESHOLD_CROSSED` notification is generated.
6. **Background scheduler**: `node-cron` runs periodic checks for revisit-due dates and visit reminders.
7. **TypeScript throughout**: Both client and server are fully typed.

---

## How to Add a New Feature

### Adding a new API endpoint
1. Create/edit route file in `server/src/routes/`
2. Use `authMiddleware` to protect it
3. Access DB via `req.app.locals.db` (pg Pool)
4. Mount in `server/src/index.ts` under `/api`

### Adding a new page
1. Create page component in `client/src/pages/`
2. Add API methods to `client/src/api.ts`
3. Add route in `App.tsx` (protected or public)
4. Add nav link in `Layout.tsx` `navItems` array if it's an app page
5. Style using existing CSS variables from `index.css`

### Adding a new DB table
1. Add `CREATE TABLE` to `server/db/schema.sql`
2. Add seed data to `server/db/seed.sql` if needed
3. Run the SQL in Supabase SQL Editor
