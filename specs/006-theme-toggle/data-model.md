# Data Model: Theme Toggle

**Feature**: 006-theme-toggle

Theme mode is a simple frontend-only preference. There is no database schema, no API payload, and no new backend entity.

## 1. Theme preference (client-only)

| Attribute | Type | Values | Scope | Notes |
|---|---|---|---|---|
| `mode` | string | `"light"` \| `"dark"` \| `"system"` | per browser | Written by the user; persisted in `window.localStorage` under key `bepro.theme` via `next-themes`. |
| `resolvedMode` | string (derived) | `"light"` \| `"dark"` | per render | `mode === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode`. Computed at render time by `next-themes`. |
| `systemMode` | string (derived) | `"light"` \| `"dark"` | per render | Always reflects the current OS preference, independent of `mode`. Exposed by `useTheme()`. |

### Validation rules

- `mode` MUST be one of the three canonical string values; any other value found in storage (e.g. stale data) MUST be treated as missing and the default `"system"` applied.
- No `mode` value is valid "sometimes" — the set is closed. (FR-002)

### State transitions

```
┌──────────┐   user picks    ┌──────────┐
│   any    │  ─────────────► │ selected │
│  mode    │                 │   mode   │
└──────────┘                 └──────────┘

Initial state when storage is empty: "system"
```

There is no lifecycle beyond "set a value" and "read a value". No audit events are recorded for theme changes (telemetry `theme.change` is fire-and-forget, not an AuditEvent).

---

## 2. CSS token surfaces (design-time entities)

These already exist in `apps/web/src/index.css`. Documented here for reference; **no schema change in this feature**.

### Neutral surface tokens (must have light + dark variants)

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`.

### Brand / semantic tokens (must have light + dark variants)

`--primary` / `--primary-foreground`, `--secondary` / `--secondary-foreground`, `--accent` / `--accent-foreground`, `--destructive` / `--destructive-foreground`, `--success` / `--success-foreground`, `--warning` / `--warning-foreground`, `--info` / `--info-foreground`.

### Chart tokens

`--chart-1` … `--chart-5`.

### Sidebar tokens

`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`.

### Status-badge tokens (candidates FSM)

`--badge-<status>-bg` / `--badge-<status>-fg` for: `registered`, `interview-scheduled`, `attended`, `pending`, `approved`, `hired`, `in-guarantee`, `guarantee-met`, `rejected`, `declined`, `no-show`, `termination`, `discarded`, `replacement`.

**Invariant (FR-015a)**: every token above MUST have a value in the `:root` selector AND in the `.dark` selector of `index.css`. Deviating from this breaks contrast guarantees.

---

## 3. Telemetry event (already defined)

From `apps/web/src/lib/telemetry.ts` (feature 005):

```ts
| { name: "theme.change"; payload: { value: "light" | "dark" | "system" } }
```

Emitted every time the user selects a new mode. No change required here.

---

## 4. No server-side entities

- No DB table
- No API endpoint
- No shared Zod schema
- No migration
