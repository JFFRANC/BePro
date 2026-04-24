# Research: UI/UX Visual Refresh

**Feature**: 009-ui-visual-refresh
**Phase**: 0 (Outline & Research)

This document resolves design and implementation questions raised by the spec and the plan. No `NEEDS CLARIFICATION` markers remain after this phase.

---

## R1. Palette strategy — how to introduce a new blueish palette without fracturing the codebase

**Decision**: Redefine the CSS-variable tokens (`--primary`, `--background`, `--foreground`, `--muted`, `--accent`, `--border`, `--ring`, `--sidebar-*`, `--chart-*`, etc.) in `apps/web/src/index.css`, updating both the `:root` block (light mode) and the `.dark` block (dark mode). The Tailwind 4.1 `@theme inline` section already re-exports these tokens as Tailwind color utilities, so every consumer — shadcn primitives, first-party components, module screens — inherits the change automatically.

**Rationale**:

- The token layer exists (feature 003) and is the single source of truth. Editing tokens propagates atomically.
- Avoids touching hundreds of component call sites with a find-and-replace of hex values.
- Preserves the component public API (FR-010) — the class names consumers pass (`bg-primary`, `text-foreground`, etc.) still resolve correctly.
- Dark-mode parity is guaranteed because the `.dark` block is updated in the same PR as `:root`.

**Alternatives considered**:

- **Introduce a parallel palette and migrate components one-by-one.** Rejected — adds complexity, drags the refresh over multiple PRs, risks visual inconsistency during the transition.
- **Ship a new Tailwind config with new color names (e.g., `bepro-blue-500`).** Rejected — would require changing every component's class names, violating FR-010 and multiplying the surface area.
- **Use a theming library (e.g., CSS vars per component).** Rejected — the current CSS-variable approach already is a theming layer; no new library needed.

---

## R2. Blueish palette selection — ensuring "distinctive, not AI-generated"

**Decision**: Build the palette around a custom desaturated deep-blue primary (hue ≈ 218–228°, `oklch` around `0.55 0.16 225`) with deliberately chosen neutrals shifted slightly toward cool gray (not pure slate, not the stock shadcn zinc/neutral). Accent and semantic colors (destructive, success, warning) pick complementary hues with similar chroma to avoid the "plastic" look. Concrete hex/oklch values are enumerated in `contracts/design-tokens.md` and validated by the WCAG contrast audit test.

**Rationale**:

- The brief explicitly rejects generic AI aesthetics (no cookie-cutter gradients, no pastel defaults, no oversized rounded corners) — a restrained, lower-chroma primary with deliberate neutrals reads as intentional rather than template-generated.
- `oklch` gives perceptually uniform contrast control, making WCAG AA validation straightforward across light/dark modes.
- Single primary hue with tight chroma bounds keeps the UI cohesive without relying on gradients or decorative flourishes.

**Alternatives considered**:

- **Default shadcn "blue" preset** — rejected (too recognizable, reinforces the AI-template perception the spec explicitly rejects).
- **Gradient-based brand system** — rejected (violates the spec's "no cookie-cutter gradients" constraint).
- **High-chroma vibrant blue** — rejected (fatigues the eye on data-dense screens; contrast management becomes harder).

---

## R3. Motion strategy — subtle, accessible, zero new dependencies

**Decision**: Use `tw-animate-css` (already imported in `apps/web/src/index.css`) plus native CSS `transition` properties on interactive elements. All motion defined via Tailwind utility classes (`transition-colors`, `transition-transform`, `duration-150`, `ease-out`, custom `@keyframes` via `@theme` when needed). `prefers-reduced-motion` handled via the existing `motion-reduce:` Tailwind variant — every animated class chain gets a `motion-reduce:*` counterpart that suppresses transforms/translations while preserving opacity.

**Rationale**:

- No new runtime dependency → respects SC-005 (≤ +5% bundle).
- `tw-animate-css` already powers the existing shadcn enter/exit animations; reusing it keeps behavior consistent with feature 005's shell.
- Tailwind's `motion-reduce:` variant is a one-class-per-element solution that is testable at the component level.

**Motion budget** (captured formally in `contracts/motion.md`):

| Surface | Duration | Easing | Reduced-motion fallback |
|---|---|---|---|
| Button hover/press | 120–150ms | `ease-out` | Opacity only |
| Card hover | 150ms | `ease-out` | Opacity only |
| Dialog / Sheet enter | 200ms (fade + 8–12px slide) | `ease-out` | Fade only |
| Dialog / Sheet exit | 150ms | `ease-in` | Fade only |
| Dropdown / Popover | 120ms | `ease-out` | Fade only |
| Tooltip | 100ms fade-in, 200ms delay | `ease-out` | Fade only, no delay change |
| Toast (sonner) | 250ms | `ease-out` | Fade only |
| Route transitions | ≤ 400ms (opacity, optional 4–8px Y translate) | `ease-out` | Fade only |
| Skeleton pulse | 1500ms loop | `ease-in-out` | Animation disabled (static skeleton) |

**Alternatives considered**:

- **Framer Motion** — rejected (adds ~30KB+ gzipped, violates SC-005; overkill for the motion budget defined).
- **Motion One** — rejected (would still be a new dep; CSS covers every case in the budget).
- **CSS-only without `tw-animate-css`** — feasible but would require re-authoring keyframes that already exist; keeping the library is the lower-risk choice.

---

## R4. Component modernization — what "modern, not AI-ish" means operationally

**Decision**: Apply the following concrete constraints to every restyled component (expanded in `contracts/design-tokens.md`):

1. **Radius scale**: `xs=2px`, `sm=4px`, `md=6px`, `lg=8px`, `xl=12px`, `full=9999px`. Default for surfaces (cards, dialogs, inputs) is `md` (6px). `full` is reserved for chips, avatars, status dots, and pill-shaped progress indicators — NOT buttons and NOT large surfaces.
2. **Shadow scale**: 3 stops — `sm` (1-layer subtle), `md` (2-layer depth), `lg` (2-layer elevated). No neon glows, no colorful shadows, no shadow on flat surfaces.
3. **Borders**: 1px default, 1px emphasis via color not thickness. Inner borders (rings) for focus only, not decoration.
4. **Typography scale**: `display` (clamp-based), `h1` (28px/36px), `h2` (22px/30px), `h3` (18px/26px), `body` (14px/22px), `caption` (12px/18px), `code` (mono). Line-heights fixed per step; no ad-hoc leading.
5. **Spacing**: rely on Tailwind's 4px base scale, stop at `space-10` (40px) for most layouts; avoid inflated 16px+ default gaps everywhere.
6. **No**: gradients on primary surfaces, pastel semantic colors (destructive must be confidently red, not pink), decorative emoji in UI chrome, playful illustrations in empty states (line-art icons OK).

**Rationale**:

- Explicit numerical budgets turn "avoid AI aesthetic" into a reviewable checklist.
- Every constraint is testable (class presence, token value, or visual review).
- The scale is compact enough for two developers to hold in their head and enforce at PR review.

**Alternatives considered**:

- **Import a third-party design system (e.g., Radix Themes).** Rejected — existing shadcn+Tailwind foundation is sufficient; importing a library would re-open API-change questions and violate FR-010.
- **Free-form component-by-component decisions.** Rejected — inconsistency is exactly the "AI-generated" signal we want to avoid.

---

## R5. Empty / loading / error state strategy

**Decision**: Extend the existing `empty-state.tsx`, `error-page.tsx`, and `skeleton.tsx` components to serve as the single templates for every primary list and detail view. `data-table.tsx` gains first-class `emptyState`, `loading`, and `errorState` props (visual-only additions — NOT breaking the public API: new props are optional with sensible defaults that reproduce today's behavior). For loading: shape-matched skeletons (table rows with matching column widths, card grids with matching card shapes), never a bare spinner. For errors: icon + message + retry action, on-brand styling.

**Rationale**:

- Single templates prevent drift across modules.
- Optional props keep component API backward-compatible (FR-010 satisfied — any caller not passing the new props gets today's behavior).
- Skeletons matched to final shape reduce perceived latency (research consensus, verified in past shadcn-based systems).

**Alternatives considered**:

- **Per-module bespoke empty/error components.** Rejected — that's how the inconsistency crept in that this feature is correcting.
- **A single generic "StatusView" component.** Rejected — over-abstraction; the three states have distinct interaction patterns.

---

## R6. Validation strategy — how we prove the refresh is done

**Decision**: Two automated guardrails + one manual audit:

1. **Automated WCAG contrast audit** (Vitest): `apps/web/src/__tests__/contrast.audit.test.ts` parses the CSS variables from `index.css` (both `:root` and `.dark`), then asserts every documented foreground/background pair in `contracts/design-tokens.md` meets AA (4.5:1 for normal text, 3:1 for large text and UI glyphs). Fails the CI on any regression. (Satisfies SC-002.)
2. **Automated bundle-size guard** (Vitest + build artifact check): `apps/web/src/__tests__/bundle-size.guard.test.ts` runs against the `dist/` build output and asserts size ≤ baseline × 1.05. Baseline committed into the test file at the start of implementation. (Satisfies SC-005.)
3. **Manual screen-by-screen visual audit** (documented in `quickstart.md`): reviewer walks every screen in both light and dark mode on localhost, confirms no legacy colors, no broken layouts, empty/loading/error states present. Results recorded in a checklist before merge.

**Rationale**:

- Visual-quality features cannot be 100% automated, but contrast and bundle size ARE automatable and catch the most common regressions.
- Manual audit is the accepted industry standard for a refresh pass and is explicitly allowed per the spec's Assumptions.

**Alternatives considered**:

- **Full screenshot-diff visual regression (Chromatic / Percy / Playwright visual).** Rejected for this pass — setup cost, CI time, and flakiness on font/subpixel rendering. The spec's Assumptions section allows deferring this; if product-quality issues emerge in production, this becomes a follow-up.
- **Manual-only audit.** Rejected — we need the automated contrast and bundle guards to prevent regressions in future PRs.

---

## R7. Coordination with branch 008-ux-roles-refinements

**Decision**: Treat 008 and 009 as independent branches with the convention that whichever merges last reconciles. No file-level coordination during active development. After either branch merges, the other runs `git fetch && git rebase origin/<base>` and resolves conflicts; both branches use the shared token layer from this feature (009) once 009 is merged, so if 008 merges first the 009 implementer rebases and re-applies the restyle on top of any new components 008 added.

**Rationale**:

- The two features have naturally low overlap: 008 adds roles refinements (logic + role-specific UI), 009 redefines tokens and restyles shared components. Modifying the same shared primitive is the only realistic conflict surface.
- Explicitly NOT attempting to coordinate file-by-file avoids blocking either branch.

**Alternatives considered**:

- **Serialize 008 and 009.** Rejected — the user explicitly wants parallel work.
- **Create a shared base branch.** Rejected — overhead for two short-lived branches.

---

## R8. Reduced-motion testing approach

**Decision**: Use jsdom + a mocked `matchMedia('(prefers-reduced-motion: reduce)')` implementation in a Vitest setup file. Component-level tests assert the reduced-motion class chain (`motion-reduce:*`) is present; a behavior test simulates the media query being active and asserts that transform-based classes are overridden.

**Rationale**:

- jsdom cannot actually render motion, but it CAN verify the correct classes are on the element, which is the contract.
- Avoids browser-level Playwright for what is essentially a class-presence check.

**Alternatives considered**:

- **Playwright only.** Rejected — overkill for a static assertion; slow in CI.
- **Skip automation, rely on manual audit.** Rejected — too easy to regress on a later edit.

---

## Summary of decisions

| Area | Decision | Spec requirement satisfied |
|---|---|---|
| Palette | Redefine CSS tokens in `:root` + `.dark` of `index.css` | FR-001, FR-002 |
| Specific hues | Desaturated deep-blue primary in `oklch`, cool-gray neutrals | FR-003, SC-008 |
| Motion | `tw-animate-css` + native CSS transitions, per-duration budget | FR-004, FR-005 |
| Component modernization | Numerical radius / shadow / typography scales | FR-006, FR-008, FR-009, SC-008 |
| Empty/loading/error | Extend existing templates, optional props on `data-table` | FR-007, FR-010 |
| Validation | Contrast audit test + bundle guard test + manual screen audit | SC-002, SC-005, SC-001 |
| 008 coordination | Independent branches, last merger reconciles | Assumption in spec |
| Reduced-motion testing | jsdom + mocked `matchMedia` | FR-004 |
