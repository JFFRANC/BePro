---

description: "Task list for Theme Toggle — Light, Dark & System Modes (006-theme-toggle)"
---

# Tasks: Theme Toggle — Light, Dark & System Modes

**Feature Branch**: `006-theme-toggle`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/theme-api.md](./contracts/theme-api.md) | **Quickstart**: [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story (US1–US4 from `spec.md`). Every implementation task is preceded by its gating test — Constitution V (Test-First) mandates TDD RED → GREEN → REFACTOR for this feature.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks).
- **[USn]**: Maps task to User Story *n* from `spec.md`.
- All file paths are absolute. Primary implementer agent for shell-adjacent work: `senior-frontend-engineer`.

---

## Phase 1: Setup

**Purpose**: No new directories or dependencies are required. `next-themes 0.4.6`, `lucide-react`, `shadcn/dropdown-menu`, and `shadcn/button` are already installed.

- [X] T001 Verify existing dependencies by inspecting `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/package.json` — confirm `next-themes@^0.4.6` present, `lucide-react@^0.577` present, shadcn `button` and `dropdown-menu` components exist under `apps/web/src/components/ui/`. If any are missing, install/add them before starting Phase 2. No file edits if all present.

**Checkpoint**: Environment ready. Phase 2 can begin.

---

## Phase 2: Foundational (P-0 Foundation — blocking prerequisites)

**Purpose**: Provider wiring, no-flash guard, reduced-motion transition, and token parity invariant. Everything under every user story depends on these artifacts. Constitution V applies — tests first.

**⚠️ CRITICAL**: No user-story task (Phase 3+) may begin until this phase is complete.

### Tests for Phase 2 (RED — must fail before implementation)

- [X] T002 [P] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/__tests__/dark-token-parity.test.ts` — reads `apps/web/src/index.css` as a string; parses all `--<name>` declarations under the `:root { … }` block and under the `.dark { … }` block; asserts (a) both sets are non-empty, (b) every key in `:root` also exists in `.dark`, (c) every key in `.dark` also exists in `:root`. Enforces FR-015a invariant.
- [X] T003 [P] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/__tests__/no-flash-script.test.ts` — reads `apps/web/index.html` as a string; asserts: (a) an inline `<script>` tag exists inside `<head>` BEFORE any `<script src>` or module tag; (b) the script references `localStorage.getItem("bepro.theme")`; (c) the script references `matchMedia("(prefers-color-scheme: dark)")`; (d) the script conditionally adds `dark` to `document.documentElement.classList`; (e) the script body is wrapped in `try`/`catch` (private-browsing safety). FR-009, FR-017, SC-002.
- [X] T004 [P] Create shared test helpers `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/theme-test-helpers.tsx` — exports: (a) `installMatchMediaMock({ systemIsDark })` for `beforeEach`; (b) `cleanupMatchMediaMock()` for `afterEach`; (c) `renderWithTheme(ui, { defaultMode?: "light"|"dark"|"system", systemIsDark?: boolean, route?: string })` that wraps its argument in `<NextThemesProvider attribute="class" defaultTheme={defaultMode ?? "system"} enableSystem storageKey="bepro.theme">` + `<MemoryRouter>` + `<TooltipProvider>`. Per research R8.

### Implementation for Phase 2 (GREEN — minimal code to pass)

- [X] T005 [P] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/index.html` — add the inline no-flash script inside `<head>`, before any other `<script>` or `<link>` tag (per research R2 and `contracts/theme-api.md` §4). Makes T003 pass. FR-009, SC-002.
- [X] T005a [P] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/__tests__/reduced-motion-transition.test.ts` — reads `apps/web/src/index.css` as a string; asserts: (a) a `@media (prefers-reduced-motion: no-preference)` block exists; (b) the block contains transitions on `background-color`, `color`, `border-color`, `fill`, and `stroke`; (c) every numeric duration found inside the block is `> 0ms` and `≤ 200ms` (regex on `/(\d+)\s*ms/g`); (d) no color-related `transition` declaration appears OUTSIDE the media query so users with `prefers-reduced-motion: reduce` receive zero animation. FR-016.
- [X] T006 [P] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/index.css` — append the `@media (prefers-reduced-motion: no-preference) { … }` block (per research R7) that animates `background-color`, `color`, `border-color`, `fill`, `stroke` at 150ms ease. Makes T005a pass. FR-016.
- [X] T007 Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/App.tsx` — import `ThemeProvider as NextThemesProvider` from `next-themes` and wrap the existing `<ThemeProvider theme={null}>` in `<NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="bepro.theme">`. Placement MUST be outside the existing `<ThemeProvider>` (research R1) and outside `<BrowserRouter>` so the theme applies to login/change-password routes as well (FR-018). No other behavior change. Depends on T005.
- [X] T008 Run `pnpm --filter @bepro/web test` to confirm T002 and T003 are green. Run `pnpm --filter @bepro/web typecheck` — green. Do NOT proceed to Phase 3 until both are green.

