# Phase 1 Data Model — App Shell & Main Layout

**Branch**: `005-app-shell-layout` | **Date**: 2026-04-19

This feature introduces no database tables and no server-side models. All "entities" are TypeScript types consumed by the shell components at runtime. They are documented here so the API surface is explicit before `/speckit.tasks` expands implementation.

---

## 1. Navigation config (`apps/web/src/lib/nav-config.ts`)

### `NavGate`

Discriminated union that drives role/permission visibility.

```ts
type NavGate =
  | { kind: "ability"; action: Actions; subject: Subjects }
  | { kind: "roles"; roles: UserRole[] };
```

- `Actions` and `Subjects` are re-exported from `lib/ability.ts` (existing).
- `UserRole` comes from `@bepro/shared`.

### `NavItem`

```ts
type NavItem = {
  id: string;                 // stable, e.g., "dashboard", "candidates"
  label: string;              // Spanish, e.g., "Candidatos"
  path: string;               // e.g., "/candidates"
  icon: LucideIcon;           // from lucide-react
  gate: NavGate;
  exactMatch?: boolean;       // default false → prefix match (FR-011)
  devOnly?: boolean;          // hidden in production (FR-014)
};
```

### `NavGroup`

```ts
type NavGroup = {
  id: string;                 // e.g., "administracion"
  label?: string;             // Spanish group label; omit for unlabeled top group
  gate?: NavGate;             // optional group-level gate (e.g., Administración is admin+manager only)
  items: NavItem[];
};
```

### `NAV_CONFIG` (constant)

Declared in order of visual appearance. Per research R6, this is the authoritative source that SC-002 tests against. 11 items across 4 groups plus 1 dev-only item.

**Validation rules:**
- Every `NavItem.path` MUST start with `/`.
- Every `NavItem.id` MUST be unique across all groups.
- Every `NavGroup.id` MUST be unique.
- Icons MUST come from `lucide-react`.

---

## 2. Layout state (`apps/web/src/store/layout-store.ts`)

Zustand store with `persist` middleware using `safeLocalStorage` (see research R2).

```ts
type LayoutState = {
  sidebarCollapsed: boolean;          // persisted
  mobileDrawerOpen: boolean;          // NOT persisted (session-only)
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  openMobileDrawer: () => void;
  closeMobileDrawer: () => void;
};
```

**Persistence key**: `"bepro.layout"`.
**Partialize**: only `sidebarCollapsed` is persisted; `mobileDrawerOpen` resets each session.
**Initial values**: `sidebarCollapsed = false`, `mobileDrawerOpen = false`.
**Validation rules**: setters accept boolean only; `toggleSidebar` flips; telemetry `emit("sidebar.toggle", { collapsed })` fires inside the setter.

**State transitions**:

| Trigger | Transition |
|---|---|
| User clicks `SidebarCollapseButton` | `sidebarCollapsed` flips |
| User presses `[` | `sidebarCollapsed` flips |
| User clicks hamburger (mobile) | `mobileDrawerOpen = true` |
| Route changes while drawer open | `mobileDrawerOpen = false` |
| Tap outside drawer or Escape | `mobileDrawerOpen = false` |

---

## 3. Breadcrumb state (`apps/web/src/store/breadcrumb-store.ts`)

Zustand store **without** persist (trail is per-page; changes on every navigation).

```ts
type BreadcrumbCrumb = {
  label: string;              // Spanish
  to?: string;                // absolute path; if omitted, renders as plain text (terminal crumb)
};

type BreadcrumbTrail = BreadcrumbCrumb[];

type BreadcrumbState = {
  trail: BreadcrumbTrail | null;
  setTrail: (trail: BreadcrumbTrail | null) => void;
};
```

**Initial value**: `trail = null` (shell renders no breadcrumb row).
**Validation rules**: `setTrail` accepts `null` (unset) or a non-empty array; empty array is rejected (would produce a visual row with nothing to show).
**Lifecycle**: the `useBreadcrumbs(trail)` hook calls `setTrail` on mount and `setTrail(null)` on unmount — preventing stale trails after a page unmounts.

---

## 4. Theme preference

Owned entirely by the installed `next-themes` package. No custom store. Spec FR-027 (OS default) and FR-028 (persistence) are satisfied by:
- `<ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bepro.theme">` in `App.tsx`.
- `useTheme()` hook inside `ThemeToggle`.

**Shape (as consumed):**

```ts
type ThemeValue = "light" | "dark" | "system";
```

---

## 5. Telemetry event union (`apps/web/src/lib/telemetry.ts`)

```ts
type TelemetryEvent =
  | { name: "nav.click"; payload: { itemId: string; path: string; source: "sidebar" | "mobile" | "shortcut" } }
  | { name: "sidebar.toggle"; payload: { collapsed: boolean } }
  | { name: "mobile-drawer.open"; payload: Record<string, never> }
  | { name: "mobile-drawer.close"; payload: { reason: "nav" | "backdrop" | "escape" | "close-button" } }
  | { name: "theme.change"; payload: { value: ThemeValue } }
  | { name: "shortcut.use"; payload: { key: string } };

type Emit = (event: TelemetryEvent) => void;
```

The `emit` implementation in v1:

```ts
export const emit: Emit = (event) => {
  if (import.meta.env.DEV) console.debug("[telemetry]", event.name, event.payload);
  // v1 no-op otherwise. Later features replace this body without changing call sites.
};
```

---

## 6. User identity summary (consumed, not owned)

This feature reads (never writes) the auth user shape already produced by `useAuth()`:

```ts
type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isFreelancer: boolean;
  tenantName: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
};
```

Only `firstName`, `lastName`, `role`, `isFreelancer`, `tenantName`, `avatarUrl` are displayed by the shell. `mustChangePassword` is already used upstream by `<RequireAuth>` to redirect.

---

## Relationships

```
App.tsx
  └── RequireAuth
        └── AppShellLayout
              ├── reads: AuthUser (from useAuth) — displayed in Header/UserMenu/MobileNav
              ├── reads: ThemeValue (from next-themes) — displayed in ThemeToggle
              ├── reads+writes: LayoutState (from layout-store) — sidebar and drawer
              ├── reads: BreadcrumbTrail (from breadcrumb-store) — set by children via useBreadcrumbs
              ├── reads: NAV_CONFIG (from nav-config.ts) — filtered by CASL ability + roles
              └── emits: TelemetryEvent (via telemetry.emit) — on every interaction
```

No circular dependencies. Stores are read by the shell and written by either the shell itself (layout) or page components (breadcrumbs).
