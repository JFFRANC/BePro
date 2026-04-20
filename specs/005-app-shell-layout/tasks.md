---

description: "Task list for App Shell & Main Layout (005-app-shell-layout)"
---

# Tasks: App Shell & Main Layout

**Feature Branch**: `005-app-shell-layout`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md) | **Data Model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/shell-api.md](./contracts/shell-api.md) | **Quickstart**: [quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story (US1–US7 from `spec.md`) and tagged with the plan's implementation phase (P-0 Foundation through P-7 Verification). Every implementation task is preceded by its gating test (TDD RED → GREEN → REFACTOR per Constitution V).

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Task can run in parallel with other [P] tasks in the same group (disjoint files, no incomplete dependency).
- **[USn]**: Maps the task to User Story *n* from `spec.md`.
- **(P-x)** in description = parent phase from `plan.md`.
- File paths are absolute.
- Primary implementer agent for component tasks: `senior-frontend-engineer`. TDD cadence driven by `superpowers:test-driven-development`.

---

## Phase 1: Setup

**Purpose**: Create the empty directory structure before any code or tests land.

- [X] T001 Create directory `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/` with an empty `__tests__/` subfolder.
- [X] T002 [P] Create `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/` subfolder for library-module unit tests.
- [X] T003 [P] Create `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/store/__tests__/` subfolder for store unit tests.

**Checkpoint**: Empty scaffolding exists; Phase 2 can begin.

---

## Phase 2: Foundational (P-0 Foundation — blocking prerequisites)

**Purpose**: Pure modules (lib + store) that every shell component imports. Includes all unit tests from the spec's required-coverage list. No React components yet.

**⚠️ CRITICAL**: No user-story task (Phase 3+) may begin until this phase is complete.

### Tests for Phase 2 (RED — must fail before implementation)

- [X] T004 [P] Write `safe-storage.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/safe-storage.test.ts` — covers: normal read/write/remove, `setItem` throws → no-op, `getItem` returns null on failure, `removeItem` swallows error. (P-0)
- [X] T005 [P] Write `telemetry.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/telemetry.test.ts` — covers: every `TelemetryEvent` variant accepted without throwing, `console.debug` called only when `import.meta.env.DEV`, never throws on unknown future variants. (P-0)
- [X] T006 [P] Write `active-match.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/active-match.test.ts` — snapshots every row of the table in `contracts/shell-api.md` §5 (exact, prefix, longest-prefix-wins, trailing slash, query string, hash, no match, empty pathname). (P-0)
- [X] T007 [P] Write `nav-config.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/nav-config.test.ts` — validates: every `NavItem.path` starts with `/`, all `id`s unique, every icon is truthy, `NAV_CONFIG` is frozen. (P-0)
- [X] T008 [P] Write `initials.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/initials.test.ts` — covers: first+last letter, single-word name, empty string, accented chars, emoji stripping. (P-0)
- [X] T009 [P] Write `use-hotkeys.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/use-hotkeys.test.ts` — covers: single key fires, sequence `g d` fires within 1s, sequence resets after 1s timeout, sequence resets on focus change into `<input>`, input-focus guard skips single keys, `[data-ignore-hotkeys]` opt-out, cleanup on unmount. (P-0)
- [X] T010 [P] Write `use-route-pending.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/__tests__/use-route-pending.test.ts` — covers: returns true when `useNavigation().state === "loading"`, true when `useIsFetching() > 0`, false otherwise, stable across rerenders. (P-0) Use `context7` to confirm current react-router-dom v7 `useNavigation` and TanStack Query `useIsFetching` APIs before writing assertions.
- [X] T011 [P] Write `layout-store.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/store/__tests__/layout-store.test.ts` — covers: `sidebarCollapsed` persists via `safeLocalStorage` and survives reload, `mobileDrawerOpen` is in-memory only (not persisted), `toggleSidebar` flips + emits `sidebar.toggle`, private-browsing fallback (storage throws → store still works in memory). (P-0)
- [X] T012 [P] Write `breadcrumb-store.test.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/store/__tests__/breadcrumb-store.test.ts` — covers: `setTrail(trail)`, `setTrail(null)`, empty array rejected (dev warning), `useBreadcrumbs` hook auto-clears on unmount, concurrent pages overwrite correctly. (P-0)

### Implementation for Phase 2 (GREEN — minimal code to pass)

- [X] T013 Implement `safe-storage.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/safe-storage.ts` — try/catch wrapper returning a `Storage`-shaped object; no-op on failure. Makes T004 pass. (P-0, research R2)
- [X] T014 [P] Implement `telemetry.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/telemetry.ts` — export `emit` + `TelemetryEvent` union per `data-model.md` §5. Makes T005 pass. (P-0, FR-032)
- [X] T015 [P] Implement `active-match.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/active-match.ts` — export `resolveActiveItem` per `contracts/shell-api.md` §5. Makes T006 pass. (P-0, FR-011)
- [X] T016 [P] Implement `nav-config.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/nav-config.ts` — export `NAV_CONFIG`, `NavGate`, `NavItem`, `NavGroup` types per `data-model.md` §1 and the visibility matrix table in `research.md` R6. Freeze with `Object.freeze`. Makes T007 pass. Icons from `lucide-react`. (P-0, FR-007, FR-013, FR-014)
- [X] T017 [P] Implement `initials.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/initials.ts` — derive initials from first/last name. Makes T008 pass. (P-0)
- [X] T018 [P] Implement `use-hotkeys.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/use-hotkeys.ts` — export `useHotkeys(bindings)` per `contracts/shell-api.md` §4. Makes T009 pass. (P-0, FR-023, research R5)
- [X] T019 [P] Implement `use-route-pending.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/use-route-pending.ts` — combines `useNavigation()` and `useIsFetching()`. Makes T010 pass. Use `context7` for current API shape. (P-0, FR-031)
- [X] T020 Implement `layout-store.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/store/layout-store.ts` — Zustand store with `persist` middleware wired through `safe-storage.ts` (depends on T013). Partialize to persist only `sidebarCollapsed`. Makes T011 pass. (P-0, FR-009)
- [X] T021 [P] Implement `breadcrumb-store.ts` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/store/breadcrumb-store.ts` — Zustand store (no persist) plus exported `useBreadcrumbs(trail)` hook (mount/unmount lifecycle). Makes T012 pass. (P-0, FR-019)

**Checkpoint**: All foundational modules green, all unit tests pass. Phase 3+ may begin.

---

## Phase 3: User Story 1 — Authenticated shell on every protected route (P1) 🎯 MVP

**Goal**: Persistent shell (header + sidebar + main) wraps every protected route; login and change-password bypass it. (P-1 Desktop shell chrome)

**Independent Test**: Log in as an admin and visit three protected routes. Header and sidebar stay identical; only main content updates. Logout from header returns to login.

### Tests for US1 (RED)

- [X] T022 [P] [US1] Component test for `SkipToContent.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/SkipToContent.test.tsx` — asserts it is the first focusable element inside the shell and jumps to `#main`. (P-1, FR-021)
- [X] T023 [P] [US1] Component test for `TenantBadge.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/TenantBadge.test.tsx` — renders logo + tenant name; long names truncated with `title` tooltip (FR-002, FR-025).
- [X] T024 [P] [US1] Component test for `SidebarItem.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/SidebarItem.test.tsx` — expanded vs. collapsed rendering, active-state class applied when `resolveActiveItem` returns its id, tooltip surfaces when collapsed (`shadcn-ui` `tooltip`).
- [X] T025 [P] [US1] Component test for `SidebarGroup.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/SidebarGroup.test.tsx` — renders labeled and unlabeled groups; hides entirely when all children are hidden.
- [X] T026 [P] [US1] Component test for `SidebarCollapseButton.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/SidebarCollapseButton.test.tsx` — click flips `layout-store.sidebarCollapsed`; ARIA `aria-expanded` reflects state.
- [X] T027 [P] [US1] Component test for `Sidebar.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/Sidebar.test.tsx` — renders ScrollArea when items overflow (FR-029); width changes with collapse state; hidden below 768px (FR-015).
- [X] T028 [P] [US1] Component test for `SidebarNav.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/SidebarNav.test.tsx` — renders every group from `NAV_CONFIG` in order; wires `SidebarItem` to `resolveActiveItem`. (Role gating is added in Phase 5 — this test renders WITHOUT gating.)
- [X] T029 [P] [US1] Component test for `Header.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/Header.test.tsx` — sticky positioning, stacks correctly under `OfflineBanner` (FR-024), left cluster has TenantBadge, right cluster placeholder for later utility tasks. `shadcn-ui` primitives used noted.
- [X] T030 [US1] Integration test for `AppShellLayout.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/AppShellLayout.test.tsx` — full shell renders with header + sidebar + main + `Outlet`; collapse state persists across unmount/remount; skip-to-content is first tab stop; at viewport width 1920px the main content's rendered width does not exceed 1536px and is centered with equal horizontal gutters (FR-020). Acceptance scenarios from US1 #1, #2, #5.

### Implementation for US1 (GREEN)

- [X] T031 [P] [US1] Implement `SkipToContent.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SkipToContent.tsx`. Makes T022 pass. (P-1, FR-021)
- [X] T032 [P] [US1] Implement `TenantBadge.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/TenantBadge.tsx` using `shadcn-ui` `tooltip`. Uses `useAuth()` for tenant name. Makes T023 pass. (P-1, FR-002, FR-025)
- [X] T033 [P] [US1] Implement `SidebarItem.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SidebarItem.tsx` using `shadcn-ui` `tooltip`; calls `telemetry.emit("nav.click", …)` on click; active class driven by `resolveActiveItem`. Makes T024 pass. (P-1, FR-008, FR-010, FR-011)
- [X] T034 [P] [US1] Implement `SidebarGroup.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SidebarGroup.tsx`. Makes T025 pass. (P-1, FR-007)
- [X] T035 [P] [US1] Implement `SidebarCollapseButton.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SidebarCollapseButton.tsx` with `shadcn-ui` `button`; emits `sidebar.toggle`. Makes T026 pass. (P-1, FR-009)
- [X] T036 [US1] Implement `SidebarNav.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SidebarNav.tsx` — renders `NAV_CONFIG` groups via `SidebarGroup`/`SidebarItem`. **Without role gating in this task** (ungated render is what the US1 tests expect; gating arrives in Phase 5). Depends on T033–T035. Makes T028 pass. (P-1, FR-007)
- [X] T037 [US1] Implement `Sidebar.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/Sidebar.tsx` using `shadcn-ui` `scroll-area` and `separator`; wires `SidebarCollapseButton`. Hides with `hidden md:flex` pattern (`tailwindcss-advanced-layouts`). Depends on T036. Makes T027 pass. (P-1, FR-015, FR-029)
- [X] T038 [US1] Implement `Header.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/Header.tsx` — sticky grid layout (`tailwindcss-advanced-layouts`), left cluster contains `TenantBadge`, right cluster has a placeholder slot for Phase 7/Phase 9 utilities. Makes T029 pass. (P-1, FR-001, FR-024)
- [X] T039 [US1] Implement `AppShellLayout.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/AppShellLayout.tsx` — composes `SkipToContent` + existing `OfflineBanner` + `Header` + `Sidebar` + `<main id="main">` + `<Outlet />` from react-router-dom. CSS grid frame (`grid-cols-[auto_1fr]` desktop, `grid-cols-[1fr]` mobile). Main content area wraps the `<Outlet />` in a centered `max-w-screen-2xl` container with responsive horizontal padding (`px-4 md:px-6 lg:px-8`) per FR-020. Depends on T031, T037, T038. Makes T030 pass. (P-1, FR-001, FR-020, FR-026)
- [X] T040 [P] [US1] Create barrel file `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/index.ts` exporting `AppShellLayout` and `useBreadcrumbs` (re-exported from `@/store/breadcrumb-store`). (P-1, contracts §1 & §2)
- [X] T041 [US1] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/App.tsx` — introduce an `<AppShellLayout>` element inside `<RequireAuth>`; move the protected routes (`/`, `/users`, `/users/:id`) under a single parent route using it. Login, change-password, and design-system routes MUST stay outside. Verify no existing module was touched. Depends on T039, T040. (P-1, FR-026)

**Checkpoint**: US1 demo-able — an admin sees the full shell and can navigate between all existing protected routes.

---

## Phase 4: User Story 2 — Mobile drawer navigation (P1)

**Goal**: Below 768px, sidebar collapses to a `<Sheet/>` drawer triggered by a hamburger in the header. (P-3 Mobile drawer)

**Independent Test**: Resize viewport < 768px. Verify sidebar disappears, hamburger appears, drawer opens, tapping a nav item navigates and closes the drawer.

### Tests for US2 (RED)

- [ ] T042 [P] [US2] Component test for `MobileNav.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/MobileNav.test.tsx` — hamburger visible below 768px (FR-015); drawer opens on click; route change closes drawer (FR-016); Escape closes drawer and returns focus to hamburger (FR-017); user card at bottom with logout (FR-018); `telemetry.emit("mobile-drawer.open"/"close", …)` fires with correct `reason`.

### Implementation for US2 (GREEN)

- [ ] T043 [US2] Implement `MobileNav.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/MobileNav.tsx` using `shadcn-ui` `sheet`. Reuses `SidebarNav` (still ungated in this phase) inside the drawer. Respects iOS safe-area insets via `env(safe-area-inset-*)`. Makes T042 pass. (P-3)
- [ ] T044 [US2] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/Header.tsx` — add hamburger button (shown only below 768px) that opens `MobileNav`. Depends on T043. (P-3, FR-015)

**Checkpoint**: US2 demo-able — phone viewport shows hamburger, drawer flow works end-to-end.

---

## Phase 5: User Story 3 — Role-gated navigation (P2)

**Goal**: Hidden nav items per role, verified by the role-visibility matrix integration test that locks SC-002. (P-4 Role gating)

**Independent Test**: Log in as each of the five role combinations in turn; verify DOM contains exactly the expected item IDs per research R6.

### Tests for US3 (RED — the SC-002 gate)

- [ ] T045 [US3] Write `role-visibility.integration.test.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/role-visibility.integration.test.tsx` — one integration test file, five cases (admin, manager, account_executive, recruiter, recruiter+freelancer). Each case mounts `<AbilityProvider><SidebarNav /></AbilityProvider>` with a mocked `useAuth` user and asserts the exact set of visible `NavItem.id`s matches the table in `research.md` R6. Snapshot is a sorted array of strings so drift fails loudly. Depends on T036 existing and currently rendering ALL items (test fails as RED for every role except admin). (P-4, SC-002)

### Implementation for US3 (GREEN)

- [ ] T046 [US3] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SidebarNav.tsx` — add role/ability gating using `useAbility` from `@casl/react` for `gate.kind === "ability"` items, and a role allowlist check for `gate.kind === "roles"` items. A group whose items are all hidden is itself hidden (FR-013). Hide (`return null`), never render-and-disable, per FR-012. Makes T045 pass. (P-4, FR-012, FR-013, FR-014, research R4)
- [ ] T047 [P] [US3] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/lib/nav-config.ts` — gate the "Design system" item with `devOnly: true`; `SidebarNav` skips it when `import.meta.env.DEV === false`. (P-4, FR-014)
- [ ] T047a [US3] Write `degraded-render.test.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/degraded-render.test.tsx` — mount `<SidebarNav>` with a mocked `useAuth()` returning `user.role = null` and separately `user.role = "some-unknown-role"`. Assert that only the `dashboard` nav item renders in both cases, the logout action is still reachable via `UserMenu`, and a `console.warn` diagnostic was emitted naming the malformed role. Covers FR-030. (P-4)
- [ ] T047b [US3] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SidebarNav.tsx` — when the user's role is null/undefined or not one of the 4 valid `UserRole` values, bypass the normal gate evaluation and show only the `dashboard` item; log a single `console.warn("[shell] malformed role", role)` on first render. Makes T047a pass. (P-4, FR-030)

**Checkpoint**: US3 demo-able — the 5-role matrix test is green AND the degraded-role fallback is verified. SC-002 locked.

---

## Phase 6: User Story 4 — Sidebar collapse persistence & active-route highlight (P2)

**Goal**: Prefix-match highlight + persisted collapse state across reloads. Already delivered by Phase 2 (`layout-store`, `active-match`) + Phase 3 (`SidebarItem`, `SidebarCollapseButton`). This phase adds the acceptance-level integration test.

### Tests for US4 (RED)

- [ ] T048 [US4] Integration test at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/sidebar-persistence.integration.test.tsx` — expand, collapse, unmount, remount → collapsed. Hover on collapsed icon → tooltip. Child route `/candidates/123/edit` → "Candidatos" item highlighted (FR-011 prefix-match end-to-end). Acceptance scenarios US4 #1–#5. (P-1/P-2)

### Implementation for US4

*(No new code — behavior already implemented in Phases 2 and 3. If T048 reveals a gap, add a minimal fix task here.)*

- [ ] T049 [US4] If T048 fails on any scenario, open a focused fix task naming the exact file and line. Otherwise mark this task complete by verification only.

**Checkpoint**: US4 demo-able with no new components.

---

## Phase 7: User Story 5 — Theme toggle with persistence (P2)

**Goal**: Light/dark toggle in header, `next-themes`-backed. (P-2 Header utilities — theme slice)

**Independent Test**: Toggle theme; entire shell inverts. Reload; preference persists. Clear preference + OS dark mode → app starts dark.

### Tests for US5 (RED)

- [ ] T050 [P] [US5] Component test for `ThemeToggle.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/ThemeToggle.test.tsx` — click cycles light → dark → system; emits `telemetry.emit("theme.change", …)`; renders correct icon for current theme. (P-2, FR-004)
- [ ] T051 [P] [US5] Integration test at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/theme-persistence.integration.test.tsx` — theme persists across reload via `next-themes` (FR-028); respects `prefers-color-scheme` on first visit (FR-027); reacts live to OS change when preference is "system". Use `context7` for current `next-themes` API. (P-2)

### Implementation for US5 (GREEN)

- [ ] T052 [US5] Implement `ThemeToggle.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/ThemeToggle.tsx` — thin wrapper over `useTheme()` from `next-themes`; `shadcn-ui` `dropdown-menu` with Sun/Moon/Monitor icons. Makes T050 pass. (P-2, research R3)
- [ ] T053 [US5] Verify `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/App.tsx` `<ThemeProvider>` props are: `attribute="class" defaultTheme="system" enableSystem storageKey="bepro.theme"`. Edit only if not set. Makes T051 pass. (P-2, FR-027, FR-028)
- [ ] T054 [US5] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/Header.tsx` — mount `ThemeToggle` in the right cluster. Depends on T052. (P-2)

**Checkpoint**: US5 demo-able.

---

## Phase 8: User Story 6 — Keyboard navigation & accessibility (P2)

**Goal**: Global hotkeys (`/`, `[`, `g d`, `g c`), skip-to-content first tab stop, visible focus rings, AA contrast. (P-6 A11y polish — partial, shortcuts here)

**Independent Test**: Mouse disconnected. Tab from top → skip-to-content first; `/` focuses search; `[` toggles sidebar; `g d` navigates to Dashboard.

### Tests for US6 (RED)

- [ ] T055 [P] [US6] Integration test at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/hotkeys.integration.test.tsx` — all six shortcut scenarios from US6 acceptance list; sequence abort on input focus; emits `telemetry.emit("shortcut.use", …)`. (P-6, FR-023)
- [ ] T056 [P] [US6] Component test at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/focus-ring.test.tsx` — every interactive element in the shell renders a visible focus ring class when focused (FR-022).

### Implementation for US6 (GREEN)

- [ ] T057 [US6] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/AppShellLayout.tsx` — mount a single `useHotkeys([...])` with the four global bindings. `/` focuses the SearchTrigger (will be created in Phase 9 — stub a `data-search-target` selector now). `[` calls `layout-store.toggleSidebar()`. `g d` → `navigate("/")`. `g c` → `navigate("/candidates")`. Depends on T018, T020. Makes T055 pass. (P-6, FR-023)
- [ ] T058 [US6] Audit every new component under `layout/` for `focus-visible:ring-2 focus-visible:ring-ring` (or equivalent) via the `web-design-guidelines` skill; patch any that lack visible focus. Makes T056 pass. (P-6, FR-022)

**Checkpoint**: US6 demo-able — keyboard-only operator can traverse the shell and reach every page without a mouse.

---

## Phase 9: User Story 7 — Header utilities (user menu, notifications placeholder, search entry) (P3)

**Goal**: Avatar + dropdown, notifications bell placeholder, cmd+k search trigger. (P-2 Header utilities — remaining surfaces)

**Independent Test**: Open user menu → see avatar/name/role + 3 actions. Click notifications bell → empty popover. cmd+k → command surface with placeholder copy.

### Tests for US7 (RED)

- [ ] T059 [P] [US7] Component test for `UserMenu.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/UserMenu.test.tsx` — avatar renders or falls back to initials (FR-006); dropdown shows name + role badge + 3 actions; "Cerrar sesión" calls `useAuth().logout`; "Cambiar contraseña" navigates to `/change-password`; "Mi perfil" navigates to `/profile`; an unusually long `firstName + lastName` renders truncated with ellipsis and the full value is surfaced via the underlying element's `title` (FR-025). (P-2, FR-006, FR-025)
- [ ] T060 [P] [US7] Component test for `NotificationsBell.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/NotificationsBell.test.tsx` — click opens a `shadcn-ui` `popover` with "Sin notificaciones por ahora"; no unread badge (no data source); no network request fires. (P-2, FR-005)
- [ ] T061 [P] [US7] Component test for `SearchTrigger.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/SearchTrigger.test.tsx` — cmd+k / ctrl+k opens a `cmdk` `CommandDialog` with "Próximamente" placeholder; no data lookup triggered; has `data-search-target` for the `/` shortcut from T057. (P-2, FR-003)

### Implementation for US7 (GREEN)

- [ ] T062 [P] [US7] Implement `UserMenu.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/UserMenu.tsx` — `shadcn-ui` `avatar` + `dropdown-menu` + `badge`. Uses `initials.ts` for fallback. Makes T059 pass. (P-2)
- [ ] T063 [P] [US7] Implement `NotificationsBell.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/NotificationsBell.tsx` — `shadcn-ui` `popover` with empty-state copy. Makes T060 pass. (P-2, FR-005)
- [ ] T064 [P] [US7] Implement `SearchTrigger.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/SearchTrigger.tsx` — `shadcn-ui` `command` / `dialog` (cmdk). Includes `data-search-target` attribute. Makes T061 pass. (P-2, FR-003)
- [ ] T065 [US7] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/Header.tsx` — mount `SearchTrigger` (center), `NotificationsBell` + `ThemeToggle` + `UserMenu` (right cluster). Depends on T054, T062, T063, T064. (P-2, FR-001, FR-006)
- [ ] T066 [US7] Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/MobileNav.tsx` — add user card at drawer bottom using `UserMenu` primitives (avatar, name, role, logout). Depends on T062. (P-3, FR-018)

**Checkpoint**: US7 demo-able — all header chrome surfaces render with placeholder empty states where appropriate.

---

## Phase 10: Polish & Cross-Cutting (P-5 Breadcrumbs/Progress/Telemetry + P-7 Verification)

**Purpose**: Wire breadcrumbs row and top progress bar, verify telemetry call sites, run full-browser smoke, verify every SC.

### Breadcrumbs & top progress bar (P-5)

- [ ] T067 [P] Component test for `Breadcrumbs.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/Breadcrumbs.test.tsx` — renders trail from `breadcrumb-store`; renders nothing when trail is `null` (FR-019); uses `shadcn-ui` `breadcrumb`; terminal crumb is not a link.
- [ ] T068 Implement `Breadcrumbs.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/Breadcrumbs.tsx` — reads the store; `shadcn-ui` `breadcrumb` primitives. Depends on T021, T067. (P-5, FR-019)
- [ ] T069 [P] Component test for `TopProgressBar.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/__tests__/TopProgressBar.test.tsx` — visible while `useRoutePending()` true; hidden otherwise; `role="progressbar"` + `aria-live="polite"` announce after 500ms; respects `prefers-reduced-motion`. (P-5, FR-031)
- [ ] T070 Implement `TopProgressBar.tsx` at `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/TopProgressBar.tsx` — custom CSS-keyframes bar styled with `--primary`. Depends on T019, T069. (P-5, FR-031, research R1)
- [ ] T071 Edit `/Users/hectorfranco/Documents/BePro/repos/BePro/apps/web/src/components/layout/AppShellLayout.tsx` — mount `TopProgressBar` above header and `Breadcrumbs` immediately above `<main>`. Depends on T068, T070. (P-5)

### Telemetry verification (P-5)

- [ ] T072 Audit every interaction surface (SidebarItem click, SidebarCollapseButton, ThemeToggle, MobileNav open/close, hotkey handlers) to confirm `telemetry.emit(...)` is called with the correct event shape. Add any missing call sites with a unit or interaction test. (P-5, FR-032)

### Accessibility polish (P-6)

- [ ] T073 [P] Verify `prefers-reduced-motion` respect across `Sidebar` collapse animation, `MobileNav` slide-in, `TopProgressBar`, and `ThemeToggle` transitions. Edit Tailwind utility usage as needed. (P-6, SC-003)
- [ ] T074 [P] Run `web-design-guidelines` audit on the entire `apps/web/src/components/layout/` directory; apply any severity-high findings. (P-6, SC-003)

### Cross-browser and device smoke (P-7)

- [ ] T075 [P] Playwright smoke via `playwright` MCP plugin — mobile drawer full flow (open, navigate, close) at 375px viewport. Produces a transcript; no test files committed unless a `tests/e2e/` directory is introduced with team agreement. (P-7, US2)
- [ ] T076 [P] Playwright smoke — keyboard traversal: Tab reaches skip-to-content first; `/` focuses SearchTrigger; `[` toggles sidebar; `g d` navigates to `/`; `g c` navigates to `/candidates`. (P-7, US6)
- [ ] T077 [P] Playwright smoke — theme toggle across reload: set dark, reload, verify `<html class="dark">` on first paint (no flash). (P-7, US5, SC-005)
- [ ] T078 [P] Playwright smoke — top progress bar visible on a throttled slow route transition. (P-7, FR-031)
- [ ] T079 [P] Playwright + `@axe-core` WCAG AA audit of the shell in both themes; zero serious/critical violations. (P-7, SC-003)
- [ ] T080 [P] Viewport sanity sweep — 320, 375, 768, 1024, 1440, 1920 pixels; no horizontal scrollbar at any breakpoint. (P-7, SC-004)

### Performance verification (P-7)

- [ ] T081 Measure shell interactive time from session-verified to first nav click accepted; assert < 150ms on a mid-tier dev machine. Record methodology in the PR description. (P-7, SC-001)
- [ ] T082 Measure mobile drawer open/close/navigate flow on a mid-tier mobile device (DevTools throttling "Mid-tier mobile"); assert < 300ms. (P-7, SC-006)

### Repo verification (P-7)

- [ ] T083 Run `pnpm --filter @bepro/web typecheck && pnpm --filter @bepro/web test` from repo root; both must be green with no new errors. (P-7)
- [ ] T084 Run the `quickstart.md` recipes manually (add a test nav item, set breadcrumbs on an existing page as a dry-run, emit a telemetry event); confirm the module-author developer experience matches the contract. Revert the dry-run edits. (P-7, contracts)
- [ ] T085 Review entire `apps/web/src/components/layout/` tree with the `frontend-design` and `ui-ux-pro-max` skills for visual polish (refined minimalism, token usage, spacing consistency with 003-design-system). Apply any recommended tweaks. (P-7)

**Checkpoint**: Every SC (SC-001 → SC-006) measurably met. Ready for `/speckit.analyze` and PR.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** — starts immediately.
- **Phase 2 (Foundational, P-0)** — starts after Phase 1. **BLOCKS every Phase 3+ task.**
- **Phase 3 (US1, P-1)** — starts after Phase 2.
- **Phase 4 (US2, P-3)** — starts after Phase 3 (uses `SidebarNav`, `Header`).
- **Phase 5 (US3, P-4)** — starts after Phase 3 (gates `SidebarNav`, which must already exist ungated).
- **Phase 6 (US4)** — starts after Phases 2 and 3 (uses `layout-store`, `SidebarItem`).
- **Phase 7 (US5, P-2 theme)** — starts after Phase 3 (mounts into `Header`).
- **Phase 8 (US6, P-6 hotkeys)** — starts after Phase 9 `SearchTrigger` exists OR stub the selector now and fill target later (T057 notes the stub).
- **Phase 9 (US7, P-2 utilities)** — starts after Phase 3 and Phase 7 (adds to the already-mounted header right cluster).
- **Phase 10 (Polish, P-5 + P-7)** — starts after every US phase.

### Within each story

- Test tasks are always before their matching implementation task.
- Multiple components in the same phase are `[P]` if file paths are disjoint.
- `Header.tsx` is edited multiple times across phases (Phase 3 base, Phase 7 `ThemeToggle`, Phase 9 remaining utilities). Those edits are sequential — NO `[P]` between edits to the same file.

---

## Parallelization Guide (two developers: Hector + Javi)

The feature cleanly splits into three disjoint work streams after Phase 2 completes. Each stream can be owned independently.

### Stream A — Foundational & desktop shell (owner: Hector)

- T004 → T021 (Phase 2: entire foundational layer).
- T022 → T041 (Phase 3: desktop shell chrome).
- Deliverable: Admin sees full shell on every protected route.

### Stream B — Mobile & role gating (owner: Javi, starts after Phase 2)

- T042 → T044 (Phase 4: mobile drawer — can start as soon as T036 `SidebarNav` lands from Stream A).
- T045 → T047 (Phase 5: role gating — same prerequisite).
- Deliverable: Drawer flow + role matrix green.

### Stream C — Header utilities & polish (either dev, starts after T038 Header base)

- Phase 7 (T050–T054 — theme) — can start as soon as T038 `Header.tsx` exists.
- Phase 9 (T059–T066 — user menu, notifications, search) — same prerequisite.
- Phase 10 (T067–T085 — polish) — starts after every US phase is in.

### Concretely parallelizable right now at each major checkpoint

- **Within Phase 2**: all T004–T012 tests parallelize; T013–T021 implementations parallelize except T020 (depends on T013).
- **Within Phase 3**: T022–T029 tests parallelize; T031–T035 implementations parallelize; T036 then T037 then T038 then T039 then T041 are sequential.
- **Between Phase 4 and Phase 5**: both can run simultaneously once Stream A reaches T036.
- **Between Phase 7 and Phase 9**: fully parallel once Stream A reaches T038.
- **Phase 10 tests T067, T069**: parallel. Implementations T068 and T070: parallel. All Playwright smoke tasks T075–T080: parallel.

---

## Notes

- `[P]` = disjoint files, no dependency on incomplete tasks.
- `[USn]` = maps task to User Story *n* from `spec.md`.
- Phase tag in parentheses `(P-x)` = parent implementation phase from `plan.md`.
- Tests MUST fail before paired implementation (Constitution V). Pair IDs are colocated within each Phase's "Tests (RED)" and "Implementation (GREEN)" subsections.
- No new third-party dependencies introduced; all shadcn primitives already installed.
- Stop at any checkpoint to validate a user story independently.
- Out of scope (no tasks generated): real search backend, notifications data source, analytics vendor wiring, new CASL subjects, tenant switcher, static route→label breadcrumb map, per-page skeletons, footer.