**Checkpoint**: Foundation ready. Dark token parity enforced. No-flash guaranteed. Provider mounted at app root. User-story phases can begin.

---

## Phase 3: User Story 1 — Toggle between light and dark from the header (Priority: P1) 🎯 MVP

**Goal**: Render a theme-toggle dropdown in the header's right cluster that lets the user pick "Claro", "Oscuro", or "Sistema"; the icon reflects the active mode and the full application repaints on selection.

**Independent Test**: Log in as any role → see the toggle in the header → open it → pick "Oscuro" → whole app switches to the dark palette within one second → icon changes to a moon → pick "Claro" → reverts → pick "Sistema" → adopts OS palette and icon changes to a monitor.

### Tests for US1 (RED)

- [X] T009 [P] [US1] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/ThemeToggle.test.tsx` — uses `renderWithTheme` from T004. Asserts: (a) trigger rendered with `data-slot="theme-toggle-trigger"` and accessible label containing "tema"; (b) trigger icon is Sun when `resolvedTheme="light"`, Moon when `"dark"`, Monitor when `theme="system"`; (c) click opens a menu containing exactly 3 items — "Claro", "Oscuro", "Sistema"; (d) selecting an option calls `setTheme(value)` and emits telemetry `emit({ name: "theme.change", payload: { value } })` exactly once; (e) each option carries `role="menuitemradio"` with `aria-checked="true|false"`; (f) trigger carries `aria-expanded` reflecting open/closed. FR-001–FR-003, FR-011, FR-014, FR-019. Mock telemetry via `vi.mock("@/lib/telemetry")`.
- [X] T010 [US1] Extend `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/Header.test.tsx` — add a new case `it("mounts the ThemeToggle inside the header right cluster", …)` that renders `<Header/>` and asserts the `[data-slot="header-right"]` element contains a descendant with `data-slot="theme-toggle-trigger"`. FR-001.

### Implementation for US1 (GREEN)

- [X] T011 [P] [US1] Implement `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/ThemeToggle.tsx` — shadcn `Button` (`variant="ghost"`, `size="icon-sm"`) as trigger carrying `data-slot="theme-toggle-trigger"` and `aria-label="Cambiar tema"`; shadcn `DropdownMenu` with three `DropdownMenuRadioItem`s (values `"light"`, `"dark"`, `"system"`, labels `"Claro"`, `"Oscuro"`, `"Sistema"`); trigger icon via lucide `Sun`/`Moon`/`Monitor` chosen by `resolvedTheme`/`theme` from `useTheme()`; on each selection, call `emit({ name: "theme.change", payload: { value } })` before `setTheme(value)`. Import telemetry from `@/lib/telemetry`. Makes T009 pass. FR-001–FR-003, FR-011, FR-014, FR-019.
- [X] T012 [US1] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/Header.tsx` — add `<ThemeToggle />` as a child of the `[data-slot="header-right"]` cluster. Depends on T011. Makes T010 pass. FR-001.

**Checkpoint**: US1 demo-able — an admin sees the toggle in the header and can switch modes. Foundation (Phase 2) ensures no flash on reload, but reload behavior is not yet explicitly tested; that lands in Phase 5.

---

## Phase 4: User Story 2 — Follow the operating system by default and live (Priority: P2)

**Goal**: When the user has no stored preference (or has chosen "Sistema"), the app paints in the OS-advertised palette and follows live OS changes. When the user has an explicit "Claro" or "Oscuro" preference, OS changes are ignored.

