# Monsoon Health — Design System Reference

This document defines the design system for Monsoon Health's Zephyr and Rainfall dashboards. It draws from a reverse-engineering of Notion's UX/UI and maps every pattern to Monsoon's Stormy Morning brand identity. Use this as the single source of truth when reviewing components, layouts, colors, spacing, and theme behavior across the codebase.

---

## 1. Notion UX/UI Audit — What We're Borrowing and Why

### 1.1 Color Philosophy

Notion restricts users to 10 accent colors. Ivan Zhao (Notion CEO) is known for obsessive control over the palette. The restriction keeps every workspace calm and prevents visual chaos. Monsoon follows the same discipline: one primary accent (sea-blue), one secondary accent (storm-cyan), and status colors. No other hues enter the system.

Notion avoids pure black and pure white everywhere. Light mode default text is `#37352F` (warm near-black). Dark mode default text is `rgba(255,255,255,0.9)` (off-white). Dark mode background is `#191919` (deep charcoal, not `#000000`). Light mode sidebar is `#F7F6F3` (warm parchment, not `#FFFFFF`).

Every accent color has separate hex values for light and dark mode. Text colors brighten in dark mode. Background colors deepen. Icon colors shift to more saturated variants. There are over 60 unique color values across all Notion color applications.

Notion's dark mode was updated from a legacy gray (`#2F3437`) to a near-black (`#191919`). Community feedback noted the new version was too high-contrast for daytime. Notion declined to keep both, citing code complexity. Lesson: pick one dark mode surface and commit. Do not maintain two dark themes.

**Monsoon application:** Our `#0f1117` base is darker than Notion's `#191919`. This is acceptable for a clinical tool used in controlled environments. The critical rule is that text must never be pure `#FFFFFF` against this surface. Use `rgba(255,255,255,0.87)` for primary text, `rgba(255,255,255,0.6)` for secondary, `rgba(255,255,255,0.38)` for tertiary/disabled.

### 1.2 Typography System

Notion uses a system font stack: SF Pro (macOS), Segoe UI (Windows), and standard sans-serif fallbacks. The interface renders natively on every OS. This reduces cognitive friction.

Notion offers three page-level font modes: Default (system sans-serif), Serif (Georgia-style), and Mono (monospace). These are page-level toggles, not inline controls.

Type hierarchy relies on weight and color, not size variation:
- Medium weight (500) for sidebar and body text
- Line heights tuned for scan-readability
- Warm grays for secondary text
- Color alone separates primary from supporting text

Notion includes a "Small text" toggle that shrinks all body text uniformly, giving power users density control without breaking the type scale.

**Monsoon application:** Space Grotesk stays for headings, brand moments, and the sidebar. For data-dense views (patient tables, protocol parsing output, screening forms), fall back to the system font stack to reduce fatigue during long sessions. Clinicians will spend hours in these views.

### 1.3 Spacing and Grid

Notion's layout runs on an 8px base grid. Every measurement snaps to multiples of 8.

Key measurements from reverse-engineering:
- Sidebar width: 224px (fixed)
- Navigation section height: 131px (four items: Search, AI, Home, Inbox)
- Favorites section height: 30px
- Section gap: 6px
- Search bar height: 30px
- Icon container: 22px × 22px
- Corner radius on clickable items: 8px
- Internal padding: consistent on all four sides of every element

The content area defaults to a centered column (~700-900px) with generous lateral margins. A "Full width" toggle removes margins for data-heavy views.

**Monsoon application:** Use 248px sidebar width (slightly wider than Notion for longer trial names). Follow the 8px grid for all spacing. Offer a compact/full-width toggle for patient tables. Keep 6px gaps between sidebar sections. Use spacing for section separation, not visible dividers.

### 1.4 Interaction Design

Click targets in Notion extend well beyond the visible icon or text. The entire sidebar row is the hit target. The hit area includes the full width with 8px rounded corners on hover.

Hover states:
- Light mode: background shifts to subtle warm gray
- Dark mode: background shifts from `#191919` to `#3F4448`
- Transitions are instantaneous (no fade delay)

Feedback is immediate on every interaction. No perceived input delay.

**Monsoon application:** Signal rule cards and patient intake forms need click targets that extend beyond the visible card edge. Hover states shift background fill, not border or shadow. Use accent color at low opacity (8-12%) for hover fills. Keep transitions under 100ms for non-theme interactions.

