# Monsoon Health — Clinical Trial Screening Tracker

## Project Overview

Monsoon Health is a clinical trial screening state tracker designed for Clinical Research Coordinators (CRCs). It helps manage patient screening workflows for clinical trials — tracking patients, trials, screening cases, pending items, visits, and notifications. The app uses a "stormy morning" dark theme with full dark/light mode support.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.3, Vite 6, React Router 6 |
| **Styling** | Vanilla CSS with CSS custom properties (dark/light themes) |
| **Authentication** | Clerk (`@clerk/clerk-react` frontend, `@clerk/express` backend) |
| **Backend** | Node.js, Express 4 |
| **Database** | SQLite via `better-sqlite3` |
| **File Uploads** | `multer` (protocol PDFs, patient documents) |
| **Scheduling** | `node-cron` (background notification jobs) |

---

## Project Structure

```
Willowbark/
├── client/                          # React frontend (Vite)
│   ├── .env                         # VITE_CLERK_PUBLISHABLE_KEY
│   ├── package.json
│   ├── vite.config.js               # Proxy /api → localhost:3001
│   └── src/
│       ├── main.jsx                 # ReactDOM entry
│       ├── App.jsx                  # ClerkProvider, ThemeProvider, Router
│       ├── api.js                   # API client (fetch wrapper with Clerk token)
│       ├── index.css                # All styles (~1400 lines, CSS variables)
│       ├── utils.jsx                # StatusBadge, formatDate, isOverdue helpers
│       ├── contexts/
│       │   ├── AuthContext.jsx      # Maps Clerk user → internal user, token mgmt
│       │   └── ToastContext.jsx     # Toast notification system
│       ├── components/
│       │   ├── Layout.jsx           # Sidebar nav, UserButton, theme toggle
│       │   └── StormyBackdrop.jsx   # Animated wave canvas for login page
│       └── pages/
│           ├── LoginPage.jsx        # Clerk <SignIn> + StormyBackdrop
│           ├── SignUpPage.jsx       # Clerk <SignUp> + StormyBackdrop
│           ├── DashboardPage.jsx    # "Today" — stats, active cases, pending items
│           ├── PatientsPage.jsx     # Patient list with search/filter/create
│           ├── PatientDetailPage.jsx # Patient profile, signals, documents
│           ├── TrialsPage.jsx       # Trial list with filtering
│           ├── TrialDetailPage.jsx  # Trial config, criteria, signal rules, protocols
│           ├── ScreeningCasesPage.jsx   # Screening case list
│           └── ScreeningCaseDetailPage.jsx # Full case workflow, status, pending items
│
└── server/                          # Express backend
    ├── .env                         # CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY
    ├── package.json
    ├── index.js                     # Express app, CORS, middleware, route mounting
    ├── middleware/
    │   └── auth.js                  # Clerk verifyToken, auto-provision users
    ├── db/
    │   ├── schema.sql               # 17 tables, all indexes
    │   ├── seed.sql                 # Sample site + referral sources
    │   └── init.js                  # DB initialization + seed runner
    ├── routes/
    │   ├── auth.js                  # GET /api/auth/me
    │   ├── patients.js              # CRUD + document upload/download
    │   ├── trials.js                # CRUD + protocol upload, signal rules, visits
    │   ├── screeningCases.js        # CRUD + enrollment + visit tracking
    │   ├── pendingItems.js          # CRUD for case pending items
    │   ├── signals.js               # Patient signal recording
    │   ├── signalTypes.js           # Signal type config
    │   ├── visits.js                # Visit template CRUD + upcoming visits
    │   ├── screenFailReasons.js     # Fail reason catalog
    │   ├── referralSources.js       # Referral source catalog
    │   ├── users.js                 # User listing
    │   ├── notifications.js         # Notification events
    │   └── today.js                 # Dashboard aggregate data
    ├── services/
    │   ├── notificationService.js   # Background job: check for alerts
    │   └── scheduler.js             # node-cron setup
    └── data/
        └── willowbark.db            # SQLite database file (auto-created)
```

---

## Database Schema (17 tables)

