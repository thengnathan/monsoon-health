# Zephyr Dashboard — Complete Recreation Spec
**Platform:** Monsoon Health / Zephyr  
**Route:** `/`  
**Page title:** "Today"  
**Design language:** *Stormy Morning* (Darker variant)

This document is fully self-contained. Give it to any AI and it will recreate the dashboard pixel-accurately.

---

## 1. Tech Stack

- **React 18** + **TypeScript** + **React Router v6**
- **No Tailwind** — all styling via CSS custom properties in `index.css`
- **Font:** Space Grotesk from Google Fonts
- **Auth:** Clerk (already wrapped at the app level — dashboard assumes user is signed in)
- **API:** REST calls via a typed `api` helper (`api.getToday()`, `api.getUpcomingVisits()`)

---

## 2. Design Tokens (copy exactly into `:root` in `index.css`)

```css
:root {
  /* ── Surface Colors (Darker variant) ── */
  --surface-primary:   #08090e;   /* page root background */
  --surface-secondary: #0d0f16;   /* cards, sidebar */
  --surface-elevated:  #141824;   /* raised: modals, dropdowns */
  --surface-tertiary:  #111520;   /* hover states */
  --surface-overlay:   rgba(0, 0, 0, 0.65);

  /* ── Borders ── */
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong:  rgba(255, 255, 255, 0.18);
  --border-focus:   #5BB8D4;

  /* ── Text ── */
  --text-primary:   rgba(255, 255, 255, 0.87);
  --text-secondary: rgba(255, 255, 255, 0.60);
  --text-tertiary:  rgba(255, 255, 255, 0.38);
  --text-inverse:   #0f1117;

  /* ── Accent (teal) ── */
  --accent-sea-blue:        #5BB8D4;
  --accent-sea-blue-hover:  #6DC4DE;
  --accent-sea-blue-subtle: rgba(91, 184, 212, 0.12);

  /* ── Aliases (used in components) ── */
  --bg-root:           var(--surface-primary);
  --bg-surface:        var(--surface-secondary);
  --bg-surface-raised: var(--surface-elevated);
  --bg-surface-hover:  var(--surface-tertiary);
  --bg-overlay:        var(--surface-overlay);
  --border-subtle:     var(--border-default);
  --accent:            var(--accent-sea-blue);
  --accent-hover:      var(--accent-sea-blue-hover);
  --accent-muted:      var(--accent-sea-blue-subtle);
  --accent-subtle:     var(--accent-sea-blue-subtle);

  /* ── Status Colors ── */
  --status-new:       #7BA3D4;
  --status-in-review: #D4A95A;
  --status-pending:   #C9A04E;
  --status-eligible:  #5BB87A;
  --status-failed:    #D46B6B;
  --status-future:    #9B8EC4;
  --status-declined:  #7A8A96;
  --status-lost:      #7A8A96;
  --status-enrolled:  #88BDDF;

  /* ── Semantic ── */
  --error:   #D46B6B;
  --success: #5BB87A;
  --warning: #D4A95A;

  /* ── Spacing ── */
  --space-1:  0.25rem;
  --space-2:  0.50rem;
  --space-3:  0.75rem;
  --space-4:  1.00rem;
  --space-5:  1.25rem;
  --space-6:  1.50rem;
  --space-8:  2.00rem;
  --space-10: 2.50rem;
  --space-12: 3.00rem;

  /* ── Border Radius ── */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;
  --radius-full: 9999px;

  /* ── Typography ── */
  --font-xs:   0.875rem;   /* labels, meta */
  --font-sm:   1rem;       /* body text */
  --font-base: 1.125rem;   /* default */
  --font-md:   1.25rem;
  --font-lg:   1.375rem;
  --font-xl:   1.625rem;
  --font-2xl:  2rem;       /* stat values, H1 */
  --font-3xl:  2.625rem;

  --tracking-tight: -0.02em;

  /* ── Transitions ── */
  --transition-fast: 120ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.40);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.30);
  --shadow-lg: 0 8px 30px rgba(0, 0, 0, 0.40);
}
```