**Independent Test**: Clear storage → set OS to dark → open app → renders dark. While app is open, switch OS to light → app switches within 3s. Then select "Oscuro" explicitly → switch OS back to dark/light → app stays dark (explicit wins).

### Tests for US2 (RED)

- [X] T013 [US2] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/theme-os-follow.integration.test.tsx` — uses helpers from T004. Cases: (a) empty localStorage + `installMatchMediaMock({ systemIsDark: true })` → mount → `document.documentElement.classList.contains("dark")` is true; (b) same setup but `systemIsDark: false` → class is not "dark"; (c) mount with `theme="system"` + OS=dark, dispatch manual `MediaQueryList` change event setting `matches: false`, assert class drops "dark" within 3s; (d) set theme explicitly to "dark" via `setTheme("dark")`, dispatch OS change to `matches: false`, assert class remains "dark" (explicit choice wins — FR-007). FR-005, FR-006, FR-007, SC-007.

### Implementation for US2 (GREEN)

- [X] T014 [US2] No new implementation expected — `enableSystem` on `NextThemesProvider` (T007) already wires matchMedia. If T013 fails on any scenario, open a focused fix task here naming the exact file and assertion. Otherwise mark verify-only and move on. FR-005–FR-007.

**Checkpoint**: US2 demo-able with no new implementation code — covered by the provider's built-in OS-follow.

---

## Phase 5: User Story 3 — Persist the preference across reloads without flash (Priority: P2)

**Goal**: The chosen mode survives reloads, tab closes, and browser restarts (same browser). On every page load the correct palette is painted on the very first frame.

**Independent Test**: Set dark → hard-reload → first paint is dark (no white flash). Set light → close tab → reopen app → first paint is light. Set system → reload → first paint matches OS.

### Tests for US3 (RED)

- [X] T015 [US3] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/theme-persistence.integration.test.tsx` — cases: (a) write `"dark"` to `localStorage["bepro.theme"]` before mount; render with `renderWithTheme`; assert `document.documentElement.classList.contains("dark")` true immediately post-mount; (b) call `setTheme("light")`; assert `localStorage.getItem("bepro.theme") === "light"`; (c) unmount, clear DOM class manually, remount fresh; assert class is rehydrated from storage (not "dark"); (d) private-browsing simulation: `vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error(); })`; spy `console.error` with `vi.spyOn(console, "error")`; call `setTheme("dark")`; assert: no throw, `document.documentElement.classList.contains("dark")` is true, `console.error` was NOT called with a storage-related message, no element with `role="alert"` exists anywhere in the document, and (if `Toaster` is mounted) its container has no child toasts. FR-008, FR-010, FR-017, SC-003, SC-008.
- [X] T016 [US3] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/__tests__/theme-no-flash.test.ts` — extracts the inline no-flash script body from `apps/web/index.html` (reuse parser from T003 or read the file); evaluates it inside a controlled jsdom scope with `localStorage` pre-populated; asserts that the synchronous evaluation leaves `document.documentElement.classList` in the correct state for: (a) empty storage + `systemIsDark=true` → class contains "dark"; (b) empty storage + `systemIsDark=false` → no "dark" class; (c) `"dark"` stored → class contains "dark"; (d) `"light"` stored + `systemIsDark=true` → no "dark" class (explicit wins). FR-009, SC-002.

### Implementation for US3 (GREEN)

- [X] T017 [US3] No new implementation expected — persistence is provided by `next-themes`' `storageKey="bepro.theme"` (T007) and no-flash by the inline script (T005). If T015 or T016 fails, open a focused fix task naming the file/line. Otherwise verify-only.

**Checkpoint**: US3 demo-able. SC-002 (zero flash) and SC-003 (persistence) both locked.

---

## Phase 6: User Story 4 — Keyboard navigation & accessibility (Priority: P2)

**Goal**: The toggle is fully keyboard-operable and screen-reader-friendly. Focus indicator visible. Labels in Spanish.

**Independent Test**: With mouse disconnected, Tab from the top of the shell until focus reaches the toggle trigger (visible focus ring). Press Enter → menu opens. Press arrow-down → highlight moves. Press Enter on "Oscuro" → app switches to dark and menu closes, focus returns to trigger. Press Escape while open → menu closes.

### Tests for US4 (RED)

- [X] T018 [US4] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/theme-toggle-a11y.test.tsx` — cases: (a) `user.tab()` lands on the `[data-slot="theme-toggle-trigger"]` element (after any shell-level focus stops); (b) Enter opens the menu; Space also opens; (c) `user.keyboard("{ArrowDown}")` shifts highlight among options; (d) Enter on a highlighted option calls `setTheme(value)` and closes the menu; (e) Escape closes the menu and returns focus to the trigger; (f) trigger and every option have a `focus-visible:ring` class; (g) aria-label is in Spanish ("Cambiar tema" or equivalent). FR-012–FR-014, FR-019, SC-005.

