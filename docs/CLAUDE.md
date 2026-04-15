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

Two sequential AI calls in `server/src/services/aiIngestion.ts`:
1. **Call 1** — metadata, all visits (ALL cohorts, prefixed names), criteria, signal rules (max 6)
2. **Call 2** — Schedule of Assessments per visit (ALL SoA tables, never skip administrative items)

Visit name fuzzy matching (3 tiers): exact → normalized (em-dash/whitespace) → partial substring.

Frontend polling (`TrialDetailPage`):
- **Phase 1:** Poll until Call 1 data appears → dismiss overlay, start card-reveal animation
- **Phase 2:** Continue polling silently until `extracted_visits` in `structured_data` arrives
- **Navigation persistence:** Write `extracting_<id>` timestamp to `sessionStorage` on poll start; on component mount check if key exists + < 5 min old + extraction incomplete → resume `startExtractionPoll({ silent: true })`

---

## Signal Rules UI
- Display signal type option labels WITHOUT data_type suffix — no `(Match)`, `(Numeric)`, etc.
- Max 6 signal rules per trial, surfaced from AI extraction
