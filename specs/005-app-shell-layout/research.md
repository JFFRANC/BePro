# Phase 0 Research — App Shell & Main Layout

**Branch**: `005-app-shell-layout` | **Date**: 2026-04-19

Six open questions were raised in `plan.md`. Each is resolved below. Decisions are binding for implementation unless challenged in a subsequent plan revision.

---

## R1 — Top progress bar: library vs custom

**Decision**: Custom ~60-line React component using CSS keyframes and Tailwind tokens.

**Rationale**:
- The UI is trivial: a 2px sticky bar at the top with a width animation. Framer Motion or NProgress is overkill for this.
- Tokens (`--primary`) must drive the color so the bar respects the 003-design-system. A bundled library would hardcode or theme via its own API.
- No SSR concerns (SPA); no need for the router integration NProgress provides because react-router-dom v7 exposes `useNavigation()` directly.
- Trigger sources: `useNavigation().state === "loading"` (route transitions) **OR** `useIsFetching()` from TanStack Query when the active page declares loading intent. The custom component subscribes to both and fades in/out with `prefers-reduced-motion` respect.

**Alternatives considered**:
- `nprogress` — deprecated, no React hook, adds ~5KB.
- `@bprogress/react` — modern port of NProgress, but adds a dep and its theming hooks are awkward with Tailwind tokens.
- Framer Motion — would add ~40KB to the bundle for something a CSS `@keyframes` handles.

**Implementation note**: component is `TopProgressBar`. ARIA: `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow` omitted (indeterminate), with an off-screen `aria-live="polite"` region announcing "Cargando..." when the bar shows for more than 500ms (to avoid spamming fast transitions).

---

## R2 — Zustand persist resilience in private browsing

**Decision**: Use `zustand/middleware`'s `persist` with a custom `createJSONStorage(() => safeLocalStorage)` wrapper that returns a `Storage`-shaped object whose `setItem`/`getItem`/`removeItem` try/catch on `localStorage` access and no-op on failure.

**Rationale**:
- Some mobile Safari private-browsing modes throw on `localStorage.setItem` even when `window.localStorage` is defined. A naive `persist` call crashes on first write.
- A `safeLocalStorage` wrapper degrades gracefully: the store keeps its in-memory value for the session, the next reload starts from defaults, and no error reaches the error boundary.
- This matches the spec's explicit assumption ("private-browsing modes, the shell gracefully defaults to the expanded sidebar and the system theme each session without erroring").

**Alternatives considered**:
- Feature-detect `localStorage` with a write-test probe and fall back to `sessionStorage` or memory — same failure mode; `sessionStorage` can also throw in private mode. Try/catch is simpler.
- Skip persistence entirely in private mode — possible but user-facing behavior difference is hard to explain.

**Implementation note**: `safeLocalStorage` lives in `lib/safe-storage.ts` (new). Both `layout-store` and any future persisted slice uses it.

---

## R3 — Theme handling: reuse `next-themes` or roll a custom Zustand slice

**Decision**: Reuse `next-themes` (already installed, v0.4.6). Wrap `ThemeToggle` as a thin component calling `useTheme()`.

**Rationale**:
- `next-themes` is already a dependency and already mounted via `<ThemeProvider theme={null}>` in `App.tsx`.
- It handles `prefers-color-scheme` detection, `localStorage` persistence, cross-tab sync, and SSR/no-SSR hydration safety out of the box — all of FR-027 and FR-028.
- "Works on SPAs without SSR" is explicitly supported (it does not require Next.js despite the name).
- Adding a custom Zustand slice for the same purpose duplicates logic and leaks a second source of truth.

**Alternatives considered**:
- Custom `theme-store.ts` Zustand slice with persist middleware and a `matchMedia('(prefers-color-scheme: dark)')` listener — reinvents a shipped library.
- CSS-only `:root.dark` toggle with a vanilla JS `<head>` script — smaller bundle, but no React integration and no cross-tab sync.

**Implementation note**: verify `<ThemeProvider>` in `App.tsx` is configured with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `storageKey="bepro.theme"` for LFPDPPP-compliant namespaced keys.

---

## R4 — CASL + react-router-dom v7 nav filtering pattern

**Decision**: Single-pass filter inside `SidebarNav`. Each `NavItem` declares **one of** a CASL tuple `[action, subject]` **or** a `roles: UserRole[]` allowlist. `useAbility(AbilityContext)` runs once at `SidebarNav` level; each item calls `ability.can(action, subject)` or `roles.includes(user.role)` synchronously. Groups are hidden when all their items are hidden.

