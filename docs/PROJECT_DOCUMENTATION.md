# Monsoon Health — Project Documentation

> **Last updated:** March 31, 2026
>
> Complete technical reference for contributors. This document covers architecture, codebase structure, database schema, API surface, AI pipelines, background jobs, and developer workflows.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Running Locally](#running-locally)
7. [Database Schema](#database-schema)
8. [Authentication Flow](#authentication-flow)
9. [API Endpoints](#api-endpoints)
10. [AI & Ingestion Pipeline](#ai--ingestion-pipeline)
11. [Background Jobs & Scheduler](#background-jobs--scheduler)
12. [Frontend Architecture (Platform)](#frontend-architecture-platform)
13. [Marketing Site](#marketing-site)
14. [Email System](#email-system)
15. [Key Design Decisions](#key-design-decisions)
16. [How to Add New Features](#how-to-add-new-features)
17. [Conventions & Coding Standards](#conventions--coding-standards)
18. [Troubleshooting](#troubleshooting)

---

## Project Overview

Monsoon Health is a **clinical trial screening and patient lifecycle management platform** for research sites, CROs, and sponsors. It replaces disconnected spreadsheets and manual processes with a unified, real-time system.

### What it does

- **Track patients** across multiple clinical trials simultaneously
- **Manage screening cases** through a full status workflow (NEW → ENROLLED, or fail/decline/future)
- **Record & monitor clinical signals** (FibroScan, labs, vitals) with threshold-based alerts
- **AI-powered protocol ingestion** — upload a trial protocol PDF and the system auto-extracts eligibility criteria, visit schedules, and signal rules
- **AI-powered patient matching** — automatically evaluate patients against protocol criteria
- **Manage pending items** (labs, imaging, consults) with due dates
- **Schedule & track patient visits** with automated reminders
- **Upload & store** trial protocols and patient documents (Supabase Storage)
- **Personal notes workspace** for coordinators (pinned, colored, draggable)
- **Real-time dashboard** with today's active cases, pending items, upcoming visits, and alerts
- **Email notifications** via Resend (waitlist, contact forms, operational alerts)

### Who uses it

| Role | Description |
|------|-------------|
| **CRC** (Clinical Research Coordinator) | Primary user — manages screening workflow day-to-day |
| **MANAGER** | Oversight, team management, receives escalation notifications |
| **READONLY** | View-only access to dashboards and patient data |

---

## Monorepo Structure

The project is a **monorepo with three independent apps** (platform, marketing, server) sharing no build tooling but using the same Supabase backend.

```
Monsoon Health/
├── platform/                         # ① Main application (authenticated SPA)
│   ├── src/
│   │   ├── App.tsx                   # ClerkProvider, ThemeProvider, Router
│   │   ├── api.ts                    # API client (fetch wrapper with Clerk token)
│   │   ├── main.tsx                  # ReactDOM entry
│   │   ├── index.css                 # App styles (~32KB, CSS variables, dark/light)
│   │   ├── utils.tsx                 # StatusBadge, formatDate, isOverdue helpers
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx        # Maps Clerk user → internal user, token mgmt
│   │   │   └── ToastContext.tsx       # Toast notification system
│   │   ├── components/
│   │   │   ├── Layout.tsx             # Sidebar nav, UserButton, theme toggle
│   │   │   ├── StormyBackdrop.tsx     # Three.js animated background
│   │   │   └── LiquidSilkBackground.tsx # Alternate animated background
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx      # "Today" — stats, active cases, pending items
│   │   │   ├── PatientsPage.tsx       # Patient list: search, filter, create, bulk import
│   │   │   ├── PatientDetailPage.tsx  # Patient profile, signals, documents
│   │   │   ├── TrialsPage.tsx         # Trial list with status filtering
│   │   │   ├── TrialDetailPage.tsx    # Trial config, criteria, signals, protocols, visits
│   │   │   ├── ScreeningCasesPage.tsx # Screening case list
│   │   │   ├── ScreeningCaseDetailPage.tsx # Full case workflow, status, pending items
│   │   │   ├── NotesPage.tsx          # Personal notes: pin, color, floating popup
│   │   │   ├── LoginPage.tsx          # Clerk <SignIn>
│   │   │   └── SignUpPage.tsx         # Clerk <SignUp>
│   │   └── types/
│   │       └── index.ts              # Frontend TypeScript interfaces
│   ├── public/                        # Static assets
│   ├── vite.config.ts                 # Proxy /api → localhost:3001
│   ├── tsconfig.json
│   └── package.json
│
├── marketing/                        # ② Public marketing site (deployed to Vercel)
│   ├── src/
│   │   ├── App.tsx                    # Router: Landing, About, Zephyr, Rainfall, Contact
│   │   ├── landing.css                # All marketing styles (~49KB)
│   │   └── pages/
│   │       ├── LandingPage.tsx        # Hero with video bg, glitch title, typing animation
│   │       ├── AboutPage.tsx          # Company story, founder bios
│   │       ├── ZephyrPage.tsx         # Product page: Zephyr
│   │       ├── RainfallPage.tsx       # Product page: Rainfall
│   │       └── ContactPage.tsx        # Contact / demo request form
│   ├── vercel.json                    # SPA rewrite rules
│   ├── vite.config.ts
│   └── package.json
│
├── server/                           # ③ Express API backend
│   ├── src/
│   │   ├── index.ts                   # Express app, CORS, middleware, route mounting
│   │   ├── middleware/
│   │   │   └── auth.ts                # Clerk token verification, auto-provision users
│   │   ├── routes/
│   │   │   ├── auth.ts                # GET /api/auth/me
│   │   │   ├── patients.ts            # CRUD + document upload/download + AI extraction
│   │   │   ├── trials.ts              # CRUD + protocol upload + AI ingestion + visits
│   │   │   ├── screeningCases.ts      # CRUD + enrollment + visit scheduling
│   │   │   ├── pendingItems.ts        # CRUD for screening case pending items
│   │   │   ├── signals.ts             # Patient signal recording + alert engine
│   │   │   ├── signalTypes.ts         # Signal type config CRUD
│   │   │   ├── visits.ts              # Visit template + patient visit CRUD
│   │   │   ├── screenFailReasons.ts   # Screen fail reason catalog
│   │   │   ├── referralSources.ts     # Referral source catalog
│   │   │   ├── users.ts               # User listing
│   │   │   ├── notifications.ts       # Notification events CRUD
│   │   │   ├── notes.ts               # Personal notes CRUD
│   │   │   ├── today.ts               # Dashboard aggregate data
│   │   │   └── email.ts               # Email endpoints (waitlist, contact)
│   │   ├── services/
│   │   │   ├── aiIngestion.ts         # Protocol & patient document AI extraction
│   │   │   ├── patientMatching.ts     # AI patient ↔ protocol eligibility matching
│   │   │   ├── alertEngine.ts         # Signal threshold evaluation + notification creation
│   │   │   ├── claude.ts              # Anthropic Claude API client
│   │   │   ├── ollama.ts              # Local Ollama LLM client
│   │   │   ├── embeddings.ts          # OpenAI text-embedding-3-small + pgvector search
│   │   │   └── scheduler.ts           # node-cron background jobs
│   │   ├── emails/
│   │   │   ├── WaitlistEmail.tsx       # Internal waitlist notification (React Email)
│   │   │   ├── WaitlistConfirmationEmail.tsx # User confirmation email
│   │   │   └── ContactEmail.tsx        # Contact form notification
│   │   └── types/
│   │       └── index.ts               # Shared TypeScript interfaces + Express augmentation
│   └── db/
│       ├── schema.sql                 # 18 core tables (run once in Supabase SQL Editor)
│       ├── seed.sql                   # Initial data: site, signal types, fail reasons
│       ├── init.js                    # pg Pool + Supabase client initialization
│       └── migrations/
│           └── 001_ai_fields.sql      # AI ingestion fields + patient_protocol_signals table
│
├── docs/
│   ├── PROJECT_DOCUMENTATION.md       # ← This file
│   └── CLAUDE.md                      # AI coding assistant rules & workflow
│
├── package.json                       # Root — email preview dependencies only
├── .gitignore
└── README.md                          # Quick-start guide
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Platform Frontend** | React 18, TypeScript, Vite 6, React Router 6 | Authenticated SPA with dark/light theme |
| **Marketing Frontend** | React 18, TypeScript, Vite 6, React Router 6 | Public site, deployed on Vercel |
| **Styling** | Vanilla CSS with CSS custom properties | No Tailwind — uses design tokens for theming |
| **3D / Animations** | Three.js, CSS animations | Stormy backdrop, glitch text, typing animation |
| **Authentication** | Clerk | `@clerk/clerk-react` (frontend), `@clerk/express` (backend) |
| **Backend** | Node.js, Express 4, TypeScript | `ts-node-dev` for dev, `tsc` for production |
| **Database** | Supabase (PostgreSQL) | Connection via `pg` Pool, schema managed via raw SQL |
| **Vector Search** | pgvector (Supabase) | Document chunk embeddings for semantic search |
| **File Storage** | Supabase Storage | Protocol PDFs, patient documents |
| **AI — Cloud** | Anthropic Claude (Haiku 4.5 / Sonnet 4.6) | Protocol ingestion, eligibility extraction |
| **AI — Local** | Ollama (Qwen 3.5) | Patient matching, local inference |
| **AI — Embeddings** | OpenAI `text-embedding-3-small` | Document chunking & semantic search |
| **Email** | Resend + React Email | Transactional emails (waitlist, contact, notifications) |
| **Background Jobs** | node-cron | Revisit scanning, visit reminders, notification dispatch |
| **PDF Parsing** | pdf-parse | Extract text from uploaded protocol/patient PDFs |
| **Excel Import** | xlsx | Bulk patient import from spreadsheets |

---

## Getting Started

### Prerequisites

| Tool | Version | Link |
|------|---------|------|
| Node.js | v18+ | [nodejs.org](https://nodejs.org) |
| npm | v9+ | Comes with Node |
| Supabase account | — | [supabase.com](https://supabase.com) |
| Clerk account | — | [clerk.com](https://clerk.com) |
| Ollama (optional) | Latest | [ollama.com](https://ollama.com) — for local AI matching |

### 1. Clone the repository

```bash
git clone https://github.com/thengnathan/monsoon-health.git
cd monsoon-health
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Run `server/db/schema.sql` — creates all 18 core tables
4. Run `server/db/seed.sql` — seeds site-001, signal types, screen fail reasons
5. Run `server/db/migrations/001_ai_fields.sql` — adds AI extraction fields + patient_protocol_signals table
6. (Optional) Enable the `vector` extension for embedding search:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
7. Copy from your Supabase project settings:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **Service Role Key** (API → Project API keys)
   - **Database URL** (Settings → Database → Connection string → URI)

### 3. Set up Clerk

1. Create a new application at [clerk.com](https://clerk.com)
2. Copy your **Publishable Key** (`pk_test_...`) and **Secret Key** (`sk_test_...`)

### 4. Install dependencies

```bash
# Platform frontend
cd platform && npm install && cd ..

# Marketing frontend
cd marketing && npm install && cd ..

# Backend
cd server && npm install && cd ..

# Root (email preview — optional)
npm install
```

---

## Environment Variables

### `server/.env`

```env
# Clerk authentication
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres

# AI Services (optional — required for protocol ingestion & matching)
ANTHROPIC_API_KEY=sk-ant-...          # Claude API key
CLAUDE_MODEL=claude-haiku-4-5-20251001 # Default model for extraction
OPENAI_API_KEY=sk-...                  # OpenAI embeddings
OLLAMA_URL=http://localhost:11434      # Local Ollama endpoint
OLLAMA_MODEL=qwen3.5                   # Local LLM model

# Email (optional — required for email notifications)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=hello@monsoonhealth.com
WAITLIST_NOTIFICATION_EMAIL=team@monsoonhealth.com

# Server
PORT=3001
```

### `platform/.env`

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

> **⚠️ Important:** `.env` files are in `.gitignore` and must never be committed. Ask your team lead for the development credentials.

---

## Running Locally

You need **two terminals** running simultaneously.

### Terminal 1 — Backend

```bash
cd server
npm run dev
# → Express API at http://localhost:3001
```

### Terminal 2 — Platform Frontend

```bash
cd platform
npm run dev
# → Vite dev server at http://localhost:5173
```

### Terminal 3 — Marketing Site (optional)

```bash
cd marketing
npm run dev
# → Vite dev server at http://localhost:5174
```

> The Vite dev server proxies all `/api` requests to `localhost:3001` (configured in `platform/vite.config.ts`).

### Available Scripts

| App | Command | Description |
|-----|---------|-------------|
| **server** | `npm run dev` | Start with hot reload (`ts-node-dev`) |
| **server** | `npm run build` | Compile TypeScript to `dist/` |
| **server** | `npm start` | Run compiled production build |
| **platform** | `npm run dev` | Start Vite dev server |
| **platform** | `npm run build` | Build for production |
| **platform** | `npm run preview` | Preview production build locally |
| **marketing** | `npm run dev` | Start Vite dev server |
| **marketing** | `npm run build` | TypeScript check + Vite build |

### First Login

1. Navigate to `http://localhost:5173/login`
2. Sign in with Clerk — your user account is **automatically provisioned** in the database with the `CRC` role attached to `site-001`
3. You'll land on the **Today** dashboard

---

## Database Schema

### Overview — 19 Tables (Supabase PostgreSQL)

The schema is fully normalized with foreign key constraints. Every table includes `site_id` for multi-tenant scoping.

### Entity Relationship Diagram

```mermaid
erDiagram
    sites ||--o{ users : "has"
    sites ||--o{ patients : "has"
    sites ||--o{ trials : "has"
    patients ||--o{ screening_cases : "screened in"
    trials ||--o{ screening_cases : "screens for"
    users ||--o{ screening_cases : "assigned to"
    screening_cases ||--o{ pending_items : "has"
    screening_cases ||--o{ patient_visits : "has"
    trials ||--o{ visit_templates : "defines"
    trials ||--o{ trial_signal_rules : "has rules"
    trials ||--o{ trial_protocols : "has protocols"
    patients ||--o{ patient_signals : "has signals"
    patients ||--o{ patient_documents : "has documents"
    patients ||--o{ patient_protocol_signals : "matched to"
    trials ||--o{ patient_protocol_signals : "matched for"
    signal_types ||--o{ patient_signals : "typed by"
    signal_types ||--o{ trial_signal_rules : "evaluated by"
    visit_templates ||--o{ patient_visits : "based on"
    screen_fail_reasons ||--o{ screening_cases : "explains"
    referral_sources ||--o{ patients : "referred by"
    users ||--o{ notes : "owns"
    notification_events ||--o{ email_logs : "triggers"
```

### Core Entities

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `sites` | Multi-tenancy root | `id`, `name`, `timezone` |
| `users` | CRCs / managers | `id`, `site_id`, `name`, `email`, `role` (CRC/MANAGER/READONLY), `clerk_id` |
| `patients` | Patient records | `id`, `site_id`, `first_name`, `last_name`, `dob`, `referral_source_id` |
| `trials` | Clinical trials | `id`, `site_id`, `name`, `protocol_number`, `recruiting_status`, `extracted_criteria_json` |
| `referral_sources` | Where patients come from | `id`, `site_id`, `name`, `type` (PCP/SPECIALIST/OTHER) |

### Screening Workflow

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `screening_cases` | **Core workflow entity** — links patient ↔ trial | `patient_id`, `trial_id`, `assigned_user_id`, `status`, `fail_reason_id`, `revisit_date` |
| `pending_items` | Checklist items per case | `screening_case_id`, `type` (LAB/IMAGING/RECORDS/PROCEDURE/CONSULT), `status`, `due_date` |
| `screen_fail_reasons` | Why patients fail screening | `code`, `label`, `explanation_template` |

#### Screening Case Status Flow

```
NEW → IN_REVIEW → PENDING_INFO → LIKELY_ELIGIBLE → ENROLLED
                                                  → SCREEN_FAILED (with fail_reason)
                                                  → FUTURE_CANDIDATE (with revisit_date)
                                                  → DECLINED
                                                  → LOST_TO_FOLLOWUP
```

### Signals & Rules

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `signal_types` | Signal definitions (e.g. "FibroScan") | `name`, `label`, `value_type` (NUMBER/STRING/ENUM), `unit` |
| `patient_signals` | Time-series signal values | `patient_id`, `signal_type_id`, `value_number`, `collected_at` |
| `trial_signal_rules` | Auto-match thresholds per trial | `trial_id`, `signal_type_id`, `operator` (GTE/LTE/EQ/IN), `threshold_number` |

### Visits

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `visit_templates` | Visit schedule blueprint per trial | `trial_id`, `visit_name`, `day_offset`, `window_before/after`, `reminder_days_before` |
| `patient_visits` | Actual scheduled visits | `screening_case_id`, `visit_template_id`, `scheduled_date`, `status`, `reminder_sent` |

### Documents & Files

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `trial_protocols` | Uploaded protocol PDFs | `trial_id`, `filename`, `storage_path` (Supabase Storage) |
| `patient_documents` | Patient files (labs, imaging) | `patient_id`, `document_type`, `storage_path`, `raw_extracted_data` (AI-extracted JSON) |

### AI / Matching

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `patient_protocol_signals` | AI-generated patient ↔ trial eligibility results | `patient_id`, `trial_id`, `overall_status`, `confidence`, `criteria_breakdown`, `auto_assigned` |

### Notes

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notes` | Personal user notes | `user_id`, `title`, `content`, `color`, `is_pinned` |

### Notifications & Audit

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `notification_events` | System alerts | `type` (REVISIT_DUE/THRESHOLD_CROSSED/PENDING_ITEM_COMPLETED/VISIT_REMINDER), `dedup_key` |
| `email_logs` | Email delivery tracking | `user_id`, `event_id`, `status` (QUEUED/SENT/FAILED) |
| `audit_logs` | Change tracking | `entity_type`, `entity_id`, `action` (CREATE/UPDATE/DELETE), `diff` |

### Pre-seeded Signal Types

The following signal types are created by `seed.sql` for `site-001`:

| ID | Name | Label | Type | Unit |
|----|------|-------|------|------|
| sig-001 | FIBROSCAN_KPA | FibroScan (kPa) | NUMBER | kPa |
| sig-002 | BIOPSY_STAGE | Fibrosis Stage (Biopsy) | ENUM | — |
| sig-003 | PLATELETS | Platelet Count | NUMBER | ×10³/μL |
| sig-004 | ALT | ALT | NUMBER | U/L |
| sig-005 | AST | AST | NUMBER | U/L |
| sig-006 | MELD_SCORE | MELD Score | NUMBER | — |
| sig-007 | HBSAG | HBsAg Status | ENUM | — |
| sig-008 | HBV_DNA | HBV DNA | NUMBER | IU/mL |
| sig-009 | BMI | BMI | NUMBER | kg/m² |
| sig-010 | NAS_SCORE | NAS Score | NUMBER | — |

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant ClerkReact as Clerk (React)
    participant API as Express API
    participant ClerkBackend as Clerk (Backend)
    participant DB as Supabase DB

    Browser->>ClerkReact: User signs in
    ClerkReact->>Browser: Session established, JWT issued
    Browser->>API: Request with Authorization: Bearer <token>
    API->>ClerkBackend: verifyToken(token, secretKey)
    ClerkBackend->>API: { sub: clerk_user_id }
    API->>DB: SELECT * FROM users WHERE clerk_id = ?
    alt User exists
        DB->>API: User record
    else First login
        API->>DB: INSERT new user (role: CRC, site: site-001)
        DB->>API: New user record
    end
    API->>Browser: Response with data
```

### Frontend Auth

1. `App.tsx` wraps everything in `<ClerkProvider>` with theme-aware appearance
2. `AuthContext.tsx` calls `getToken()` from Clerk, stores in `localStorage` as `monsoon_clerk_token`
3. `api.ts` reads `monsoon_clerk_token` and sends as `Authorization: Bearer <token>` header
4. `ProtectedRoute` component checks `isSignedIn` and redirects to `/login` if not

### Backend Auth

1. `middleware/auth.ts` extracts Bearer token from `Authorization` header
2. Uses Clerk `verifyToken(token, { secretKey })` to decode
3. Extracts `payload.sub` (Clerk user ID)
4. Looks up internal user by `clerk_id` in the database
5. If not found → **auto-provisions** a new user (role: `CRC`, site: `site-001`)
6. Sets `req.user` with internal user data for all downstream route handlers

---

## API Endpoints

All routes are prefixed with `/api`. Protected routes require a Bearer token.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Get current user's internal profile |

### Patients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/patients` | List patients (`?search=`, `?referral_source_id=`) |
| GET | `/api/patients/:id` | Get patient detail (includes signals, documents) |
| POST | `/api/patients` | Create patient |
| PATCH | `/api/patients/:id` | Update patient |
| POST | `/api/patients/upload-document` | Upload patient document (multipart, triggers AI extraction) |
| GET | `/api/patients/:id/documents` | List patient documents |
| GET | `/api/patients/:id/documents/:docId/download` | Download a document |
| DELETE | `/api/patients/:id/documents/:docId` | Delete a document |

### Trials

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trials` | List trials (`?recruiting_status=`) |
| GET | `/api/trials/:id` | Get trial detail |
| POST | `/api/trials` | Create trial |
| PATCH | `/api/trials/:id` | Update trial |
| GET/POST | `/api/trials/:id/signal-rules` | Get / create signal threshold rules |
| DELETE | `/api/trials/signal-rules/:id` | Delete signal rule |
| POST | `/api/trials/:id/protocol` | Upload protocol PDF (triggers AI ingestion pipeline) |
| GET | `/api/trials/:id/protocol/download` | Download protocol |
| DELETE | `/api/trials/:id/protocol` | Delete protocol |
| GET/POST | `/api/trials/:id/visit-templates` | Get / create visit templates |

### Screening Cases

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/screening-cases` | List cases (`?status=`, `?trial_id=`, `?patient_id=`) |
| GET | `/api/screening-cases/:id` | Get case detail |
| POST | `/api/screening-cases` | Create case |
| PATCH | `/api/screening-cases/:id` | Update case status, assignment, notes |
| POST | `/api/screening-cases/:id/enroll` | Enroll patient (creates scheduled visits from templates) |
| GET | `/api/screening-cases/:id/visits` | Get case visits |

### Notes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notes` | List current user's notes |
| POST | `/api/notes` | Create note |
| PATCH | `/api/notes/:id` | Update note (title, content, color, pin) |
| DELETE | `/api/notes/:id` | Delete note |

### Pending Items

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pending-items` | List pending items (`?screening_case_id=`) |
| POST | `/api/pending-items` | Create pending item |
| PATCH | `/api/pending-items/:id` | Update pending item status |
| DELETE | `/api/pending-items/:id` | Delete pending item |

### Signals

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/signals/patient/:id` | Get patient's signal history |
| POST | `/api/signals/patient/:id` | Record a signal value (triggers alert engine) |

### Visits

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/upcoming-visits` | Visits in next 7 days |
| PATCH | `/api/visit-templates/:id` | Update visit template |
| DELETE | `/api/visit-templates/:id` | Delete visit template |
| PATCH | `/api/patient-visits/:id` | Update visit status |

### Other Resources

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/today` | Dashboard aggregate: stats, active cases, pending, revisits, alerts |
| GET | `/api/users` | List all active users |
| GET/POST | `/api/signal-types` | List / create signal type definitions |
| GET | `/api/screen-fail-reasons` | List screen fail reason catalog |
| GET/POST | `/api/referral-sources` | List / create referral sources |
| GET | `/api/notifications` | List notification events |

### Email

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/email/waitlist` | Submit waitlist signup (sends confirmation + internal notification) |
| POST | `/api/email/contact` | Submit contact form |

### AI / Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/ai/health` | Check if Ollama is running + which model |
| POST | `/api/ai/test` | Test Ollama with a raw prompt |

---

## AI & Ingestion Pipeline

The platform has **three AI capabilities**, each using different models optimized for cost / quality / speed trade-offs.

### 1. Protocol Ingestion (Claude)

When a user uploads a protocol PDF to a trial:

```mermaid
flowchart LR
    A[PDF Upload] --> B[pdf-parse: extract text]
    B --> C[cleanPdfText: fix line breaks, page numbers]
    C --> D1[Claude Haiku: extract metadata<br/>title, sponsor, phase, criteria JSON]
    C --> D2[Claude Haiku: extract eligibility criteria<br/>clean, numbered, HTML-formatted]
    C --> D3[Claude Sonnet: extract visit schedule<br/>Schedule of Assessments table]
    C --> D4[Claude Haiku: extract signal rules<br/>max 6 key screening filters]
    D1 --> E[Store in trials table]
    D2 --> E
    D3 --> F[Create visit_templates rows]
    D4 --> G[Create trial_signal_rules + signal_types rows]
```

**Key implementation details:**
- `aiIngestion.ts` — main extraction pipelines
- `cleanPdfText()` — removes embedded line/page numbers, re-joins split sentences
- `findCriteriaSection()` — searches for eligibility section headers in the PDF text
- `findVisitScheduleSection()` — searches for Schedule of Assessments headers
- `criteriaToHtml()` — converts plain-text criteria to structured HTML with `<ol>`, `<ul>`, boldened thresholds
- Visit schedule extraction uses **Claude Sonnet 4.6** for higher quality on complex tables
- Signal rules are limited to **max 6** clinically important screening filters
- Eligibility extraction runs a **dedicated second pass** for cleaner output

### 2. Patient Document Extraction (Claude)

When a user uploads a patient document:

```mermaid
flowchart LR
    A[Document Upload] --> B[pdf-parse]
    B --> C[cleanPdfText]
    C --> D[Claude Haiku: extract patient data]
    D --> E[Store raw_extracted_data JSON in patient_documents]
```

Extracted fields include: demographics, diagnoses, medications, labs, vitals, imaging, FibroScan, smoking/alcohol status, family history, and more.

### 3. Patient-Protocol Matching (Ollama)

Evaluates all site patients against a trial's extracted criteria:

```mermaid
flowchart LR
    A[User triggers matching] --> B[Load trial criteria JSON]
    B --> C[For each patient...]
    C --> D[Build patient bundle:<br/>demographics + signals + extracted docs]
    D --> E[Ollama/Qwen 3.5: evaluate eligibility]
    E --> F[Store result in patient_protocol_signals]
    F --> G{LIKELY_ELIGIBLE or BORDERLINE?}
    G -->|Yes| H[Auto-create screening_case]
    G -->|No| I[Skip]
```

**Result statuses:** `LIKELY_ELIGIBLE`, `BORDERLINE`, `LIKELY_INELIGIBLE`
**Confidence levels:** `HIGH`, `MEDIUM`, `LOW`

### 4. Document Embeddings (OpenAI)

For semantic search across protocol and patient documents:

- `embeddings.ts` uses OpenAI `text-embedding-3-small`
- Documents are chunked (800 words, 100-word overlap)
- Chunks stored in `document_chunks` table with pgvector
- `searchChunks()` performs cosine similarity search

### Alert Engine

When a new patient signal is recorded, `alertEngine.ts` automatically:

1. Finds all active `trial_signal_rules` for that signal type
2. Evaluates if the value meets the threshold (GTE, LTE, EQ, IN)
3. Checks if a screening case already exists for the patient ↔ trial
4. Creates a `THRESHOLD_CROSSED` notification event (deduplicated per day)

---

## Background Jobs & Scheduler

`scheduler.ts` sets up three `node-cron` jobs:

| Job | Schedule | Description |
|-----|----------|-------------|
| **Revisit Due Scanner** | Daily at 7:00 AM | Finds `FUTURE_CANDIDATE` / `SCREEN_FAILED` cases with `revisit_date ≤ today + 3 days`, creates `REVISIT_DUE` notifications |
| **Visit Reminder Scanner** | Daily at 7:05 AM | Finds scheduled visits where `scheduled_date - reminder_days_before ≤ today`, creates `VISIT_REMINDER` notifications |
| **Notification Dispatcher** | Every 5 minutes | Processes unprocessed `notification_events`, identifies recipients (assigned CRC → fallback to all CRCs/managers), creates `email_logs` records |

All three jobs also run once on server startup (after 2-second delay).

### Notification Deduplication

Each notification has a `dedup_key` (unique per `site_id`). Duplicate key inserts are silently skipped via `UNIQUE(site_id, dedup_key)` constraint. This prevents duplicate alerts for the same event.

---

## Frontend Architecture (Platform)

### Routing

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| `/login` | `LoginPage` | No | Clerk `<SignIn>` |
| `/sign-up` | `SignUpPage` | No | Clerk `<SignUp>` |
| `/` | `DashboardPage` | Yes | Today dashboard |
| `/patients` | `PatientsPage` | Yes | Patient list |
| `/patients/:id` | `PatientDetailPage` | Yes | Patient detail |
| `/trials` | `TrialsPage` | Yes | Trial list |
| `/trials/:id` | `TrialDetailPage` | Yes | Trial detail + AI ingestion |
| `/screening` | `ScreeningCasesPage` | Yes | Screening case list |
| `/screening/:id` | `ScreeningCaseDetailPage` | Yes | Screening case workflow |
| `/notes` | `NotesPage` | Yes | Personal notes |

### Component Hierarchy

```
App (ThemeProvider → ClerkProvider → AuthProvider → ToastProvider)
├── LoginPage / SignUpPage (public)
└── ProtectedRoute
    └── Layout (sidebar, header, user button, theme toggle, floating note)
        ├── DashboardPage
        ├── PatientsPage
        ├── PatientDetailPage
        ├── TrialsPage
        ├── TrialDetailPage
        ├── ScreeningCasesPage
        ├── ScreeningCaseDetailPage
        └── NotesPage
```

### Theming System

The app supports **dark mode ("Stormy Morning")** and **light mode**.

- `ThemeProvider` in `App.tsx` manages state via `ThemeContext`
- Theme persisted to `localStorage` as `monsoon_theme`
- CSS uses `[data-theme="dark"]` and `[data-theme="light"]` attribute selectors
- All colors use CSS custom properties
- Clerk appearance dynamically generated via `getClerkAppearance(theme)`
- Toggle in sidebar (`Layout.tsx`)

#### Design Tokens (Dark Mode)

```css
--bg-root:            #1a2530
--bg-surface:         #212f3b
--bg-surface-raised:  #283846
--text-primary:       #e4edf5
--text-secondary:     #9ab0c4
--text-tertiary:      #6A89A7
--accent:             #88BDDF
--accent-hover:       #BDDDFC
```

### API Client (`api.ts`)

- Centralized `fetch` wrapper that auto-attaches the Clerk Bearer token from `localStorage`
- All API functions return typed responses
- Error handling with toast notifications via `ToastContext`

### Key Patterns

- **Optimistic UI:** Most lists refetch after mutations; no optimistic updates
- **Loading states:** Spinner component for async loads
- **Page transitions:** CSS-based fade via `PageWrapper` component
- **Notes popup:** Floating, draggable popup shared between `NotesPage` and `Layout`
- **Status badges:** Centralized `StatusBadge` component in `utils.tsx`
- **Date formatting:** `formatDate()` and `isOverdue()` helpers in `utils.tsx`

---

## Marketing Site

The marketing site is a **separate Vite app** deployed independently to **Vercel**.

### Pages

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `LandingPage` | Hero with video bg, glitch title, typing animation |
| `/about` | `AboutPage` | Company story, founder bios |
| `/products/zephyr` | `ZephyrPage` | Product page: Zephyr |
| `/products/rainfall` | `RainfallPage` | Product page: Rainfall |
| `/contact` | `ContactPage` | Contact / demo request form |

### Landing Page Features

- **Hero background:** Video (`waves-clouds-bg.mp4`) with dark overlay
- **Title:** "Monsoon Health" in Friz Quadrata Std with CSS glitch animation
- **Typing animation:** Cycles between two phrases (2.5s hold, 35–55ms per character)
- **Navbar:** Brand left, Products/Company dropdowns centered, "Schedule a Demo" CTA right
- **Dropdowns:** Fade-in with translateY -8px→0, 150ms close delay, one open at a time

### Deployment

- Deployed to Vercel with SPA rewrite rules (`vercel.json`)
- `{ "source": "/(.*)", "destination": "/index.html" }` — all routes handled client-side

---

## Email System

Emails are sent via **Resend** using **React Email** templates.

### Templates

| Template | File | Trigger |
|----------|------|---------|
| Waitlist Internal Notification | `emails/WaitlistEmail.tsx` | User joins waitlist |
| Waitlist Confirmation | `emails/WaitlistConfirmationEmail.tsx` | Confirmation to user |
| Contact Form | `emails/ContactEmail.tsx` | Contact form submission |

### Operational Notifications

The scheduler generates email content for these notification types (via `generateEmailContent()` in `scheduler.ts`):

| Type | Subject Template |
|------|-----------------|
| `REVISIT_DUE` | "Re-screen due: {patient} — {trial}" |
| `THRESHOLD_CROSSED` | "Signal alert: Patient may qualify for {trial}" |
| `PENDING_ITEM_COMPLETED` | "Screening update: {item} received" |
| `VISIT_REMINDER` | "Visit reminder: {patient} — {visit}" |

---

## Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Supabase (PostgreSQL)** | Hosted database with connection pooling, Storage, and built-in auth helpers. Schema is fully normalized with FK constraints. |
| 2 | **Multi-tenant by `site_id`** | Every table has `site_id`. All queries are scoped to the user's site. Enables future multi-site support without schema changes. |
| 3 | **Clerk for auth** | No custom password handling. Backend verifies tokens with `verifyToken()`, auto-provisions users on first login. |
| 4 | **Supabase Storage for files** | Protocol PDFs and patient documents stored in Storage buckets (not database BLOBs). Scales independently. |
| 5 | **Three-tier AI strategy** | Claude (cloud) for high-quality extraction, Ollama (local) for cost-effective matching, OpenAI for embeddings. Each model chosen for its strength. |
| 6 | **Signal-based matching** | Trials define threshold rules. When a patient's signal crosses a threshold, a `THRESHOLD_CROSSED` notification is generated automatically. |
| 7 | **Background scheduler** | `node-cron` runs periodic checks for revisit-due dates, visit reminders, and notification dispatch. Runs in the same process as the API server. |
| 8 | **TypeScript throughout** | Both client and server are fully typed. Shared type definitions in `server/src/types/index.ts` and `platform/src/types/index.ts`. |
| 9 | **Vanilla CSS with design tokens** | No CSS framework dependency. All colors, spacing, and shadows are CSS custom properties, making theming straightforward. |
| 10 | **Monorepo without shared tooling** | Each app (platform, marketing, server) has its own `package.json` and build process. Simple, no monorepo tooling overhead. |
| 11 | **Notification deduplication** | `dedup_key` prevents duplicate alerts. Key format: `{type}:{entity_id}:{date}`. |
| 12 | **Protocol ingestion is multi-pass** | Separate extraction passes for metadata, eligibility criteria, visit schedule, and signal rules. Each pass uses tailored prompts for higher quality. |

---

## How to Add New Features

### Adding a new API endpoint

1. Create or edit a route file in `server/src/routes/`
2. Import and use `authMiddleware` to protect it
3. Access the database via `req.app.locals.db` (pg Pool)
4. Access Supabase client via `req.app.locals.supabase`
5. Mount it in `server/src/index.ts` under `/api`
6. Add TypeScript types to `server/src/types/index.ts`

### Adding a new page

1. Create a page component in `platform/src/pages/`
2. Add API methods to `platform/src/api.ts`
3. Add the route in `platform/src/App.tsx` (inside `<Route>` for protected, or outside for public)
4. If it's a sidebar-navigable page, add to `navItems` array in `platform/src/components/Layout.tsx`
5. Style using existing CSS variables from `platform/src/index.css`

### Adding a new DB table

1. Add `CREATE TABLE` statement to `server/db/schema.sql` for reference
2. Create a migration file in `server/db/migrations/` (e.g., `002_your_feature.sql`)
3. Add seed data to `server/db/seed.sql` if needed
4. Run the migration SQL in Supabase SQL Editor
5. Add TypeScript types to `server/src/types/index.ts`

### Adding a new signal type

1. Insert into `signal_types` table via Supabase SQL Editor or the API
2. The new signal type will automatically appear in the UI
3. Trials can then create `trial_signal_rules` against it

### Adding an AI extraction feature

1. Define system prompt and extraction prompt in `server/src/services/aiIngestion.ts`
2. Choose the right model:
   - **Claude Haiku 4.5** — fast, cheap, good for structured extraction
   - **Claude Sonnet 4.6** — best quality, use for complex tables/documents
   - **Ollama** — local, free, good for matching/evaluation tasks
3. Use `claudeExtract<T>()` for JSON extraction or `claudeChat()` for text
4. Handle JSON parse failures gracefully (see `recoverPartialVisitArray()` pattern)

---

## Conventions & Coding Standards

### General

- **TypeScript everywhere** — no `any` types unless absolutely necessary
- **Functional components** — React function components with hooks, no class components
- **Named exports** for utilities and types, **default exports** for page/component files
- **UUID v4** for all primary keys (generated via `uuid` package on the server)

### File Naming

- **Components/Pages:** PascalCase (`PatientDetailPage.tsx`)
- **Services/Utils:** camelCase (`aiIngestion.ts`, `alertEngine.ts`)
- **CSS:** kebab-case (`index.css`, `landing.css`)
- **SQL:** snake_case (`schema.sql`, `001_ai_fields.sql`)

### Database Conventions

- All tables have `site_id` for multi-tenancy
- All tables have `created_at` (auto-set via `DEFAULT NOW()`)
- Most tables have `updated_at` (must be set manually on updates)
- Primary keys are `TEXT` (UUID strings)
- Status fields use `CHECK` constraints with `UPPER_SNAKE_CASE` values
- JSON stored as `TEXT` (not `JSONB`) — parsed in application layer

### API Conventions

- RESTful routes: `GET /api/resource`, `POST /api/resource`, `PATCH /api/resource/:id`
- Query parameters for filtering: `?status=`, `?search=`, `?trial_id=`
- All responses are JSON
- Errors return `{ error: "message" }` with appropriate HTTP status
- File uploads use `multer` with `memoryStorage()`
- 5-minute timeout for AI-related endpoints

### CSS Conventions

- Use CSS custom properties (variables) for all colors, not hardcoded values
- Theme-aware: define values under `[data-theme="dark"]` and `[data-theme="light"]`
- No CSS modules or CSS-in-JS — plain CSS files
- Component-specific styles use class prefixes (e.g., `.trial-detail-`, `.screening-case-`)

---

## Troubleshooting

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` on all requests | Expired or missing Clerk token | Clear `monsoon_clerk_token` from localStorage, re-login |
| `CORS error` in console | Dev server not proxying | Ensure `platform/vite.config.ts` proxy is pointing to `localhost:3001` |
| AI ingestion hangs | Ollama not running or wrong model | Run `ollama serve` and `ollama pull qwen3.5` |
| Protocol upload returns empty criteria | PDF text extraction failed | Check PDF is text-based (not scanned image). `pdf-parse` only handles text PDFs. |
| `relation "xyz" does not exist` | Missing migration | Run all migration files in `server/db/migrations/` in Supabase SQL Editor |
| User auto-provisioned to wrong site | Default behavior | New users are auto-assigned to `site-001`. Update in `middleware/auth.ts` if needed. |
| Email not sending | Missing Resend API key | Set `RESEND_API_KEY` in `server/.env` |
| Embeddings failing | Missing OpenAI key or pgvector not enabled | Set `OPENAI_API_KEY` and run `CREATE EXTENSION vector` in Supabase |

### Useful Debug Commands

```bash
# Check server health
curl http://localhost:3001/health

# Check Ollama status
curl http://localhost:3001/api/ai/health

# Test Ollama directly
curl http://localhost:11434/api/tags

# Check Supabase connection (from server logs)
# Watch for "Monsoon Health API running on http://localhost:3001" on startup
```

---

## Appendix: External Service URLs

| Service | Dashboard URL |
|---------|--------------|
| Supabase | [app.supabase.com](https://app.supabase.com) |
| Clerk | [dashboard.clerk.com](https://dashboard.clerk.com) |
| Vercel (marketing) | [vercel.com/dashboard](https://vercel.com/dashboard) |
| Resend | [resend.com/dashboard](https://resend.com/dashboard) |
| Anthropic Console | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI Platform | [platform.openai.com](https://platform.openai.com) |
