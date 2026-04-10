# Design System Extensions — Design Spec

**Created**: 2026-04-09
**Status**: Draft
**Authors**: Hector Franco
**Branch**: `003-design-system` (extends existing spec)
**References**: [Design System Spec](../../../specs/003-design-system/spec.md), [Platform Redesign](2026-03-27-bepro-platform-redesign-design.md), [Constitution](../../../.specify/memory/constitution.md)

---

## 1. Purpose

Extend the existing design system (003-design-system) with missing components, patterns, and application-level infrastructure needed by the upcoming modules (users, clients, candidates, placements, audit). The original spec delivered 21 functional requirements covering tokens, typography, badges, buttons, inputs, cards, animations, layout patterns, and ThemeProvider. This extension adds the interactive and structural components that bridge the design system to real application screens.

## 2. Scope

### Prerequisites (before implementation)

These shared type fixes must be applied first to avoid downstream naming mismatches:

1. **Rename `guarantee_failed` to `termination`** in `packages/shared/src/types/candidate.ts` — aligns with constitution FSM, design spec, and existing badge variants (`status-termination`)
2. **Rename `leaderId` to `accountExecutiveId`** and `leaderFullName` to `accountExecutiveFullName` in `packages/shared/src/types/candidate.ts` and `packages/shared/src/types/client.ts` — aligns with platform redesign naming
3. **Add `statusToBadgeVariant()` utility** — maps snake_case `CandidateStatus` values to kebab-case badge variant names (e.g., `interview_scheduled` → `status-interview-scheduled`)
4. **Verify `@fontsource-variable/geist` status** — confirm if still in `package.json` before planning removal

### In Scope

- **Tier 1**: Install 4 missing shadcn/ui primitives (Sheet, Switch, ScrollArea, Collapsible) + 1 composition (DatePicker)
- **Tier 2**: Build 3 composite patterns (Sidebar Navigation, Search Bar + Filters, Confirmation Dialog)
- **Tier 3**: Integrate 3 application-level systems (CASL role-based access, error handling with retry/offline, dynamic form renderer)

### Out of Scope

- Actual module implementation (users, clients, candidates CRUD)
- API integration (all components use mock data in preview)
- Backend changes
- Storybook setup (deferred)

## 3. Decisions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Sidebar style | Collapsible: expanded (240px) with grouped sections ↔ icon rail (56px). Dark always. Sheet on mobile. | Combines A (grouped sections) + B (follows light/dark tokens) + C (icon rail) per user request |
| Sidebar trigger | Toggle button + hover-to-expand on tablet. Persisted in localStorage. | Best of both: explicit control + quick access |
| Search/filters | Inline horizontal bar above DataTable | 4 filters fit in one row; recruiters need speed over aesthetics |
| Dynamic form | Simple conditional render based on `form_config` booleans | Fields determined at load time, not toggled by user — no animation complexity needed |
| Error handling | Full: toasts + error pages (403/404/500) + Error Boundary + TanStack Query retry + offline banner | 250 recruiters will hit edge cases; production-grade resilience |
| Role-based visibility | CASL library (`@casl/ability` + `@casl/react`) + route guards | 6.9k stars, 6KB gzipped, TypeScript-first, scales from simple RBAC to ABAC |
| Confirmation dialog | Generic `useConfirm()` hook + `<ConfirmDialogProvider>` | One component covers all FSM transitions, deletions, and destructive actions |
| Icons | Lucide React (already installed) | Consistent with existing codebase |

## 4. Phase 11: Missing shadcn/ui Primitives

### Components to Install

| Component | Purpose | Consumed By |
|-----------|---------|-------------|
| Sheet | Mobile sidebar overlay, candidate detail slide-out panels | Sidebar Nav, Candidates module |
| Switch | Boolean toggles for client `form_config` (`showPosition`, `showAge`, etc.) | Clients module, Settings |
| ScrollArea | Scrollable candidate lists, sidebar nav overflow, long select dropdowns | Sidebar, DataTable, Dialogs |
| Collapsible | Expandable nav groups in sidebar, form field sections | Sidebar Nav, Forms |
| DatePicker | Interview date selection (Calendar + Popover + Input composition) | Candidates module |

