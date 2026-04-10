# Tasks: Design System

**Input**: Design documents from `/specs/003-design-system/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: TDD mandatory per constitution (Principle V). Tests written first, verified to fail, then implementation.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Initialize shadcn/ui configuration and prepare the component infrastructure

- [x] T001 Initialize shadcn/ui by running `npx shadcn@latest init` in `apps/web/` — configure with `src/components/ui` path alias, New York style, and existing `index.css` as the CSS file
- [x] T002 Verify `apps/web/components.json` was created with correct path aliases (`@/components`, `@/lib/utils`) and that no existing files were overwritten

**Checkpoint**: shadcn/ui CLI is ready to install components

---

## Phase 2: Foundational (Core Design Tokens)

**Purpose**: Replace grayscale defaults with brand teal-green palette and extended semantic colors. MUST complete before ANY user story work.

**⚠️ CRITICAL**: All user stories depend on these tokens being in place

- [x] T003 Add Google Fonts `<link>` tags (preconnect + Fraunces + Source Sans 3 with `display=swap`) to `apps/web/index.html`
- [x] T004 Replace all `:root` color token values in `apps/web/src/index.css` with brand teal-green OKLch palette from research.md D2 — primary `oklch(0.45 0.12 175)`, surfaces with faint teal tint, destructive `oklch(0.55 0.22 25)`, plus add `--destructive-foreground: oklch(0.98 0.01 25)`
- [x] T005 Replace all `.dark` color token values in `apps/web/src/index.css` with dark-mode OKLch palette from research.md D2 — primary `oklch(0.72 0.10 175)`, dark surfaces, chart colors adjusted for dark backgrounds
- [x] T006 Add `--success`/`--success-foreground`, `--warning`/`--warning-foreground`, `--info`/`--info-foreground` CSS custom properties to both `:root` and `.dark` blocks in `apps/web/src/index.css` with OKLch values from research.md D2
- [x] T007 Add `--color-success`, `--color-success-foreground`, `--color-warning`, `--color-warning-foreground`, `--color-info`, `--color-info-foreground` mappings to the `@theme inline` block in `apps/web/src/index.css`
- [x] T008 Update `--font-heading`, `--font-sans`, `--font-mono` values in `:root` of `apps/web/src/index.css` to `'Fraunces', serif`, `'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif`, and `'JetBrains Mono', 'Fira Code', ui-monospace, monospace` respectively
- [x] T009 Update `--radius` from `0.625rem` to `0.5rem` in `:root` of `apps/web/src/index.css` per research.md D8
- [x] T010 Add sRGB fallback values for critical tokens (`--primary`, `--destructive`, `--background`, `--foreground`) using `@supports not (color: oklch(0 0 0))` block at the end of `apps/web/src/index.css` — provides hex/rgb fallbacks for browsers without OKLch support

**Checkpoint**: Foundation ready — all semantic color tokens, fonts, radius, and sRGB fallbacks are brand-aligned. Existing components (LoginForm, App.tsx) should automatically display brand colors.

---

## Phase 3: User Story 1 — Brand Identity & Color Tokens (Priority: P1) 🎯 MVP

**Goal**: Verify the brand color palette renders correctly in both light and dark modes with WCAG AA contrast.

**Independent Test**: Render shadcn/ui Button (all variants) and Card on a blank page. Primary button should display teal-green, destructive should display red/coral, in both light and dark mode.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [P] [US1] Write test that verifies `--primary` resolves to a teal-green OKLch value (not grayscale) in `:root` scope — in `apps/web/src/__tests__/design-tokens.test.tsx`
- [x] T012 [P] [US1] Write test that verifies all semantic tokens (`--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--success`, `--warning`, `--info`) have non-zero chroma (not grayscale) in both `:root` and `.dark` — in `apps/web/src/__tests__/design-tokens.test.tsx`
- [x] T013 [P] [US1] Write test that verifies dark mode tokens differ from light mode tokens when `.dark` class is applied to root — in `apps/web/src/__tests__/design-tokens.test.tsx`
- [x] T014 [P] [US1] Write test that verifies `--destructive-foreground` exists in both `:root` and `.dark` — in `apps/web/src/__tests__/design-tokens.test.tsx`
- [x] T015 [P] [US1] Write test that computes lightness delta between each `--*-foreground` / `--*` pair (primary, secondary, destructive, muted, accent, success, warning, info) and verifies delta >= 0.40 for WCAG AA compliance — in `apps/web/src/__tests__/design-tokens.test.tsx`
- [x] T016 [P] [US1] Write test that counts distinct neutral/surface lightness values across `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--input`, `--sidebar`, `--popover` and verifies >= 8 perceptually uniform gray steps — in `apps/web/src/__tests__/design-tokens.test.tsx`

