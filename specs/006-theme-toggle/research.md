# Research: Theme Toggle — Light, Dark & System Modes

**Feature**: 006-theme-toggle
**Date**: 2026-04-20
**Scope**: Resolve all open questions from `plan.md` Technical Context. Catalog best practices per dependency. No `NEEDS CLARIFICATION` entries remained after `/speckit.clarify` — this doc locks in the mechanics.

---

## R1 — Provider composition: next-themes and tenant ThemeProvider

**Decision**: Layer the providers. `NextThemesProvider` (from `next-themes`) wraps the existing tenant `ThemeProvider` at the root of `App.tsx`.

```tsx
<NextThemesProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  storageKey="bepro.theme"
  disableTransitionOnChange={false}
>
  <ThemeProvider theme={currentTenantTheme}>
    {children}
  </ThemeProvider>
</NextThemesProvider>
```

**Rationale**:
- `next-themes` only manages a single class on `<html>` (`.dark` or `.light`) and a `data-theme` attribute. It does NOT touch inline CSS variables on `:root`.
- The existing tenant `ThemeProvider` sets inline CSS variables on `document.documentElement.style` via `useLayoutEffect`. Those inline variables take precedence over `:root` rules in `index.css` but NOT over `.dark` rules (since `.dark` specificity is higher than `:root` when the class is present).
- Result: when a tenant sets `--primary`, it wins in light mode (overrides `:root`); in dark mode the `.dark` block's `--primary` wins UNLESS the tenant also sets it inline — which means for correct dark-mode tenant branding, the tenant module must also set inline `--primary` with a dark variant (or we must handle this differently — see R5).
- Two independent providers keep responsibilities cleanly separated. Neither knows about the other.

**Alternatives considered**:
- **Rewrite `ThemeProvider` to call `next-themes` internally**: More refactor surface, more coupled. Rejected.
- **Drop the tenant provider entirely**: Cannot — tenant branding is a live requirement handled elsewhere.
- **Move tenant CSS variables onto a `[data-tenant="..."]` selector in `index.css`**: Would avoid the precedence issue but requires pre-generating tenant CSS at build time. Rejected as over-engineering for this feature.

---

## R2 — No-flash on first paint (FR-009, SC-002)

**Decision**: Inline a small (~500-byte) script in `apps/web/index.html` that runs synchronously BEFORE React mounts. It reads `localStorage["bepro.theme"]` (or falls back to `prefers-color-scheme`) and sets `className="dark"` on the `<html>` element accordingly.

```html
<head>
  …
  <script>
    (function () {
      try {
        var saved = localStorage.getItem("bepro.theme");
        var mode = saved || "system";
        var isDark =
          mode === "dark" ||
          (mode === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (isDark) document.documentElement.classList.add("dark");
      } catch (_) { /* private browsing: fallback to light */ }
    })();
  </script>
</head>
```

**Rationale**:
- `next-themes` was designed for Next.js (SSR/SSG). In a Vite SPA, the HTML shell ships static; React hydrates afterwards. Without an inline script, the first paint uses the default `:root` palette, then React mounts, the provider's `useEffect` runs, and the class flips — producing the documented "flash of wrong theme" (FOUC).
- `next-themes` v0.4 exposes no official helper for non-Next.js SPAs; the community pattern is exactly this inline script.
- Runs synchronously in `<head>` — completes before ANY pixel is drawn. Silent try/catch handles private-browsing / storage-blocked cases.

**Alternatives considered**:
- **Inject the class in `main.tsx` before `createRoot().render`**: Still happens after parse + first paint frame. Rejected.
- **Use `next-themes`'s `ThemeProvider` with `enableColorScheme` and rely on it alone**: Will not prevent first-paint FOUC in SPA mode — confirmed via local experiment and multiple issue threads in the next-themes repo.

---

## R3 — Cross-tab synchronization (FR-020, SC-009)

**Decision**: Rely on `next-themes`' built-in cross-tab sync. `NextThemesProvider` subscribes to the `storage` event by default and updates its internal state when another tab writes the preference.

**Rationale**:
- `next-themes` v0.4.6 ships with `storage` event listener out of the box; no additional config needed.
- Propagation latency is the browser's native `storage`-event dispatch time — typically < 50 ms — well inside the 1-second bound from SC-009.

**Alternatives considered**:
- **`BroadcastChannel`**: Stronger primitive but not needed when `storage` event already works.
- **Polling localStorage**: Wasteful.

**Verification plan**: integration test opens two in-memory router instances against the same jsdom localStorage, dispatches a manual `storage` event, and asserts both update.

---

## R4 — OS `prefers-color-scheme` live follow (FR-006, SC-007)

**Decision**: Rely on `next-themes`' built-in `matchMedia` listener when `enableSystem` is set and the current theme is `"system"`. No custom logic required.