### Implementation Notes

- Install via `npx shadcn@latest add sheet switch scroll-area collapsible`
- DatePicker is a composition: Calendar (already installed) + Popover (already installed) + Button, following shadcn/ui's date picker pattern
- Each component gets a demo section on the `/design-system` preview page with BePro-contextual examples

## 5. Phase 12: Sidebar Navigation

### File

`apps/web/src/components/app-sidebar.tsx`

### Architecture

Data-driven navigation with role filtering, collapsible behavior, and responsive breakpoints.

**Nav item config:**

```typescript
interface NavItem {
  label: string
  icon: LucideIcon
  href: string
  roles: UserRole[]
}
```

**Main navigation items:**

| Label | Icon (Lucide) | Route | Roles |
|-------|---------------|-------|-------|
| Dashboard | `LayoutDashboard` | `/` | all |
| Candidatos | `Users` | `/candidates` | all |
| Clientes | `Building2` | `/clients` | admin, manager, account_executive |
| Colocaciones | `Briefcase` | `/placements` | admin, manager, account_executive |

**Admin group** (labeled "Administracion", only renders if any child is visible):

| Label | Icon (Lucide) | Route | Roles |
|-------|---------------|-------|-------|
| Usuarios | `UserCog` | `/users` | admin |
| Auditoria | `ScrollText` | `/audit` | admin, manager |

### Visual States

| Viewport | Default State | Behavior |
|----------|---------------|----------|
| Desktop (>=1024px) | Expanded (240px) | Toggle via `PanelLeftClose` / `PanelLeft` button |
| Tablet (768-1023px) | Collapsed (56px icon rail) | Hover expands on pointer devices only (`@media (hover: hover)`); toggle button always available |
| Mobile (<768px) | Hidden | `Menu` hamburger opens Sheet from left; `X` closes |

### Styling

- **Always dark**: uses existing `--sidebar-background`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border` tokens from `index.css`
- **Active item**: rounded highlight with `--sidebar-primary` background, `--sidebar-primary-foreground` text
- **Inactive items**: `--sidebar-foreground` with reduced opacity
- **Group labels**: uppercase, small, reduced opacity
- **User footer**: Avatar (existing component) + name + role badge. Collapses to avatar-only in icon rail.
- **Tooltips**: Icon rail shows Tooltip (already installed) with link name on hover

### Persistence

- Collapsed state stored in `localStorage` key `"sidebar-collapsed"`
- Read on mount, default to `false` (expanded)

### Dependencies

- Sheet (Phase 11), ScrollArea (Phase 11), Collapsible (Phase 11), Tooltip (already installed), Avatar (already installed)
- CASL ability (Phase 14) for role filtering — until CASL is integrated, uses simple role string comparison

## 6. Phase 13: Search Bar + Filter Controls

### File

`apps/web/src/components/search-filters.tsx`

### Layout

```
[🔍 Search input        ] [Estado ▼] [Cliente ▼] [Reclutador ▼] [📅 Fecha ▼] [⊘ Clear]
[Badge: Registrado ✕] [Badge: Empresa A ✕]  ← active filter chips (when filters applied)
```

### Architecture

Generic, config-driven component reusable across modules (candidates, placements, users).

```typescript
interface FilterConfig {
  search?: { placeholder: string; icon?: LucideIcon }
  filters: Array<{
    key: string
    label: string
    icon?: LucideIcon
    type: "select" | "date-range"
    options?: Array<{ value: string; label: string; group?: string }>
  }>
}
```

### Behavior

- **Search**: Debounced (300ms) text input with `Search` icon. Fires `onFilterChange` with `{ q: "..." }`.
- **Select filters**: Each uses existing `Select` component. Status filter groups options by FSM category (Progreso, Exito, Negativo, Terminal).
- **Date range**: DatePicker in range mode — popover with two Calendar instances (from/to).
- **Active filter badges**: Below the bar when filters are active. Each shows a `Badge` with `X` (`X` Lucide icon) to clear individual filters.
- **Clear all**: `XCircle` icon button, resets all filters to empty.
- **URL state**: All filters sync to URL search params (`useSearchParams`). Filters survive refresh and are linkable.
- **Responsive**: On mobile (<768px), filters collapse into a "Filtros" button that opens a Sheet with vertical filter list.

### Integration with DataTable

`SearchFilters` is a sibling of `DataTable`, composed in each page component. Data flow:

1. `SearchFilters` reads/writes URL search params via `useSearchParams`
2. Page component reads search params and passes them to TanStack Query hook
3. Query hook fetches filtered data from API
4. Page passes query result to `DataTable`

No wrapper component — each page composes `SearchFilters` + `DataTable` directly, since different pages may need different filter configs.

### Icons Used

`Search`, `XCircle`, `X`, `Calendar`, `Filter`

## 7. Phase 14: CASL Integration + Role System

### Packages

- `@casl/ability` — core ability engine (~5KB gzipped)
- `@casl/react` — React bindings (~1KB gzipped)

### Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/ability.ts` | Ability definitions per role |
| `apps/web/src/components/ability-provider.tsx` | React context provider |
| `apps/web/src/components/role-gate.tsx` | Declarative visibility wrapper |
| `apps/web/src/components/protected-route.tsx` | Route guard with 403 redirect |

