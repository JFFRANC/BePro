# Shell Public API Contract

**Branch**: `005-app-shell-layout` | **Date**: 2026-04-19

This is the stable, exported API surface of the app shell — the only touch points that page/module code in `apps/web/src/modules/**` is allowed to import. Internal shell components (`Sidebar`, `Header`, etc.) are not exported.

All imports are from `@/components/layout` or `@/lib/...` (existing path alias).

---

## 1. `<AppShellLayout>` component

**Purpose**: Wraps a protected `<Outlet/>` with the full shell chrome.

**Module**: `@/components/layout/AppShellLayout`

**Props**: none. Composition via `<Outlet/>` from react-router-dom.

**Usage** (in `App.tsx`):

```tsx
<Route element={<RequireAuth><AppShellLayout /></RequireAuth>}>
  <Route path="/" element={<DashboardPage />} />
  <Route path="/users" element={<UsersPage />} />
  <Route path="/users/:id" element={<UserDetailPage />} />
  {/* …every protected route… */}
</Route>
```

**Guarantees**:
- Renders header, sidebar (or mobile hamburger), breadcrumb row (when set), main content area, and top progress bar.
- Skip-to-content link is the first tab stop.
- Respects `prefers-reduced-motion`.
- Renders `null`-equivalent chrome if `useAuth().user` is not yet ready (should not happen because `<RequireAuth>` guards it).

**Non-goals**: does NOT render login, change-password, or 404 screens.

---

## 2. `useBreadcrumbs(trail)` hook

**Purpose**: Pages declare their breadcrumb trail. The shell renders it. Unmounting clears.

**Module**: `@/components/layout` (barrel export)

**Signature**:

```ts
function useBreadcrumbs(trail: BreadcrumbTrail | null): void;

type BreadcrumbCrumb = { label: string; to?: string };
type BreadcrumbTrail = BreadcrumbCrumb[];
```

**Usage** (in any page component inside the shell):

```tsx
function CandidateDetailPage() {
  const { data: candidate } = useCandidate(id);

  useBreadcrumbs(
    candidate
      ? [
          { label: "Candidatos", to: "/candidates" },
          { label: `${candidate.firstName} ${candidate.lastName}` },
        ]
      : null, // render no breadcrumb until the candidate loads
  );

  // …
}
```

**Guarantees**:
- Calling with `null` removes the current trail.
- Calling with an empty array is rejected (dev warning, no render).
- On unmount, the trail is automatically cleared (`setTrail(null)`).
- Safe to call conditionally across renders.

---

## 3. `emit(event)` telemetry function

**Purpose**: Single hook point for shell-level product events. No-op in v1.

**Module**: `@/lib/telemetry`

**Signature**:

```ts
import type { TelemetryEvent } from "@/lib/telemetry";

export function emit(event: TelemetryEvent): void;

// Event union (see data-model.md §5) — exported for tests and future consumers.
export type TelemetryEvent =
  | { name: "nav.click"; payload: { itemId: string; path: string; source: "sidebar" | "mobile" | "shortcut" } }
  | { name: "sidebar.toggle"; payload: { collapsed: boolean } }
  | { name: "mobile-drawer.open"; payload: Record<string, never> }
  | { name: "mobile-drawer.close"; payload: { reason: "nav" | "backdrop" | "escape" | "close-button" } }
  | { name: "theme.change"; payload: { value: "light" | "dark" | "system" } }
  | { name: "shortcut.use"; payload: { key: string } };
```

**Guarantees**:
- Never throws.
- In development (`import.meta.env.DEV`), logs via `console.debug`.
- In production, silent (no-op).
- Adding new event variants is backward-compatible (consumers must handle unknown names defensively if they ever subscribe).

---

## 4. `useHotkeys(bindings)` hook

**Purpose**: Low-level primitive used internally by the shell. Exported for future features that want to register page-local shortcuts.

**Module**: `@/lib/use-hotkeys`

**Signature**:

```ts
type SingleBinding = { type: "single"; key: string; handler: (ev: KeyboardEvent) => void };
type SequenceBinding = { type: "sequence"; keys: [string, string]; handler: (ev: KeyboardEvent) => void };
type Binding = SingleBinding | SequenceBinding;

export function useHotkeys(bindings: Binding[]): void;
```

**Guarantees**:
- Ignores events whose `target` is `<input>`, `<textarea>`, `[contenteditable]`, or has `[data-ignore-hotkeys]`.
- Sequence bindings reset on any focus change into an input or after 1 second of inactivity.
- Does not preventDefault unless the handler's binding targets a printable key that would otherwise type into the page.
- Cleans up listeners on unmount.

**Usage** (page-local example):

```tsx
useHotkeys([
  { type: "single", key: "n", handler: () => openCandidateForm() },
]);
```

---

## 5. `resolveActiveItem(pathname, items)` pure function

**Purpose**: The sidebar-active resolver. Exported so the sidebar and unit tests share one source of truth.

**Module**: `@/lib/active-match`

**Signature**:

```ts
export function resolveActiveItem(
  pathname: string,
  items: Pick<NavItem, "id" | "path" | "exactMatch">[],
): string | null; // returns the active item's id, or null
```

**Guarantees**:
- Exact match always wins over prefix match.
- When multiple items prefix-match, the longest `path` wins (FR-011).
- Trailing slashes are normalized (`/candidates` and `/candidates/` are equivalent).
- Query string and hash are ignored.
- Returns `null` when no item matches.

**Test cases (unit tests will lock these):**

| pathname | expected active id |
|---|---|
| `/` | `dashboard` |
| `/candidates` | `candidates` |
| `/candidates/123` | `candidates` |
| `/candidates/123/edit` | `candidates` |
| `/users/abc` | `users` |
| `/something-unknown` | `null` |
| `/users/abc?tab=audit` | `users` (query ignored) |
| `/candidates/` (trailing slash) | `candidates` |

---

## 6. `NAV_CONFIG` read-only export

**Purpose**: Authoritative list of all shell nav items. Consumed by the sidebar and by the 5-role integration tests.

**Module**: `@/lib/nav-config`

**Signature**:

```ts
export const NAV_CONFIG: readonly NavGroup[];
```

**Guarantees**:
- Frozen (`Object.freeze`) at module load.
- Ordering in the array dictates visual ordering in the sidebar.
- IDs are stable identifiers that tests match against.

---

## Backward-compatibility notes

- Adding new `TelemetryEvent` variants is non-breaking for publishers (`emit`); subscribers (v2+) must handle unknown names.
- Adding new `NavItem` entries to `NAV_CONFIG` is non-breaking but must be accompanied by an update to the visibility-matrix tests (SC-002).
- Adding new `BreadcrumbCrumb` fields is non-breaking if optional.