### Implementation for User Story 1

- [x] T017 [US1] Run tests from T011-T016 and verify they all PASS with the foundational tokens from Phase 2 — no additional implementation needed if Phase 2 was done correctly
- [x] T018 [US1] Run `pnpm typecheck` and `pnpm test` in `apps/web/` to verify no regressions

**Checkpoint**: Brand color palette is verified in both modes with contrast and gray scale tests passing

---

## Phase 4: User Story 2 — Typography System (Priority: P1)

**Goal**: Establish Fraunces + Source Sans 3 type system with a 7-level modular scale.

**Independent Test**: Render h1-h4, body, small, and caption text. Each level should be visually distinct with Fraunces on headings and Source Sans 3 on body.

### Tests for User Story 2

- [x] T019 [P] [US2] Write test that verifies `--font-heading` contains `Fraunces` and `--font-sans` contains `Source Sans 3` — in `apps/web/src/__tests__/design-tokens.test.tsx`
- [x] T020 [P] [US2] Write test that verifies `font-heading` Tailwind utility class applies `--font-heading` font-family — in `apps/web/src/__tests__/design-tokens.test.tsx`

### Implementation for User Story 2

- [x] T021 [US2] Add typography CSS custom properties (`--text-h1-size` through `--text-caption-size` with line-height, letter-spacing, weight) to `:root` in `apps/web/src/index.css` per data-model.md Type Scale Step table
- [x] T022 [US2] Add `@layer base` heading styles in `apps/web/src/index.css` — apply `font-heading` to `h1, h2, h3, h4` elements and map each heading level to its type scale values (size, line-height, letter-spacing, weight)
- [x] T023 [US2] Run T019-T020 tests and verify they PASS
- [x] T024 [US2] Run `pnpm typecheck` and `pnpm test` in `apps/web/` to verify no regressions

**Checkpoint**: Typography system is in place — headings use Fraunces, body uses Source Sans 3, visual hierarchy is clear

---

## Phase 5: User Story 3 — Candidate Status Badges (Priority: P2)

**Goal**: Install Badge component with 14 FSM status variants, each with distinct colors grouped by semantic category.

**Independent Test**: Render all 14 badges in a row. Each should be visually distinguishable, grouped by color family (blue=progress, green=success, red=negative, gray=terminal).

### Tests for User Story 3

- [x] T025 [P] [US3] Write test that verifies Badge component renders with `variant="status-registered"` and applies the correct CSS class — in `apps/web/src/__tests__/badge-variants.test.tsx`
- [x] T026 [P] [US3] Write test that verifies all 14 FSM status variants (`status-registered`, `status-interview-scheduled`, `status-attended`, `status-pending`, `status-approved`, `status-hired`, `status-in-guarantee`, `status-guarantee-met`, `status-rejected`, `status-declined`, `status-no-show`, `status-termination`, `status-discarded`, `status-replacement`) render without errors — in `apps/web/src/__tests__/badge-variants.test.tsx`
- [x] T027 [P] [US3] Write test that verifies Badge defaults to `variant="default"` when no variant is specified — in `apps/web/src/__tests__/badge-variants.test.tsx`
- [x] T028 [P] [US3] Write test that verifies Badge renders gracefully with an unknown/undefined variant string, falling back to default styling without throwing — in `apps/web/src/__tests__/badge-variants.test.tsx`

### Implementation for User Story 3