### Ability Model

```typescript
type Actions = "manage" | "create" | "read" | "update" | "delete"
type Subjects = "Dashboard" | "Candidate" | "Client" | "Placement" | "User" | "Audit" | "all"
```

**Per-role abilities:**

| Role | Abilities |
|------|-----------|
| admin | `manage all` (full access within tenant) |
| manager | `read all`, `create + update Candidate/Placement` |
| account_executive | `read Dashboard/Candidate/Client/Placement` (with condition `{ accountExecutiveId: user.id }` on Candidate/Client), `create + update Candidate/Placement` |
| recruiter | `read Dashboard/Candidate` (with condition `{ recruiterId: user.id }`), `create Candidate` |

**Note on conditions:** CASL conditions are a UX optimization — they determine what the UI shows/hides. The actual data enforcement is done server-side via RLS policies. If the frontend conditions are bypassed, the API will still reject unauthorized access.

### Components

**`<AbilityProvider>`** — Wraps the app. Creates ability from `useAuth().user?.role` (from `apps/web/src/modules/auth/hooks/useAuth.ts`). Updates when role changes (token refresh with new role).

**`<RoleGate action="create" subject="User">`** — Renders children only if the current user's ability allows the action. Uses CASL's `<Can>` internally. Optional `fallback` prop for alternative content.

**`<ProtectedRoute action="read" subject="User" />`** — Route-level guard for authorization (CASL abilities). If unauthorized, renders the 403 ErrorPage (from Phase 15). Used in the router definition:

```tsx
<Route element={<ProtectedRoute action="read" subject="User" />}>
  <Route path="/users" element={<UsersPage />} />
</Route>
```

**Naming convention:** The existing `ProtectedRoute` in `App.tsx` (which checks authentication — is the user logged in?) should be renamed to `<RequireAuth>`. The new `<ProtectedRoute>` checks authorization (does the user have permission?). They compose: `RequireAuth` wraps all authenticated routes, `ProtectedRoute` wraps role-restricted routes within them.

### Integration with Sidebar

Phase 12's sidebar uses CASL abilities to filter nav items instead of raw role string comparison:

```tsx
const ability = useAbility()
const visibleItems = navItems.filter(item =>
  ability.can("read", item.subject)
)
```

## 8. Phase 15: Error Handling

### Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/error-boundary.tsx` | React Error Boundary |
| `apps/web/src/components/error-page.tsx` | Full-page error states |
| `apps/web/src/components/offline-banner.tsx` | Network status banner |
| `apps/web/src/lib/query-client.ts` | TanStack Query configuration |

### Error Boundary

- Catches render crashes at the app level
- Shows friendly error page with `RefreshCw` icon button to retry
- Resets error state on route navigation
- Logs error to console (no PII per LFPDPPP)

### Error Pages

Reusable `<ErrorPage>` component with variants:

