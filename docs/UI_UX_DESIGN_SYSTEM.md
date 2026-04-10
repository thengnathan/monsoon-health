# Monsoon Health — Zephyr Platform: UI/UX Design System
**Version:** 1.0 | **Last Updated:** April 2026

This document is a complete, self-contained specification of the Monsoon Health / Zephyr platform's visual design language. It is detailed enough to fully replicate the UI from scratch on any codebase.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing & Layout Grid](#4-spacing--layout-grid)
5. [Border Radius & Shadows](#5-border-radius--shadows)
6. [Transitions & Animations](#6-transitions--animations)
7. [Application Shell & Navigation](#7-application-shell--navigation)
8. [Authentication Pages](#8-authentication-pages)
9. [Component Library](#9-component-library)
10. [Page-by-Page Specifications](#10-page-by-page-specifications)
11. [Theme Toggle System](#11-theme-toggle-system)
12. [Clerk Auth UI Integration](#12-clerk-auth-ui-integration)
13. [Responsive Behavior](#13-responsive-behavior)
14. [Marketing / Landing Page Vision](#14-marketing--landing-page-vision)
15. [Implementation Checklist](#15-implementation-checklist)

---

## 1. Design Philosophy

### Brand Identity
**Platform Name:** Zephyr by Monsoon Health  
**Tagline:** Screening Management for Clinical Research Teams  
**Design Language Name:** *Stormy Morning*

### Core Aesthetic Principles

| Principle | Description |
|-----------|-------------|
| **Stormy Morning** | The entire palette is drawn from a pre-dawn Pacific coastline — deep navy skies, mist-grey surfaces, single streak of pale teal light on the horizon. Nothing warm, nothing loud. |
| **Clinical Precision** | Typography is tight and purposeful. Every label is uppercase small-caps. Every number is larger than its context. Data density is a feature, not a problem. |
| **Minimal Chrome** | Navigation is a fixed sidebar with a logo, a short icon+label nav list, and a user pill at the bottom. There is no top bar, no breadcrumb, no secondary navigation. |
| **Single Accent** | One accent color only: teal (`#88BDDF` dark / `#4A7FA8` light). Used exclusively on interactive elements, active states, and data highlights. Never used decoratively. |
| **Layered Depth** | Three elevation levels: root background → surface (cards) → raised surface (modals/popovers). Each level is defined by a slightly lighter background and a more visible border. |
| **Motion with Purpose** | Animations communicate hierarchy and intent — page fades in, items slide up staggered, modals spring open. Nothing loops or plays unprompted. |

---

## 2. Color System

### Implementation
All colors are implemented as CSS custom properties on `:root` and overridden per-theme with `[data-theme="light"]`. JavaScript sets `document.documentElement.setAttribute('data-theme', theme)` on load and on toggle.

### 2.1 Dark Theme (Default)

#### Backgrounds
```css
--bg-root:            #1a2530;   /* Page background — darkest layer */
--bg-surface:         #212f3b;   /* Cards, sidebar, panels */
--bg-surface-raised:  #283846;   /* Elevated: modals, dropdowns */
--bg-surface-hover:   #2f4050;   /* Hover states on surfaces */
--bg-overlay:         rgba(10, 16, 22, 0.6); /* Modal backdrop */
```

#### Borders
```css
--border-subtle:   rgba(106, 137, 167, 0.10); /* Hairline dividers */
--border-default:  rgba(106, 137, 167, 0.18); /* Standard card borders */
--border-strong:   rgba(106, 137, 167, 0.30); /* Emphasized borders */
```

#### Text
```css
--text-primary:    #e4edf5;  /* Body copy, headings */
--text-secondary:  #9ab0c4;  /* Labels, secondary info */
--text-tertiary:   #6A89A7;  /* Placeholders, hints, captions */
--text-inverse:    #1a2530;  /* Text on light/accent backgrounds */
```

#### Accent (Teal)
```css
--accent:          #88BDDF;                    /* Primary interactive */
--accent-hover:    #BDDDFC;                    /* Hover — lighter teal */
--accent-muted:    rgba(136, 189, 223, 0.12);  /* Background wash */
--accent-subtle:   rgba(136, 189, 223, 0.06);  /* Very faint wash */
```

#### Status Colors
```css
--status-new:       #7BA3D4;  /* New / unreviewed */
--status-in-review: #D4A95A;  /* In review (amber) */
--status-pending:   #C9A04E;  /* Pending information */
--status-eligible:  #5BB87A;  /* Likely eligible (green) */
--status-failed:    #D46B6B;  /* Screen failed (red) */
--status-future:    #9B8EC4;  /* Future candidate (purple) */
--status-declined:  #7A8A96;  /* Declined / lost (grey) */
--status-lost:      #7A8A96;
--status-enrolled:  #88BDDF;  /* Enrolled (teal = success) */
```

#### Semantic
```css
--success:  #5BB87A;
--warning:  #D4A95A;
--error:    #D46B6B;
--info:     #7BA3D4;
```

#### Shadows
```css
--shadow-sm:   0 1px 2px rgba(10, 16, 22, 0.40);
--shadow-md:   0 4px 12px rgba(10, 16, 22, 0.30);
--shadow-lg:   0 8px 30px rgba(10, 16, 22, 0.40);
--shadow-glow: 0 0 20px rgba(136, 189, 223, 0.10);  /* Accent halo */
```

---

### 2.2 Light Theme

Applied via `[data-theme="light"]` attribute on `<html>`.

#### Backgrounds
```css
--bg-root:            #EDF3F8;
--bg-surface:         #ffffff;
--bg-surface-raised:  #ffffff;
--bg-surface-hover:   #E1EBF3;
--bg-overlay:         rgba(56, 73, 89, 0.30);
```

#### Borders
```css
--border-subtle:   rgba(56, 73, 89, 0.08);
--border-default:  rgba(56, 73, 89, 0.14);
--border-strong:   rgba(56, 73, 89, 0.22);
```

#### Text
```css
--text-primary:    #1a2530;
--text-secondary:  #4A6275;
--text-tertiary:   #7A95A9;
--text-inverse:    #ffffff;
```

#### Accent (Darker Teal for Contrast)
```css
--accent:          #4A7FA8;
--accent-hover:    #384959;
--accent-muted:    rgba(106, 137, 167, 0.10);
--accent-subtle:   rgba(106, 137, 167, 0.05);
```

#### Status Colors (Light)
```css
--status-new:       #4A7FA8;
--status-in-review: #B8912E;
--status-pending:   #A88428;
--status-eligible:  #3A8F55;
--status-failed:    #C04848;
--status-future:    #7A6BAD;
--status-declined:  #6B7B87;
--status-lost:      #6B7B87;
--status-enrolled:  #4A7FA8;
```

#### Shadows (Light)
```css
--shadow-sm:   0 1px 3px rgba(56, 73, 89, 0.08);
--shadow-md:   0 4px 12px rgba(56, 73, 89, 0.06);
--shadow-lg:   0 8px 30px rgba(56, 73, 89, 0.10);
--shadow-glow: 0 0 20px rgba(106, 137, 167, 0.08);
```

---

### 2.3 Raw Color Reference (No CSS Variables)

For use in inline styles and Clerk/third-party appearance configs:

| Purpose | Dark Hex | Light Hex |
|---------|----------|-----------|
| Page BG | `#1a2530` | `#EDF3F8` |
| Surface | `#212f3b` | `#ffffff` |
| Elevated | `#283846` | `#ffffff` |
| Auth page BG | `#0a141e` | — |
| Auth card BG | `rgba(26,37,48,0.65)` | `#ffffff` |
| Accent | `#88BDDF` | `#4A7FA8` |
| Accent hover | `#BDDDFC` | `#384959` |
| Text primary | `#e4edf5` | `#1a2530` |
| Text secondary | `#9ab0c4` | `#4A6275` |
| Text tertiary | `#6A89A7` | `#7A95A9` |
| Success | `#5BB87A` | `#3A8F55` |
| Warning | `#D4A95A` | `#B8912E` |
| Error | `#D46B6B` | `#C04848` |

---

## 3. Typography

### Font Stack
```css
font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
```
Space Grotesk is loaded from Google Fonts. It is a geometric sans-serif with a technical, slightly compressed feel — chosen for its readability at small sizes and its modern clinical personality.

### Font Size Scale
```css
--font-xs:   0.6875rem;  /* 11px — uppercase labels, meta, captions */
--font-sm:   0.8125rem;  /* 13px — body text in tables/cards */
--font-base: 0.875rem;   /* 14px — default body, inputs */
--font-md:   1rem;       /* 16px — emphasized body */
--font-lg:   1.125rem;   /* 18px — card titles, modal headers */
--font-xl:   1.375rem;   /* 22px — page section headings */
--font-2xl:  1.75rem;    /* 28px — page H1 titles */
--font-3xl:  2.25rem;    /* 36px — hero/landing display text */
```

### Line Height
```css
--leading-tight:   1.25;  /* Headings */
--leading-normal:  1.50;  /* Body copy */
--leading-relaxed: 1.65;  /* Long-form text, notes */
```

### Letter Spacing
```css
--tracking-tight:  -0.02em;  /* H1/H2 headings */
--tracking-normal: -0.01em;  /* Subheadings */
```

### Typographic Patterns

| Element | Size | Weight | Case | Color | Spacing |
|---------|------|--------|------|-------|---------|
| Page H1 | `--font-2xl` | 600 | Normal | `--text-primary` | `--tracking-tight` |
| Section title | `--font-sm` | 600 | UPPERCASE | `--text-tertiary` | 0.06em |
| Card title | `--font-base` | 600 | Normal | `--text-primary` | — |
| Table header | `--font-xs` | 600 | UPPERCASE | `--text-tertiary` | 0.05em |
| Table cell | `--font-base` | 400 | Normal | `--text-primary` | — |
| Body / label | `--font-sm` | 500 | Normal | `--text-secondary` | — |
| Caption / meta | `--font-xs` | 400 | Normal | `--text-tertiary` | — |
| Stat value | `--font-2xl` | 700 | Normal | `--text-primary` | `--tracking-tight` |
| Stat label | `--font-xs` | 500 | UPPERCASE | `--text-tertiary` | 0.05em |
| Button | `--font-sm` | 500 | Normal | varies | — |

---

## 4. Spacing & Layout Grid

### Spacing Scale
```css
--space-1:  0.25rem;  /*  4px */
--space-2:  0.50rem;  /*  8px */
--space-3:  0.75rem;  /* 12px */
--space-4:  1.00rem;  /* 16px */
--space-5:  1.25rem;  /* 20px */
--space-6:  1.50rem;  /* 24px */
--space-8:  2.00rem;  /* 32px */
--space-10: 2.50rem;  /* 40px */
--space-12: 3.00rem;  /* 48px */
--space-16: 4.00rem;  /* 64px */
```

### App Shell Layout
```
┌─────────────────────────────────────────────────┐
│  SIDEBAR (240px fixed)  │  MAIN CONTENT          │
│                         │  margin-left: 240px    │
│  Logo                   │  padding: 32px         │
│  ─────────────────────  │  padding-right: 72px   │
│  Nav items              │                        │
│                         │  [Page content here]   │
│  ─────────────────────  │                        │
│  User pill (bottom)     │                        │
└─────────────────────────────────────────────────┘
```

```css
--sidebar-width: 240px;

.app-layout {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: var(--sidebar-width);
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.app-main {
  margin-left: var(--sidebar-width);
  padding: var(--space-8);
  padding-right: calc(var(--space-8) + 40px); /* room for theme toggle */
  min-height: 100vh;
}
```

### Content Layout Patterns

**Detail Page (2-column):**
```css
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: var(--space-6);
  align-items: start;
}
```

**Stats Row:**
```css
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}
```

**Form Row (2 equal columns):**
```css
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
```

**Notes Masonry:**
```css
.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-4);
}
```

---

## 5. Border Radius & Shadows

### Border Radius
```css
--radius-sm:   6px;     /* Tags, small buttons, checkboxes */
--radius-md:   10px;    /* Inputs, standard cards */
--radius-lg:   14px;    /* Primary cards, sidebar links */
--radius-xl:   20px;    /* Modals, auth cards */
--radius-full: 9999px;  /* Pills, avatar circles, filter chips */
```

### Elevation Model

Three-tier elevation system — never mix levels arbitrarily:

| Level | Background | Border | Shadow | Used For |
|-------|-----------|--------|--------|----------|
| 0 — Root | `--bg-root` | none | none | Page background |
| 1 — Surface | `--bg-surface` | `--border-subtle` | `--shadow-sm` | Cards, sidebar, table rows |
| 2 — Raised | `--bg-surface-raised` | `--border-default` | `--shadow-md` | Modals, dropdowns, note popup |
| 3 — Overlay | `rgba(26,37,48,0.65)` + blur | `--border-default` | `--shadow-lg` | Auth cards, floating elements |

---

## 6. Transitions & Animations

### Timing Variables
```css
--transition-fast: 120ms ease;
--transition-base: 200ms ease;
--transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Keyframe Animations

**Page transition (every route change):**
```css
@keyframes page-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.page-transition {
  animation: page-fade-in 0.35s ease both;
}
```

**List items / cards entering view:**
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-in { animation: fadeInUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both; }

/* Stagger children */
.animate-in:nth-child(1) { animation-delay: 0ms; }
.animate-in:nth-child(2) { animation-delay: 50ms; }
.animate-in:nth-child(3) { animation-delay: 100ms; }
.animate-in:nth-child(4) { animation-delay: 150ms; }
.animate-in:nth-child(5) { animation-delay: 200ms; }
```

**Modal entrance:**
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Modal uses: animation: slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1) */
```

**Criteria reveal (screening case detail):**
```css
@keyframes criterionReveal {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
.criterion-reveal { animation: criterionReveal 300ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```

**Visit slide-in (patient timeline):**
```css
@keyframes visitSlideIn {
  from { opacity: 0; transform: translateX(16px) scale(0.97); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
.visit-slide-in { animation: visitSlideIn 350ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```

**Rule items (signal alignment):**
```css
@keyframes ruleFadeIn {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.rule-fade-in { animation: ruleFadeIn 280ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```

**Skeleton loading:**
```css
@keyframes skeleton-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    var(--bg-surface) 25%,
    var(--bg-surface-hover) 50%,
    var(--bg-surface) 75%
  );
  background-size: 800px 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
```

**Loading spinner:**
```css
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

## 7. Application Shell & Navigation

### Sidebar Structure
```
┌─────────────────────────┐
│  [Logo SVG wordmark]    │  ← sidebar-brand (padding: 24px 12px)
│  Zephyr — Screening Mgmt│    subtitle: 13px, --text-tertiary
├─────────────────────────┤
│  NAVIGATION             │  ← section-label: 11px uppercase, --text-tertiary
│                         │
│  ◉  Today               │  ← sidebar-link (active)
│  ◎  Screening Cases     │
│  ◇  Patients            │
│  △  Trials              │
│  ◫  Intake Forms        │
│  ☰  Notes               │
│  ⚙  Settings            │
│                         │
├─────────────────────────┤
│  [Avatar] Nathan Theng  │  ← sidebar-user (Clerk UserButton + name)
│           MANAGER       │
└─────────────────────────┘
```

### Sidebar CSS
```css
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  position: fixed;
  top: 0; left: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-brand {
  padding: var(--space-6) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
}
.sidebar-brand-wordmark { width: 100%; height: auto; transform: scale(1.1); }
.sidebar-brand span {
  font-size: var(--font-sm);
  color: var(--text-tertiary);
  display: block;
  margin-top: var(--space-2);
}

.sidebar-nav {
  flex: 1;
  padding: var(--space-3);
  overflow-y: auto;
}

.sidebar-section-label {
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-tertiary);
  padding: var(--space-3) var(--space-3) var(--space-2);
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-base);
  font-weight: 450;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.sidebar-link:hover {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}
.sidebar-link.active {
  background: var(--accent-muted);
  color: var(--accent);
}

.sidebar-footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
}
.sidebar-user-name {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.sidebar-user-role {
  font-size: var(--font-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

### Theme Toggle (Top-Right)
A small vertical pill fixed to the top-right of the main content area. Two icon buttons (sun/moon) stacked vertically.

```css
.theme-toggle-container {
  position: fixed;
  top: var(--space-8);
  right: var(--space-5);
  z-index: 200;
}
.theme-toggle-mini {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  padding: 3px;
  cursor: pointer;
  transition: all 0.2s;
}
.theme-toggle-mini:hover {
  border-color: var(--accent);
  box-shadow: 0 0 8px rgba(136, 189, 223, 0.2);
}
.theme-icon {
  color: var(--text-tertiary);
  opacity: 0.3;
  transition: all 0.25s;
}
.theme-icon.active {
  color: var(--accent);
  opacity: 1;
  filter: drop-shadow(0 0 3px var(--accent));
}
```

---

## 8. Authentication Pages

### AuthLayout Component
`AuthLayout.tsx` wraps both `/login/*` and `/sign-up/*` routes with a single `WaveBackground` instance. This is critical — without it, the background remounts and flashes on every Clerk multi-step transition (email verify → phone verify → continue).

```tsx
// AuthLayout.tsx
import { Outlet } from 'react-router-dom';
import WaveBackground from './WaveBackground';

export default function AuthLayout() {
  return (
    <div className="login-page">
      <WaveBackground backgroundColor="#0a141e" strokeColor="rgba(136,189,223,0.25)" />
      <div style={{ position: 'relative', zIndex: 10 }}>
        <Outlet />
      </div>
    </div>
  );
}
```

**Route structure in App.tsx:**
```tsx
<Route element={<AuthLayout />}>
  <Route path="/login/*" element={<LoginPage />} />
  <Route path="/sign-up/*" element={<SignUpPage />} />
</Route>
```

### Login & Sign-Up Pages
Both pages render only the Clerk component directly — no wrapper divs. The `AuthLayout` provides the full-page background and centering.

```css
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
```

### Clerk Card Appearance (Auth Pages)
```javascript
appearance: {
  elements: {
    rootBox: { width: '100%', maxWidth: 440 },
    card: {
      backgroundColor: 'rgba(26, 37, 48, 0.65)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      border: '1px solid rgba(106, 137, 167, 0.12)',
      boxShadow: '0 32px 80px rgba(0, 0, 0, 0.35)',
      borderRadius: '20px',
    },
  },
}
```

### WaveBackground Component
Interactive SVG-based animated background using simplex noise.

- **Library:** `simplex-noise`
- **Technique:** Generates a grid of vertical paths using Perlin noise + mouse cursor influence
- **Config:** `backgroundColor="#0a141e"`, `strokeColor="rgba(136,189,223,0.25)"`, `pointerSize=0.5`
- **Grid:** Lines every 8px horizontal, points every 8px vertical
- **Animation:** `requestAnimationFrame` loop — waves move slowly via noise, cursor creates local disturbance within ~175px radius
- **A pointer dot** (0.5rem circle, same stroke color) follows the cursor using `transform: translate3d(calc(var(--x) - 50%), calc(var(--y) - 50%), 0)` and CSS custom properties `--x` / `--y` updated on `mousemove`

---

## 9. Component Library

### 9.1 Buttons

```css
/* Base */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  line-height: var(--leading-tight);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Variants */
.btn-primary {
  background: var(--accent);
  color: var(--text-inverse);
  border-color: var(--accent);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  box-shadow: var(--shadow-glow);
}

.btn-secondary {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border-default);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-1) var(--space-2);
  border-color: transparent;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-surface-hover);
  color: var(--text-primary);
}

.btn-danger {
  background: transparent;
  color: var(--error);
  border-color: rgba(212, 107, 107, 0.3);
}
.btn-danger:hover:not(:disabled) {
  background: rgba(212, 107, 107, 0.1);
}

/* Sizes */
.btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--font-xs); }
.btn-lg { padding: var(--space-3) var(--space-6); font-size: var(--font-base); }
```

---

### 9.2 Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  transition: border-color var(--transition-base);
}
.card:hover { border-color: var(--border-default); }

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.card-title { font-size: var(--font-base); font-weight: 600; color: var(--text-primary); }
.card-subtitle { font-size: var(--font-sm); color: var(--text-tertiary); }
```

**Stat Card:**
```css
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

---

### 9.3 Status Badges

Used throughout for screening case status, signal match level, etc.

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
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.status-badge.new            { background: rgba(123,163,212,0.12); color: var(--status-new); }
.status-badge.in-review      { background: rgba(212,169,90,0.12);  color: var(--status-in-review); }
.status-badge.pending-info   { background: rgba(201,160,78,0.12);  color: var(--status-pending); }
.status-badge.likely-eligible{ background: rgba(91,184,122,0.12);  color: var(--status-eligible); }
.status-badge.screen-failed  { background: rgba(212,107,107,0.12); color: var(--status-failed); }
.status-badge.future-candidate{ background: rgba(155,142,196,0.12); color: var(--status-future); }
.status-badge.declined,
.status-badge.lost-to-followup{ background: rgba(122,138,150,0.12); color: var(--status-declined); }
.status-badge.enrolled        { background: rgba(136,189,223,0.12); color: var(--status-enrolled); }
```

---

### 9.4 Forms

```css
.form-group { margin-bottom: var(--space-5); }

.form-label {
  display: block;
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-root);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--font-base);
  font-family: inherit;
  transition: border-color var(--transition-fast);
  outline: none;
}
.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-muted);
}
.form-input::placeholder { color: var(--text-tertiary); }

/* Select arrow */
.form-select {
  appearance: none;
  background-image: url("data:image/svg+xml,..."); /* chevron-down SVG */
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.form-textarea { min-height: 80px; resize: vertical; }
.form-error { color: var(--error); font-size: var(--font-xs); margin-top: var(--space-1); }
.form-hint { color: var(--text-tertiary); font-size: var(--font-xs); margin-top: var(--space-1); }
```

---

### 9.5 Modals

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn 150ms ease;
}

.modal {
  background: var(--bg-surface-raised);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  max-width: 560px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 200ms cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}
.modal-title { font-size: var(--font-lg); font-weight: 600; color: var(--text-primary); }
.modal-close {
  background: none; border: none;
  color: var(--text-tertiary); cursor: pointer;
  padding: var(--space-1); border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.modal-close:hover { color: var(--text-primary); background: var(--bg-surface-hover); }

.modal-actions {
  display: flex; gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-6);
}
```

---

### 9.6 Tables

```css
.data-table { width: 100%; border-collapse: collapse; }

.data-table th {
  text-align: left;
  font-size: var(--font-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.data-table td {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-base);
  border-bottom: 1px solid var(--border-subtle);
  vertical-align: middle;
}

.data-table tbody tr {
  transition: background var(--transition-fast);
  cursor: pointer;
}
.data-table tbody tr:hover { background: var(--bg-surface-hover); }
.data-table .table-meta { font-size: var(--font-xs); color: var(--text-tertiary); }
```

---

### 9.7 Search Bar

```css
.search-bar { position: relative; margin-bottom: var(--space-6); }

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  padding-left: 44px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-base);
  outline: none;
  transition: all var(--transition-fast);
}
.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.search-icon {
  position: absolute;
  left: 14px; top: 50%;
  transform: translateY(-50%);
  width: 18px; height: 18px;
  color: var(--text-tertiary);
  pointer-events: none;
}
```

---

### 9.8 Tabs

```css
.tabs {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
}

.tab-btn {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-sm); font-weight: 500;
  color: var(--text-tertiary);
  background: none; border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: -1px;
}
.tab-btn:hover { color: var(--text-primary); }
.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
```

---

### 9.9 Filter Pills

```css
.filter-pill {
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  font-size: var(--font-sm); font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  background: transparent;
  transition: all var(--transition-fast);
}
.filter-pill:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}
.filter-pill.active {
  background: var(--accent-muted);
  border-color: var(--accent);
  color: var(--accent);
}
```

---

### 9.10 Toast Notifications

```css
.toast-container {
  position: fixed;
  bottom: var(--space-6); right: var(--space-6);
  z-index: 2000;
  display: flex; flex-direction: column; gap: var(--space-2);
}

.toast {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-md);
  font-size: var(--font-sm); font-weight: 500;
  animation: slideUp 200ms ease;
  box-shadow: var(--shadow-md);
  max-width: 400px;
}
.toast.success { background: #1a3a2a; color: var(--success); border: 1px solid rgba(91,184,122,0.2); }
.toast.error   { background: #3a1a1a; color: var(--error);   border: 1px solid rgba(212,107,107,0.2); }
.toast.info    { background: #1a2a3a; color: var(--info);    border: 1px solid rgba(123,163,212,0.2); }
```

---

### 9.11 Alert Cards (Dashboard)

Informational alert cards used in the Dashboard for patient alerts, thresholds, and revisits.

```css
.alert-card {
  display: flex; gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  transition: all var(--transition-base);
}
.alert-card:hover {
  border-color: var(--border-default);
  transform: translateX(2px);
}

.alert-icon {
  width: 36px; height: 36px;
  border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 16px;
}
.alert-icon.revisit   { background: rgba(155,142,196,0.12); color: var(--status-future); }
.alert-icon.threshold { background: rgba(91,184,122,0.12);  color: var(--status-eligible); }
.alert-icon.pending   { background: rgba(212,169,90,0.12);  color: var(--status-in-review); }

.alert-title { font-size: var(--font-sm); font-weight: 500; color: var(--text-primary); margin-bottom: 2px; }
.alert-meta  { font-size: var(--font-xs); color: var(--text-tertiary); }
```

---

### 9.12 Signal Timeline

Used in PatientDetailPage to show chronological signal data.

```css
.signal-timeline { position: relative; }

.signal-item {
  display: flex; gap: var(--space-4);
  padding: var(--space-3) 0;
  position: relative;
}
.signal-item::before {
  content: '';
  position: absolute;
  left: 15px; top: 36px; bottom: -12px;
  width: 1px;
  background: var(--border-subtle);
}
.signal-item:last-child::before { display: none; }

.signal-dot {
  width: 32px; height: 32px;
  border-radius: var(--radius-full);
  background: var(--accent-muted);
  border: 2px solid var(--accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 12px;
}

.signal-label { font-size: var(--font-sm); font-weight: 500; color: var(--text-primary); }
.signal-value { font-size: var(--font-lg); font-weight: 700; color: var(--accent); margin: 2px 0; }
.signal-meta  { font-size: var(--font-xs); color: var(--text-tertiary); }
```

---

### 9.13 Notes (Floating Popup)

Notes are draggable floating popups that persist across page navigation using a shared outlet context. They support 6 color variants and a title + body.

```css
.note-popup {
  position: fixed;
  z-index: 1000;
  width: 480px; max-width: 90vw;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  box-shadow: 0 24px 64px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05);
  display: flex; flex-direction: column;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.note-popup-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  cursor: grab;
}
.note-popup-header:active { cursor: grabbing; }
```

**Note color variants** (background/border pair):
1. Default: `var(--bg-surface)` / `var(--border-default)`
2. Blue: `rgba(136,189,223,0.08)` / `rgba(136,189,223,0.2)`
3. Green: `rgba(46,204,113,0.08)` / `rgba(46,204,113,0.2)`
4. Amber: `rgba(241,196,15,0.08)` / `rgba(241,196,15,0.2)`
5. Rose: `rgba(231,76,60,0.08)` / `rgba(231,76,60,0.2)`
6. Purple: `rgba(155,89,182,0.08)` / `rgba(155,89,182,0.2)`

---

### 9.14 Empty States

```css
.empty-state {
  text-align: center;
  padding: var(--space-12) var(--space-8);
  color: var(--text-tertiary);
}
.empty-state-icon { font-size: 2.5rem; margin-bottom: var(--space-4); opacity: 0.4; }
.empty-state h3   { font-size: var(--font-md); font-weight: 500; color: var(--text-secondary); margin-bottom: var(--space-2); }
.empty-state p    { font-size: var(--font-sm); max-width: 360px; margin: 0 auto; }
```

---

### 9.15 Detail Page Structure

Consistent structure used across PatientDetailPage, TrialDetailPage, ScreeningCaseDetailPage.

```css
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-8);
}
.detail-header-info h1 {
  font-size: var(--font-2xl); font-weight: 600;
  letter-spacing: var(--tracking-tight);
}
.detail-header-meta {
  display: flex; align-items: center; gap: var(--space-4);
  margin-top: var(--space-2);
  color: var(--text-secondary); font-size: var(--font-sm);
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: var(--space-6);
  align-items: start;
}

.detail-section { margin-bottom: var(--space-6); }
.detail-section-title {
  font-size: var(--font-sm); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}
```

---

## 10. Page-by-Page Specifications

### 10.1 Dashboard (Today)
**Route:** `/`

**Layout:** Full-width, no sidebar second column

**Sections:**
1. **Header** — H1: "Today", subtitle with today's date
2. **Stats Row** — 4 stat cards: Active Screening Cases / Upcoming Visits Today / Pending Items / Patients Enrolled
3. **Two-column grid** (1fr + 380px):
   - Left: "Screening Alerts" card with alert-card list (revisit / threshold / pending type icons)
   - Right: "Upcoming Visits" card with checklist-style visit list

**Key behaviors:**
- Stats are fetched from `/api/dashboard/stats`
- Alerts from `/api/dashboard/alerts`
- Upcoming visits from `/api/patients/upcoming-visits`
- All cards have `animate-in` stagger on mount

---

### 10.2 Patients Page
**Route:** `/patients`

**Layout:** Full-width list

**Sections:**
1. **Header** — H1: "Patients", Add Patient button (primary, top right)
2. **Search bar** — full-width, searches name/MRN/DOB
3. **Patients table** — columns: Name + MRN, DOB, Sex, Status, Site, Actions

**Add Patient Modal:**
- Fields: First Name, Last Name, MRN, DOB, Sex (select), Site
- Two-column form rows for name fields
- Primary CTA: "Add Patient"

**Key behaviors:**
- Click any row → navigates to `/patients/:id`
- Status badge on each patient row
- Empty state when no patients or no search results

---

### 10.3 Patient Detail Page
**Route:** `/patients/:id`

**Layout:** `detail-header` → 3-tab system → tabbed content

**Tabs:** Clinical Profile | Trial Matches | Documents

**Tab: Clinical Profile**
- Two-column detail grid (1fr + 380px)
- Left column sections (gated by `patient_profile_config.enabled_options`):
  - Signals (signal timeline component)
  - Labs (key-value grid)
  - Vitals
  - Imaging
  - Diagnoses
  - Medications
  - Lifestyle
  - Surgical History
  - Family History
- Right column:
  - Patient info card (DOB, sex, MRN, site)
  - Pending items checklist

**Tab: Trial Matches**
- Match History section: table of past match runs (trial name, date, score, eligible criteria count, failed criteria count)
- Signal-Rule Alignment Preview: per-trial expansion showing which rules pass/fail against current signals (instant, no AI — uses SQL LATERAL join)
- "Match Now" button: triggers `POST /api/patients/:id/match`, streams result, animates new row appearing at top of match history

**Tab: Documents**
- Uploaded document cards with upload date, file type icon, extracted signals summary
- Upload button → file picker → POST to `/api/patients/:id/documents`
- Extraction Review Modal: shows raw extracted structured data from the document in a formatted JSON view with section headings

**Section visibility gating:**
```typescript
// SiteConfigContext provides:
isSectionVisible(section: string): boolean
isOptionEnabled(optionId: string): boolean
// Falls back to true if no config is set (show everything)
```

---

### 10.4 Trials Page
**Route:** `/trials`

**Layout:** Full-width list

**Sections:**
1. Header — H1: "Trials", Add Trial button
2. Trials table — columns: Name, Sponsor, Phase, Status, Signal Rules, Created

**Add Trial Modal:**
- Fields: Trial Name, Sponsor, Phase (select), Status (select), Description

---

### 10.5 Trial Detail Page
**Route:** `/trials/:id`

**Layout:** `detail-header` → two-section layout

**Sections:**
1. **Trial Info** — Name, sponsor, phase, status, description
2. **Signal Rules** — Table of rules: Signal Type, Operator, Value(s), Required/Optional
   - Add Rule button → inline rule builder modal
3. **Protocol Upload** — Upload PDF → triggers AI extraction pipeline
   - After upload: shows extracted signals in a review panel
   - Protocol viewer: rendered rich text of the protocol document

---

### 10.6 Screening Cases Page
**Route:** `/screening`

**Layout:** Full-width with filter chips + table

**Filter Chips:** All | New | In Review | Pending Info | Likely Eligible | Screen Failed | Future Candidate | Enrolled | Declined

**Table columns:** Patient, Trial, Status, Assigned To, Last Updated, Actions

---

### 10.7 Screening Case Detail Page
**Route:** `/screening/:id`

**Layout:** `detail-header` → `detail-grid` (1fr + 380px)

**Left column:**
- Status update controls (inline status dropdown + save)
- Eligibility Criteria breakdown — per-criterion cards with pass/fail/unknown state
  - Each criterion has: label, operator, required value, patient's actual value, status dot
  - Animated in with `criterionReveal` on load
- Notes/comments thread

**Right column:**
- Patient info summary card
- Trial info summary card
- Pending items for this case
- Visit schedule

---

### 10.8 Intake Form Page
**Route:** `/intake?site=<site_id>` (public, no auth)

**Layout:** Full-page form, no sidebar

**Background:** Solid `--bg-root` color, no wave background

**Form sections (multi-step or single scroll):**
1. About You — name, DOB, biological sex, gender identity, phone, email, language, race/ethnicity, height, weight
2. Medical History — conditions (checkboxes), surgical history, family history
3. Liver Health — FibroScan, biopsy, liver procedures, symptoms, hepatologist
4. Medications — GLP-1 meds, diabetes meds, liver/cholesterol meds, blood thinners, other meds (name + dose pairs)
5. Insurance & Availability
6. Consent

**Key behavior:**
- `?site=` param required — shows "Invalid Link" error state if missing
- Submits to `POST /api/intake/submit?site=<site_id>`
- Success state: confirmation message with next steps

---

### 10.9 Intake Submissions Page
**Route:** `/intake-submissions`

**Layout:** Header with intake link copy + submissions table

**Header area:**
- "Intake Forms" H1
- Subtitle: "Patient intake forms submitted via your intake link"
- "Copy Intake Link" button — copies `window.location.origin + /intake?site=` + user's `site_id` to clipboard
- Displays the full link URL below the button

**Submissions table columns:** Patient Name, Email, Submitted At, Status (new/reviewed), Actions (View / Convert to Patient)

---

### 10.10 Notes Page
**Route:** `/notes`

**Layout:** Full-width masonry grid

**Sections:**
1. Header — H1: "Notes", New Note button
2. Notes grid — `repeat(auto-fill, minmax(240px, 1fr))` of note cards

**Note cards:**
- Background tinted by color variant
- Title (bold), body preview (4 lines clamped), timestamp
- Click → opens floating Note Popup
- Popup is draggable, persists across navigation via outlet context

---

### 10.11 Settings Page
**Route:** `/settings`

**Layout:** Single column, max-width 860px

**Section 1 — Clinical Specialties:**
- Card-style buttons for each specialty (HEPATOLOGY, ONCOLOGY, HEMATOLOGY)
- Each card: colored dot + specialty name (bold) + description text
- Selected state: colored border + faint background wash
- Only clickable for MANAGER role

**Section 2 — Patient Profile Fields** (only shown if ≥1 specialty selected):
- Specialty tab bar (underline style, color per specialty)
- Tab count badge: `(enabled / total)`
- Options grid: `repeat(auto-fill, minmax(240px, 1fr))`
- Grouped by section with uppercase section header
- Checkboxes with `accentColor` = specialty color
- Select All / Clear All buttons (top right of options area)

**Specialty colors:**
```javascript
HEPATOLOGY: '#4a90c4'
ONCOLOGY:   '#c4744a'
HEMATOLOGY: '#7a4ac4'
```

**Save Changes button** — top right of page header (primary, disabled during save)

---

## 11. Theme Toggle System

### Implementation
- Theme state stored in `localStorage` key `monsoon_theme`
- Default: `'dark'`
- On change: `document.documentElement.setAttribute('data-theme', theme)`
- Context: `ThemeContext` from `App.tsx`, accessed via `useTheme()`
- Toggle function: `toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark')`

### Visual
Fixed top-right pill with two SVG icons (sun top, moon bottom). Active icon glows with accent color. Inactive icon is dimmed to opacity 0.3.

---

## 12. Clerk Auth UI Integration

### Full Appearance Config
This is passed to `<ClerkProvider appearance={...}>` and updates reactively when theme toggles.

**Dark theme variables:**
```javascript
variables: {
  colorPrimary: '#88BDDF',
  colorTextOnPrimaryBackground: '#e4edf5',
  colorBackground: '#1e2d3a',
  colorInputBackground: 'rgba(20, 30, 40, 0.6)',
  colorInputText: '#e4edf5',
  colorText: '#e4edf5',
  colorTextSecondary: '#9ab0c4',
  colorDanger: '#e74c3c',
  borderRadius: '10px',
  fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
}
```

**Key element overrides (dark):**
```javascript
elements: {
  card: {
    backgroundColor: 'rgba(26, 37, 48, 0.95)',
    backdropFilter: 'blur(40px)',
    border: '1px solid rgba(106, 137, 167, 0.15)',
    boxShadow: '0 32px 80px rgba(0, 0, 0, 0.35)',
  },
  formButtonPrimary: {
    background: 'linear-gradient(135deg, #6A89A7, #384959)',
    color: '#ffffff',
  },
  userButtonPopoverCard: {
    backgroundColor: '#1e2d3a',
    border: '1px solid rgba(106, 137, 167, 0.2)',
  },
  userButtonPopoverFooter: { display: 'none' },  // hide Clerk branding
  pageScrollBox: { backgroundColor: '#1e2d3a', borderRadius: '16px', overflow: 'hidden' },
  modalContent: { backgroundColor: '#1e2d3a', borderRadius: '16px', overflow: 'hidden' },
}
```

---

## 13. Responsive Behavior

### Breakpoints

**≤ 1024px (Tablet / Small Laptop):**
```css
.detail-grid  { grid-template-columns: 1fr; }
.form-row     { grid-template-columns: 1fr; }
```

**≤ 768px (Mobile):**
```css
.sidebar     { display: none; }
.app-main    { margin-left: 0; padding: var(--space-4); }
.stats-grid  { grid-template-columns: repeat(2, 1fr); }
```

> Note: Mobile is not a primary target for this platform. The application is designed for desktop CRC workstations. Mobile breakpoints exist to prevent complete breakage on smaller screens.

---

## 14. Marketing / Landing Page Vision

The marketing/landing page does not yet exist in the codebase. This section defines the intended design.

### URL
`https://monsoonhealth.com` (or `/landing` in dev)

### Design Language
Same *Stormy Morning* system — but more expressive. The platform UI uses it conservatively for clinical precision; the landing page can use full-bleed backgrounds, large type, and motion more freely.

### Sections

**1. Hero**
- Full-viewport height
- Background: `WaveBackground` (same component as auth pages) — `backgroundColor: "#0a141e"`, `strokeColor: "rgba(136,189,223,0.2)"`
- Centered layout, vertically centered content
- Logo / wordmark SVG (white)
- H1: ~56–64px, font-weight 700, letter-spacing -0.03em
  - Example: *"Clinical trial screening,\nbuilt for the team doing the work."*
- Subheading: ~18–20px, `--text-secondary` equivalent
- Two CTAs: "Request Access" (primary pill button) + "See How It Works" (ghost)
- Subtle fade-in animation (600ms, staggered 150ms per element)

**2. Feature Highlights** (3-column)
- Background: `#111a22` (slightly lighter than hero)
- 3 cards, each:
  - Icon (SVG, teal, ~32px)
  - Feature name (16px, 600 weight)
  - 2-sentence description (14px, secondary text)
  - Border: 1px solid rgba(136,189,223,0.08)
  - Hover: border brightens to rgba(136,189,223,0.2), translateY(-2px)
- Features to highlight: AI-Powered Protocol Extraction / Smart Patient Matching / Unified Screening Workflow

**3. How It Works** (numbered steps)
- Background: `#0d1720`
- 3 horizontal steps with connector line
- Step number: large (48px), teal, low opacity as background element
- Step title + description
- Right-side: mockup screenshot of the platform (blurred/frosted glass treatment)

**4. Social Proof / Credibility**
- Quote from a CRC or PI
- Institution logos (desaturated white)

**5. CTA Banner**
- Full-width, background: `linear-gradient(135deg, rgba(136,189,223,0.1), rgba(56,73,89,0.2))`
- Border top + bottom: 1px solid rgba(136,189,223,0.1)
- Large H2 + single CTA button

**6. Footer**
- Background: `#0a141e`
- Logo, nav links, copyright
- 1px top border: rgba(136,189,223,0.08)

### Landing Page Typography Scale
```
Hero H1:       56–64px, weight 700, tracking -0.03em
Hero subtitle: 18–20px, weight 400
Section H2:    36–40px, weight 600, tracking -0.02em
Card title:    16–18px, weight 600
Body:          14–16px, weight 400
Caption:       13px, weight 400
```

---

## 15. Implementation Checklist

Use this to verify a faithful implementation:

### Design Tokens
- [ ] All CSS variables defined on `:root`
- [ ] `[data-theme="light"]` overrides all variables
- [ ] Space Grotesk loaded from Google Fonts
- [ ] `data-theme` set on `<html>` on page load from `localStorage`

### Layout
- [ ] Sidebar is `position: fixed`, 240px wide, full height
- [ ] Main content has `margin-left: 240px`
- [ ] Theme toggle is `position: fixed` top-right
- [ ] Detail pages use `1fr 380px` two-column grid

### Auth
- [ ] `AuthLayout` wraps both `/login/*` and `/sign-up/*`
- [ ] `WaveBackground` is NOT inside `LoginPage` or `SignUpPage` — only in `AuthLayout`
- [ ] Clerk card appearance matches spec above
- [ ] Auth page background is `#0a141e`, stroke `rgba(136,189,223,0.25)`

### Components
- [ ] Status badges use the correct per-status background + text color
- [ ] All buttons have `transition: all var(--transition-fast)` hover states
- [ ] Tables have pointer cursor on `tbody tr`
- [ ] Modals use `backdropFilter: blur(4px)` on overlay
- [ ] Toast notifications are fixed bottom-right
- [ ] Empty states have icon + heading + paragraph

### Animation
- [ ] Page routes wrapped in `<PageWrapper>` applying `page-transition` class
- [ ] List items stagger with `animate-in` + nth-child delays
- [ ] Modals animate with `slideUp`
- [ ] Skeleton shimmer on loading states

### Accessibility
- [ ] All interactive elements have visible focus states
- [ ] Status badge colors meet 4.5:1 contrast on their background
- [ ] Form labels are associated with inputs via `htmlFor`/`id`
- [ ] Modal closes on Escape key

---

*End of UI/UX Design System Document*