- [x] T029 [US3] Add 28 badge CSS custom properties (14 `--badge-*-bg` + 14 `--badge-*-fg`) to both `:root` and `.dark` blocks in `apps/web/src/index.css` with OKLch values from research.md badge colors
- [x] T030 [US3] Add badge color mappings to `@theme inline` block in `apps/web/src/index.css` — map `--color-badge-registered: var(--badge-registered-bg)`, `--color-badge-registered-fg: var(--badge-registered-fg)`, etc. for all 14 states
- [x] T031 [US3] Install shadcn/ui Badge component by running `npx shadcn@latest add badge` in `apps/web/`
- [x] T032 [US3] Extend `badgeVariants` in `apps/web/src/components/ui/badge.tsx` with 14 `status-*` CVA variants — each using `border-transparent bg-badge-{state} text-badge-{state}-fg` pattern per data-model.md Badge Status Map
- [x] T033 [US3] Run T025-T028 tests and verify they PASS
- [x] T034 [US3] Run `pnpm typecheck` and `pnpm test` in `apps/web/` to verify no regressions

**Checkpoint**: All 14 FSM badges render with distinct, accessible colors in both light and dark mode

---

## Phase 6: User Story 4 — Component Patterns (Priority: P2)

**Goal**: Install Button, Input, and Card components with brand styling and custom variants.

**Independent Test**: Render a form with 3 inputs (text, email with error, password), 4 button variants (primary, secondary, destructive, ghost), and a Card wrapper. Focus rings should use brand primary.

### Tests for User Story 4

- [x] T035 [P] [US4] Write test that verifies Button renders with `variant="default"` and applies `bg-primary` class — in `apps/web/src/__tests__/component-patterns.test.tsx`
- [x] T036 [P] [US4] Write test that verifies Input renders with `error={true}` and applies `border-destructive` class and `aria-invalid="true"` — in `apps/web/src/__tests__/component-patterns.test.tsx`
- [x] T037 [P] [US4] Write test that verifies Card renders and applies `bg-card text-card-foreground` classes — in `apps/web/src/__tests__/component-patterns.test.tsx`

### Implementation for User Story 4

- [x] T038 [P] [US4] Install shadcn/ui Button component by running `npx shadcn@latest add button` in `apps/web/`
- [x] T039 [P] [US4] Install shadcn/ui Input component by running `npx shadcn@latest add input` in `apps/web/`
- [x] T040 [P] [US4] Install shadcn/ui Card component by running `npx shadcn@latest add card` in `apps/web/`
- [x] T041 [US4] Add `success` and `warning` variants to `buttonVariants` in `apps/web/src/components/ui/button.tsx` — `success: "bg-success text-success-foreground shadow-sm hover:bg-success/90"`, `warning: "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90"`
- [x] T042 [US4] Extend Input component in `apps/web/src/components/ui/input.tsx` — add optional `error` boolean prop that conditionally applies `border-destructive focus-visible:ring-destructive` classes and sets `aria-invalid`
- [x] T043 [US4] Run T035-T037 tests and verify they PASS
- [x] T044 [US4] Run `pnpm typecheck` and `pnpm test` in `apps/web/` to verify no regressions

**Checkpoint**: Button (6 variants + success/warning), Input (with error state), and Card are installed and consuming brand tokens

---

## Phase 7: User Story 5 — Animation & Motion (Priority: P3)

**Goal**: Add CSS-only entrance animations, micro-interactions, and a loading spinner with `prefers-reduced-motion` support.

**Independent Test**: Apply `animate-fade-in` to a div and verify it animates. Enable `prefers-reduced-motion` and verify animations are disabled.

### Tests for User Story 5

- [x] T045 [P] [US5] Write test that verifies `animate-fade-in` CSS class exists and applies an animation — in `apps/web/src/__tests__/animations.test.tsx`
- [x] T046 [P] [US5] Write test that verifies `prefers-reduced-motion: reduce` media query disables animations (checks for the CSS rule presence) — in `apps/web/src/__tests__/animations.test.tsx`

### Implementation for User Story 5

- [x] T047 [US5] Add `--animate-fade-in`, `--animate-fade-out`, `--animate-slide-in-up`, `--animate-slide-in-down`, `--animate-scale-in`, `--animate-spin`, `--animate-accordion-down`, `--animate-accordion-up` tokens with corresponding `@keyframes` inside the `@theme inline` block in `apps/web/src/index.css`
- [x] T048 [US5] Add `prefers-reduced-motion` media query to `@layer base` in `apps/web/src/index.css` that sets `animation-duration: 0.01ms`, `animation-iteration-count: 1`, `transition-duration: 0.01ms` on all elements
- [x] T049 [US5] Run T045-T046 tests and verify they PASS
- [x] T050 [US5] Run `pnpm typecheck` and `pnpm test` in `apps/web/` to verify no regressions