---

## 3. Global Body Styles

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-root);
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
```

---

## 4. App Shell Layout

The dashboard lives inside a sidebar + main content shell:

```
┌──────────────────────────────────────────────────────────┐
│  SIDEBAR (240px, fixed)     │  MAIN CONTENT              │
│                             │  margin-left: 240px        │
│  [Logo wordmark]            │  padding: 32px             │
│  ─────────────────────────  │  padding-right: 72px       │
│  NAVIGATION                 │                            │
│  ● Today           ← active │  [Dashboard content]       │
│  ○ Screening Cases          │                            │
│  ○ Patients                 │                            │
│  ○ Trials                   │                            │
│  ○ Intake Forms             │                            │
│  ○ Notes                    │                            │
│  ○ Settings                 │                            │
│  ─────────────────────────  │                            │
│  [Avatar] Nathan  MANAGER   │                            │
└──────────────────────────────────────────────────────────┘
```

```css
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-main {
  margin-left: 240px;
  padding: var(--space-8);
  padding-right: calc(var(--space-8) + 40px);
  min-height: 100vh;
}
```

---

## 5. Dashboard Page Structure

```
DashboardPage
├── .page-header
│   ├── h1  "Today"
│   └── p   "Your screening overview — [Day], [Month] [Date]"
│
├── .stats-grid   (5 stat cards)
│   ├── .stat-card  "Active Cases"    [accent color value]
│   ├── .stat-card  "Open Items"
│   ├── .stat-card  "Patients"
│   ├── .stat-card  "Active Trials"
│   └── .stat-card  "Enrolled"        [--status-enrolled color]
│
└── .detail-grid   (2-column: 1fr + 380px)
    ├── LEFT COLUMN
    │   ├── .detail-section  "Active Cases — Needs Attention"
    │   ├── .detail-section  "Pending Items Due"
    │   └── .detail-section  "Upcoming Visits (Next 7 days)"  [only if visits exist]
    │
    └── RIGHT COLUMN
        ├── .detail-section  "Revisit Due"
        └── .detail-section  "Recent Alerts"
```

---

## 6. Full CSS for Dashboard Components

### Page Header
```css
.page-header {
  margin-bottom: var(--space-8);
}
.page-header h1 {
  font-size: var(--font-2xl);
  font-weight: 600;
  letter-spacing: var(--tracking-tight);
  color: var(--text-primary);
}
.page-header p {
  color: var(--text-secondary);
  margin-top: var(--space-1);
  font-size: var(--font-base);
}
```

### Stats Grid
```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  transition: all var(--transition-base);
}
.stat-card:hover {
  border-color: var(--border-default);
  transform: translateY(-1px);
}

.stat-label {
  font-size: var(--font-xs);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: var(--space-2);
}

.stat-value {
  font-size: var(--font-2xl);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: var(--tracking-tight);
}
.stat-value.accent { color: var(--accent); }
```

### Detail Grid + Sections
```css
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: var(--space-6);
  align-items: start;
}

.detail-section {
  margin-bottom: var(--space-6);
}

.detail-section-title {
  font-size: var(--font-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}
```

### Alert Cards (used for every row item in all sections)
```css
.alert-card {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  transition: all var(--transition-base);
  cursor: pointer;
}
.alert-card:hover {
  border-color: var(--border-default);
  transform: translateX(2px);
}

/* Icon box — 36×36, rounded, emoji inside */
.alert-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 16px;
}
.alert-icon.revisit   { background: rgba(155, 142, 196, 0.12); color: var(--status-future); }
.alert-icon.threshold { background: rgba(91, 184, 122, 0.12);  color: var(--status-eligible); }
.alert-icon.pending   { background: rgba(212, 169, 90, 0.12);  color: var(--status-in-review); }

/* Content area — flex:1, truncates long text */
.alert-content { flex: 1; min-width: 0; }

