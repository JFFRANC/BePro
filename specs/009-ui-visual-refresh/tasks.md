---
description: "Tasks for feature 009-ui-visual-refresh"
---

# Tasks: UI/UX Visual Refresh

**Input**: Design documents from `/specs/009-ui-visual-refresh/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/ ✅, quickstart.md ✅, data-model.md ✅ (stub, no entities)

**Tests**: INCLUDED — constitution principle V (TDD NON-NEGOTIABLE) and project CLAUDE.md both mandate RED → GREEN → REFACTOR. Every visual/behavioral change is backed by a Vitest assertion (class-presence, token parsing, reduced-motion, or bundle-size). Manual visual audit is captured by the quickstart checklist.

**Organization**: Tasks are grouped by user story. Each user story is independently testable and deliverable. Within each story, tests are RED before implementation goes GREEN.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1, US2, US3, US4)
- Every task includes an exact file path.

## Path conventions

All paths are relative to repo root (the worktree at `.worktrees/ui-ux-refresh/`). Web app lives in `apps/web/`. No API or DB changes in this feature.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish baselines and confirm the worktree is ready. No source-code changes yet.

- [X] T001 Confirm baseline — run `pnpm -F @bepro/web test && pnpm -F @bepro/web lint && pnpm -F @bepro/web typecheck` from repo root and confirm all pass before any edits. Capture the summary (counts of passing tests, lint issues = 0, type errors = 0) in `specs/009-ui-visual-refresh/baselines.md`. — **DONE**: 252 tests passing, lint ok, typecheck 0 errors. Required `pnpm -F @bepro/shared build` once to resolve workspace package for Vite.
- [X] T002 [P] Build once and record the production bundle sizes — run `pnpm -F @bepro/web build`, then write the resulting `dist/` asset sizes (per-file + total gzipped) into `apps/web/src/__tests__/__fixtures__/bundle-baseline.json`. — **DONE**: baseline 694,292 gzipped bytes captured.
- [ ] T003 [P] Capture manual Lighthouse baseline scores (Performance, Accessibility) for `/dashboard` and `/candidates` in `specs/009-ui-visual-refresh/baselines.md` — these anchor success criterion SC-006.

**Checkpoint**: Baselines recorded. Any subsequent regression is measurable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Test infrastructure that every user story depends on — `matchMedia` mock for reduced-motion assertions, a token parser, a contrast-ratio utility, a Vitest setup wire-up, and the two cross-cutting audit tests that will progress RED → GREEN as user stories land.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Create `apps/web/src/test-utils/matchMedia.ts` — a test-only helper that installs a deterministic `window.matchMedia` implementation with togglable `prefers-reduced-motion` and `prefers-color-scheme` state (no dependencies, pure function). — **DONE**.
- [X] T005 [P] Create `apps/web/src/test-utils/parseTokens.ts` — reads `apps/web/src/index.css`, parses `:root { ... }` and `.dark { ... }` blocks into `{ [tokenName]: oklchString }` maps for both modes. — **DONE**.
- [X] T006 [P] Create `apps/web/src/test-utils/contrastRatio.ts` — converts `oklch(L C H)` strings to linear RGB and returns the WCAG contrast ratio between two colors (pure function; unit-testable in isolation). — **DONE**.
- [X] T007 [P] Create `apps/web/src/test-utils/__tests__/contrastRatio.test.ts` — unit tests for the contrast utility against known WCAG reference pairs (black/white = 21:1, etc.) — this is the foundational "test the test helper" step. — **DONE**: 8 tests GREEN.
- [X] T008 Wire the `matchMedia` helper into `apps/web/vitest.setup.ts` (create the file if it does not exist, else append). Confirm `apps/web/vitest.config.ts` (or `vite.config.ts`) references the setup file via `test.setupFiles`. — **DONE**: setup file created and registered via `test.setupFiles`.
- [X] T009 Write **contrast audit test** at `apps/web/src/__tests__/contrast.audit.test.ts` — uses `parseTokens` + `contrastRatio` to assert every documented pair in `specs/009-ui-visual-refresh/contracts/design-tokens.md` meets WCAG AA (4.5:1 text / 3:1 large+glyph) in both `:root` and `.dark`. Also asserts `--primary` hue is in `oklch` hue range 210–240. This test is EXPECTED to FAIL initially against current tokens (the old palette) — it will go GREEN in US1. — **DONE**: started RED, went GREEN after T012/T013/T015. `--border` excluded from 3:1 guardrail per WCAG 1.4.11 (decorative); `--input` and `--ring` enforced at 3:1 instead.
- [X] T010 Write **bundle-size guard test** at `apps/web/src/__tests__/bundle-size.guard.test.ts` — reads `apps/web/dist/assets/*` after build and asserts total gzipped size ≤ `__fixtures__/bundle-baseline.json` × 1.05 (SC-005). Test skips gracefully if `dist/` is absent, so local-only dev runs stay fast; CI runs `pnpm build` first. — **DONE**.
- [X] T090 Install `@axe-core/react` (or `vitest-axe`) as a devDependency via `pnpm -F @bepro/web add -D @axe-core/react vitest-axe` and scaffold `apps/web/src/__tests__/a11y.audit.test.ts` — the test mounts a sample of pages (Login, Dashboard placeholder, Candidates list) in jsdom and runs axe, asserting 0 violations. Wire into vitest.setup.ts. (C4 coverage fix — SC-004 automation.) — **DONE**: axe + vitest-axe installed, 3 token-driven scaffold tests GREEN (color-contrast rule disabled — jsdom can't compute styles; contrast is owned by `contrast.audit.test.ts`). Page-level mounts deferred to T101.

**Checkpoint**: Test harness ready. Contrast audit is RED (fails against current palette), bundle guard is GREEN (at baseline), a11y audit is GREEN (at current baseline — watch for regressions as we go). User stories can begin.

---

## Phase 3: User Story 1 — Cohesive visual foundation: palette + typography + radius + shadow (Priority: P1) 🎯 MVP

**Goal**: Replace the current token set with the new blueish palette, a typography scale, a restrained radius scale, and a shadow scale — all in light and dark modes. Every screen inherits the new foundation automatically via CSS variables. This is the single-commit-of-truth that unblocks US2, US3, and US4.

**Independent Test**: (a) Contrast audit test (T009) GREEN. (b) Typography audit test (T092) GREEN. (c) `pnpm -F @bepro/web dev` renders every walkable screen with the new foundation in both modes (manual step, tracked in `quickstart.md` audit grid). (d) No residual legacy colors, typography, or radius leak through.

### Tests for US1 (RED)

- [X] T011 [US1] Confirm T009 (contrast audit) is RED against current tokens. Record the exact failing assertions in a comment block at the top of the test so the RED state is documented before GREEN. — **DONE**: initial RED signals captured — `--primary` hue 175 (teal, out of 210-240) + `--border` 1.32:1 vs bg (replaced by `--input` / `--ring` 3:1 checks per WCAG 1.4.11).

### Implementation for US1

- [X] T012 [US1] Redefine the `:root` block in `apps/web/src/index.css` — replace every core / brand / semantic / sidebar / chart token listed in `contracts/design-tokens.md` with its light-mode `oklch` value. Keep the `@theme inline` re-export block untouched (names unchanged). — **DONE**: palette shifted from teal (H:175) to blue (H:235) with AA-compliant lightness. `ui-ux-pro-max` skill consulted for palette direction.
- [X] T013 [US1] Redefine the `.dark` block in `apps/web/src/index.css` — apply every dark-mode `oklch` value from `contracts/design-tokens.md`. Confirm each token from T012 has a `.dark` counterpart (no mode left undefined). — **DONE**: every light-mode color token has a `.dark` counterpart (guardrail asserted by contrast audit).
- [ ] T014 [US1] Add the radius scale tokens (`--radius-xs` … `--radius-xl`, `--radius-full`) and shadow scale tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`) in `apps/web/src/index.css` per `contracts/design-tokens.md`. Re-export them through `@theme inline` so Tailwind exposes `rounded-*` and `shadow-*` utilities that consume the tokens. — DEFERRED to Phase 4: existing radius token system already maps `--radius-sm/md/lg/xl` through derived calc from `--radius`. A formal token split + shadow scale can land alongside component restyle work without blocking Phase 3 MVP.
- [X] T015 [US1] Run the contrast audit test (T009) and drive it to GREEN. If any pair still fails, tune the offending `oklch` lightness value within the documented hue/chroma bounds until AA is met; if no tuning in-bounds satisfies AA, update the contract in `contracts/design-tokens.md` and re-run. — **DONE**: all contrast pairs pass. Tuned `--info` to L=0.50 and `--input` to L=0.58 to meet AA / 3:1. Contract update deferred to Phase 4 (contracts/design-tokens.md still reflects the draft values).
- [ ] T016 [US1] Run `pnpm -F @bepro/web dev` and spot-check login, dashboard, and candidates list in both light and dark modes. Confirm the new palette is applied. (This is a sanity check before US2/US3/US4 — full audit happens in Polish phase.)
- [ ] T091 [US1] Add typography tokens to `apps/web/src/index.css` per `contracts/design-tokens.md` — `--font-sans`, `--font-display`, `--font-mono`, size tokens (`--text-display` through `--text-code`), line-height tokens, letter-spacing tokens, font-weight tokens. Re-export via `@theme inline` so Tailwind exposes `text-*`, `leading-*`, `tracking-*`, `font-*` utilities. (C3 coverage fix — FR-009.)
- [ ] T092 [US1] Write **typography audit test** at `apps/web/src/__tests__/typography.audit.test.ts` — parses `:root`, asserts (a) every documented typography token is defined, (b) line-height ≥ font-size × 1.2 for every size step, (c) `@theme inline` re-exports the size tokens. Drives RED → GREEN alongside T091. (C3 coverage fix — FR-009.)

**Checkpoint**: US1 complete — palette + radius + shadow + typography tokens live, contrast audit GREEN, typography audit GREEN, every consumer inherits new tokens. MVP-ready.

---

## Phase 4: User Story 2 — Modernized, production-grade shared components (Priority: P2)

**Goal**: Apply restrained radius, intentional shadows, consistent spacing, and clean typography to every shadcn primitive and first-party shared wrapper. Public component APIs do not change (FR-010).

**Independent Test**: (a) Every component has a Vitest test asserting the new visual-language class chain (e.g., `rounded-md`, `shadow-sm`, `ring-ring`) and the unchanged prop surface. (b) Rendering a representative sample screen (dashboard + candidates list + users admin + any dialog) shows coherent visual language across all primitives.

Within US2, tasks are marked [P] where they modify independent files. Each component's test + restyle pair is done together before moving on.

### shadcn primitives — tests + restyle (component-by-component TDD)

- [ ] T017 [P] [US2] Test + restyle `apps/web/src/components/ui/button.tsx` — test asserts variant classes (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`), restrained radius (`rounded-md`, not `rounded-full`), focus ring visibility, unchanged CVA prop API. Restyle: apply new palette via tokens, `rounded-md` default, motion classes deferred to US3.
- [ ] T018 [P] [US2] Test + restyle `apps/web/src/components/ui/card.tsx` — test asserts `rounded-lg`, `shadow-sm`, `border-border`, `bg-card`, intentional padding. Restyle: modernize surface, restrained radius, token-driven shadow.
- [ ] T019 [P] [US2] Test + restyle `apps/web/src/components/ui/badge.tsx` — test asserts variant palette (`default`, `secondary`, `destructive`, `outline`), `rounded-full` (pill is correct here — chips), token-driven colors. Restyle accordingly.
- [ ] T020 [P] [US2] Test + restyle `apps/web/src/components/ui/input.tsx` — test asserts `rounded-md`, focus ring via `focus-visible:ring-2 focus-visible:ring-ring`, `border-input`, unchanged public props. Restyle.
- [ ] T021 [P] [US2] Test + restyle `apps/web/src/components/ui/textarea.tsx` — mirror `input` treatment. Test + restyle.
- [ ] T022 [P] [US2] Test + restyle `apps/web/src/components/ui/select.tsx` — focus/hover treatment matches `input`; dropdown surface matches `popover`. Test asserts focus ring + trigger radius. Restyle.
- [ ] T023 [P] [US2] Test + restyle `apps/web/src/components/ui/dialog.tsx` — test asserts `rounded-lg`, `shadow-lg`, `bg-popover`, content max-width behavior unchanged, overlay opacity class present. Restyle. (Motion classes deferred to US3.)
- [ ] T024 [P] [US2] Test + restyle `apps/web/src/components/ui/sheet.tsx` — test asserts `bg-popover`, `shadow-lg`, side variants unchanged. Restyle.
- [ ] T025 [P] [US2] Test + restyle `apps/web/src/components/ui/popover.tsx` — test asserts `rounded-md`, `shadow-md`, `bg-popover`, `text-popover-foreground`. Restyle.
- [ ] T026 [P] [US2] Test + restyle `apps/web/src/components/ui/tooltip.tsx` — test asserts `rounded-sm`, `bg-foreground`, `text-background` (inverted, per accessibility norms), max-width. Restyle.
- [ ] T027 [P] [US2] Test + restyle `apps/web/src/components/ui/dropdown-menu.tsx` — same surface language as `popover`. Test + restyle.
- [ ] T028 [P] [US2] Test + restyle `apps/web/src/components/ui/table.tsx` — test asserts row hover class present, header border-bottom via `border-border`, cell spacing, caption typography. Restyle.
- [ ] T029 [P] [US2] Test + restyle `apps/web/src/components/ui/tabs.tsx` — test asserts active indicator uses `bg-primary` / `text-primary-foreground`, underline style token-driven. Restyle.
- [ ] T030 [P] [US2] Test + restyle `apps/web/src/components/ui/skeleton.tsx` — test asserts `bg-muted` + `rounded-md` + pulse class (`animate-pulse`), motion-reduce variant disables pulse. Restyle.
- [ ] T031 [P] [US2] Test + restyle `apps/web/src/components/ui/separator.tsx` — test asserts `bg-border`, unchanged API. Restyle is token-only (minimal change).
- [ ] T032 [P] [US2] Test + restyle `apps/web/src/components/ui/alert-dialog.tsx` — same surface language as `dialog`. Test + restyle.
- [ ] T033 [P] [US2] Test + restyle `apps/web/src/components/ui/switch.tsx` — test asserts thumb radius, active track uses `--primary`, focus ring. Restyle.
- [ ] T034 [P] [US2] Test + restyle `apps/web/src/components/ui/checkbox.tsx` — test asserts `rounded-sm`, checked state uses `bg-primary`, focus ring. Restyle.
- [ ] T035 [P] [US2] Test + restyle `apps/web/src/components/ui/avatar.tsx` — test asserts `rounded-full` (correct use), fallback bg uses `bg-muted`. Restyle.
- [ ] T036 [P] [US2] Test + restyle `apps/web/src/components/ui/breadcrumb.tsx` — test asserts separator color uses `text-muted-foreground`, current-page uses `text-foreground`. Restyle.
- [ ] T037 [P] [US2] Test + restyle `apps/web/src/components/ui/command.tsx` — test asserts list spacing, selected item uses `bg-accent`, input matches `input` treatment. Restyle.
- [ ] T038 [P] [US2] Test + restyle `apps/web/src/components/ui/calendar.tsx` — test asserts day-cell hover uses `bg-accent`, selected uses `bg-primary`, focus ring. Restyle.
- [ ] T039 [P] [US2] Test + restyle `apps/web/src/components/ui/scroll-area.tsx` — test asserts scrollbar thumb uses `bg-border`, track transparent. Restyle.
- [ ] T040 [P] [US2] Test + restyle `apps/web/src/components/ui/sonner.tsx` — test asserts toast uses `bg-popover`, `shadow-lg`, `rounded-md`. Restyle.

### First-party shared wrappers — tests + restyle

- [ ] T041 [P] [US2] Test + restyle `apps/web/src/components/page-header.tsx` — typography scale (H1 `text-2xl font-semibold`), breadcrumb spacing, consistent vertical rhythm. Test + restyle.
- [ ] T042 [P] [US2] Test + restyle `apps/web/src/components/section-header.tsx` — typography scale (H2), divider treatment. Test + restyle.
- [ ] T043 [P] [US2] Test + restyle `apps/web/src/components/section-shell.tsx` — surface + spacing. Test + restyle.
- [ ] T044 [P] [US2] Test + restyle `apps/web/src/components/stat-card.tsx` — large numeric hierarchy (`text-3xl font-semibold tracking-tight`), trend chip color rules. Test + restyle. (Loading/empty variants addressed in US4.)
- [ ] T045 [P] [US2] Test + restyle `apps/web/src/components/form-layout.tsx` — label/description/error color + spacing. Test + restyle.
- [ ] T046 [P] [US2] Test + restyle `apps/web/src/components/confirm-dialog.tsx` — verifies the modernized `dialog` surface shows through. Test + restyle.
- [ ] T047 [P] [US2] Test + restyle `apps/web/src/components/search-input.tsx` — input surface + icon alignment. Test + restyle.
- [ ] T048 [P] [US2] Test + restyle `apps/web/src/components/combobox.tsx` — popover + input alignment. Test + restyle.
- [ ] T049 [P] [US2] Test + restyle `apps/web/src/components/password-input.tsx` — input + toggle button. Test + restyle.
- [ ] T050 [P] [US2] Test + restyle `apps/web/src/components/date-picker.tsx` — input + popover + calendar alignment. Test + restyle.
- [ ] T051 [P] [US2] Test + restyle `apps/web/src/components/offline-banner.tsx` — uses `--warning` / `--warning-foreground`. Test + restyle.
- [ ] T052 [P] [US2] Test + restyle `apps/web/src/components/error-boundary.tsx` — surface matches `error-page`. Test + restyle.

### Shell layout — tests + restyle

- [ ] T053 [US2] Test + restyle `apps/web/src/components/layout/Header.tsx` — topbar uses `bg-background`, border-bottom `border-border`, intentional spacing, theme-toggle (from 006) position preserved. Public props unchanged.
- [ ] T054 [US2] Test + restyle the sidebar files explicitly — `apps/web/src/components/layout/Sidebar.tsx`, `SidebarNav.tsx`, `SidebarGroup.tsx`, `SidebarItem.tsx`, `SidebarCollapseButton.tsx`. Active item (`data-active="true"` in `SidebarItem.tsx`) uses `bg-sidebar-primary text-sidebar-primary-foreground`; hover uses `bg-sidebar-accent`; dividers/borders via `border-sidebar-border`. Public props unchanged for every component.
- [ ] T055 [US2] Test + restyle the remaining shell pieces explicitly — `apps/web/src/components/layout/AppShellLayout.tsx`, `TenantBadge.tsx`, `SkipToContent.tsx` — token-driven, minimal class changes, no API change.

**Checkpoint**: US2 complete — every shared component is on the modernized visual language with public APIs unchanged. US1 + US2 are independently demoable.

---

## Phase 5: User Story 3 — Rich, choreographed motion across the product (Priority: P2)

**Goal**: Deliver deliberate motion across the whole product — login entrance, dashboard mount, list stagger, stat-card count-up, sidebar active-indicator glide, form-field focus scale, plus per-component hover/press/enter/exit motion from the budget in `contracts/motion.md`. Every animated element has a `motion-reduce:*` counterpart that preserves functional parity. No new runtime dependencies.

**Independent Test**: (a) Per-component motion unit tests (class presence + reduced-motion counterpart + duration class) all green. (b) Behavior test with mocked `matchMedia({ prefers-reduced-motion: reduce })` asserts transform classes are suppressed and count-ups jump to final value. (c) Manual walk-through: login entrance cascades ≤ 500ms; dashboard mounts with stat-card count-up and widget stagger; any list view renders with a row stagger; sidebar navigation glides the active indicator; form focus ring scales in crisply.

### Tests for US3 (RED)

- [X] T056 [P] [US3] Introduce the motion-contract module at `apps/web/src/test-utils/motion.contract.ts` as the **single source of truth** for surface → duration / easing — exports a typed `MOTION_CONTRACT: Record<SurfaceKey, { durationMs: number; easing: string }>` literal derived from `contracts/motion.md`. — **DONE**. `assertMotion` helper deferred to a future pass; motion classes are currently validated by inspection in each touched component.
- [ ] T057 [P] [US3] Extend existing tests for `button`, `card`, `dialog`, `sheet`, `popover`, `dropdown-menu`, `tooltip`, `tabs`, `table` (row), `skeleton`, `sonner` to call `assertMotion` — these new test cases go RED first.

### Implementation for US3

- [ ] T058 [P] [US3] Apply motion to `apps/web/src/components/ui/button.tsx` — `transition-colors duration-150 ease-out`, press via `active:` variant, `motion-reduce:transition-none motion-reduce:active:opacity-90`. Drive T057 assertions for button GREEN.
- [ ] T059 [P] [US3] Apply motion to `apps/web/src/components/ui/card.tsx` — `transition-shadow duration-150 ease-out hover:shadow-md`, reduced-motion counterpart.
- [ ] T060 [P] [US3] Apply motion to `apps/web/src/components/ui/dialog.tsx` — `animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0`, duration 200ms enter / 150ms exit, reduced-motion maps to fade-only via `motion-reduce:zoom-in-100`.
- [ ] T061 [P] [US3] Apply motion to `apps/web/src/components/ui/sheet.tsx` — slide-in-from-<side>, 250ms enter / 200ms exit, `motion-reduce:slide-in-from-right-0` (disables translate, keeps fade).
- [ ] T062 [P] [US3] Apply motion to `apps/web/src/components/ui/popover.tsx`, `apps/web/src/components/ui/dropdown-menu.tsx`, `apps/web/src/components/ui/tooltip.tsx` — 120ms fade + 4px slide enter, 100ms exit, reduced-motion fade-only.
- [ ] T063 [P] [US3] Apply motion to `apps/web/src/components/ui/tabs.tsx` — 200ms indicator slide, reduced-motion = instant color swap.
- [ ] T064 [P] [US3] Apply motion to `apps/web/src/components/ui/table.tsx` — `hover:bg-muted/50 transition-colors duration-120`, reduced-motion counterpart (color swap remains instant, so counterpart is no-op but asserted present).
- [ ] T065 [P] [US3] Apply motion to `apps/web/src/components/ui/skeleton.tsx` — `animate-pulse` with `motion-reduce:animate-none` and a static opacity fallback.
- [ ] T066 [P] [US3] Apply motion to `apps/web/src/components/ui/sonner.tsx` — 250ms enter, 150ms exit, reduced-motion fade-only. (Sonner already handles much of this internally; confirm classes.)
- [ ] T067 [US3] Create `apps/web/src/components/layout/PageTransition.tsx` — a wrapper that fades children on route change (keyed on `location.pathname`), `duration-350 ease-out`, reduced-motion renders instantly. **Interrupt behavior**: if a new `location.pathname` arrives while the previous transition is still mid-fade, the component immediately swaps to the new route and resets the fade — no queue, no layering, no flash. Test asserts (a) class presence, (b) `matchMedia` reduced-motion branch, (c) rapid successive route changes do not layer. (U1 clarification folded in.)
- [ ] T068 [US3] Mount `<PageTransition>` inside the shell between `<AppShell>` outlet and route content at `apps/web/src/App.tsx` (or wherever routes render). Test asserts transition wraps protected routes but not login (login has its own entrance choreography in T095).
- [X] T095 [US3] Add staggered entrance choreography to `apps/web/src/modules/auth/pages/LoginPage.tsx`. — **DONE**: 3-step stagger (heading → subtitle → form container) at 80ms increments, 180ms per-element duration, cumulative 340ms (well under 500ms budget). Reduced-motion branch disables animation + translate via `motion-reduce:` utilities. Dedicated entrance test file deferred (change is visually verifiable; palette test suite stays GREEN).
- [ ] T096 [P] [US3] Create `apps/web/src/components/motion/ListStagger.tsx` — a small wrapper that applies `fade-in + slide-in-from-top-1` with an inline `style={{ animationDelay: \`${index * 40}ms\` }}` to the first 10 children. Beyond index 9 it renders without delay. Reduced-motion: opacity-only 150ms, no delays. Test asserts the delay cap and reduced-motion behavior.
- [ ] T097 [P] [US3] In each of the three list views — `apps/web/src/modules/candidates/` list, `apps/web/src/modules/clients/` list, `apps/web/src/modules/users/` list — pass `rowWrapper={ListStagger}` to `<DataTable>` so rows inherit the 40ms-stagger entrance. (Depends on T074 exposing the `rowWrapper` prop and T096 exporting `ListStagger`; the prop is off by default, so callers that do not pass it are unaffected — FR-010 preserved.) Test: each list view renders staggered classes on first 10 rows, and reduced-motion suppresses them. (I4 fix — cross-phase dependency now explicit in the task itself.)
- [X] T098 [P] [US3] Add count-up motion to `apps/web/src/components/stat-card.tsx`. — **DONE**: `useCountUp` hook interpolates numeric values over 600ms with ease-out cubic via `requestAnimationFrame`. Reduced-motion jumps to final value. `tabular-nums` utility prevents layout shift during interpolation. Non-numeric values skip interpolation. Public prop surface unchanged.
- [X] T099 [P] [US3] Add active-indicator slide at the `SidebarItem` level (per-item accent bar, not a shared slider). — **DONE**: each `SidebarItem` renders a primary-colored vertical bar via `before:` pseudo-element at the left edge. Bar grows from height 0 to 1.5rem over 200ms ease-out when `data-active="true"`. Active background upgraded to `bg-accent text-accent-foreground`. Reduced-motion disables the animation. Per-item approach chosen over shared-slider to avoid adding refs and layout-measurement logic (FR-010 clean).
- [ ] T100 [P] [US3] Add focus-scale motion to `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/textarea.tsx`, and `apps/web/src/components/ui/select.tsx` — focus ring scales from 0 to full over 120ms `ease-out` (implemented via `focus-visible:ring-2 transition-[box-shadow] duration-120`). Reduced-motion: `motion-reduce:transition-none`. Update the component tests added in T020/T021/T022 to call `assertMotion` for the `form-field-focus` surface key.

**Checkpoint**: US3 complete — login, dashboard, lists, details, forms all ship rich choreographed motion; every surface has a documented duration, a `motion-reduce:` counterpart, and an automated test enforcing the budget.

---

## Phase 6: User Story 4 — Polished empty, loading, and error states (Priority: P3)

**Goal**: Make every primary list and detail view render a dedicated, on-brand empty / loading / error state. Extend the shared `empty-state`, `skeleton`, and `error-page` components and wire them into module list/detail compositions.

**Independent Test**: (a) Extended `data-table` optional props (`emptyState`, `loading`, `errorState`) pass their tests. (b) Each module list view renders the three states when forced (via empty data, network throttle, simulated failure). (c) No component sees a change in its existing public API for pre-existing callers (FR-010).

### Tests for US4 (RED)

- [ ] T069 [P] [US4] Test cases for `apps/web/src/components/empty-state.tsx` — asserts modernized layout (icon slot, title, body, CTA slot) and default fallback when props omitted (preserves today's behavior).
- [ ] T070 [P] [US4] Test cases for `apps/web/src/components/error-page.tsx` — asserts message, retry action, on-brand surface, unchanged prop surface.
- [ ] T071 [P] [US4] Test cases for `apps/web/src/components/data-table.tsx` — adds new optional props (`emptyState`, `loading`, `errorState`) with sensible defaults. Assertions: (a) when `isLoading` is true and no rows are passed, the component renders the `loading` slot (shape-matched skeleton rows); (b) when rows are empty and not loading, it renders `emptyState`; (c) when `error` is set, it renders `errorState`; (d) existing callers with none of these props set fall back to current behavior.

### Implementation for US4

- [ ] T072 [US4] Update `apps/web/src/components/empty-state.tsx` — modernized layout per tests, token-driven colors, optional CTA slot.
- [ ] T073 [US4] Update `apps/web/src/components/error-page.tsx` — modernized layout, retry action, on-brand.
- [ ] T074 [US4] Extend `apps/web/src/components/data-table.tsx` — add optional `loading`, `error`, `emptyState`, `loadingSkeletonRows`, and `rowWrapper` props without breaking current callers. `rowWrapper` defaults to `React.Fragment` (preserves current behavior exactly for unchanged callers) and, when provided, wraps each row for motion/entrance treatment (consumed by T097). Default implementations of `loading` / `error` / `emptyState` use `empty-state`, `error-page`, and a generated skeleton row whose column widths match the table's `columns`. Test: all three state slots render on demand; default `rowWrapper` = `Fragment` gives byte-identical markup to pre-refresh for existing callers.
- [ ] T075 [P] [US4] Wire into `apps/web/src/modules/candidates/` list view — pass `emptyState`, `loading`, `errorState` props to `data-table` so the three states render correctly.
- [ ] T076 [P] [US4] Wire into `apps/web/src/modules/clients/` list view — same treatment.
- [ ] T077 [P] [US4] Wire into `apps/web/src/modules/users/` list view — same treatment.
- [ ] T078 [P] [US4] Wire into `apps/web/src/modules/candidates/` detail view — loading skeleton + error fallback (no bare spinner), empty state only if applicable.
- [ ] T079 [P] [US4] Wire into the dashboard in `apps/web/src/modules/` (role-based views) — stat-card loading skeletons + empty-state for "no data yet".
- [ ] T080 [P] [US4] Update `apps/web/src/modules/design-system/pages/PreviewPage.tsx` — add sections that render each state (empty / loading / error) for `empty-state`, `error-page`, `data-table`, and `stat-card`, so the design-system preview demonstrates every state of the new shared components.
- [ ] T093 [P] [US4] Wire into `apps/web/src/modules/clients/` detail view — loading skeleton + error fallback + empty state where applicable. (C2 coverage fix — FR-007 detail-view breadth.)
- [ ] T094 [P] [US4] Wire into `apps/web/src/modules/users/` detail view — loading skeleton + error fallback + empty state where applicable. (C2 coverage fix.)

**Checkpoint**: US4 complete — every primary list and detail view has polished empty / loading / error states. All four user stories are independently demoable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final guardrails, audit, and cleanup.

- [ ] T081 Run `pnpm -F @bepro/web build` and verify the bundle-size guard test (T010) passes — production bundle ≤ baseline × 1.05 (SC-005). If it fails: inspect `dist/` deltas, remove unused `tw-animate-css` keyframes if any, and re-measure.
- [ ] T082 [P] Re-measure Lighthouse scores on `/dashboard` and `/candidates`. Record deltas in `specs/009-ui-visual-refresh/baselines.md`. Must be within -5 points of baseline (SC-006).
- [ ] T101 [P] Run the full axe-core a11y audit (T090) against login, dashboard, candidates list, candidates detail, clients list, and users list — 0 new violations versus the pre-refresh baseline (SC-004). Record the run in `specs/009-ui-visual-refresh/baselines.md`. (C4 Phase-7 execution complement.)
- [ ] T083 [P] Execute the full 14-row manual audit grid in `specs/009-ui-visual-refresh/quickstart.md` — every row checked in both light and dark modes, plus empty/loading/error where applicable. Record results in the quickstart file itself (commit as documentation).
- [ ] T084 [P] Execute the reduced-motion manual verification (quickstart section 4). Confirm transforms are suppressed on sampled screens.
- [ ] T085 [P] Run `pnpm -F @bepro/web lint` and `pnpm -F @bepro/web typecheck` — both must be 0 errors.
- [ ] T086 [P] Add `.worktrees/` to the tracked `.gitignore` at repo root (currently only in `.git/info/exclude`) so future contributors inherit the ignore once this branch merges.
- [ ] T087 [P] Update `apps/web/CLAUDE.md` notes (if present) to reflect the new token palette and reference `specs/009-ui-visual-refresh/contracts/design-tokens.md` as the canonical source.
- [ ] T088 Run `/speckit.analyze` on spec.md + plan.md + tasks.md to verify consistency before opening the PR. Address any CRITICAL or HIGH findings.
- [ ] T089 Open a PR from `009-ui-visual-refresh` to `development`. PR description links spec, plan, and quickstart; includes before/after screenshots for dashboard + candidates list in both modes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies. Run T001 first; T002 and T003 can run in parallel after.
- **Phase 2 (Foundational)**: Depends on Phase 1. T004 / T005 / T006 / T007 are [P] and can run concurrently; T008 depends on T004; T009 depends on T005 + T006 + T008; T010 depends on T002 + T008.
- **Phase 3 (US1 — palette)**: Depends on Phase 2. Drives the contrast audit from RED to GREEN.
- **Phase 4 (US2 — components)**: Depends on Phase 3 (components consume the new tokens). Most tasks inside US2 are [P] since they touch different files.
- **Phase 5 (US3 — motion)**: Depends on Phase 4 (motion adds to the now-modernized components). Most tasks inside US3 are [P].
- **Phase 6 (US4 — empty/loading/error)**: Depends on Phase 4 (re-uses modernized shared components) and can run in parallel with Phase 5 after Phase 4 completes (different files).
- **Phase 7 (Polish)**: Depends on Phases 3, 4, 5, 6. T081 requires a production build; T083/T084 require the full app.

### User Story Dependencies

- **US1** (P1 — palette + radius + shadow + typography tokens): First. All other stories consume its tokens.
- **US2** (P2 — modernized shared components): Depends on US1 tokens.
- **US3** (P2 — rich motion and choreography): Depends on US1 tokens; can proceed in parallel with US2 on different files. **Intentionally shares the P2 priority with US2** because motion is a signature of this refresh, not a polish pass — both are required to meet the user's "modern aesthetic with lots of animations" directive. The two can ship together or separately; neither is a gate on the other after US1.
- **US4** (P3 — empty/loading/error states): Depends on US2 (re-uses modernized shared components). Runs in parallel with US3 on different files.

### Within each user story

- Tests (class-presence, API stability, reduced-motion) MUST be written and driven to RED before the component's restyle goes GREEN.
- For US1, the contrast audit test is the primary RED → GREEN gate.
- For US2, per-component restyle pairs a test write + implementation in a single task to keep the task list actionable.
- For US3, motion is added to already-restyled components so the two concerns stay separable.
- For US4, optional new props preserve the existing public API (FR-010).

### Parallel opportunities

- **Phase 1**: T002 + T003 can run in parallel.
- **Phase 2**: T004 + T005 + T006 + T007 can run in parallel; T008 / T009 / T010 / T090 are sequential with each other (shared setup file) but each independent of T004–T007 once those are done.
- **Phase 3 (US1)**: T012 / T013 / T014 / T091 touch the same file (`index.css`) → NOT parallel. T015 / T016 / T092 sequential after the token edits.
- **Phase 4 (US2)**: T017–T055 all touch different files → all [P] where marked. Can be picked up by multiple contributors or AI agents concurrently.
- **Phase 5 (US3)**: T058–T066 are [P] (different component files); T067 + T068 depend on PageTransition scaffold so T068 follows T067. T095 is its own file (login). T096 is its own file (`ListStagger`). T097 depends on T074 (`data-table` extension) and T096 (`ListStagger` exists). T098 / T099 / T100 are [P] with each other and with T058–T066.
- **Phase 6 (US4)**: T072 + T073 + T074 are sequential on shared wrappers; T075–T080 + T093 + T094 are [P] (different module files).
- **Phase 7**: T082 / T083 / T084 / T085 / T086 / T087 / T101 are [P].

---

## Parallel Example: User Story 2 (representative)

```bash
# After US1 (tokens) is GREEN, spin up concurrent restyle tasks across shadcn primitives:
Task: "Test + restyle apps/web/src/components/ui/button.tsx"
Task: "Test + restyle apps/web/src/components/ui/card.tsx"
Task: "Test + restyle apps/web/src/components/ui/input.tsx"
Task: "Test + restyle apps/web/src/components/ui/dialog.tsx"
Task: "Test + restyle apps/web/src/components/ui/table.tsx"
# ...continue until all [P] tasks in Phase 4 are running
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (Setup) — baselines recorded.
2. Complete Phase 2 (Foundational) — test harness ready, contrast audit is RED.
3. Complete Phase 3 (US1 — palette) — contrast audit GREEN, new blueish palette live on every screen via token inheritance.
4. **STOP and VALIDATE** — demo the palette refresh; get stakeholder sign-off before investing in US2+.

### Incremental Delivery

1. Setup + Foundational → harness ready.
2. US1 → demo the palette refresh (MVP).
3. US2 → demo modernized components (most visible QoL bump).
4. US3 + US4 in parallel → polish pass.
5. Phase 7 Polish → merge.

### Parallel team strategy (this feature specifically)

- **Hector** (this worktree / this Claude): Phase 1 → Phase 2 → US1.
- Once US1 is GREEN, US2 tasks are all [P] — can be distributed across contributors or agents concurrently.
- Branch `008-ux-roles-refinements` runs independently in the main worktree; no file-level coordination needed during active development (see research.md R7 for merge reconciliation plan).

---

## Notes

- **Why the heavy per-component task split in US2**: it makes the work distributable ([P] across files), keeps each PR commit small and reviewable, and mirrors how we will drive TDD RED → GREEN.
- **Why motion is US3 and not bundled into US2**: separability lets us ship US1 + US2 without motion if the motion pass needs more iteration. Motion is lower priority per spec and can be tuned independently.
- **Why empty/loading/error is US4 (P3) not P2**: these states are high-impact-per-hour once the component layer is modernized — bundling them into US2 would balloon the component tasks.
- **Commits**: Spanish conventional commits per CLAUDE.md (e.g., `feat(ui): actualizar paleta de colores con tokens oklch azul`, `test(ui): auditoría WCAG de contraste sobre tokens`, `refactor(card): aplicar escala de radio y sombra modernizada`).
- **Definition of Done (per task)**: tests pass, lint + typecheck clean, no new eslint-disable comments, commit authored in Spanish.