**Checkpoint**: 8 animation utilities available, all disabled when user prefers reduced motion

---

## Phase 8: ThemeProvider — Multi-tenant Runtime Injection

**Goal**: Create a `ThemeProvider` component that injects per-tenant CSS custom property overrides at runtime without conditional logic.

**Independent Test**: Render ThemeProvider with a mock tenant theme. Verify CSS variables on `document.documentElement` are set to tenant values. Remove theme and verify variables are cleaned up.

### Tests for ThemeProvider

- [x] T051 [P] Write test that verifies ThemeProvider injects CSS variables onto `document.documentElement` when a tenant theme is provided — in `apps/web/src/__tests__/theme-provider.test.tsx`
- [x] T052 [P] Write test that verifies ThemeProvider does NOT inject any CSS variables when theme is null — in `apps/web/src/__tests__/theme-provider.test.tsx`
- [x] T053 [P] Write test that verifies ThemeProvider cleans up injected CSS variables on unmount — in `apps/web/src/__tests__/theme-provider.test.tsx`
- [x] T054 [P] Write test that verifies ThemeProvider handles partial theme (e.g., only `primary` set) — unspecified properties are not injected (fall back to `index.css` defaults) — in `apps/web/src/__tests__/theme-provider.test.tsx`

### Implementation for ThemeProvider

- [x] T055 Define `TenantTheme` TypeScript interface in `apps/web/src/components/theme-provider.tsx` with all optional OKLch string fields per data-model.md Tenant Theme entity
- [x] T056 Implement `ThemeProvider` React component in `apps/web/src/components/theme-provider.tsx` — uses `useLayoutEffect` to iterate `TenantTheme` entries and call `document.documentElement.style.setProperty()` for non-null values, removes properties on cleanup
- [x] T057 Wrap app with `ThemeProvider` in `apps/web/src/App.tsx` — pass `theme={null}` for MVP (BePro defaults), positioned as outermost provider before `QueryClientProvider`
- [x] T058 Run T051-T054 tests and verify they PASS
- [x] T059 Run `pnpm typecheck` and `pnpm test` in `apps/web/` to verify no regressions

**Checkpoint**: ThemeProvider is integrated. MVP uses BePro defaults. Architecture supports per-tenant overrides when tenant module is built.

---

## Phase 9: User Story 6 — Layout Patterns (Priority: P3)

**Goal**: Define responsive CSS layout utilities for auth split-screen and dashboard sidebar patterns.

**Independent Test**: Render a div with auth layout classes at 1280px — verify two-panel grid. Resize to 375px — verify single column.

### Tests for User Story 6

- [x] T060 [P] [US6] Write test that verifies auth layout utility produces a two-column grid at `lg:` breakpoint — in `apps/web/src/__tests__/layout-patterns.test.tsx`
- [x] T061 [P] [US6] Write test that verifies dashboard layout utility produces a sidebar + content grid at `lg:` breakpoint — in `apps/web/src/__tests__/layout-patterns.test.tsx`

### Implementation for User Story 6