### Implementation for US4 (GREEN)

- [X] T019 [US4] No new implementation expected — shadcn/Radix `DropdownMenu` provides WAI-ARIA menu keyboard semantics and focus return by default. If T018 fails on any case, patch `ThemeToggle.tsx` (e.g., to add `focus-visible:ring-2 focus-visible:ring-ring` classes or correct the Spanish aria-label). Otherwise verify-only.

**Checkpoint**: US4 demo-able. Keyboard-only operator can reach and operate the toggle.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-tab propagation, global scope validation, contrast audit, visual QA, and final verification.

### Cross-tab propagation (FR-020, SC-009)

- [X] T020 [P] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/theme-cross-tab.integration.test.tsx` — mounts two independent `<NextThemesProvider>` instances against the same jsdom (shared `window.localStorage`); sets theme in instance A via `setTheme("dark")`; dispatches a manual `StorageEvent` on `window` with `{ key: "bepro.theme", newValue: "dark", oldValue: null }`; waits up to 1s; asserts instance B's rendered `document.documentElement.classList` contains "dark". FR-020, SC-009.

### Global scope (FR-018)

- [X] T021 [P] Write `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/theme-global-scope.test.tsx` — renders a minimal tree with `<NextThemesProvider>` wrapping a plain non-shell `<Routes>` containing two routes: `/login` (returns `<div data-testid="login">LOGIN</div>`) and `/change-password` (`<div data-testid="cp">CP</div>`); sets theme to "dark"; asserts `document.documentElement.classList.contains("dark")` both at `/login` and at `/change-password`. FR-018.

### Visual & accessibility QA (SC-004, SC-006)

- [ ] T022 Visual QA pass — manually log in as admin, navigate to every protected route (`/`, `/users`, `/users/:id`, `/clients`, `/clients/:id`) and public route (`/login`, `/change-password`, `/design-system`) in BOTH palettes; record every first-party surface where contrast, border, icon, or badge looks wrong; for each finding, file a focused follow-up ticket (not part of this task) describing the file and the token needed. Third-party widget gaps are also recorded but tracked as follow-up per clarified FR-004. SC-004, SC-006.
- [ ] T023 [P] Run an automated accessibility audit — use the `playwright` MCP plugin with `@axe-core/playwright` (or the Playwright `browser_evaluate` + axe-core inline) against `/`, `/users`, `/clients`, `/login` in BOTH themes; assert zero `serious` or `critical` violations. SC-005, SC-006.

### Repo verification

- [X] T024 Run `pnpm --filter @bepro/web typecheck && pnpm --filter @bepro/web test` from repo root — both must be green with no new failures. If any existing test broke because of the added providers, address in a focused fix task naming the exact test file. SC-001–SC-009 verified via the suite.
- [ ] T025 Dev-server smoke — run `pnpm --filter @bepro/web dev`, open `http://localhost:5173`, verify: (a) on first visit the toggle defaults to "Sistema" and renders the OS palette; (b) setting "Oscuro" and reloading keeps the dark palette with no flash; (c) opening a second tab shows the same theme; changing theme in tab A propagates to tab B within 1 second; (d) OS appearance change under "Sistema" mode updates the app within 3 seconds; (e) the toggle icon swaps correctly across all three modes. Record methodology in the PR description.

