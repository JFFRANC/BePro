# Contract: Theme Mode API (UI surface)

**Feature**: 006-theme-toggle

This feature exposes only UI / in-process contracts (no HTTP endpoints). Consumers are: feature authors building surfaces that need to behave correctly under both palettes, and the shell itself (header mount point).

---

## 1. `<NextThemesProvider>` mounting contract

**Where**: top-level in `apps/web/src/App.tsx`, wrapping `<ThemeProvider>` (tenant theme) and every other consumer.

**Configuration**:

```tsx
<NextThemesProvider
  attribute="class"            // sets className="dark" | nothing on <html>
  defaultTheme="system"        // FR-005
  enableSystem                 // FR-006
  storageKey="bepro.theme"     // FR-008 / FR-010 stable key
  disableTransitionOnChange={false}
>
  …
</NextThemesProvider>
```

**Invariants**:
- Exactly ONE `NextThemesProvider` in the tree.
- MUST be mounted outside `<ThemeProvider>` so the tenant provider can read theme-mode class at paint time if ever needed.
- MUST be mounted outside any `Routes` / `BrowserRouter` since theme applies globally, including `/login` and `/change-password` (FR-018).

---

## 2. `<ThemeToggle/>` component

**Path**: `apps/web/src/components/layout/ThemeToggle.tsx`

**Public props**: none. It reads `useTheme()` internally.

**DOM contract** (enforced by tests):

```
┌─ <button data-slot="theme-toggle-trigger"                       (shadcn Button, size="icon-sm", variant="ghost")
│            aria-label="Cambiar tema"
│            aria-expanded="true|false"
│          >
│    <Sun | Moon | Monitor>  ← Sun when resolvedTheme="light",
│                              Moon when resolvedTheme="dark",
│                              Monitor when theme="system"
│  </button>
│
└─ on open (cmdk-ish dropdown-menu):
    <div role="menu" data-slot="theme-toggle-menu">
      <div role="menuitemradio" aria-checked="true|false" data-value="light">Claro</div>
      <div role="menuitemradio" aria-checked="true|false" data-value="dark">Oscuro</div>
      <div role="menuitemradio" aria-checked="true|false" data-value="system">Sistema</div>
    </div>
```

**Behavior**:
- Click on the trigger opens the menu.
- Click (or Enter/Space) on any option calls `setTheme(value)` AND calls `emit({ name: "theme.change", payload: { value } })`.
- The menu closes on selection, on Escape, or on click outside.
- The currently-active option is marked with `aria-checked="true"` (screen-reader announcement).
- Visible focus ring on trigger and every option (FR-013).

---

## 3. Telemetry contract

Already defined in `apps/web/src/lib/telemetry.ts`:

```ts
emit({ name: "theme.change", payload: { value: "light" | "dark" | "system" } })
```

Emitted once per user-initiated mode change. NOT emitted on OS-follow updates (those are not user-initiated) and NOT emitted on cross-tab sync (would double-count across tabs).

---

## 4. No-flash script contract (index.html)

**Path**: `apps/web/index.html` — added inside `<head>`, before any other script tag.

**Contract**:
- Script is synchronous (no `defer`, no `async`).
- Reads `localStorage.getItem("bepro.theme")`; falls back to `matchMedia("(prefers-color-scheme: dark)").matches`.
- When the resolved mode is `"dark"`, adds `class="dark"` to `<html>`.
- Silently swallows any thrown error (private browsing).
- Does NOT remove `class="dark"` on `"light"` mode (default is already light).

**Why contract-tested**: we include a Playwright (or cheaper: a unit test using `jsdom` + parsing the HTML) check that inserts the script + loads `index.html`, then asserts the initial `<html>` class matches the stored preference without a re-render.

---

## 5. CSS tokens contract

**Invariant** (carried from feature 003; this feature does not alter but depends on it):

Every semantic token declared in `:root` of `apps/web/src/index.css` MUST have a corresponding declaration in the `.dark` selector of the same file with a dark-palette value that satisfies WCAG AA contrast against its paired foreground.

**Verification**: a unit test reads the compiled CSS (or parses `index.css` as a string) and asserts:
- Every `--<name>` appearing under `:root` also appears under `.dark`.
- The two sets have identical key cardinality.

---

## 6. `useThemeMode()` — optional internal helper

If module authors need to branch on theme from React (rare — prefer CSS tokens), they may import `useTheme` directly from `next-themes`:

```ts
import { useTheme } from "next-themes";
const { theme, resolvedTheme, setTheme, systemTheme } = useTheme();
```

Guidance:
- `resolvedTheme` is the rendered palette (`"light"` or `"dark"`) — use this for conditional content like toggling a logo variant.
- `theme` is the user's stored choice (`"light"` | `"dark"` | `"system"`) — use this for reflecting the setting UI.
- Prefer tokens + `dark:` Tailwind variants over runtime JS branches.

---

## 7. No HTTP contract

This feature does not add, remove, or modify any HTTP endpoint, WebSocket subscription, or shared Zod schema.