**Rationale**:
- `next-themes` calls `window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", …)` internally. When the user is on `"system"`, the resolved theme flips and the class on `<html>` updates within a frame.
- FR-007 (don't follow when user has chosen explicit mode) is also handled by `next-themes` — it only listens to `matchMedia` when `theme === "system"`.

**Alternatives considered**:
- **Custom `useMediaQuery` hook**: Duplicates what the library already does. Rejected.

---

## R5 — Tenant brand dark variants (FR-015a)

**Decision**: For v1, the default BePro palette's dark variants ALREADY exist in `apps/web/src/index.css` under `.dark` (primary, accent, destructive, background, card, muted, foreground, chart-1..5, sidebar-*, badge-*). When a tenant does NOT override brand tokens at runtime, dark mode works out of the box. When a tenant DOES override tokens via `ThemeProvider theme={{...}}`, they MUST also provide dark variants — this is a responsibility carried by the (future) tenant-branding module, tracked as an assumption in the spec.

For THIS feature: we do not edit the tenant-injection path. We ensure the default palette's dark variants stay coherent under the new toggle. The `ThemeProvider` change is zero-behavior — same logic, same position relative to React tree.

**Rationale**:
- Moving tenant branding to support dark variants is a separate workstream (likely in a future `tenants` module feature, not in the shell).
- For the current user base (one tenant with no brand overrides yet), the default `.dark` block is correct.

**Alternatives considered**:
- **Block dark mode for branded tenants until they provide dark variants**: Overkill for v1 — no branded tenants exist today.
- **Auto-derive dark variants from light (lightness inversion via OKLch)**: Tempting but produces poor results with branded primary colors. Rejected.

---

## R6 — Telemetry wiring (FR-011)

**Decision**: Wrap `setTheme` from `useTheme()` with a local helper inside `ThemeToggle.tsx` that calls `emit({ name: "theme.change", payload: { value } })` before invoking `setTheme`. The `TelemetryEvent` union from feature 005 already includes the exact event shape.

**Rationale**:
- Single call site (the only place where the user can change the theme in v1) — no scatter.
- The telemetry emitter from `apps/web/src/lib/telemetry.ts` is already a no-op-in-prod + `console.debug`-in-dev dispatcher. No new wiring.

**Alternatives considered**:
- **Global hook wrapping `useTheme`**: Over-engineering for one call site.

---

## R7 — Reduced-motion transition (FR-016)

**Decision**: Add a brief global CSS transition on color/background properties gated by `@media (prefers-reduced-motion: no-preference)`. Target < 200 ms. Existing `tw-animate-css` + Tailwind 4 utilities can handle this; we add one small block in `index.css`:

```css
@media (prefers-reduced-motion: no-preference) {
  :root {
    transition:
      background-color 150ms ease,
      color 150ms ease,
      border-color 150ms ease;
  }
  :root * {
    transition:
      background-color 150ms ease,
      color 150ms ease,
      border-color 150ms ease,
      fill 150ms ease,
      stroke 150ms ease;
  }
}
```

Users with `prefers-reduced-motion: reduce` see an instantaneous switch (no transition).

**Rationale**:
- Scoped to color/background/border/fill/stroke — no layout or transform transitions to avoid unexpected animations.
- 150 ms is under the 200 ms ceiling and feels snappy without being jarring.

**Alternatives considered**:
- **Per-element utility classes**: Too invasive; hundreds of components.
- **`view-transition-api`**: Not universally supported (Safari < 18). Rejected.

---

## R8 — Test strategy for jsdom

**Decision**: Jsdom supports `matchMedia` only via a manual polyfill or `vi.stubGlobal`. Existing tests do not rely on matchMedia; we add a small shim in `vitest.config.ts` setup (not yet present) OR inline in the test file itself to keep the global config untouched.

**Rationale**:
- The 005 feature chose not to add a global setup file. Keep that pattern: each test that needs matchMedia sets it up locally.

Example shim:

```ts
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark") ? false : true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});
```

**Alternatives considered**:
- **Global `vitest.setup.ts`**: Worth it if many tests need `matchMedia`. For 006 only two tests need it — keep local.

---

## Summary of decisions

| ID | Decision | Key file(s) |
|---|---|---|
| R1 | Layered providers: NextThemesProvider outside, tenant ThemeProvider inside | `apps/web/src/App.tsx` |
| R2 | Inline no-flash script in index.html before React mounts | `apps/web/index.html` |
| R3 | Rely on next-themes built-in cross-tab storage sync | — |
| R4 | Rely on next-themes built-in matchMedia listener | — |
| R5 | Use existing `.dark` tokens; tenant dark variants deferred to tenants module | `apps/web/src/index.css` (no change) |
| R6 | Wrap `setTheme` with telemetry emit in ThemeToggle | `apps/web/src/components/layout/ThemeToggle.tsx` |
| R7 | Add color/background transition via `@media (prefers-reduced-motion: no-preference)` | `apps/web/src/index.css` |
| R8 | Local matchMedia shim per test file | test files |

All open questions resolved. Ready for Phase 1.