### 1.5 Sidebar Architecture

Notion's sidebar follows strict top-to-bottom hierarchy:
1. Workspace name (anchor/identity)
2. Search (primary utility)
3. AI (secondary utility)
4. Home (navigation)
5. Inbox (notifications)
6. Favorites (user-curated shortcuts)
7. Private pages (user content)
8. Shared pages (team content)

Visual separation uses spacing gaps (6px), not visible dividers. No horizontal rules or borders between sections.

**Monsoon application:** Zephyr sidebar order should be: site identity (trial name, site code), tools (search, filters), then content (protocols, patients, screening queue). Separate with spacing, not lines. If stronger grouping is needed, use subtle background tint shifts.

### 1.6 Content-First Design

Notion's core principle: the interface disappears when you're working.
- Progressive disclosure: controls appear only on hover or focus
- Minimal persistent chrome: top bar shows breadcrumbs and a few icons
- Centered content column optimized for scan speed
- Cover images and icons create page identity without structural complexity

**Monsoon application:** Resist cramming every action into persistent toolbars. Keep protocol views focused on protocol content. Tuck screening actions, status filters, and batch operations behind contextual menus or hover-triggered toolbars.

### 1.7 Component Patterns

**Callout blocks:** tinted background with left-aligned icon. Light mode uses pale accent (e.g. `#DDEBF1` for blue). Dark mode uses deep tone (e.g. `#364954`). Use this for signal rule cards: eligibility criteria, exclusion alerts, protocol warnings.

**Toggle sections:** expand/collapse with small (12px) left-aligned arrow, 90° rotation on expand, indented content. Use for protocol sections (inclusion criteria, dosing schedules, visit windows).

**Database views:** Table, Board, Calendar, List, Gallery, Timeline. Same data, different views, no context loss. Consider whether patient screening data should support table view (batch review), board view (status tracking: screened → eligible → enrolled), list view (quick scan).

### 1.8 Theme Transition Behavior

Notion's theme swap is instant. No fade, no crossfade. The class flips and all colors change in a single frame. The perceived smoothness comes from the fact that color pairs are close in luminance (warm grays, not black-to-white), so the shift does not feel jarring.

Three appearance options: System, Light, Dark. "System" follows the OS setting. Keyboard shortcut: `Cmd/Ctrl + Shift + L`. Transition between modes is instantaneous.

Monsoon supports both approaches:
- Instant swap (Notion-style): set `defaultSmooth={false}` in ThemeProvider
- Smooth crossfade (200ms ease-out): set `defaultSmooth={true}` in ThemeProvider

The smooth transition injects a stylesheet that adds `transition: background-color 200ms ease-out, color 200ms ease-out` to all elements. 200ms is the perceptual sweet spot. Longer feels sluggish. Shorter looks instant.

### 1.9 What Makes Notion Feel Like Notion

1. **Warm neutrals.** Grays lean warm (browns/taupes, not blue-grays). Light sidebar is `#F7F6F3`, closer to parchment than steel.
2. **Deliberate emptiness.** Pages start blank. No placeholder widgets or suggested actions.
3. **Emoji as identity.** Page icons default to emoji for personality without design effort.
4. **Invisible tooling.** Slash command (`/`) replaces visible toolbars.
5. **Consistent restraint.** No gradients. No shadows beyond subtle card lifts. No decorative borders. Flat, warm, quiet.

Monsoon does not copy the warm-taupe personality. Our Stormy Morning system is cool, oceanic, clinical. But the structural lessons apply: spacing over borders, progressive disclosure over persistent toolbars, typography weight and color for hierarchy, data as the loudest element.

---

## 2. Design Tokens

All colors, spacing, borders, shadows, and radii are defined as CSS custom properties. The ThemeProvider (section 4) swaps these at runtime based on the active theme.

### 2.1 Light Mode Tokens