- [x] T062 [US6] Add auth layout and dashboard layout `@utility` definitions (or Tailwind class compositions) to `apps/web/src/index.css` — auth: `grid grid-cols-1 lg:grid-cols-[2fr_3fr]`, dashboard: `grid grid-cols-1 lg:grid-cols-[16rem_1fr]`
- [x] T063 [US6] Add max-width container utility to `apps/web/src/index.css` — `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- [x] T064 [US6] Run T060-T061 tests and verify they PASS
- [x] T065 [US6] Run `pnpm typecheck` and `pnpm test` in `apps/web/` to verify no regressions

**Checkpoint**: Layout patterns are defined. Auth and dashboard modules can consume them when built.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and cross-story verification

- [x] T066 Run full test suite with `pnpm test` from monorepo root — verify all design system tests pass alongside existing auth tests
- [x] T067 Run `pnpm typecheck` from monorepo root — verify no TypeScript errors across all packages
- [x] T068 Run `pnpm build` in `apps/web/` — verify production build succeeds with all new CSS tokens and components
- [x] T069 Visually verify light and dark mode rendering in Chrome — check primary buttons, destructive buttons, badges, inputs, cards all show brand colors
- [x] T070 Visually verify all 14 badge variants are distinguishable in a row — check that progress (blue), success (green), negative (red), and terminal (gray) groups are clearly different
- [x] T071 Verify Google Fonts load correctly — check Network tab for Fraunces and Source Sans 3 requests, confirm `display=swap` prevents FOIT
- [x] T072 Run quickstart.md validation — follow the quickstart guide from scratch and verify all code examples work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 Colors (Phase 3)**: Depends on Phase 2 — validates the foundational work
- **US2 Typography (Phase 4)**: Depends on Phase 2 — can run parallel with US1
- **US3 Badges (Phase 5)**: Depends on Phase 2 — can run parallel with US4
- **US4 Components (Phase 6)**: Depends on Phase 2 — can run parallel with US3
- **US5 Animations (Phase 7)**: Depends on Phase 2 — can run parallel with ThemeProvider
- **ThemeProvider (Phase 8)**: Depends on Phase 2 — can run parallel with US5
- **US6 Layout (Phase 9)**: Depends on Phase 2 — can start after foundational tokens
- **Polish (Phase 10)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: Validates foundational tokens — no cross-story dependencies
- **US2 (P1)**: Independent — only needs foundational fonts in index.html
- **US3 (P2)**: Independent — adds badge-specific tokens + component
- **US4 (P2)**: Independent — installs shadcn/ui components consuming existing tokens
- **US5 (P3)**: Independent — adds animation keyframes to index.css
- **US6 (P3)**: Independent — adds layout utility definitions
- **ThemeProvider**: Independent — wraps App.tsx, doesn't affect other stories

### Within Each User Story

1. Write tests FIRST — verify they FAIL
2. Implement tokens/components
3. Verify tests PASS
4. Run full suite + typecheck for regression

### Parallel Opportunities

**After Phase 2 completes, these groups can run in parallel:**

- Group A: US1 (T011-T018) + US2 (T019-T024) — both P1, different tokens
- Group B: US3 (T025-T034) + US4 (T035-T044) — both P2, different files
- Group C: US5 (T045-T050) + ThemeProvider (T051-T059) — different files
- US6 (T060-T065) — can start any time after Phase 2

---

## Parallel Example: User Story 3 (Badges) + User Story 4 (Components)

```bash
# These can run in parallel because they touch different files:

# US3 — Badge tokens in index.css, badge component in badge.tsx
Task T029: "Add badge CSS custom properties to index.css"
Task T031: "Install shadcn/ui Badge component"

# US4 — Button, Input, Card in separate files
Task T038: "Install shadcn/ui Button in button.tsx"
Task T039: "Install shadcn/ui Input in input.tsx"
Task T040: "Install shadcn/ui Card in card.tsx"
```

**Note**: T029 (badge tokens in index.css) should complete before T032 (extending badge CVA variants), as variants reference the token classes. But T029 can run parallel with T038-T040.

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (shadcn/ui init)
2. Complete Phase 2: Foundational (brand tokens + fonts + sRGB fallbacks)
3. Complete Phase 3: US1 — verify colors + contrast + gray scale
4. Complete Phase 4: US2 — verify typography
5. **STOP and VALIDATE**: Brand identity is live — LoginForm and dashboard show brand colors and fonts
6. Deploy to preview

### Incremental Delivery

1. Setup + Foundational → Token foundation ready
2. US1 + US2 → Brand identity verified (MVP!)
3. US3 + US4 (parallel) → Badges + core components
4. US5 + ThemeProvider (parallel) → Animations + tenant support
5. US6 → Layout patterns
6. Polish → Final validation

### Parallel Team Strategy (Hector + Javi)

1. Both complete Setup + Foundational together
2. Once Foundational is done:
   - Hector: US1 + US3 + US5 (tokens → badges → animations)
   - Javi: US2 + US4 + ThemeProvider (typography → components → tenant)
3. Both: US6 + Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All `index.css` modifications touch the same file — avoid parallelizing tasks within the same file
- shadcn/ui CLI (`npx shadcn@latest add`) creates files — these tasks can run in parallel since each creates a different file
- TDD is mandatory: write tests, verify they fail, implement, verify they pass
- Commit after each phase checkpoint