### Core Entities
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sites` | Multi-tenancy | `id`, `name`, `timezone` |
| `users` | CRCs/managers | `id`, `site_id`, `name`, `email`, `role` (CRC/MANAGER/READONLY), `clerk_id` |
| `patients` | Patient records | `id`, `site_id`, `first_name`, `last_name`, `dob`, `referral_source_id` |
| `trials` | Clinical trials | `id`, `site_id`, `name`, `protocol_number`, `recruiting_status` (ACTIVE/PAUSED/CLOSED), `inclusion_criteria`, `exclusion_criteria` |

### Screening Workflow
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `screening_cases` | **Core entity** — links patient↔trial | `patient_id`, `trial_id`, `assigned_user_id`, `status` (NEW→IN_REVIEW→ENROLLED etc), `fail_reason_id`, `revisit_date` |
| `pending_items` | Checklist items per case | `screening_case_id`, `type` (LAB/IMAGING/RECORDS/PROCEDURE/CONSULT), `status` (OPEN/COMPLETED/CANCELLED), `due_date` |
| `screen_fail_reasons` | Catalog of why patients fail | `code`, `label`, `explanation_template` |

### Signals & Rules
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `signal_types` | Signal definitions (e.g. "HbA1c") | `name`, `label`, `value_type` (NUMBER/STRING/ENUM), `unit` |
| `patient_signals` | Time-series signal values | `patient_id`, `signal_type_id`, `value_number`, `collected_at` |
| `trial_signal_rules` | Auto-match thresholds per trial | `trial_id`, `signal_type_id`, `operator` (GTE/LTE/EQ/IN), `threshold_number` |

### Visits
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `visit_templates` | Visit schedule blueprint per trial | `trial_id`, `visit_name`, `day_offset`, `window_before/after` |
| `patient_visits` | Actual scheduled visits for enrolled patients | `screening_case_id`, `visit_template_id`, `scheduled_date`, `status` |

### Documents & Files
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `trial_protocols` | Uploaded protocol PDFs | `trial_id`, `filename`, `file_data` (BLOB) |
| `patient_documents` | Patient files (labs, Fibroscan) | `patient_id`, `document_type`, `file_data` (BLOB) |

### Notifications & Audit
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notification_events` | System alerts | `type` (REVISIT_DUE/THRESHOLD_CROSSED/etc), `screening_case_id`, `payload`, `dedup_key` |
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
1. `App.jsx` wraps everything in `<ClerkProvider>` with theme-aware appearance
2. `LoginPage.jsx` renders `<SignIn routing="path" path="/login" />`
3. `SignUpPage.jsx` renders `<SignUp routing="path" path="/sign-up" />`
4. `AuthContext.jsx` calls `getToken()` from Clerk, stores in `localStorage` as `monsoon_clerk_token`
5. `api.js` reads `monsoon_clerk_token` and sends as `Authorization: Bearer <token>` header

**Backend (Clerk Express):**
1. `middleware/auth.js` uses `verifyToken(token, { secretKey })` from `@clerk/express` to verify the Bearer token
2. Extracts `payload.sub` (Clerk user ID)
3. Looks up internal user by `clerk_id` column
4. If not found → auto-provisions a new internal user (role: CRC)
5. Sets `req.user` with internal user data for route handlers

**Environment Variables:**
```
# client/.env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# server/.env
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
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
| GET | `/api/trials/:id` | Get trial detail (includes criteria, rules, protocols) |
| POST | `/api/trials` | Create trial |
| PATCH | `/api/trials/:id` | Update trial |
| GET | `/api/trials/:id/signal-rules` | Get signal threshold rules |
| POST | `/api/trials/:id/signal-rules` | Create signal rule |
| DELETE | `/api/trials/signal-rules/:id` | Delete signal rule |
| POST | `/api/trials/:id/protocol` | Upload protocol PDF (multipart) |
| GET | `/api/trials/:id/protocol/download` | Download protocol |
| DELETE | `/api/trials/:id/protocol` | Delete protocol |
| GET | `/api/trials/:id/visit-templates` | Get visit schedule templates |
| POST | `/api/trials/:id/visit-templates` | Create visit template |

### Screening Cases
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/screening-cases` | List cases (supports `?status=`, `?trial_id=`, `?patient_id=`) |
| GET | `/api/screening-cases/:id` | Get case detail (includes pending items, signals, visits) |
| POST | `/api/screening-cases` | Create case (links patient→trial) |
| PATCH | `/api/screening-cases/:id` | Update case status, assignment, notes |
| POST | `/api/screening-cases/:id/enroll` | Enroll patient (creates scheduled visits from templates) |
| GET | `/api/screening-cases/:id/visits` | Get case's patient visits |