```
--surface-primary:          #FFFFFF          /* main content background */
--surface-secondary:        #F5F6F7          /* sidebar, cards (cool off-white) */
--surface-tertiary:         #EBEDF0          /* hover fills, nested cards */
--surface-elevated:         #FFFFFF          /* modals, dropdowns */
--surface-overlay:          rgba(0,0,0,0.04) /* scrim behind modals */

--text-primary:             #1A1D23          /* warm near-black */
--text-secondary:           #5F6672          /* labels, captions */
--text-tertiary:            #9CA3AF          /* placeholders, disabled */
--text-inverse:             #FFFFFF          /* text on filled buttons */

--border-default:           #E5E7EB          /* subtle dividers */
--border-strong:            #D1D5DB          /* input outlines */
--border-focus:             #4A90B8          /* focus rings (sea-blue) */

--accent-sea-blue:          #3B7A9E          /* primary actions (muted for light) */
--accent-sea-blue-hover:    #326B8A
--accent-sea-blue-subtle:   rgba(59,122,158,0.08)
--accent-storm-cyan:        #5BA4B5          /* secondary highlights */
--accent-storm-cyan-subtle: rgba(91,164,181,0.08)

--status-success:           #0D7C5F
--status-success-bg:        #ECFDF5
--status-warning:           #B45309
--status-warning-bg:        #FFFBEB
--status-error:             #DC2626
--status-error-bg:          #FEF2F2
--status-info:              #2563EB
--status-info-bg:           #EFF6FF

--shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
--shadow-md:  0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.06)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.05)
```

### 2.2 Dark Mode Tokens

```
--surface-primary:          #0f1117          /* Stormy Morning charcoal */
--surface-secondary:        #161922          /* sidebar, slightly lifted */
--surface-tertiary:         #1e2230          /* hover fills, nested cards */
--surface-elevated:         #232836          /* modals, dropdowns */
--surface-overlay:          rgba(0,0,0,0.5)

--text-primary:             rgba(255,255,255,0.87)   /* NEVER pure white */
--text-secondary:           rgba(255,255,255,0.6)
--text-tertiary:            rgba(255,255,255,0.38)
--text-inverse:             #0f1117

--border-default:           rgba(255,255,255,0.08)
--border-strong:            rgba(255,255,255,0.14)
--border-focus:             #5BB8D4

--accent-sea-blue:          #5BB8D4          /* primary actions (bright for dark) */
--accent-sea-blue-hover:    #6DC4DE
--accent-sea-blue-subtle:   rgba(91,184,212,0.12)
--accent-storm-cyan:        #7DD3E8
--accent-storm-cyan-subtle: rgba(125,211,232,0.10)

--status-success:           #34D399
--status-success-bg:        rgba(52,211,153,0.10)
--status-warning:           #FBBF24
--status-warning-bg:        rgba(251,191,36,0.10)
--status-error:             #F87171
--status-error-bg:          rgba(248,113,113,0.10)
--status-info:              #60A5FA
--status-info-bg:           rgba(96,165,250,0.10)

--shadow-sm:  0 1px 2px rgba(0,0,0,0.3)
--shadow-md:  0 4px 6px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.2)
--shadow-lg:  0 10px 15px rgba(0,0,0,0.3), 0 4px 6px rgba(0,0,0,0.2)
```

### 2.3 Shared Tokens (same in both modes)

```
--radius-sm:      4px
--radius-md:      6px
--radius-lg:      8px
--sidebar-width:  248px
--focus-ring:     0 0 0 2px var(--surface-primary), 0 0 0 4px var(--border-focus)

--font-sans:  'Space Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
--font-mono:  'JetBrains Mono', 'SF Mono', 'Fira Code', monospace

--text-xs:    11px
--text-sm:    13px
--text-base:  14px
--text-md:    15px
--text-lg:    17px
--text-xl:    20px
--text-2xl:   24px
--text-3xl:   30px

--leading-tight:    1.25
--leading-normal:   1.5
--leading-relaxed:  1.625

/* 8px grid spacing scale */
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
```

---

## 3. Notion Reference Color Tables

For direct comparison when auditing our palette against Notion's.

### 3.1 Notion Light Mode

| Color   | Text Hex  | Background Hex | CSS Variable (text)     |
|---------|-----------|----------------|-------------------------|
| Default | #37352F   | #FFFFFF        | --color-text-default    |
| Gray    | #9B9A97   | #EBECED        | --color-text-gray       |
| Brown   | #64473A   | #E9E5E3        | --color-text-brown      |
| Orange  | #D9730D   | #FAEBDD        | --color-text-orange     |
| Yellow  | #DFAB01   | #FBF3DB        | --color-text-yellow     |
| Green   | #0F7B6C   | #DDEDEA        | --color-text-green      |
| Blue    | #0B6E99   | #DDEBF1        | --color-text-blue       |
| Purple  | #6940A5   | #EAE4F2        | --color-text-purple     |
| Pink    | #AD1A72   | #F4DFEB        | --color-text-pink       |
| Red     | #E03E3E   | #FBE4E4        | --color-text-red        |