| Code | Icon (Lucide) | Title | Description | Action |
|------|---------------|-------|-------------|--------|
| 403 | `ShieldAlert` | Acceso denegado | No tienes permisos para ver esta pagina | "Ir al Dashboard" button |
| 404 | `SearchX` | Pagina no encontrada | La pagina que buscas no existe | "Ir al Dashboard" button |
| 500 | `ServerCrash` | Error del servidor | Algo salio mal, intenta de nuevo | "Reintentar" button |

- Centered card layout with icon, heading (Fraunces), description, and action button
- Uses `--destructive` tokens for 403/500, `--muted` for 404

### Offline Banner

- Detects `navigator.onLine` + `online`/`offline` events
- Slim banner pinned to top: `WifiOff` icon + "Sin conexion — los cambios se sincronizaran al reconectar"
- Uses `--warning` color tokens
- Auto-dismisses on reconnection with "Conexion restaurada" success toast (Sonner)

### TanStack Query Config

**Note:** The existing `query-client.ts` uses `staleTime: 5 * 60 * 1000` (5 minutes). This extension reduces it to 30 seconds for candidate/placement lists where data changes frequently as 250 recruiters work concurrently. Module-specific overrides can set longer staleTime for rarely-changing data (e.g., clients list, user roles).

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 30_000, // 30s default; override per-query for stable data
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        // 401 → redirect to login (token expired)
        // 403 → toast "No tienes permisos para esta accion"
        // 4xx → toast with server error message
        // 5xx → toast "Error del servidor, intenta de nuevo"
      },
    },
  },
})
```

### Global Mutation Error Handler

Centralized in `query-client.ts`. Uses Sonner toast for all mutation errors. Specific handling:
- **401**: Clear auth store, redirect to `/login`
- **403**: Toast with `ShieldAlert` icon
- **Network error**: Toast with `WifiOff` icon + "Verifica tu conexion"

## 9. Phase 16: Application Patterns

### 9.1 ConfirmDialog

**Files:**
- `apps/web/src/components/confirm-dialog.tsx` — Provider + hook

**Architecture:** Context provider + promise-based hook.

```typescript
interface ConfirmOptions {
  title: string
  description: string
  confirmLabel?: string        // default: "Confirmar"
  cancelLabel?: string         // default: "Cancelar"
  variant?: "default" | "destructive"  // default: "default"
  icon?: LucideIcon            // optional icon above title
}

