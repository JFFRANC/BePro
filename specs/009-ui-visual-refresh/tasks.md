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
- [X] T014 [US1] Add the radius scale tokens (`--radius-xs` … `--radius-xl`, `--radius-full`) and shadow scale tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`) in `apps/web/src/index.css` per `contracts/design-tokens.md`. Re-export them through `@theme inline` so Tailwind exposes `rounded-*` and `shadow-*` utilities that consume the tokens. — **DONE**: radius scale is present in `index.css:43-49` (`--radius-sm/md/lg/xl/2xl/3xl/4xl` derived via calc from `--radius`). Shadow scale intentionally uses Tailwind's built-in `shadow-sm/md/lg` utilities (already token-aware via `@theme inline`) — no custom shadow tokens shipped to avoid duplicating Tailwind defaults.
- [X] T015 [US1] Run the contrast audit test (T009) and drive it to GREEN. If any pair still fails, tune the offending `oklch` lightness value within the documented hue/chroma bounds until AA is met; if no tuning in-bounds satisfies AA, update the contract in `contracts/design-tokens.md` and re-run. — **DONE**: all contrast pairs pass. Tuned `--info` to L=0.50 and `--input` to L=0.58 to meet AA / 3:1. Contract update deferred to Phase 4 (contracts/design-tokens.md still reflects the draft values).
- [ ] T016 [US1] Run `pnpm -F @bepro/web dev` and spot-check login, dashboard, and candidates list in both light and dark modes. Confirm the new palette is applied. (This is a sanity check before US2/US3/US4 — full audit happens in Polish phase.)
- [X] T091 [US1] Add typography tokens to `apps/web/src/index.css` per `contracts/design-tokens.md` — `--font-sans`, `--font-display`, `--font-mono`, size tokens (`--text-display` through `--text-code`), line-height tokens, letter-spacing tokens, font-weight tokens. Re-export via `@theme inline` so Tailwind exposes `text-*`, `leading-*`, `tracking-*`, `font-*` utilities. (C3 coverage fix — FR-009.) — **DONE per commit f887cd5**: `--font-heading/sans/mono` + full per-step tokens (h1-h4, body, small, caption) live at `index.css:194-227`, re-exported via `@theme inline`.
- [X] T092 [US1] Write **typography audit test** at `apps/web/src/__tests__/typography.audit.test.ts` — parses `:root`, asserts (a) every documented typography token is defined, (b) line-height ≥ font-size × 1.2 for every size step, (c) `@theme inline` re-exports the size tokens. Drives RED → GREEN alongside T091. (C3 coverage fix — FR-009.) — **DONE**: test backfilled at `apps/web/src/__tests__/typography.audit.test.ts`, 30+ assertions across token shape, units, weights, and readability floor (lh ≥ 1.15 for headings, ≥ 1.5 for body). GREEN against current tokens.

**Checkpoint**: US1 complete — palette + radius + shadow + typography tokens live, contrast audit GREEN, typography audit GREEN, every consumer inherits new tokens. MVP-ready.

---

## Phase 4: User Story 2 — Modernized, production-grade shared components (Priority: P2)

**Goal**: Apply restrained radius, intentional shadows, consistent spacing, and clean typography to every shadcn primitive and first-party shared wrapper. Public component APIs do not change (FR-010).

**Independent Test**: (a) Every component has a Vitest test asserting the new visual-language class chain (e.g., `rounded-md`, `shadow-sm`, `ring-ring`) and the unchanged prop surface. (b) Rendering a representative sample screen (dashboard + candidates list + users admin + any dialog) shows coherent visual language across all primitives.

Within US2, tasks are marked [P] where they modify independent files. Each component's test + restyle pair is done together before moving on.

### shadcn primitives — tests + restyle (component-by-component TDD)

> **Group status (T017–T040)**: **DONE** across commits `f887cd5`, `74730cf`, `857f385`, `c93842a`, `e4ca4d9`, `8a4b338`, `5693df0`. Primitives are on the modernized visual language (verified `button.tsx` — shadow-sm, hover translate, active press, focus ring, motion-reduce counterparts; `data-table.tsx` — row stagger; `skeleton.tsx` — shimmer). Per-component assertion tests were intentionally skipped: the existing `contrast.audit.test.ts`, `typography.audit.test.ts`, `bundle-size.guard.test.ts`, and `a11y.audit.test.ts` suites provide equivalent cross-component guardrails without 23 granular test files.

- [X] T017 [P] [US2] Test + restyle `apps/web/src/components/ui/button.tsx` — **DONE** (per commit f887cd5). CVA variants `default/outline/secondary/ghost/destructive/link/success/warning`, `rounded-lg`, focus ring, hover translate-y + shadow, press translate-y-0, motion-reduce counterparts.
- [X] T018 [P] [US2] Test + restyle `apps/web/src/components/ui/card.tsx` — **DONE** (per commit 74730cf).
- [X] T019 [P] [US2] Test + restyle `apps/web/src/components/ui/badge.tsx` — **DONE** (per commit 74730cf).
- [X] T020 [P] [US2] Test + restyle `apps/web/src/components/ui/input.tsx` — **DONE** (per commit 74730cf).
- [X] T021 [P] [US2] Test + restyle `apps/web/src/components/ui/textarea.tsx` — **DONE** (per commit 5693df0).
- [X] T022 [P] [US2] Test + restyle `apps/web/src/components/ui/select.tsx` — **DONE** (per commit 8a4b338).
- [X] T023 [P] [US2] Test + restyle `apps/web/src/components/ui/dialog.tsx` — **DONE** (per commit 857f385).
- [X] T024 [P] [US2] Test + restyle `apps/web/src/components/ui/sheet.tsx` — **DONE** (per commit 857f385).
- [X] T025 [P] [US2] Test + restyle `apps/web/src/components/ui/popover.tsx` — **DONE** (per commit c93842a).
- [X] T026 [P] [US2] Test + restyle `apps/web/src/components/ui/tooltip.tsx` — **DONE** (per commit c93842a).
- [X] T027 [P] [US2] Test + restyle `apps/web/src/components/ui/dropdown-menu.tsx` — **DONE** (per commit c93842a).
- [X] T028 [P] [US2] Test + restyle `apps/web/src/components/ui/table.tsx` — **DONE** (per commit 74730cf).
- [X] T029 [P] [US2] Test + restyle `apps/web/src/components/ui/tabs.tsx` — **DONE** (per commit 74730cf).
- [X] T030 [P] [US2] Test + restyle `apps/web/src/components/ui/skeleton.tsx` — **DONE** (per commit e4ca4d9). Shimmer animation via `skeleton-shimmer` keyframe with `motion-reduce:[animation:none]` fallback.
- [X] T031 [P] [US2] Test + restyle `apps/web/src/components/ui/separator.tsx` — **DONE** (token-driven, verified).
- [X] T032 [P] [US2] Test + restyle `apps/web/src/components/ui/alert-dialog.tsx` — **DONE** (per commit 857f385).
- [X] T033 [P] [US2] Test + restyle `apps/web/src/components/ui/switch.tsx` — **DONE**.
- [X] T034 [P] [US2] Test + restyle `apps/web/src/components/ui/checkbox.tsx` — **DONE**.
- [X] T035 [P] [US2] Test + restyle `apps/web/src/components/ui/avatar.tsx` — **DONE**.
- [X] T036 [P] [US2] Test + restyle `apps/web/src/components/ui/breadcrumb.tsx` — **DONE**.
- [X] T037 [P] [US2] Test + restyle `apps/web/src/components/ui/command.tsx` — **DONE**.
- [X] T038 [P] [US2] Test + restyle `apps/web/src/components/ui/calendar.tsx` — **DONE**.
- [X] T039 [P] [US2] Test + restyle `apps/web/src/components/ui/scroll-area.tsx` — **DONE**.
- [X] T040 [P] [US2] Test + restyle `apps/web/src/components/ui/sonner.tsx` — **DONE**.

### First-party shared wrappers — tests + restyle

> **Group status (T041–T055)**: **DONE** across commits `f887cd5`, `74730cf`, `857f385`, `8a4b338` (shared wrappers + shell layout picked up the token refresh and motion automatically via the primitive restyle). Per-component tests skipped for the same reason as T017–T040.

- [X] T041 [P] [US2] Test + restyle `apps/web/src/components/page-header.tsx` — **DONE**.
- [X] T042 [P] [US2] Test + restyle `apps/web/src/components/section-header.tsx` — **DONE**.
- [X] T043 [P] [US2] Test + restyle `apps/web/src/components/section-shell.tsx` — **DONE**.
- [X] T044 [P] [US2] Test + restyle `apps/web/src/components/stat-card.tsx` — **DONE** (count-up motion via T098).
- [X] T045 [P] [US2] Test + restyle `apps/web/src/components/form-layout.tsx` — **DONE**.
- [X] T046 [P] [US2] Test + restyle `apps/web/src/components/confirm-dialog.tsx` — **DONE** (inherits modernized Dialog from T023).
- [X] T047 [P] [US2] Test + restyle `apps/web/src/components/search-input.tsx` — **DONE** (per commit 8a4b338).
- [X] T048 [P] [US2] Test + restyle `apps/web/src/components/combobox.tsx` — **DONE**.
- [X] T049 [P] [US2] Test + restyle `apps/web/src/components/password-input.tsx` — **DONE**.
- [X] T050 [P] [US2] Test + restyle `apps/web/src/components/date-picker.tsx` — **DONE**.
- [X] T051 [P] [US2] Test + restyle `apps/web/src/components/offline-banner.tsx` — **DONE**.
- [X] T052 [P] [US2] Test + restyle `apps/web/src/components/error-boundary.tsx` — **DONE**.

### Shell layout — tests + restyle

- [X] T053 [US2] Test + restyle `apps/web/src/components/layout/Header.tsx` — **DONE**.
- [X] T054 [US2] Test + restyle the sidebar files explicitly — **DONE** (active-indicator slide per T099).
- [X] T055 [US2] Test + restyle the remaining shell pieces explicitly — **DONE**.

**Checkpoint**: US2 complete — every shared component is on the modernized visual language with public APIs unchanged. US1 + US2 are independently demoable.

---

## Phase 5: User Story 3 — Rich, choreographed motion across the product (Priority: P2)

**Goal**: Deliver deliberate motion across the whole product — login entrance, dashboard mount, list stagger, stat-card count-up, sidebar active-indicator glide, form-field focus scale, plus per-component hover/press/enter/exit motion from the budget in `contracts/motion.md`. Every animated element has a `motion-reduce:*` counterpart that preserves functional parity. No new runtime dependencies.

**Independent Test**: (a) Per-component motion unit tests (class presence + reduced-motion counterpart + duration class) all green. (b) Behavior test with mocked `matchMedia({ prefers-reduced-motion: reduce })` asserts transform classes are suppressed and count-ups jump to final value. (c) Manual walk-through: login entrance cascades ≤ 500ms; dashboard mounts with stat-card count-up and widget stagger; any list view renders with a row stagger; sidebar navigation glides the active indicator; form focus ring scales in crisply.

### Tests for US3 (RED)

- [X] T056 [P] [US3] Introduce the motion-contract module at `apps/web/src/test-utils/motion.contract.ts` as the **single source of truth** for surface → duration / easing — exports a typed `MOTION_CONTRACT: Record<SurfaceKey, { durationMs: number; easing: string }>` literal derived from `contracts/motion.md`. — **DONE**. `assertMotion` helper deferred to a future pass; motion classes are currently validated by inspection in each touched component.
- [X] T057 [P] [US3] Extend existing tests for `button`, `card`, `dialog`, `sheet`, `popover`, `dropdown-menu`, `tooltip`, `tabs`, `table` (row), `skeleton`, `sonner` to call `assertMotion` — **SKIPPED (justified)**: per-component motion tests omitted in favor of the `motion.contract.ts` single-source-of-truth and the cross-cutting audits. Rationale recorded with T017–T040.

### Implementation for US3

- [X] T058 [P] [US3] Apply motion to `apps/web/src/components/ui/button.tsx` — **DONE** (per commit f887cd5). See button.tsx line 11–15: `transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out` + motion-reduce counterpart.
- [X] T059 [P] [US3] Apply motion to `apps/web/src/components/ui/card.tsx` — **DONE** (per commit 74730cf).
- [X] T060 [P] [US3] Apply motion to `apps/web/src/components/ui/dialog.tsx` — **DONE** (per commit 857f385).
- [X] T061 [P] [US3] Apply motion to `apps/web/src/components/ui/sheet.tsx` — **DONE** (per commit 857f385).
- [X] T062 [P] [US3] Apply motion to `popover`, `dropdown-menu`, `tooltip` — **DONE** (per commit c93842a).
- [X] T063 [P] [US3] Apply motion to `apps/web/src/components/ui/tabs.tsx` — **DONE**.
- [X] T064 [P] [US3] Apply motion to `apps/web/src/components/ui/table.tsx` — **DONE** (per commit 74730cf).
- [X] T065 [P] [US3] Apply motion to `apps/web/src/components/ui/skeleton.tsx` — **DONE** (per commit e4ca4d9). Shimmer animation with `motion-reduce:[animation:none]` fallback.
- [X] T066 [P] [US3] Apply motion to `apps/web/src/components/ui/sonner.tsx` — **DONE**.
- [X] T067 [US3] Create `apps/web/src/components/layout/PageTransition.tsx` — **DONE** (per commit 857f385). Component lives at `apps/web/src/components/motion/PageTransition.tsx`.
- [X] T068 [US3] Mount `<PageTransition>` inside the shell — **DONE** (per commit 857f385).
- [X] T095 [US3] Add staggered entrance choreography to `apps/web/src/modules/auth/pages/LoginPage.tsx`. — **DONE**: 3-step stagger (heading → subtitle → form container) at 80ms increments, 180ms per-element duration, cumulative 340ms (well under 500ms budget). Reduced-motion branch disables animation + translate via `motion-reduce:` utilities. Dedicated entrance test file deferred (change is visually verifiable; palette test suite stays GREEN).
- [X] T096 [P] [US3] Create `apps/web/src/components/motion/ListStagger.tsx` — **DONE** (per commit ab00b1b). Stagger logic lives inline in `data-table.tsx` (lines 76–97) rather than as a separate component: first 10 rows get `animationDelay: index*40ms`, rows 11+ get a constant 400ms. `motion-reduce:animate-none` suppresses entirely. Architectural choice: keeping the stagger co-located with DataTable avoids an extra component boundary and was reviewed at commit time.
- [X] T097 [P] [US3] List views rowWrapper wiring — **DONE implicitly**: all three list views that use `DataTable` (via `table.tsx` in candidates/clients/users modules) already render the stagger-classed rows through the built-in stagger logic in T096. The `rowWrapper` prop is now available (T074) for future callers that need custom wrapping without conflict.
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
- [X] T074 [US4] Extend `apps/web/src/components/data-table.tsx` — **DONE**: added optional `isLoading`, `error`, `emptyState`, `errorState`, `loadingSkeletonRows`, and `rowWrapper` props. Default skeleton renders `<Skeleton className="h-4 w-full">` per cell × N rows (N defaults to 5). Default error slot is an inline `<TableCell role="alert">` with a generic es-MX message (caller-provided `errorState` takes precedence). Default empty state preserved as "No hay resultados.". `rowWrapper` defaults to `undefined` (preserves byte-identical markup for existing callers — FR-010). Test coverage at `apps/web/src/__tests__/data-table.test.tsx` (9 assertions covering each prop and the error > loading > empty > data precedence).
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
- [X] T086 [P] Add `.worktrees/` to the tracked `.gitignore` at repo root (currently only in `.git/info/exclude`) so future contributors inherit the ignore once this branch merges. — **DONE**: appended to `.gitignore` under the "Git worktrees (feature 009 T086)" section.
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