### 3.2 Notion Dark Mode

| Color   | Text Hex             | Background Hex | CSS Variable (text)     |
|---------|----------------------|----------------|-------------------------|
| Default | rgba(255,255,255,0.9)| #2F3437        | --color-text-default    |
| Gray    | rgba(151,154,155,0.95)| #454B4E       | --color-text-gray       |
| Brown   | #937264              | #434040        | --color-text-brown      |
| Orange  | #FFA344              | #594A3A        | --color-text-orange     |
| Yellow  | #FFDC49              | #59563B        | --color-text-yellow     |
| Green   | #4DAB9A              | #354C4B        | --color-text-green      |
| Blue    | #529CCA              | #364954        | --color-text-blue       |
| Purple  | #9A6DD7              | #443F57        | --color-text-purple     |
| Pink    | #E255A1              | #533B4C        | --color-text-pink       |
| Red     | #FF7369              | #594141        | --color-text-red        |

### 3.3 Notion Interface Surfaces

| Element           | Light Mode | Dark Mode (legacy) | Dark Mode (current) |
|-------------------|------------|--------------------|---------------------|
| Main content      | #FFFFFF    | #2F3437            | #191919             |
| Sidebar           | #F7F6F3    | #373C3F            | —                   |
| Hover items       | #FFFFFF    | #3F4448            | —                   |

---

## 4. React Theme Provider

Complete drop-in provider for Zephyr and Rainfall. Handles mode switching, token application, keyboard shortcuts, smooth transitions, and persistence.

### 4.1 Provider Implementation

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  smoothTransition: boolean;
  setSmoothTransition: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "monsoon-theme-mode";
const SMOOTH_KEY = "monsoon-theme-smooth";

// -----------------------------------------------------------
// Token Definitions
// -----------------------------------------------------------

const lightTokens: Record<string, string> = {
  "--surface-primary": "#FFFFFF",
  "--surface-secondary": "#F5F6F7",
  "--surface-tertiary": "#EBEDF0",
  "--surface-elevated": "#FFFFFF",
  "--surface-overlay": "rgba(0, 0, 0, 0.04)",
  "--text-primary": "#1A1D23",
  "--text-secondary": "#5F6672",
  "--text-tertiary": "#9CA3AF",
  "--text-inverse": "#FFFFFF",
  "--border-default": "#E5E7EB",
  "--border-strong": "#D1D5DB",
  "--border-focus": "#4A90B8",
  "--accent-sea-blue": "#3B7A9E",
  "--accent-sea-blue-hover": "#326B8A",
  "--accent-sea-blue-subtle": "rgba(59, 122, 158, 0.08)",
  "--accent-storm-cyan": "#5BA4B5",
  "--accent-storm-cyan-subtle": "rgba(91, 164, 181, 0.08)",
  "--status-success": "#0D7C5F",
  "--status-success-bg": "#ECFDF5",
  "--status-warning": "#B45309",
  "--status-warning-bg": "#FFFBEB",
  "--status-error": "#DC2626",
  "--status-error-bg": "#FEF2F2",
  "--status-info": "#2563EB",
  "--status-info-bg": "#EFF6FF",
  "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
  "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.06)",
  "--shadow-lg": "0 10px 15px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.05)",
};

const darkTokens: Record<string, string> = {
  "--surface-primary": "#0f1117",
  "--surface-secondary": "#161922",
  "--surface-tertiary": "#1e2230",
  "--surface-elevated": "#232836",
  "--surface-overlay": "rgba(0, 0, 0, 0.5)",
  "--text-primary": "rgba(255, 255, 255, 0.87)",
  "--text-secondary": "rgba(255, 255, 255, 0.6)",
  "--text-tertiary": "rgba(255, 255, 255, 0.38)",
  "--text-inverse": "#0f1117",
  "--border-default": "rgba(255, 255, 255, 0.08)",
  "--border-strong": "rgba(255, 255, 255, 0.14)",
  "--border-focus": "#5BB8D4",
  "--accent-sea-blue": "#5BB8D4",
  "--accent-sea-blue-hover": "#6DC4DE",
  "--accent-sea-blue-subtle": "rgba(91, 184, 212, 0.12)",
  "--accent-storm-cyan": "#7DD3E8",
  "--accent-storm-cyan-subtle": "rgba(125, 211, 232, 0.10)",
  "--status-success": "#34D399",
  "--status-success-bg": "rgba(52, 211, 153, 0.10)",
  "--status-warning": "#FBBF24",
  "--status-warning-bg": "rgba(251, 191, 36, 0.10)",
  "--status-error": "#F87171",
  "--status-error-bg": "rgba(248, 113, 113, 0.10)",
  "--status-info": "#60A5FA",
  "--status-info-bg": "rgba(96, 165, 250, 0.10)",
  "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.3)",
  "--shadow-md": "0 4px 6px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.2)",
  "--shadow-lg": "0 10px 15px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2)",
};