.alert-title {
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.alert-meta {
  font-size: var(--font-xs);
  color: var(--text-tertiary);
}
```

### Pending Item Type Badge (right-aligned on card)
```css
.checklist-type {
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--accent-muted);
  color: var(--accent);
  align-self: center;
  flex-shrink: 0;
}
```

### Status Badges (inline in alert-meta text)
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.status-badge::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.status-badge.new             { background: rgba(123,163,212,0.12); color: var(--status-new); }
.status-badge.in-review       { background: rgba(212,169,90,0.12);  color: var(--status-in-review); }
.status-badge.pending-info    { background: rgba(201,160,78,0.12);  color: var(--status-pending); }
.status-badge.likely-eligible { background: rgba(91,184,122,0.12);  color: var(--status-eligible); }
.status-badge.screen-failed   { background: rgba(212,107,107,0.12); color: var(--status-failed); }
.status-badge.future-candidate{ background: rgba(155,142,196,0.12); color: var(--status-future); }
.status-badge.declined,
.status-badge.lost-to-followup{ background: rgba(122,138,150,0.12); color: var(--status-declined); }
.status-badge.enrolled        { background: rgba(136,189,223,0.12); color: var(--status-enrolled); }
```

### Empty States
```css
.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-8);
  color: var(--text-tertiary);
}
.empty-state-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-4);
  opacity: 0.4;
}
.empty-state h3 {
  font-size: var(--font-md);
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}
.empty-state p {
  font-size: var(--font-sm);
  max-width: 360px;
  margin: 0 auto;
}
```

### Animations
```css
/* Cards enter from below on mount */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-in { animation: fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.animate-in:nth-child(1) { animation-delay: 0ms; }
.animate-in:nth-child(2) { animation-delay: 50ms; }
.animate-in:nth-child(3) { animation-delay: 100ms; }
.animate-in:nth-child(4) { animation-delay: 150ms; }
.animate-in:nth-child(5) { animation-delay: 200ms; }

/* Loading spinner */
@keyframes spin { to { transform: rotate(360deg); } }
.spinner {
  width: 24px; height: 24px;
  border: 2px solid var(--border-default);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
.loading-spinner {
  display: flex; align-items: center; justify-content: center;
  min-height: 200px;
}
```

---

## 7. TypeScript Data Shapes

```typescript
// API responses
interface TodayData {
  stats: {
    total_active_cases: number;
    pending_items_open: number;
    total_patients: number;
    active_trials: number;
    cases_enrolled: number;
  };
  active_cases: ActiveCase[];
  pending_items_due: PendingItem[];
  revisit_due: RevisitCase[];
  recent_alerts: NotificationEvent[];
}

interface ActiveCase {
  id: string;
  first_name: string;
  last_name: string;
  trial_name: string;
  status: string;            // 'NEW' | 'IN_REVIEW' | 'PENDING_INFO' | 'LIKELY_ELIGIBLE' | 'SCREEN_FAILED' | 'ENROLLED' | 'FUTURE_CANDIDATE' | 'DECLINED'
  assigned_user_name: string | null;
}

interface PendingItem {
  id: string;
  name: string;
  type: string;              // e.g. 'TASK', 'LAB', 'DOCUMENT'
  due_date: string | null;   // YYYY-MM-DD
  first_name: string;
  last_name: string;
  trial_name: string;
  screening_case_id: string;
}

interface RevisitCase {
  id: string;
  first_name: string;
  last_name: string;
  trial_name: string;
  revisit_date: string;      // YYYY-MM-DD
  fail_reason_label: string | null;
}

interface NotificationEvent {
  id: string;
  type: 'THRESHOLD_CROSSED' | 'REVISIT_DUE' | 'PENDING_ITEM_COMPLETED' | 'VISIT_REMINDER';
  payload: Record<string, string>;  // { signal_label?, patient_name?, item_name?, visit_name? }
  first_name: string | null;
  last_name: string | null;
  trial_name: string | null;
  screening_case_id: string | null;
  created_at: string;        // ISO timestamp
}

interface UpcomingVisit {
  id: string;
  first_name: string;
  last_name: string;
  visit_name: string;
  trial_name: string;
  scheduled_date: string;    // YYYY-MM-DD
  screening_case_id: string;
}
```

