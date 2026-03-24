# Monsoon Health

> Clinical trial screening and patient lifecycle management platform for research sites, CROs, and sponsors.

---

## What is Monsoon Health?

Monsoon Health is a full-stack web application that helps Clinical Research Coordinators (CRCs) manage the entire patient screening workflow for clinical trials — from referral through enrollment. It replaces disconnected spreadsheets and manual processes with a unified, real-time tracker.

**Key capabilities:**
- Track patients across multiple clinical trials simultaneously
- Manage screening case status from NEW → ENROLLED (or fail/decline/future)
- Record and monitor clinical signals (FibroScan, labs, vitals) with threshold-based alerts
- Manage pending items (labs, imaging, consults) with due dates
- Schedule and track patient visits
- Upload and store trial protocols and patient documents
- Personal notes workspace for coordinators
- Real-time dashboard with today's active cases, pending items, and alerts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, React Router 6 |
| Styling | Vanilla CSS with CSS custom properties |
| Auth | Clerk |
| Backend | Node.js, Express 4, TypeScript |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Background Jobs | node-cron |

---

## Prerequisites

Make sure you have the following installed:

- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (comes with Node)
- A **Supabase** account — [supabase.com](https://supabase.com)
- A **Clerk** account — [clerk.com](https://clerk.com)

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/thengnathan/monsoon-health.git
cd monsoon-health
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Paste and run the contents of `server/db/schema.sql` — this creates all 18 tables
4. Paste and run the contents of `server/db/seed.sql` — this seeds the initial site, signal types, and screen fail reasons
5. From your Supabase project settings, copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **Service Role Key** (under API → Project API keys)
   - **Database URL** (under Settings → Database → Connection string → URI)

### 3. Set up Clerk

1. Create a new application at [clerk.com](https://clerk.com)
2. From your Clerk dashboard, copy:
   - **Publishable Key** (starts with `pk_test_...`)
   - **Secret Key** (starts with `sk_test_...`)

### 4. Configure environment variables

**Server** — create `server/.env`:
```env
CLERK_SECRET_KEY=sk_test_your_key_here
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres
```

**Client** — create `client/.env`:
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

### 5. Install dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

---

## Running Locally

You need two terminals running simultaneously.

**Terminal 1 — Start the backend:**
```bash
cd server
npm run dev
```
The API server starts at `http://localhost:3001`

**Terminal 2 — Start the frontend:**
```bash
cd client
npm run dev
```
The app opens at `http://localhost:5173`

> The Vite dev server automatically proxies all `/api` requests to `localhost:3001`.

---

## First Login

1. Navigate to `http://localhost:5173/landing`
2. Click **Sign In** or go to `/login`
3. Sign in with Clerk — your user account is automatically provisioned in the database on first login with the `CRC` role
4. You'll land on the **Today** dashboard

---

## Project Structure

```
monsoon-health/
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # All page components
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── api.ts   # API client
│   │   └── index.css / landing.css
│   └── public/
│       └── images/  # Hero video and images
│
├── server/          # Express backend
│   ├── src/
│   │   ├── routes/  # API route handlers
│   │   ├── middleware/
│   │   └── services/
│   └── db/
│       ├── schema.sql  # Database schema
│       └── seed.sql    # Initial seed data
│
└── PROJECT_DOCUMENTATION.md  # Full technical reference
```

---

## Available Scripts

### Server
| Command | Description |
|---------|-------------|
| `npm run dev` | Start server in development mode with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |

### Client
| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |

---

## Pages

| URL | Description | Auth |
|-----|-------------|------|
| `/landing` | Public landing page | No |
| `/about` | Company and team page | No |
| `/login` | Sign in | No |
| `/` | Today dashboard | Yes |
| `/patients` | Patient list | Yes |
| `/patients/:id` | Patient detail | Yes |
| `/trials` | Trial list | Yes |
| `/trials/:id` | Trial detail | Yes |
| `/screening` | Screening cases | Yes |
| `/screening/:id` | Screening case detail | Yes |
| `/notes` | Personal notes | Yes |

---

## For more details

See [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) for the full technical reference including database schema, API endpoints, architecture decisions, and how to extend the app.