// -----------------------------------------------------------
// Transition CSS (injected when smooth mode is active)
// -----------------------------------------------------------

const TRANSITION_DURATION = "200ms";
const TRANSITION_EASING = "ease-out";

const transitionCSS = `
  *,
  *::before,
  *::after {
    transition:
      background-color ${TRANSITION_DURATION} ${TRANSITION_EASING},
      border-color ${TRANSITION_DURATION} ${TRANSITION_EASING},
      color ${TRANSITION_DURATION} ${TRANSITION_EASING},
      fill ${TRANSITION_DURATION} ${TRANSITION_EASING},
      stroke ${TRANSITION_DURATION} ${TRANSITION_EASING},
      box-shadow ${TRANSITION_DURATION} ${TRANSITION_EASING} !important;
  }
`;

// -----------------------------------------------------------
// Helpers
// -----------------------------------------------------------

function getSystemPreference(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") return getSystemPreference();
  return mode;
}

function applyTokens(theme: ResolvedTheme) {
  const root = document.documentElement;
  const tokens = theme === "dark" ? darkTokens : lightTokens;

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.setAttribute("data-theme", theme);

  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

const STYLE_ID = "monsoon-theme-transition";

function injectTransitionStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = transitionCSS;
  document.head.appendChild(style);
}

function removeTransitionStyles() {
  const el = document.getElementById(STYLE_ID);
  if (el) el.remove();
}

// -----------------------------------------------------------
// Provider Component
// -----------------------------------------------------------

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
  defaultSmooth?: boolean;
}