---

## 8. Utility Functions

```typescript
// Format a date string for display
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Returns true if the date is in the past
export function isOverdue(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
}

// Returns the CSS class for a status badge based on the status string
export function statusClass(status: string): string {
  const map: Record<string, string> = {
    NEW: 'new',
    IN_REVIEW: 'in-review',
    PENDING_INFO: 'pending-info',
    LIKELY_ELIGIBLE: 'likely-eligible',
    SCREEN_FAILED: 'screen-failed',
    FUTURE_CANDIDATE: 'future-candidate',
    ENROLLED: 'enrolled',
    DECLINED: 'declined',
    LOST_TO_FOLLOWUP: 'lost-to-followup',
  };
  return map[status] ?? 'new';
}

// StatusBadge component
export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  return <span className={`status-badge ${statusClass(status)}`}>{label}</span>;
}
```

---

## 9. Complete DashboardPage Component

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { StatusBadge, formatDate, isOverdue } from '../utils';
import type { TodayData, UpcomingVisit, NotificationEvent } from '../types';

export default function DashboardPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [upcomingVisits, setUpcomingVisits] = useState<UpcomingVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.getToday(),
      api.getUpcomingVisits().catch(() => [] as UpcomingVisit[])
    ]).then(([todayData, visits]) => {
      setData(todayData);
      setUpcomingVisits(visits);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-spinner"><div className="spinner" /></div>
  );
  if (!data) return null;

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <h1>Today</h1>
        <p>Your screening overview — {new Date().toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric'
        })}</p>
      </div>

      {/* ── Stats Row ── */}
      <div className="stats-grid">
        <div className="stat-card animate-in">
          <div className="stat-label">Active Cases</div>
          <div className="stat-value accent">{data.stats.total_active_cases}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-label">Open Items</div>
          <div className="stat-value">{data.stats.pending_items_open}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-label">Patients</div>
          <div className="stat-value">{data.stats.total_patients}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-label">Active Trials</div>
          <div className="stat-value">{data.stats.active_trials}</div>
        </div>
        <div className="stat-card animate-in">
          <div className="stat-label">Enrolled</div>
          <div className="stat-value" style={{ color: 'var(--status-enrolled)' }}>
            {data.stats.cases_enrolled}
          </div>
        </div>
      </div>

      {/* ── Two-Column Detail Grid ── */}
      <div className="detail-grid">

        {/* ── LEFT COLUMN ── */}
        <div>
          {/* Active Cases */}
          <div className="detail-section animate-in">
            <div className="detail-section-title">Active Cases — Needs Attention</div>
            {data.active_cases.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✓</div>
                <h3>All caught up</h3>
                <p>No screening cases needing immediate attention.</p>
              </div>
            ) : (
              data.active_cases.map(sc => (
                <div
                  key={sc.id}
                  className="alert-card"
                  onClick={() => navigate(`/screening/${sc.id}`)}
                >
                  <div className="alert-content">
                    <div className="alert-title">{sc.first_name} {sc.last_name}</div>
                    <div className="alert-meta">
                      {sc.trial_name} · <StatusBadge status={sc.status} /> · {sc.assigned_user_name || 'Unassigned'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pending Items Due */}
          <div className="detail-section animate-in">
            <div className="detail-section-title">Pending Items Due</div>
            {data.pending_items_due.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p>No items due this week</p>
              </div>
            ) : (
              data.pending_items_due.map(pi => (
                <div
                  key={pi.id}
                  className="alert-card"
                  onClick={() => navigate(`/screening/${pi.screening_case_id}`)}
                >
                  <div className="alert-icon pending">📋</div>
                  <div className="alert-content">
                    <div className="alert-title">{pi.name}</div>
                    <div className="alert-meta">
                      {pi.first_name} {pi.last_name} · {pi.trial_name}
                      {pi.due_date && (
                        <span style={{ color: isOverdue(pi.due_date) ? 'var(--error)' : 'inherit' }}>
                          {' '}· Due {formatDate(pi.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="checklist-type">{pi.type}</span>
                </div>
              ))
            )}
          </div>

          {/* Upcoming Visits — only rendered if list is non-empty */}
          {upcomingVisits.length > 0 && (
            <div className="detail-section animate-in">
              <div className="detail-section-title">Upcoming Visits (Next 7 days)</div>
              {upcomingVisits.map(v => (
                <div
                  key={v.id}
                  className="alert-card"
                  onClick={() => navigate(`/screening/${v.screening_case_id}`)}
                >
                  <div className="alert-icon" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>📅</div>
                  <div className="alert-content">
                    <div className="alert-title">{v.first_name} {v.last_name} — {v.visit_name}</div>
                    <div className="alert-meta">{v.trial_name} · {formatDate(v.scheduled_date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div>
          {/* Revisit Due */}
          <div className="detail-section animate-in">
            <div className="detail-section-title">Revisit Due</div>
            {data.revisit_due.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p>No revisits due this week</p>
              </div>
            ) : (
              data.revisit_due.map(sc => (
                <div
                  key={sc.id}
                  className="alert-card"
                  onClick={() => navigate(`/screening/${sc.id}`)}
                >
                  <div className="alert-icon revisit">↻</div>
                  <div className="alert-content">
                    <div className="alert-title">{sc.first_name} {sc.last_name}</div>
                    <div className="alert-meta">
                      {sc.trial_name} · Revisit {formatDate(sc.revisit_date)}
                    </div>
                    {sc.fail_reason_label && (
                      <div className="alert-meta" style={{ marginTop: 2 }}>
                        Reason: {sc.fail_reason_label}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Alerts */}
          <div className="detail-section animate-in">
            <div className="detail-section-title">Recent Alerts</div>
            {data.recent_alerts.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p>No recent alerts</p>
              </div>
            ) : (
              data.recent_alerts.slice(0, 8).map((alert: NotificationEvent) => {
                const payload = typeof alert.payload === 'string'
                  ? JSON.parse(alert.payload) as Record<string, string>
                  : alert.payload as Record<string, string>;
                return (
                  <div
                    key={alert.id}
                    className="alert-card"
                    onClick={() => alert.screening_case_id && navigate(`/screening/${alert.screening_case_id}`)}
                    style={{ cursor: alert.screening_case_id ? 'pointer' : 'default' }}
                  >
                    <div className={`alert-icon ${
                      alert.type === 'THRESHOLD_CROSSED' ? 'threshold'
                      : alert.type === 'REVISIT_DUE' ? 'revisit'
                      : 'pending'
                    }`}>
                      {alert.type === 'THRESHOLD_CROSSED' ? '⚡'
                        : alert.type === 'REVISIT_DUE' ? '↻'
                        : alert.type === 'VISIT_REMINDER' ? '📅'
                        : '✓'}
                    </div>
                    <div className="alert-content">
                      <div className="alert-title">
                        {alert.type === 'THRESHOLD_CROSSED' && `Signal match: ${payload.signal_label || payload.signal_type}`}
                        {alert.type === 'REVISIT_DUE' && `Revisit due: ${payload.patient_name}`}
                        {alert.type === 'PENDING_ITEM_COMPLETED' && `Item completed: ${payload.item_name}`}
                        {alert.type === 'VISIT_REMINDER' && `Visit reminder: ${payload.patient_name} — ${payload.visit_name}`}
                      </div>
                      <div className="alert-meta">
                        {alert.first_name && `${alert.first_name} ${alert.last_name}`}
                        {alert.trial_name && ` · ${alert.trial_name}`}
                        {' · '}{formatDate(alert.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 10. API Endpoints Required

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/api/` | `TodayData` |
| `GET` | `/api/upcoming-visits` | `UpcomingVisit[]` — visits scheduled within next 7 days, status `SCHEDULED` |

---

## 11. Section-by-Section Visual Description

### Page Header
- H1 "Today" — `--font-2xl` (2rem), weight 600, `--text-primary`, tight tracking
- Subtitle — `--font-base`, `--text-secondary`, today's full date: e.g. "Your screening overview — Wednesday, June 10"
- Bottom margin: 32px before stats row

### Stats Row
- 5 cards in a responsive auto-fit grid, each `min 180px`
- Cards: dark surface (`--bg-surface`), subtle border, `--radius-lg`, padding 20px
- Label: 11px uppercase, spaced, `--text-tertiary`
- Value: 2rem bold, `--text-primary` (except Active Cases = `--accent` teal, Enrolled = `--status-enrolled` teal)
- Hover: `translateY(-1px)`, border brightens
- Each card has `animate-in` class for stagger entrance

### Left Column — Active Cases
- Section title: 1rem uppercase bold, `--text-tertiary`, bottom border
- Each case = alert-card (no icon box — content starts directly)
  - Title: patient full name, `--font-sm` weight 500
  - Meta: "Trial Name · [StatusBadge] · Assigned Name or 'Unassigned'"
  - Click navigates to `/screening/:id`
- Empty state: checkmark icon, "All caught up", "No screening cases needing immediate attention."

### Left Column — Pending Items Due
- Each item = alert-card with:
  - Icon: 📋 in `.alert-icon.pending` (amber wash background)
  - Title: item name
  - Meta: "First Last · Trial Name · Due [date]" — due date turns red (`--error`) if overdue
  - Right: `.checklist-type` badge showing item type (TASK, LAB, etc.) in accent teal pill
- Empty state: "No items due this week"

### Left Column — Upcoming Visits (conditional — only shown if data exists)
- Each visit = alert-card with:
  - Icon: 📅 in accent-muted background, accent color
  - Title: "First Last — Visit Name"
  - Meta: "Trial Name · [formatted date]"

### Right Column — Revisit Due
- Each case = alert-card with:
  - Icon: ↻ text in `.alert-icon.revisit` (purple wash)
  - Title: patient name
  - Meta: "Trial Name · Revisit [date]"
  - Optional second meta line: "Reason: [fail_reason_label]"
- Empty state: "No revisits due this week"

### Right Column — Recent Alerts (max 8 shown)
- Each alert = alert-card
- Icon varies by type:
  - `THRESHOLD_CROSSED` → ⚡ in `.threshold` (green wash)
  - `REVISIT_DUE` → ↻ in `.revisit` (purple wash)
  - `VISIT_REMINDER` or other → 📅 or ✓ in `.pending` (amber wash)
- Title varies by type:
  - `THRESHOLD_CROSSED` → "Signal match: [signal_label]"
  - `REVISIT_DUE` → "Revisit due: [patient_name]"
  - `PENDING_ITEM_COMPLETED` → "Item completed: [item_name]"
  - `VISIT_REMINDER` → "Visit reminder: [patient_name] — [visit_name]"
- Meta: "First Last · Trial Name · [date]"
- Non-clickable if `screening_case_id` is null

---

## 12. Recreation Checklist

- [ ] Space Grotesk loaded from Google Fonts
- [ ] All CSS variables defined on `:root` with the darker surface values
- [ ] Body background is `var(--bg-root)` = `#08090e`
- [ ] Sidebar is `position: fixed`, 240px, `var(--bg-surface)` background
- [ ] Main content has `margin-left: 240px`, padding `32px`
- [ ] Stats grid uses `repeat(auto-fit, minmax(180px, 1fr))`
- [ ] "Active Cases" stat value uses `--accent` (teal)
- [ ] "Enrolled" stat value uses `--status-enrolled`
- [ ] Detail grid is `1fr 380px`, `align-items: start`
- [ ] All alert cards animate with `translateX(2px)` on hover
- [ ] All sections have `animate-in` class with stagger delays
- [ ] Status badges have dot prefix via `::before` pseudo-element
- [ ] Pending item type badge is accent-colored pill (`.checklist-type`)
- [ ] Overdue pending items show date in `--error` red
- [ ] Upcoming Visits section only renders when `upcomingVisits.length > 0`
- [ ] Recent Alerts capped at 8 (`slice(0, 8)`)
- [ ] Empty states have icon + h3 + p structure
