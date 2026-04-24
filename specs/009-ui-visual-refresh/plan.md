# Implementation Plan: UI/UX Visual Refresh

**Branch**: `009-ui-visual-refresh` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-ui-visual-refresh/spec.md`

## Summary

Refresh the entire authenticated web app (SPA) with a new blueish color palette, a modernized visual language for shared components (card, button, badge, input, table, dialog, sheet, etc.), restrained and accessible motion, and polished empty/loading/error states — all without changing any component public API or any user-facing copy.

**Technical approach**: redefine the existing CSS-variable design tokens in `apps/web/src/index.css` (both `:root` and `.dark` blocks) so every consumer inherits the new palette automatically; apply component-level visual polish to the shadcn/ui primitives in `apps/web/src/components/ui/` and to first-party shared wrappers in `apps/web/src/components/` (`empty-state`, `stat-card`, `page-header`, `data-table`, `error-page`, `section-shell`, `form-layout`); add motion via the already-installed `tw-animate-css` plus native CSS transitions (no new runtime dependency); standardize empty / loading / error templates for every primary list and detail view. No API, DB, or schema changes.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: React 19.1, Vite 6.3, Tailwind CSS 4.1.10 (`@theme inline` tokens), shadcn/ui (all components already installed), `tw-animate-css` (already installed, used for enter/exit animations), `next-themes` 0.4.6 (theme mode manager from feature 006), `class-variance-authority` 0.7.1, `clsx` 2.1, `tailwind-merge` 3.5, `lucide-react` 0.577, `sonner` 2.0
**Storage**: N/A (presentational only). Theme mode persistence remains owned by feature 006.
**Testing**: Vitest 3.2 + `@testing-library/react` 16.3 + `jsdom` 29 (matches existing project setup); optional Playwright for the manual visual audit pass
**Target Platform**: Cloudflare Pages SPA on evergreen desktop + mobile browsers (Chrome 120+, Safari 17+, Firefox 120+)
**Project Type**: Web application — frontend-only change; no API, DB, or shared-package modifications
**Performance Goals**: primary-interaction motion ≤ 250ms (FR-005); route/page transitions ≤ 400ms (FR-005); no Lighthouse score regression > 5 points (SC-006); production bundle size delta ≤ +5% (SC-005)
**Constraints**: every foreground/background token pair used for text MUST meet WCAG AA (FR-003); every token MUST have light and dark variants (FR-002); motion MUST respect `prefers-reduced-motion` (FR-004); component public APIs MUST NOT change (FR-010); no new runtime dependencies beyond what is already installed (implied by SC-005); the refresh MUST NOT regress features 003-design-system, 005-app-shell-layout, or 006-theme-toggle; MUST coexist cleanly at merge time with in-flight branch 008-ux-roles-refinements
**Scale/Scope**: Entire authenticated SPA as it exists today — login, protected routes, shell (sidebar, topbar, breadcrumb, command palette, toasts), and the module surfaces that currently ship (`auth`, `candidates`, `clients`, `users`, `design-system`). Placements, audit log, and tenant settings modules are **not yet in the codebase** and are explicitly out of scope for this feature (will adopt the refresh when they ship). Approx. 25 shadcn primitives + 15 first-party shared components + ~18–22 screen compositions to restyle, plus 5 new motion-entrance pieces (login choreography, list stagger, stat-card count-up, sidebar active-indicator slide, form-field focus scale). Token changes centralized in a single `index.css` block (color + radius + shadow + typography).

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Multi-Tenant Isolation | N/A | Frontend-only, presentational. No DB, no tenant-scoped data access, no RLS surface. Tenant brand tokens (deferred per feature 003) remain out of scope. |
| II. Edge-First | ✅ Pass | Ships with the Vite SPA on Cloudflare Pages. No new services. No new runtime dependencies (motion via already-installed `tw-animate-css` + native CSS). |
| III. TypeScript Everywhere | ✅ Pass | TypeScript strict throughout. Component public APIs are unchanged (FR-010). Any new variant props use `class-variance-authority` patterns already in use. Code in English, comments in Spanish, Conventional Commits in Spanish. |
| IV. Modular by Domain | ✅ Pass | Changes land in the shell (`components/layout/`), shared primitives (`components/ui/`), and shared wrappers (`components/`). No domain module (`candidates`, `clients`, `users`, `placements`, `audit`) is modified beyond consuming updated tokens. No new module required. |
| V. Test-First (NON-NEGOTIABLE) | ✅ Pass | RED → GREEN → REFACTOR enforced via: (a) Vitest assertion tests for every restyled component (class presence, duration-class presence, reduced-motion counterpart, variant API stability); (b) an automated WCAG contrast audit (SC-002); (c) a bundle-size guard (SC-005); (d) an automated axe-core a11y audit (SC-004); (e) a typography audit (FR-009); (f) motion-budget assertion via a shared `assertMotion` helper that enforces documented per-surface durations. |
| VI. Security by Design | ✅ Pass | No new PII, no new network egress, no auth surface changes. No logs or telemetry added. Focus ring visibility preserved (FR-012). |
| VII. Best Practices via Agents | ✅ Pass | Skills leveraged: `tailwind-design-system` (token strategy, dark-mode variants), `shadcn-ui` (component customization without breaking CVA patterns), `web-design-guidelines` (contrast and motion review), `vitest` (tests), `react-vite-best-practices` (no unnecessary re-renders, no bundle bloat). |
| VIII. Spec-Driven Development | ✅ Pass | Spec → Plan → (Tasks) → Implementation. This plan is the second phase. Tasks produced by `/speckit.tasks`. |

**Gate verdict**: PASS — no violations, no complexity-tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/009-ui-visual-refresh/
├── plan.md              # This file
├── research.md          # Phase 0 output — palette / motion / modernization decisions
├── data-model.md        # Phase 1 output — N/A stub (no data entities)
├── quickstart.md        # Phase 1 output — how to verify the refresh locally
├── contracts/
│   ├── design-tokens.md # Phase 1 output — canonical token list (name, light, dark, usage, contrast pair)
│   └── motion.md        # Phase 1 output — motion budget, easing curves, reduced-motion mapping
└── checklists/
    └── requirements.md  # From /speckit.specify
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── index.css                                    # EDIT — redefine :root / .dark CSS variables (the palette core)
│   ├── components/
│   │   ├── ui/                                      # EDIT — shadcn primitives restyle (Tailwind classes only, no API change)
│   │   │   ├── button.tsx                           # EDIT — refined variants, restrained radius, hover/press motion ≤ 250ms
│   │   │   ├── card.tsx                             # EDIT — modernized surface, shadow scale, spacing
│   │   │   ├── badge.tsx                            # EDIT — restrained palette, clear variant hierarchy
│   │   │   ├── input.tsx                            # EDIT — focus ring visibility (FR-012), spacing
│   │   │   ├── select.tsx                           # EDIT — matching focus/hover treatment
│   │   │   ├── textarea.tsx                         # EDIT — matching focus treatment
│   │   │   ├── dialog.tsx                           # EDIT — enter/exit motion via tw-animate-css
│   │   │   ├── sheet.tsx                            # EDIT — slide motion aligned with motion budget
│   │   │   ├── popover.tsx                          # EDIT — fade/scale motion
│   │   │   ├── tooltip.tsx                          # EDIT — fade motion, restrained delay
│   │   │   ├── dropdown-menu.tsx                    # EDIT — motion + focus
│   │   │   ├── table.tsx                            # EDIT — row spacing, hover treatment
│   │   │   ├── skeleton.tsx                         # EDIT — pulse timing per motion budget
│   │   │   ├── separator.tsx                        # EDIT — token-driven color only
│   │   │   ├── tabs.tsx                             # EDIT — indicator motion
│   │   │   └── (others consumed as-is via tokens)   # breadcrumb, avatar, command, scroll-area, switch, calendar, checkbox, alert-dialog
│   │   ├── empty-state.tsx                          # EDIT — modernized layout, on-brand icon, CTA treatment
│   │   ├── stat-card.tsx                            # EDIT — refreshed surface, numeric hierarchy
│   │   ├── page-header.tsx                          # EDIT — typography scale, breadcrumb integration
│   │   ├── section-header.tsx                       # EDIT — typography scale
│   │   ├── section-shell.tsx                        # EDIT — surface treatment, spacing
│   │   ├── form-layout.tsx                          # EDIT — label / description / error treatment
│   │   ├── data-table.tsx                           # EDIT — header, row, empty, loading, error states
│   │   ├── error-page.tsx                           # EDIT — consistent with empty-state language
│   │   ├── error-boundary.tsx                       # EDIT — visual only, preserve behavior
│   │   ├── offline-banner.tsx                       # EDIT — token-driven
│   │   ├── confirm-dialog.tsx                       # EDIT — uses refreshed dialog
│   │   ├── date-picker.tsx                          # EDIT — calendar focus/hover treatment
│   │   ├── search-input.tsx                         # EDIT — input + icon treatment
│   │   ├── combobox.tsx                             # EDIT — popover + input alignment
│   │   ├── password-input.tsx                       # EDIT — input treatment
│   │   └── layout/
│   │       ├── Header.tsx                           # EDIT — topbar spacing, shadow, surface
│   │       ├── Sidebar.tsx                          # EDIT — active item treatment, motion
│   │       ├── Breadcrumb.tsx                       # EDIT — typography and separators
│   │       └── (other layout pieces)                # EDIT as needed, no API changes
│   └── __tests__/
│       ├── contrast.audit.test.ts                   # NEW — parses tokens, asserts WCAG AA for all documented pairs (SC-002)
│       ├── typography.audit.test.ts                 # NEW — asserts typography tokens defined + readability floor (FR-009)
│       ├── bundle-size.guard.test.ts                # NEW — asserts dist bundle ≤ baseline × 1.05 (SC-005)
│       └── a11y.audit.test.ts                       # NEW — axe-core against Login/Dashboard/CandidatesList, 0 violations (SC-004)
└── (no other changes)
```

**Structure Decision**: Single web app — changes confined to `apps/web/`. The refresh is a centralized token change (one file) plus component-level visual polish across the shared UI layer. No domain module (`candidates`, `clients`, `users`, `placements`, `audit`) is modified; those surfaces pick up the new look by consuming the shared layer and the new token values automatically. Tests co-located with components (Vitest convention) plus two feature-level audit tests at `apps/web/src/__tests__/` for the cross-cutting WCAG and bundle guards.

## Complexity Tracking

*No constitution violations — section omitted.*