export function ThemeProvider({
  children,
  defaultMode = "system",
  defaultSmooth = true,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return defaultMode;
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || defaultMode;
  });

  const [smoothTransition, setSmoothState] = useState<boolean>(() => {
    if (typeof window === "undefined") return defaultSmooth;
    const stored = localStorage.getItem(SMOOTH_KEY);
    return stored !== null ? stored === "true" : defaultSmooth;
  });

  const resolvedTheme = resolveTheme(mode);

  useEffect(() => {
    applyTokens(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (smoothTransition) {
      injectTransitionStyles();
    } else {
      removeTransitionStyles();
    }
    return () => removeTransitionStyles();
  }, [smoothTransition]);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTokens(resolveTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  // Keyboard shortcut: Cmd/Ctrl + Shift + L (Notion convention)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "L") {
        e.preventDefault();
        setModeState((prev) => {
          const resolved = resolveTheme(prev);
          const next: ThemeMode = resolved === "dark" ? "light" : "dark";
          localStorage.setItem(STORAGE_KEY, next);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setModeState(newMode);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const resolved = resolveTheme(prev);
      const next: ThemeMode = resolved === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setSmoothTransition = useCallback((enabled: boolean) => {
    localStorage.setItem(SMOOTH_KEY, String(enabled));
    setSmoothState(enabled);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        resolvedTheme,
        setMode,
        toggle,
        smoothTransition,
        setSmoothTransition,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// -----------------------------------------------------------
// Hook
// -----------------------------------------------------------

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
```

### 4.2 Toggle Components

```tsx
// Three-option toggle for settings page: System | Light | Dark

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  const options: { value: ThemeMode; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        gap: "2px",
        padding: "2px",
        borderRadius: "var(--radius-md)",
        backgroundColor: "var(--surface-tertiary)",
      }}
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={mode === opt.value}
          onClick={() => setMode(opt.value)}
          style={{
            padding: "6px 12px",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            lineHeight: 1,
            color: mode === opt.value ? "var(--text-primary)" : "var(--text-secondary)",
            backgroundColor: mode === opt.value ? "var(--surface-primary)" : "transparent",
            boxShadow: mode === opt.value ? "var(--shadow-sm)" : "none",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Compact icon toggle for sidebar/header: sun/moon icon

export function ThemeIconToggle({ size = 18 }: { size?: number }) {
  const { resolvedTheme, toggle } = useTheme();

  const sunIcon = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );

  const moonIcon = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "32px",
        height: "32px",
        borderRadius: "var(--radius-md)",
        border: "none",
        backgroundColor: "transparent",
        color: "var(--text-secondary)",
        cursor: "pointer",
      }}
    >
      {resolvedTheme === "dark" ? sunIcon : moonIcon}
    </button>
  );
}
```

### 4.3 Usage

```tsx
// In App.tsx or root layout:

import { ThemeProvider, ThemeToggle, ThemeIconToggle } from "./theme";

function App() {
  return (
    <ThemeProvider defaultMode="system" defaultSmooth={true}>
      <header>
        <ThemeIconToggle />
      </header>
      <SettingsPage>
        <ThemeToggle />
      </SettingsPage>
      <YourApp />
    </ThemeProvider>
  );
}

// In any component:
const { resolvedTheme, toggle } = useTheme();

// In CSS, reference tokens:
// .card {
//   background: var(--surface-secondary);
//   border: 1px solid var(--border-default);
//   color: var(--text-primary);
//   border-radius: var(--radius-lg);
// }
```

---

## 5. Base CSS

Import this in your root stylesheet. Sets global defaults, scrollbar styling, and reference component classes.

```css
/* ============================================================
   Monsoon Health — Theme Base Styles
   ============================================================ */

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-primary);
  background-color: var(--surface-primary);
}

::selection {
  background-color: var(--accent-sea-blue-subtle);
  color: var(--text-primary);
}

*:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Scrollbar — thin, unobtrusive (Notion pattern) */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: var(--border-strong);
  border-radius: 4px;
  border: 2px solid var(--surface-primary);
}
::-webkit-scrollbar-thumb:hover { background-color: var(--text-tertiary); }
* { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
```

---

## 6. Component Class Reference

These classes follow Notion's structural patterns mapped to Monsoon's identity. Use them as-is or as the naming convention for Tailwind/CSS module equivalents.

```css
/* --- SIDEBAR --- */

.monsoon-sidebar {
  width: var(--sidebar-width);
  background: var(--surface-secondary);
  padding: var(--space-2) 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow-y: auto;
  flex-shrink: 0;
}

.monsoon-sidebar-section {
  padding: var(--space-1) var(--space-3);
}

/* 6px gap between sections (Notion pattern) */
.monsoon-sidebar-section + .monsoon-sidebar-section {
  margin-top: 6px;
}

.monsoon-sidebar-section-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: var(--space-1) var(--space-2);
  margin-bottom: var(--space-1);
}

/* Full-row click target (Notion pattern) */
.monsoon-sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  width: 100%;
  text-align: left;
  min-height: 30px;
}

.monsoon-sidebar-item:hover {
  background: var(--surface-tertiary);
  color: var(--text-primary);
}

.monsoon-sidebar-item.active {
  background: var(--accent-sea-blue-subtle);
  color: var(--accent-sea-blue);
}

/* 22px icon container (Notion pattern) */
.monsoon-sidebar-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* --- CARDS --- */

.monsoon-card {
  background: var(--surface-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  border: 1px solid var(--border-default);
}

.monsoon-card:hover {
  background: var(--surface-tertiary);
}

/* --- STATUS BADGES --- */

.monsoon-status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: 9999px;
  font-size: var(--text-xs);
  font-weight: 600;
}

.monsoon-status-badge.success {
  background: var(--status-success-bg);
  color: var(--status-success);
}
.monsoon-status-badge.warning {
  background: var(--status-warning-bg);
  color: var(--status-warning);
}
.monsoon-status-badge.error {
  background: var(--status-error-bg);
  color: var(--status-error);
}
.monsoon-status-badge.info {
  background: var(--status-info-bg);
  color: var(--status-info);
}

/* --- INPUTS --- */

.monsoon-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--surface-primary);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  line-height: var(--leading-normal);
}
.monsoon-input::placeholder { color: var(--text-tertiary); }
.monsoon-input:hover { border-color: var(--text-tertiary); }
.monsoon-input:focus {
  border-color: var(--border-focus);
  box-shadow: var(--focus-ring);
  outline: none;
}

