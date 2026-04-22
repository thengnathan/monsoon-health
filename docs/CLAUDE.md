# CLAUDE.md

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## 2. Subagent Strategy
- Use subagents liberally to keep the main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at them via subagents
- One task per subagent for focused execution

## 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until the mistake rate drops
- Review lessons at the start of each session for the relevant project

## 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between the main branch and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, and demonstrate correctness

## 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask, "Is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

## 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point to logs, errors, and failing tests — then resolve them
- Require zero context switching from the user
- Go fix failing CI tests without being told how

## Task Management
1. Plan First: Write a plan in `tasks/todo.md` with checkable items
2. Verify Plan: Check in before starting implementation
3. Track Progress: Mark items complete as you go
4. Explain Changes: Provide a high-level summary at each step
5. Document Results: Add a review section to `tasks/todo.md`
6. Capture Lessons: Update `tasks/lessons.md` after corrections

## Core Principles
- Simplicity First: Make every change as simple as possible. Minimize code impact
- No Laziness: Find root causes. No temporary fixes. Maintain senior developer standards
- Minimal Impact: Only touch what's necessary. Avoid introducing new bugs

---

## Key Design Constraints

### No Native OS Dropdowns
Always use `platform/src/components/Select.tsx` for ALL dropdown/select elements — never native `<select>`. The custom component uses `createPortal`, smart viewport-flip positioning, and matches the design system.

### CSS Custom Properties Only
No Tailwind. All styling via CSS custom properties defined in `platform/src/index.css`. When referencing design tokens in TSX inline styles, always use `var(--token-name)` — never hardcode hex values.

**Defined tokens (dark mode):** `--bg-root`, `--bg-surface`, `--bg-surface-raised`, `--bg-surface-hover`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--accent`, `--accent-hover`, `--accent-muted`, `--border-default`, `--border-strong`, `--border-subtle`

**Undefined / do not use:** `--bg-primary`, `--bg-secondary`, `--border`, `--primary` — these are not defined and will silently produce invisible elements.

### Sidebar Animation
- Sidebar and its edge handle MUST use `transform: translateX()` — never `left` property — to stay on the GPU compositor layer
- ThemeContext must inject transition styles as flash-only (300ms window around toggle), NOT permanently. Permanent `!important` injection blocks the sidebar transform animation.

### Overlays: Frosted Glass, Not Opaque
Loading/extraction overlays: `background: rgba(10,13,20,0.72)` + `backdropFilter: blur(12px)`. Never use a solid dark color as a full-page overlay.

### Portals for Tooltips and Dropdowns
Any tooltip, dropdown, or popover rendered inside a scrollable or `overflow:hidden` container must use `createPortal` at `document.body` with `position: fixed` and `getBoundingClientRect()` for positioning. Use viewport-half detection to flip direction (e.g. tooltip renders above trigger if trigger is in the bottom half of the screen).

### Native PDF for Protocol Ingestion
Use Anthropic document blocks (native PDF) for protocol extraction — NOT pdf-parse text extraction. Streaming is required: `client.messages.stream()`.

### Multi-tenant by site_id
Every database table has `site_id`. Every query must filter by `site_id`.

### Monorepo Structure
Three independent apps — `platform/` (React SPA), `server/` (Express API), `marketing/` — with no shared tooling. TypeScript throughout both client and server.

---

## Protocol Extraction Architecture

Two AI calls in `server/src/services/aiIngestion.ts`:

**Call 1** — `claudeExtractFromPDF` (32k tokens): metadata, all visits (ALL cohorts, prefixed `"Cohort X - Visit Name"`), inclusion_structured + exclusion_structured (both grouped by cohort), signal rules (up to 6 per cohort). Saved immediately via `onCall1Complete` callback so UI updates before Call 2 finishes.

**Call 2** — SoA assessments (64k tokens): one call per cohort, run in **parallel** via `Promise.allSettled`. Each call receives the exact visit names from Call 1 to use as JSON keys (eliminates name mismatch). `detectCohortGroups()` splits by prefix when ≥2 distinct prefixes each appear on ≥2 visits.

**SoA visit name mapping:** `applyAssessmentsToVisits()` merges Call 2 results onto `extracted_visits` using 3-tier fuzzy match: exact → normalized (em-dash/whitespace) → partial substring. Logs matched/unmatched visits to server console for debugging.

**Re-extraction flow:** clears `visit_templates`, `trial_signal_rules` (ai_extracted), `trials.inclusion/exclusion_criteria`, and `trial_protocols.structured_data` **synchronously before responding** — ensures first poll sees empty state instead of stale data.

**Frontend polling (`TrialDetailPage`):**
- `cache: 'no-store'` on all API requests — prevents 304 stale responses during polling
- **Phase 1:** Poll (3s interval) until `visit_templates.length > 0` or `signal_rules.length > 0` → dismiss overlay, start card-reveal animation. Timeout: 40 attempts (2 min).
- **Phase 2:** Continue polling silently until `extracted_visits.some(v => v.assessments.length > 0)` — NOT just `extracted_visits.length > 0` (which fires too early after Call 1 partial save). Hard cap: 60 attempts (3 min).
- **Navigation persistence:** Write `extracting_<id>` timestamp to `sessionStorage` on poll start; on mount check if key exists + < 5 min old + extraction incomplete → resume `startExtractionPoll({ silent: true })`

---

## Signal Rules Architecture

**Extraction:** Up to 6 rules per cohort. Each rule has a `cohort` field (`null` = main study, `"Cohort D"` = cohort-specific). Stored in `trial_signal_rules.cohort` (migration 012).

**Display (TrialDetailPage):** Filtered to only show rules matching the site's Trial Profile signals for that specialty (by `signal_type_id` or label match). Grouped by cohort (outer, "Main Study" first) then category (inner). Cohort headers only shown when multiple cohorts exist.

**Trial Profile (Settings):** Per-specialty signal selection stored in `sites.patient_profile_config` JSONB under `trial_profile_signals: { HEPATOLOGY: [id,...], ... }`. Drives both signal rule filtering on trial detail and signal type dropdown in the Add Rule modal.

---

## Criteria Display

`inclusion_structured` and `exclusion_structured` both use `ExclusionCategory[]` shape: `{ category: string|null, note: string|null, criteria: [...] }[]`. Category is the cohort/arm label ("Main Study", "Cohort D") or a protocol section header for exclusion. Rendered by `ExclusionStructuredList` in `ProtocolViewer.tsx` for both panels.

---

## Database Notes

- **Pool config:** `max: 5`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000` — prevents connection exhaustion during polling + background extraction.
- **Trial GET queries:** Sequential (not `Promise.all`) to avoid consuming all pool slots in one request burst.
- **Migration 012** (`server/db/migrations/012_signal_rule_cohort.sql`): Adds `cohort VARCHAR(128)` to `trial_signal_rules`. Must be run before re-extraction or signal rule inserts will fail silently.
