# Quickstart — Working inside the App Shell

**Audience**: module authors (candidates, placements, clients, users teams) working on pages that render inside the shell.

---

## Wrap your page in the shell

Nothing to do. If your route is declared inside the `<RequireAuth><AppShellLayout /></RequireAuth>` element in `App.tsx`, your page automatically renders in the main content area with header, sidebar, breadcrumb row, and top progress bar wired up.

```tsx
// App.tsx — already set up by this feature
<Route element={<RequireAuth><AppShellLayout /></RequireAuth>}>
  <Route path="/candidates" element={<CandidatesPage />} />
  <Route path="/candidates/:id" element={<CandidateDetailPage />} />
  {/* add your route here */}
</Route>
```

Routes outside that element (e.g., `/login`, `/change-password`) render full-bleed without the shell.

---

## Set breadcrumbs on your page

Use the `useBreadcrumbs` hook anywhere inside the shell. The shell renders whatever you declare; omit the hook (or pass `null`) to render no breadcrumb row.

```tsx
import { useBreadcrumbs } from "@/components/layout";

export function CandidateDetailPage() {
  const { data: candidate } = useCandidate(id);

  useBreadcrumbs(
    candidate
      ? [
          { label: "Candidatos", to: "/candidates" },
          { label: `${candidate.firstName} ${candidate.lastName}` }, // terminal crumb, no `to`
        ]
      : null,
  );

  return /* …page body… */;
}
```

- The **first** crumb always links to the section; the **last** crumb is plain text.
- On unmount, the trail is cleared automatically — you never need `setTrail(null)` yourself.
- Passing an empty `[]` is a dev-mode warning and renders nothing.

---

## Add a nav item to the sidebar

Edit `apps/web/src/lib/nav-config.ts`. Choose the gating style:

**A) You have a CASL subject for this destination:**

```ts
{
  id: "placements",
  label: "Colocaciones",
  path: "/placements",
  icon: Handshake,
  gate: { kind: "ability", action: "read", subject: "Placement" },
}
```

**B) You do NOT have a CASL subject yet:**

```ts
{
  id: "job-openings",
  label: "Vacantes",
  path: "/job-openings",
  icon: Briefcase,
  gate: { kind: "roles", roles: ["admin", "manager", "account_executive", "recruiter"] },
}
```

Then **update the role-visibility test** at `apps/web/src/components/layout/__tests__/role-visibility.test.tsx` — that test locks the SC-002 matrix and will fail until you declare the expected visibility for the new item in all 5 role columns.

**When your module later defines a CASL subject**, flip the gate from `roles` to `ability`. If the visibility matrix is unchanged, the tests still pass.

---

## Declare a child route (detail/edit) without losing sidebar highlight

Nothing to do. The sidebar uses prefix match (FR-011). A route like `/candidates/123/edit` continues to highlight the `Candidatos` item because its `path: "/candidates"` is a prefix. If you have two items whose paths would both match (e.g., `/users` and `/users/new`), the longest prefix wins — declare them naturally.

If you need **exact match** (rare — shared prefixes that must not overlap), set `exactMatch: true` on the item:

```ts
{ id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard, gate: { … }, exactMatch: true }
```

Without `exactMatch: true`, a `path: "/"` would match *every* route.

---

## Emit a telemetry event

```ts
import { emit } from "@/lib/telemetry";

function openRegistrationForm() {
  emit({ name: "nav.click", payload: { itemId: "candidates-new", path: "/candidates/new", source: "sidebar" } });
  // …
}
```

- `emit` is a no-op in production today. In development it logs via `console.debug`.
- Adding new event names requires extending the `TelemetryEvent` union in `lib/telemetry.ts` (preserves type safety for future subscribers).

---

## Register a page-local keyboard shortcut

```tsx
import { useHotkeys } from "@/lib/use-hotkeys";

export function CandidatesPage() {
  const navigate = useNavigate();
  useHotkeys([
    { type: "single", key: "n", handler: () => navigate("/candidates/new") },
  ]);
  // …
}
```

The shell already owns these global shortcuts — do not re-register them on your page:

| Key | Action |
|---|---|
| `/` | Focus global search |
| `[` | Toggle sidebar |
| `g` then `d` | Go to Dashboard |
| `g` then `c` | Go to Candidatos |
| `cmd+k` / `ctrl+k` | Open global search surface |

All hotkeys (shell and page-local) auto-ignore keystrokes while focus is in a text input.

---

## Show a loading state during data fetches

You do not need a skeleton. The shell's `TopProgressBar` is already tied to:
- `useNavigation().state === "loading"` (react-router-dom), and
- `useIsFetching()` from TanStack Query.

As long as your queries use the project's `queryClient`, the bar animates automatically during slow loads. Only build a per-page skeleton if the empty state is particularly confusing without one — it is never required.

---

## Gotchas

- **Do not style your page with a top margin for the header.** The shell already reserves that space; a page-level margin will double it.
- **Do not wrap your page in a second `<ErrorBoundary>`.** The shell has one. Wrap local islands (e.g., a flaky widget) instead.
- **Do not call `document.title = "…"` directly.** A dedicated `useDocumentTitle(title)` hook lives in the existing `page-header` component area — prefer that.
- **Do not persist sidebar state yourself.** That is the shell's concern.
- **Do not assume `AuthUser` is not null inside the shell.** It never is — `<RequireAuth>` guarantees it — but if you test your page in isolation, mock `useAuth()`.
