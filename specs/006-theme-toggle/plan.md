# Implementation Plan: Theme Toggle — Light, Dark & System Modes

**Branch**: `006-theme-toggle` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-theme-toggle/spec.md`

## Summary

Add a visible light/dark/system theme toggle to the application header, backed by a proper theme-mode provider that persists per-browser and respects `prefers-color-scheme`. Existing design tokens already define both light and dark variants in `apps/web/src/index.css` (`:root` and `.dark` blocks). The implementation composes the existing tenant `ThemeProvider` with a new `NextThemesProvider` that manages the `.dark` class on the document root, adds an inline no-flash script in `index.html`, builds a `ThemeToggle` dropdown in the header right cluster, and wires telemetry.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: React 19.1, Vite 6.3, Tailwind CSS 4.1, shadcn/ui (dropdown-menu, button), `next-themes` 0.4.6, lucide-react 0.577 (Sun/Moon/Monitor icons), Zustand 5.0 (unchanged)
**Storage**: `window.localStorage` via `next-themes` built-in persistence under key `bepro.theme`. No backend storage.
**Testing**: Vitest 3.2 + `@testing-library/react` 16.3 + `jsdom` 29 (matches existing project setup; no new test infra)
**Target Platform**: Cloudflare Pages SPA; evergreen desktop + mobile browsers (Chrome 120+, Safari 17+, Firefox 120+)
**Project Type**: Web application — frontend-only change; no API or DB modifications
**Performance Goals**: Mode switch < 1 s (SC-001); cross-tab sync < 1 s (SC-009); OS live-follow < 3 s (SC-007); zero perceivable flash on reload (SC-002); palette transition ≤ 200 ms for users without `prefers-reduced-motion` (FR-016)
**Performance verification note**: SC-001 and SC-009 are verified end-to-end only during the T025 dev-server smoke and (optionally) the T023 Playwright audit. Jsdom-based unit tests cannot measure real paint time; automated CI guards regression via structural assertions (class toggles, storage writes, telemetry emissions) while actual repaint latency is confirmed manually before merge.
**Constraints**: The existing `ThemeProvider` at `apps/web/src/components/theme-provider.tsx` is a tenant CSS-variable injector — NOT the dark/light manager. Both providers must co-exist without conflict. Tenant brand tokens MUST have both light and dark variants (FR-015a); the current `index.css` `.dark` block already covers this for the default BePro palette; tenants that override `--primary` et al. at runtime MUST provide a dark variant (follow-up responsibility of the tenants module — noted in Assumptions).
**Scale/Scope**: Applies to every protected route of the web app + login + change-password. Affects the shell, every first-party module surface, and best-effort third-party widgets (per clarified FR-004 SHOULD). ~6 new/modified files, ~3 new test files.

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Multi-Tenant Isolation | N/A | Frontend-only; no DB writes. Theme preference is per-browser, not per-tenant. Tenant brand tokens (from the tenant module) continue to compose on top of the mode-level palette. |
| II. Edge-First | ✅ Pass | Ships with the Vite SPA on Cloudflare Pages. No new services. |
| III. TypeScript Everywhere | ✅ Pass | TS strict throughout. Typed via `next-themes`' own types plus local component props. |
| IV. Modular by Domain | ✅ Pass | New code lives in `apps/web/src/components/layout/` (shell, already owned by feature 005). Existing `components/theme-provider.tsx` (tenant theming) is untouched in behavior — only its mounting position may shift. No existing module needs modification. |
| V. Test-First (NON-NEGOTIABLE) | ✅ Pass | Every new file arrives via RED → GREEN with unit + integration tests for persistence, OS follow, cross-tab sync, and keyboard a11y. |
| VI. Security by Design | ✅ Pass | No new PII. Preference stored in localStorage; no network egress. No auth surfaces changed. |
| VII. Best Practices via Agents | ✅ Pass | Uses `shadcn-ui` skill patterns (dropdown-menu), `tailwind-design-system` skill for dark-mode tokens, `react-vite-best-practices` for provider composition, `vitest` skill for testing. |
| VIII. Spec-Driven Development | ✅ Pass | This plan. Tasks will come from `/speckit.tasks`. |

**Gate verdict**: PASS — no violations, no complexity-tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/006-theme-toggle/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── theme-api.md     # Phase 1 output — shell/app contract for theme-mode consumers
└── checklists/
    └── requirements.md  # Already present from /speckit.specify
```

### Source Code (repository root)

```text
apps/web/
├── index.html                                    # EDIT — inline no-flash script
├── src/
│   ├── App.tsx                                   # EDIT — wrap in NextThemesProvider
│   ├── main.tsx                                  # (no change)
│   ├── index.css                                 # (no change — .dark tokens already exist)
│   ├── components/
│   │   ├── theme-provider.tsx                    # (no change in behavior — tenant CSS-variable injector stays)
│   │   └── layout/
│   │       ├── Header.tsx                        # EDIT — mount <ThemeToggle/> in right cluster
│   │       ├── ThemeToggle.tsx                   # NEW — dropdown-menu with Sun/Moon/Monitor
│   │       └── __tests__/
│   │           ├── ThemeToggle.test.tsx          # NEW — component tests (options, icon swap, telemetry, a11y)
│   │           └── theme-persistence.integration.test.tsx  # NEW — reload persistence, OS follow, cross-tab
│   └── lib/
│       └── telemetry.ts                          # (no change — "theme.change" event already defined)
```

**Structure Decision**: Single web app. Theme feature lives within the shell layout module (`apps/web/src/components/layout/`) and composes with the existing tenant theme provider at the root (`App.tsx`). No module-by-domain addition is needed; this extends the shell surface authored by feature 005.

## Complexity Tracking

*No constitution violations — section omitted.*
