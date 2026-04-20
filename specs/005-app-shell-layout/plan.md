# Implementation Plan: App Shell & Main Layout

**Branch**: `005-app-shell-layout` | **Date**: 2026-04-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-app-shell-layout/spec.md`

## Summary

Deliver a persistent, accessible, role-aware application shell (header + collapsible sidebar + main content area, mobile drawer below 768px) that wraps every authenticated route except `login` and `change-password`. The shell provides a single navigation surface across the entire admin, with prefix-match active highlighting, dynamic page-supplied breadcrumbs, a top progress bar for route transitions, a theme toggle with OS-preference fallback, keyboard shortcuts (`/`, `[`, `g d`, `g c`), and a no-op telemetry dispatcher as an extension seam. Implementation reuses existing shadcn/ui primitives, the installed CASL ability provider for role gating, `next-themes` for theme persistence, and a thin Zustand store for sidebar/drawer state. Zero modifications to existing modules — the shell wraps them via a new `<AppShellLayout>`.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: React 19.1, Vite 6.3, react-router-dom 7.6, Tailwind CSS 4.1, shadcn/ui (already installed: sheet, breadcrumb, command, tooltip, avatar, dropdown-menu, scroll-area, separator, popover, skeleton, badge), lucide-react 0.577, Zustand 5.0, @casl/ability 6.8 + @casl/react 5.0, next-themes 0.4, cmdk 1.1, TanStack Query 5.91, clsx + tailwind-merge
**Storage**: `window.localStorage` for sidebar collapsed state and theme preference (via `next-themes`). No backend storage introduced by this feature.
**Testing**: Vitest 3.2 + @testing-library/react 16.3 + @testing-library/user-event 14.6 + jsdom 29 for unit/component tests. Playwright (via MCP plugin) for cross-browser smoke of responsive breakpoints, keyboard traversal, drawer, top progress bar, and WCAG AA audit.
**Target Platform**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge — last two versions) on desktop and mobile. iOS Safari safe-area support required for mobile drawer.
**Project Type**: Web frontend SPA (part of a monorepo: `apps/web/`)
**Performance Goals**: Shell interactive < 150ms after session verified (SC-001); mobile drawer open/close/navigate < 300ms on mid-tier device (SC-006); no layout flicker on reload (SC-005).
**Constraints**: Works offline with existing OfflineBanner stacked above header (FR-024); renders without horizontal scroll 320px→1920px (SC-004); WCAG 2.1 AA compliant with zero serious violations (SC-003); gracefully degrades when `localStorage` is unavailable (private browsing).
**Scale/Scope**: ~14 React components, ~5 library/hook modules, ~3 Zustand slices, 11 new nav items configured. Estimated ~1,200 LOC new code plus tests.
**Main content max-width**: `max-w-screen-2xl` (1536px) centered inside the main area, per FR-020. Below that width the content fills naturally; above it, equal horizontal gutters keep line length readable on ≥ 1536px displays.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Multi-Tenant Isolation | PASS | Shell consumes tenant name from existing auth session (JWT-derived). Emits no DB queries. No new tenant-scoped tables. |
| II. Edge-First | PASS | Pure frontend; ships on Cloudflare Pages like the rest of `apps/web/`. No new infra. |
| III. TypeScript Everywhere | PASS | All new code in strict TS. Nav config, store types, hook signatures, event names are all typed. Spanish strings in UI, English in code. |
| IV. Modular by Domain | PASS | Shell lives under `apps/web/src/components/layout/` — a cross-cutting concern, not a domain. **No existing module is modified.** Modules remain free to register breadcrumbs via the exported hook. |
| V. Test-First (NON-NEGOTIABLE) | PASS | Every user story drives a failing test first (RED), then minimal code (GREEN), then cleanup (REFACTOR). Role-visibility matrix is the first test written, before any nav rendering. |
| VI. Security by Design | PASS | Role gating is UI-only — the server remains the authoritative authz boundary. No new PII exposed. Telemetry dispatcher is a no-op; no vendor, no consent UX to build. |
| VII. Best Practices via Agents | PASS | Skills applied: `frontend-design`, `ui-ux-pro-max`, `shadcn-ui`, `tailwind-design-system`, `tailwindcss-advanced-layouts`, `design-system`, `react-vite-best-practices`, `tanstack-query-best-practices`, `superpowers:test-driven-development`, `vitest`, `web-design-guidelines`. MCP plugins: `context7` for current framework docs, `playwright` for browser verification. Agent: `senior-frontend-engineer`. |
| VIII. Spec-Driven Development | PASS | `spec.md` clarified (5 questions answered 2026-04-19), this plan consumes it, `/speckit.tasks` follows. |

**All gates pass — no violations. Complexity Tracking section left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/005-app-shell-layout/
├── plan.md              # This file
├── research.md          # Phase 0 — library/pattern decisions
├── data-model.md        # Phase 1 — nav config, stores, hooks (no DB entities)
├── quickstart.md        # Phase 1 — "add a page", "set breadcrumbs", "add a nav item"
├── contracts/
│   └── shell-api.md     # Phase 1 — shell-exported hook/type signatures
├── checklists/
│   └── requirements.md  # (from /speckit.specify)
└── tasks.md             # Phase 2 — produced by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── components/
│   │   ├── layout/                    # NEW — shell components
│   │   │   ├── AppShellLayout.tsx     # Wraps <Outlet/> with header + sidebar + main
│   │   │   ├── Header.tsx             # Sticky top bar (logo, tenant, search, utilities)
│   │   │   ├── TenantBadge.tsx        # Logo + tenant name, truncated w/ tooltip
│   │   │   ├── SearchTrigger.tsx      # Cmd+K entry; opens cmdk CommandDialog placeholder
│   │   │   ├── NotificationsBell.tsx  # Popover placeholder "Sin notificaciones por ahora"
│   │   │   ├── ThemeToggle.tsx        # Thin wrapper over next-themes setTheme
│   │   │   ├── UserMenu.tsx           # Avatar + dropdown (Mi perfil / Cambiar contraseña / Cerrar sesión)
│   │   │   ├── Sidebar.tsx            # Desktop sidebar shell (expanded/collapsed states)
│   │   │   ├── SidebarNav.tsx         # Renders groups via nav-config + ability filter
│   │   │   ├── SidebarGroup.tsx       # Labeled group wrapper with per-group role gate
│   │   │   ├── SidebarItem.tsx        # Single link with icon + active-state styling
│   │   │   ├── SidebarCollapseButton.tsx
│   │   │   ├── MobileNav.tsx          # <Sheet/>-based drawer (reuses SidebarNav + user card)
│   │   │   ├── Breadcrumbs.tsx        # Reads breadcrumb store; renders nothing if empty
│   │   │   ├── TopProgressBar.tsx     # Thin bar tied to navigation + TanStack Query isFetching
│   │   │   ├── SkipToContent.tsx      # First tab stop; jumps to #main
│   │   │   └── __tests__/             # Component tests (one file per component)
│   │   ├── ui/                        # existing shadcn primitives (unchanged)
│   │   └── ... (existing shared components unchanged)
│   ├── lib/
│   │   ├── nav-config.ts              # NEW — typed nav tree (groups → items)
│   │   ├── active-match.ts            # NEW — prefix/exact match resolver
│   │   ├── use-hotkeys.ts             # NEW — tiny global keyboard shortcut handler
│   │   ├── telemetry.ts               # NEW — no-op emit() + dev-only console.debug
│   │   ├── use-route-pending.ts       # NEW — derives "navigation in flight" from router + query
│   │   ├── initials.ts                # NEW — derive initials from first/last name
│   │   └── ... (existing libs unchanged)
│   ├── store/
│   │   ├── layout-store.ts            # NEW — sidebarCollapsed + mobileDrawerOpen (zustand+persist)
│   │   ├── breadcrumb-store.ts        # NEW — current trail (zustand, not persisted)
│   │   └── auth-store.ts              # existing, unchanged
│   ├── modules/                       # existing modules — untouched
│   ├── App.tsx                        # MODIFIED — wraps protected routes in <AppShellLayout>
│   └── index.css                      # MODIFIED — add CSS variables for shell if needed (tokens from 003 reused)
└── tests/
    └── e2e/                           # Optional Playwright fixtures (via MCP plugin runs — no repo install)
```

**Structure Decision**: The shell is a cross-cutting layout concern, not a domain module. It lives under `apps/web/src/components/layout/` with its supporting hooks in `lib/` and state in `store/`. `App.tsx` is the single touch point outside `layout/` — it wraps the protected `<Outlet/>` tree (everything inside `<RequireAuth>`) with `<AppShellLayout>`. No existing module is modified. The `login`, `change-password`, and `design-system` routes remain outside the shell per FR-026 (their layouts are full-bleed).

## Phases

### Phase 0 — Outline & Research

**Status**: Complete — see [research.md](./research.md).

**Open questions resolved by research:**
1. Top progress bar: library vs custom.
2. Zustand persist resilience when `localStorage` is unavailable (private browsing).
3. Theme handling: reuse the already-installed `next-themes` or roll a custom Zustand slice?
4. CASL + react-router-dom v7 nav filtering pattern.
5. Keyboard shortcuts: tiny custom `useHotkeys` vs `react-hotkeys-hook`.
6. Ability-subject gap: three items (`Vacantes`, `Entrevistas`, `Configuración`) have no matching CASL subject — gating strategy for those.

### Phase 1 — Design & Contracts

**Status**: Complete — see [data-model.md](./data-model.md), [contracts/shell-api.md](./contracts/shell-api.md), [quickstart.md](./quickstart.md).

### Phase 2 — Implementation Phasing

*(The following is the ordered delivery plan the `/speckit.tasks` command will expand.)*

| # | Phase | Scope | Gating test |
|---|---|---|---|
| P-0 | **Foundation** | `nav-config.ts`, `active-match.ts`, `layout-store.ts`, `breadcrumb-store.ts`, `telemetry.ts`, `use-hotkeys.ts`, `use-route-pending.ts`, `initials.ts` — pure modules, no React yet. | Unit tests for each function/store; `active-match` covers exact/prefix/longest-prefix-wins/no-match. |
| P-1 | **Desktop shell chrome** | `AppShellLayout`, `Header`, `Sidebar`, `SidebarNav`, `SidebarGroup`, `SidebarItem`, `SidebarCollapseButton`, `TenantBadge`, `SkipToContent`. Wire in `App.tsx`. | Renders frame for admin; active item highlight; collapse state persists; skip-to-content is first tab stop. |
| P-2 | **Header utilities** | `SearchTrigger` (cmdk placeholder), `NotificationsBell` (popover placeholder), `ThemeToggle` (next-themes wrapper), `UserMenu` (avatar + dropdown). | Menu opens, "Cerrar sesión" logs out, "Cambiar contraseña" navigates, theme toggle persists across reload, notifications popover shows empty state. |
| P-3 | **Mobile drawer** | `MobileNav` using `<Sheet/>`; hamburger in header < 768px; close-on-navigate; user card at bottom. | Viewport < 768px → sidebar hidden, hamburger present, drawer opens, route change closes drawer, Escape dismisses. |
| P-4 | **Role gating** | Thread `@casl/react` `useAbility` through `SidebarNav`; hide groups/items per `requiredAbility` or `roles` fallback (see research). | 5 integration tests (one per role combo) locking the visibility matrix (SC-002). |
| P-5 | **Breadcrumbs + top progress bar + telemetry** | `Breadcrumbs`, `TopProgressBar`, telemetry `emit()` calls wired into nav clicks, sidebar toggle, shortcut use, theme change, drawer open/close. | Breadcrumbs render only when set; bar appears on slow transition; telemetry calls fire in dev console with expected event names. |
| P-6 | **A11y polish** | Focus-ring audit, keyboard traversal, ARIA for drawer state and progress bar, reduced-motion respect, prefers-color-scheme live reaction. | Playwright + axe audit: zero serious violations; full keyboard traversal of every user story passes (SC-003). |
| P-7 | **Tests & verification** | Round out Vitest coverage, run Playwright smoke across breakpoints (320 / 375 / 768 / 1024 / 1920), verify SC-001 through SC-006. | All six SCs measurably met; full test suite green; `pnpm typecheck` + `pnpm test` clean. |

## Shadcn Component Inventory

| Need | Component | Status |
|---|---|---|
| Header right-side user menu | `avatar`, `dropdown-menu` | already installed |
| Role badge in user card | `badge` | already installed |
| Cmd+K search surface | `command`, `dialog` | already installed |
| Notifications popover | `popover` | already installed |
| Collapsed-sidebar label tooltip | `tooltip` | already installed |
| Mobile drawer | `sheet` | already installed |
| Sidebar scroll when overflowing | `scroll-area` | already installed |
| Visual rules between groups | `separator` | already installed |
| Breadcrumb trail rendering | `breadcrumb` | already installed |
| Loading placeholder (optional) | `skeleton` | already installed |

**Nothing new to install via `npx shadcn@latest add`.** All required primitives exist. This keeps the dependency surface identical and keeps us aligned with the 003-design-system tokens already in `index.css`.

## Observability & Telemetry

- Shell-level error logging → uses the existing `ErrorBoundary` component already mounted at the top of `App.tsx`.
- Shell product events (nav click, sidebar toggle, shortcut use, theme change, drawer open/close) → routed through `lib/telemetry.ts` `emit(event, payload)`.
- v1 `emit` is a no-op that `console.debug(...)` only when `import.meta.env.DEV`. A later feature replaces the implementation without changing call sites.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ability subjects for `Vacantes`, `Entrevistas`, `Configuración` don't exist yet | High | Medium | `nav-config.ts` supports a `roles: UserRole[]` gating mode as a fallback when no CASL subject applies (documented in research). Items with subjects use CASL; items without use role allowlist. Both converge on the same visibility-matrix contract. |
| Sidebar collapse flicker on reload before hydration | Medium | Low | Zustand `persist` middleware reads synchronously on client; apply collapsed class to `<aside>` on first render using the initializer value, not on an effect, so the very first paint is correct. |
| Keyboard shortcut capture while typing in a form | High | Medium | `use-hotkeys` guards against focus in `<input>`, `<textarea>`, `[contenteditable]`; resets multi-key sequences on focus change or 1s timeout. |
| WCAG audit finds serious issue late | Medium | Medium | Run axe checks in P-6 (not at the end) and again in P-7; include `prefers-reduced-motion` respect on drawer, progress bar, and theme transitions. |
| Next-themes hydration mismatch on first paint | Medium | Low | Rely on `next-themes` own hydration guard; SPA has no SSR so there is no server/client mismatch. Keep `ThemeProvider` where it already is in `App.tsx`. |

## Complexity Tracking

*No Constitution Check violations — no complexity justifications required.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *(none)* | | |