**Checkpoint**: Every SC (SC-001 → SC-009) measurably met. Ready for `/speckit.analyze` and PR against `development`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** — T001 only, may be trivially skipped if env is already correct.
- **Phase 2 (Foundational, P-0)** — BLOCKS every Phase 3+ task. T002–T007 sequential within, then T008 gate.
- **Phase 3 (US1, P-1) 🎯 MVP** — depends on Phase 2.
- **Phase 4 (US2)** — depends on Phase 2. Independent of US1 (does not require ThemeToggle).
- **Phase 5 (US3)** — depends on Phase 2. Independent of US1/US2.
- **Phase 6 (US4)** — depends on Phase 3 (needs ThemeToggle to test keyboard/a11y).
- **Phase 7 (Polish)** — depends on Phases 2–6.

### Within each user story

- Test tasks precede implementation (Constitution V — RED before GREEN).
- T009 and T010 are not [P] with each other because they touch different files but the Header test depends on the ThemeToggle component's contract being defined (which T009 establishes).

### File-coordination notes

- `Header.tsx` is edited in feature 005 (base mount) and again here in T012 (add ThemeToggle). No other phase of 006 touches it.
- `App.tsx` is edited once in T007 to wrap in `NextThemesProvider`. No other task touches it.
- `index.html` and `index.css` are each edited exactly once (T005 and T006 respectively).

---

## Parallelization Guide

Between Phase 3 (US1) and Phase 4 (US2) + Phase 5 (US3): US1 can run in parallel with US2/US3 once Phase 2 is in. US2 and US3 are pure verification (no new component code) so they are primarily test-writing work.

### Stream A — US1 MVP (owner: Hector)

- T009 → T011 → T010 → T012

### Stream B — US2 + US3 verification (owner: Javi, can start right after Phase 2)

- T013, T015, T016 can all be written in parallel since they touch disjoint files.
- T014 and T017 are conditional verify-only gates.

### Stream C — Polish (either dev, starts after Stream A's T012)

- T020 and T021 can run in parallel with each other.
- T022–T025 are sequential manual/verification tasks.

---

## Parallel Example: Phase 2 Foundational

```bash
# After T001, launch these in parallel:
Task: "Write dark-token-parity.test.ts — apps/web/src/__tests__/dark-token-parity.test.ts" (T002)
Task: "Write no-flash-script.test.ts — apps/web/src/__tests__/no-flash-script.test.ts" (T003)
Task: "Create theme-test-helpers.tsx — apps/web/src/components/layout/__tests__/theme-test-helpers.tsx" (T004)
Task: "Edit apps/web/index.html to add no-flash script" (T005)
Task: "Edit apps/web/src/index.css to add reduced-motion transition block" (T006)

# Then sequentially:
Task: "Edit apps/web/src/App.tsx to wrap in NextThemesProvider" (T007)
Task: "Run pnpm test + typecheck gate" (T008)
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (T001) — environment check.
2. Complete Phase 2 (T002–T008) — foundation.
3. Complete Phase 3 (T009–T012) — visible toggle in header.
4. **STOP and validate** — user can switch themes from the header; reload keeps the preference; no flash on load.
5. Demo.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → toggle works end-to-end → deploy / demo (MVP).
3. US2 → OS-follow verified.
4. US3 → reload persistence + no-flash verified.
5. US4 → keyboard + a11y verified.
6. Polish (cross-tab, global scope, visual QA, axe audit, typecheck).
7. PR against `development`.

### Parallel team strategy (Hector + Javi)

- Both devs pair on Phase 2 (one writes T002/T003, the other T005/T006, then one does T007 + T008).
- Then Stream A (Hector, US1) and Stream B (Javi, US2/US3 verification) in parallel.
- Reconverge for US4 (either dev) and Polish (either dev).

---

## Notes

- `[P]` = disjoint files, no dependency on incomplete tasks.
- `[USn]` = maps task to User Story *n* from `spec.md`.
- Tests MUST fail before paired implementation per Constitution V.
- No new third-party dependencies — everything needed (`next-themes`, `lucide-react`, shadcn `dropdown-menu`/`button`) is already installed per feature 005.
- Stop at any checkpoint to validate a user story independently.
- Out of scope (no tasks generated): server-side preference sync, per-tenant dark-variant override, high-contrast mode, in-app settings page for theme, SSR/SSG paths (this is a Vite SPA).