### Other Resources
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/today` | Dashboard aggregate: stats, active cases, pending items, revisits, alerts |
| GET | `/api/upcoming-visits` | Visits scheduled in next 7 days |
| GET | `/api/users` | List all active users |
| GET | `/api/signal-types` | List signal type definitions |
| POST | `/api/signal-types` | Create signal type |
| GET | `/api/signals/patient/:id` | Get patient's signal history |
| POST | `/api/signals/patient/:id` | Record a signal value |
| GET/POST | `/api/pending-items` | List/create pending items |
| PATCH/DELETE | `/api/pending-items/:id` | Update/delete pending item |
| GET | `/api/screen-fail-reasons` | List screen fail reason catalog |
| GET | `/api/referral-sources` | List referral sources |
| POST | `/api/referral-sources` | Create referral source |
| GET | `/api/notifications` | List notification events |
| PATCH/DELETE | `/api/visit-templates/:id` | Update/delete visit template |
| PATCH | `/api/patient-visits/:id` | Update visit status |

---

## Frontend Architecture

### Theming System
- `ThemeProvider` in `App.jsx` manages dark/light mode via `ThemeContext`
- CSS uses `[data-theme="dark"]` and `[data-theme="light"]` attribute selectors
- All colors use CSS variables (e.g., `--bg-primary`, `--text-primary`, `--accent`)
- Clerk appearance is dynamically generated via `getClerkAppearance(theme)` function
- Toggle switch in `Layout.jsx` sidebar

### Color Palette (Dark Mode — "Stormy Morning")
```
--bg-primary:    #0f1923    (deep navy)
--bg-surface:    #1a2530    (card background)
--bg-elevated:   #243040    (hover states)
--text-primary:  #e4edf5    (main text)
--text-secondary:#9ab0c4    (muted text)
--text-tertiary: #6a89a7    (labels)
--accent:        #88BDDF    (interactive elements)
--border-default:rgba(106, 137, 167, 0.12)
```

### Key Frontend Patterns
1. **API Client** (`api.js`): Centralized `request()` function that auto-attaches Clerk Bearer token from localStorage
2. **AuthContext**: Bridges Clerk authentication with internal user profile — calls `/api/auth/me` after Clerk sign-in, keeps token fresh via 50s interval
3. **Page Pattern**: Each page uses `useState` + `useEffect` to fetch data from `api.*` methods, with loading spinners and empty states
4. **Route Protection**: `ProtectedRoute` component checks Clerk `isSignedIn` and internal user loading state
5. **Toast Notifications**: `ToastContext` for success/error messages across pages

### Pages & Their Data Sources
| Page | API Calls | Description |
|------|-----------|-------------|
| DashboardPage | `getToday()`, `getUpcomingVisits()` | Aggregated stats, active cases, pending items, revisits, alerts |
| PatientsPage | `getPatients()`, `getReferralSources()` | Searchable/filterable patient list, create modal |
| PatientDetailPage | `getPatient(id)`, patient signals, documents | Full patient profile with signal chart, document uploads |
| TrialsPage | `getTrials()` | Trial list with status filters |
| TrialDetailPage | `getTrial(id)`, signal rules, protocols, visits | Trial config, criteria editing, protocol upload, visit schedule |
| ScreeningCasesPage | `getScreeningCases()` | Case list with status/trial filters |
| ScreeningCaseDetailPage | `getScreeningCase(id)`, pending items, visits | Full case workflow with status changes, pending items, enrollment |

---

## Running Locally

```bash
# Terminal 1 — Backend
cd server
npm install
node index.js
# → http://localhost:3001

# Terminal 2 — Frontend
cd client
npm install
npx vite --port 5173 --host 0.0.0.0
# → http://localhost:5173
```

The Vite dev server proxies `/api` requests to `localhost:3001` (configured in `vite.config.js`).

The database auto-creates and seeds on first run (`server/db/init.js`).

---

## Key Design Decisions

1. **SQLite for simplicity**: Single-file DB, no setup. Schema designed for easy Postgres migration.
2. **Multi-tenant by site_id**: Every table has `site_id`. All queries are scoped to the user's site.
3. **Clerk for auth**: No custom password handling. Clerk handles sign-in/sign-up/MFA. Backend verifies tokens with `verifyToken()`.
4. **Auto-provisioning**: First Clerk login auto-creates an internal user record (role: CRC).
5. **Signal-based matching**: Trials define threshold rules. When a patient's signal crosses a threshold, a `THRESHOLD_CROSSED` notification is generated.
6. **BLOBs for files**: Protocol PDFs and patient documents stored directly in SQLite as BLOBs (fine for small scale).
7. **Background scheduler**: `node-cron` runs periodic checks for revisit-due dates and visit reminders.

---

## How to Add a New Feature

### Adding a new API endpoint
1. Create/edit route file in `server/routes/`
2. Use `authMiddleware` to protect it
3. Access DB via `req.app.locals.db`
4. Mount in `server/index.js` under `/api`

### Adding a new page
1. Create page component in `client/src/pages/`
2. Add API methods to `client/src/api.js`
3. Add route in `App.jsx` inside the protected `<Route path="/">`
4. Add nav link in `Layout.jsx` `navItems` array
5. Style using existing CSS variables from `index.css`

### Adding a new DB table
1. Add `CREATE TABLE` to `server/db/schema.sql`
2. Add seed data to `server/db/seed.sql` if needed
3. Delete `server/data/willowbark.db` and restart server to re-create