/* --- BUTTONS --- */

.monsoon-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-inverse);
  background: var(--accent-sea-blue);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  line-height: 1;
  min-height: 34px;
}
.monsoon-btn-primary:hover { background: var(--accent-sea-blue-hover); }

/* Ghost button (no border until hover, Notion pattern) */
.monsoon-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}
.monsoon-btn-ghost:hover {
  background: var(--surface-tertiary);
  color: var(--text-primary);
}

/* --- DIVIDER (use spacing first, this is the fallback) --- */

.monsoon-divider {
  height: 1px;
  background: var(--border-default);
  margin: var(--space-3) 0;
  border: none;
}

/* --- CONTENT AREA (centered column, Notion pattern) --- */

.monsoon-content {
  max-width: 900px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}
.monsoon-content.full-width {
  max-width: none;
  padding: var(--space-4);
}

/* --- DATA TABLE --- */

.monsoon-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: var(--text-sm);
}
.monsoon-table th {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  font-weight: 600;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-default);
  position: sticky;
  top: 0;
  background: var(--surface-primary);
  z-index: 1;
}
.monsoon-table td {
  padding: var(--space-2) var(--space-3);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-default);
}
.monsoon-table tbody tr:hover {
  background: var(--surface-tertiary);
}

/* --- MOTION --- */

.monsoon-hover-lift {
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.monsoon-hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.monsoon-fade-in {
  animation: monsoonFadeIn 200ms ease-out;
}
@keyframes monsoonFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 7. Code Review Checklist

When reviewing any component in the Zephyr or Rainfall codebase, verify:

### Colors
- [ ] No hardcoded hex values. Every color references a `var(--token)`.
- [ ] No pure `#000000` or `#FFFFFF` used for text anywhere.
- [ ] Dark mode text uses `rgba(255,255,255,0.87)` or lower, never `#FFFFFF`.
- [ ] Light mode text uses `#1A1D23` or similar warm near-black, never `#000000`.
- [ ] Accent colors use the correct mode variant (muted in light, bright in dark).
- [ ] Status colors use the correct mode variant.
- [ ] All text/background combinations pass WCAG AA contrast (4.5:1 for normal text, 3:1 for large text).

### Spacing
- [ ] All spacing values snap to the 8px grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64).
- [ ] Sections separated by spacing gaps (6px between sidebar sections), not visible dividers.
- [ ] No arbitrary pixel values that break the grid.

### Typography
- [ ] Space Grotesk used for headings and brand elements only.
- [ ] Data-dense views (tables, forms, protocol text) use system font stack.
- [ ] Font sizes reference `var(--text-*)` tokens.
- [ ] Line heights reference `var(--leading-*)` tokens.
- [ ] No `font-weight: bold` (700) on body text. Use 500 (medium) for emphasis.

### Interaction
- [ ] Click targets extend to full row/card width, not limited to text/icon.
- [ ] Hover states change background fill, not border or shadow.
- [ ] Hover fills use accent at low opacity (8-12%).
- [ ] All interactive elements have `:focus-visible` styles using `var(--focus-ring)`.
- [ ] Non-theme transitions stay under 150ms.

### Theme
- [ ] ThemeProvider wraps the entire app.
- [ ] No inline styles use hardcoded colors (all reference CSS variables).
- [ ] `Cmd/Ctrl+Shift+L` keyboard shortcut works.
- [ ] System preference is respected when mode is "system".
- [ ] Theme preference persists across sessions.
- [ ] Smooth transition does not interfere with other CSS transitions/animations.

### Layout
- [ ] Sidebar width is `var(--sidebar-width)` (248px).
- [ ] Content area uses centered column (max-width: 900px) with full-width toggle for data views.
- [ ] No persistent toolbars cluttering data views. Actions behind contextual menus.
- [ ] Sidebar hierarchy: identity → tools → content.

### Borders and Shadows
- [ ] Borders use `var(--border-default)` or `var(--border-strong)`, never hardcoded grays.
- [ ] Shadows use `var(--shadow-*)` tokens.
- [ ] Prefer spacing over visible dividers for section separation.
- [ ] Border radius uses `var(--radius-*)` tokens (4px, 6px, 8px).

### Scrollbars
- [ ] Thin, unobtrusive scrollbars styled with theme tokens.
- [ ] Scrollbar thumb uses `var(--border-strong)`.
- [ ] Scrollbar track is transparent.