// Usage:
const confirm = useConfirm()
const ok = await confirm({
  title: "Rechazar candidato?",
  description: "Se registrara el motivo de rechazo. Esta accion no se puede deshacer.",
  confirmLabel: "Rechazar",
  variant: "destructive",
  icon: UserX,
})
```

- `<ConfirmDialogProvider>` renders a single AlertDialog, content swapped via state
- `useConfirm()` returns async function that resolves `true` (confirm) or `false` (cancel)
- Uses existing AlertDialog component (already installed)

### 9.2 Dynamic Form Renderer

**File:** `apps/web/src/components/dynamic-form.tsx`

**Architecture:** React Hook Form + Zod, fields driven by `IClientFormConfig`.

**Always-rendered fields (required):**

| Field | Icon (Lucide) | Type |
|-------|---------------|------|
| fullName | `User` | text |
| phone | `Phone` | tel |
| interviewDate | `Calendar` | DatePicker |
| clientId | `Building2` | Select (read-only, from context) |

**Conditionally-rendered fields (based on `form_config`):**

| Config Toggle | Field | Icon (Lucide) | Type |
|---------------|-------|---------------|------|
| showInterviewTime | interviewTime | `Clock` | time input |
| showPosition | position | `Briefcase` | text |
| showMunicipality | municipality | `MapPin` | Combobox |
| showAge | age | `UserCheck` | number |
| showShift | shift | `Sun` | Select |
| showPlant | plant | `Factory` | text |
| showInterviewPoint | interviewPoint | `Navigation` | text |
| showComments | comments | `MessageSquare` | Textarea |

**Zod schema:** Built dynamically by merging base schema with optional field schemas:

```typescript
function buildCandidateSchema(config: IClientFormConfig) {
  let schema = baseCandidateSchema
  if (config.showInterviewTime) schema = schema.merge(interviewTimeSchema)
  if (config.showPosition) schema = schema.merge(positionSchema)
  if (config.showAge) schema = schema.merge(ageSchema)
  // ...
  return schema
}
```

**Performance:** `buildCandidateSchema` must be wrapped in `useMemo` keyed on the `formConfig` object to avoid rebuilding on every render.

**Layout:** Uses FormLayout (below) with responsive grid — short fields (age + shift) side-by-side on desktop.

### 9.3 Form Layout

**File:** `apps/web/src/components/form-layout.tsx`

**Components:**

- `<FormLayout title="..." description="..." onSubmit={...}>` — Card wrapper with heading, description, content area, and submit button at bottom
- `<FormSection title="...">` — Groups related fields with a separator and subtitle. Uses existing Separator component.
- `<FormField label="..." error="..." icon={...}>` — Label + input wrapper + error message display. Wraps existing Input/Select/DatePicker/Textarea with consistent spacing and icon positioning.
- `<FormRow>` — Horizontal grouping for short fields. `grid grid-cols-1 sm:grid-cols-2 gap-4`.

**Responsive:** Single column on mobile, two-column grid on desktop for short fields.

## 10. Preview Page Additions

Each phase adds a section to the existing `/design-system` preview page:

| Phase | Preview Section | Content |
|-------|-----------------|---------|
| 11 | Sheet, Switch, ScrollArea, Collapsible, DatePicker | Individual component demos |
| 12 | Sidebar Navigation | Interactive mini-demo showing expanded/collapsed/mobile states |
| 13 | Search & Filters | Functional filter bar with mock candidate data |
| 14 | Role-Based Access | Demo showing different role views side by side |
| 15 | Error Handling | Error pages (403/404/500) + offline banner demo + toast variants |
| 16 | ConfirmDialog, Dynamic Form, Form Layout | Interactive confirm demo + sample candidate form |

## 11. Cleanup

- Remove `@fontsource-variable/geist` from `apps/web/package.json` if still present (installed by shadcn init, unused — we use Google Fonts)
- Rename existing `ProtectedRoute` in `App.tsx` to `RequireAuth` (authentication guard)
- Fix Spanish accent marks in all UI copy: "Administración", "página", "conexión", "acción"

## 12. Dependencies

### New npm packages

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `@casl/ability` | ^6.x | ~5KB gzip | Core RBAC engine |
| `@casl/react` | ^4.x | ~1KB gzip | React bindings (`<Can>`, `useAbility`) |

### shadcn/ui components to install

Sheet, Switch, ScrollArea, Collapsible (via `npx shadcn@latest add`)

### Existing dependencies used

- `lucide-react` (icons)
- `@tanstack/react-query` (error handling config)
- `sonner` (toast notifications)
- `react-hook-form` + `zod` (dynamic form)
- All existing shadcn/ui components (Badge, Button, Input, Card, Select, Dialog, AlertDialog, Calendar, Popover, Tooltip, Avatar, Separator, Tabs)

## 13. Testing Strategy

TDD per constitution. Each phase follows RED → GREEN → REFACTOR:

| Phase | Test File | Key Tests |
|-------|-----------|-----------|
| 11 | `primitives.test.tsx` | Each component renders, accepts props, accessibility |
| 12 | `app-sidebar.test.tsx` | Renders nav items, filters by role, collapse/expand toggle, mobile Sheet trigger |
| 13 | `search-filters.test.tsx` | Debounced search, filter selection, URL sync, clear filters, active filter badges |
| 14 | `ability.test.ts`, `role-gate.test.tsx`, `protected-route.test.tsx` | Ability definitions per role, RoleGate renders/hides, ProtectedRoute redirects |
| 15 | `error-boundary.test.tsx`, `error-page.test.tsx`, `offline-banner.test.tsx` | Boundary catches errors, error pages render correct content, offline detection |
| 16 | `confirm-dialog.test.tsx`, `dynamic-form.test.tsx`, `form-layout.test.tsx` | Confirm resolves true/false, dynamic fields toggle, Zod validation, form layout structure |

---

*Design System Extensions — Design Spec v1.1 (post-review fixes: naming prerequisites, CASL conditions, hover accessibility, interviewTime field, ProtectedRoute naming, staleTime rationale, DataTable integration, schema memoization, accent marks)*