**Rationale**:
- `@casl/react`'s `Can` component is a wrapper that re-runs the check on render; for a flat nav list of ~11 items it is the simplest primitive.
- Separating CASL-gated items from role-allowlist items lets us ship the shell now (covers Dashboard, Candidatos, Clientes, Usuarios, Auditoría via subjects; Vacantes, Entrevistas, Configuración via roles) without defining new CASL subjects outside the feature's scope (the spec states this feature does not define new permissions).
- A single configuration object (`nav-config.ts`) is the source of truth and is the subject of 5 role-matrix integration tests.

**Alternatives considered**:
- Put every item under a CASL subject — requires extending `Subjects` in `lib/ability.ts`, which is out of scope for this feature.
- Role check everywhere — works today, but future role refactors (e.g., permissions per feature flag) would touch every nav item instead of the ability module.

**Implementation note**: `NavItem`'s gating field is a discriminated union:
```ts
type NavGate =
  | { kind: "ability"; action: Actions; subject: Subjects }
  | { kind: "roles"; roles: UserRole[] };
```
A `shouldShow(item, ability, user)` helper centralizes the logic and is unit-tested.

---

## R5 — Keyboard shortcuts: tiny custom `useHotkeys` vs `react-hotkeys-hook`

**Decision**: Custom `use-hotkeys.ts` (~80 lines).

**Rationale**:
- The shortcut surface is small and fixed: `/`, `[`, `g d`, `g c` — four bindings total.
- `react-hotkeys-hook` adds ~6KB and its API (`useHotkeys('g+d', ...)`) overlaps with a 20-line state machine for g-prefix shortcuts.
- The custom hook implements the exact behavior we need (guard against inputs, reset on focus change into an input, 1s timeout for sequence completion) without the library's assumptions about scope providers.
- Tiny surface area means tests can exercise every branch in one suite.

**Alternatives considered**:
- `react-hotkeys-hook` — well-maintained but over-general for 4 shortcuts.
- `mousetrap` — no React bindings out of the box; would still need a wrapper.

**Implementation note**: contract is `useHotkeys(bindings: Binding[]): void` where `Binding` is a discriminated union of `{ type: "single"; key: string; handler: () => void }` and `{ type: "sequence"; keys: [string, string]; handler: () => void }`. Ignores events when `event.target` is an `<input>`, `<textarea>`, `[contenteditable]`, or when the active element has `[data-ignore-hotkeys]`.

---

## R6 — Ability-subject gap

**Decision**: Items without a matching CASL subject use the `roles` gating mode (see R4). The following mapping is authoritative for this feature:

| Nav item | Gating | Visible to |
|---|---|---|
| Dashboard | `roles: ["admin", "manager", "account_executive", "recruiter"]` | all four |
| Candidatos | `ability: ["read", "Candidate"]` | all four (per existing CASL) |
| Vacantes | `roles: ["admin", "manager", "account_executive", "recruiter"]` | all four (placeholder until subject exists) |
| Entrevistas | `roles: ["admin", "manager", "account_executive", "recruiter"]` | all four (placeholder) |
| Colocaciones | `ability: ["read", "Placement"]` | admin, manager, account_executive |
| Empresas cliente | `ability: ["read", "Client"]` | admin, manager, account_executive |
| Contactos | `roles: ["admin", "manager", "account_executive"]` | same three (placeholder) |
| Usuarios | `ability: ["manage", "User"]` → admin only | admin |
| Configuración | `roles: ["admin"]` | admin only (placeholder) |
| Auditoría | `ability: ["read", "Audit"]` | admin, manager (manager has `read all`) |
| Design system | `roles: ["admin", "manager", "account_executive", "recruiter"]` AND only when `import.meta.env.DEV === true` | all roles in dev only |

**Rationale**:
- Locks the exact role-visibility matrix that SC-002 tests against.
- Freelancer flag is a modifier on `recruiter`, not a distinct role, so it inherits the recruiter row.
- When a module later defines its CASL subject (e.g., adding `"Job"` for Vacantes), the nav item's gating can flip from `roles` to `ability` without moving DOM around — the tests will still pass because the visibility matrix is unchanged.

**Alternatives considered**:
- Extend `Subjects` in `lib/ability.ts` now — pulls subject design decisions into a feature that isn't responsible for those modules yet.
- Hide `Vacantes`, `Entrevistas`, `Contactos`, `Configuración` from v1 nav entirely — violates FR-007, which says these groups MUST appear.

---

## Out of scope (called out for clarity)

- **Actual cmd/k search backend** — the shell exposes the trigger only; the opened `CommandDialog` shows a "Próximamente" placeholder.
- **Notifications data layer** — bell popover shows an empty state; no polling, no subscription.
- **Tenant switcher** — confirmed by spec clarification Q5. Tenant name is display-only.
- **Analytics vendor wiring** — telemetry emits through a no-op dispatcher.
- **Static route→label breadcrumb map** — breadcrumbs are page-supplied only (spec clarification Q2).
- **Per-page loading skeletons** — shell provides the global top progress bar; pages do not need to ship skeletons.
