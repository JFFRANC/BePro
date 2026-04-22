# Quickstart: Theme Toggle

**Feature**: 006-theme-toggle
**Audience**: module authors building new UI surfaces. Shell maintainers, see `plan.md`.

---

## 1. Do nothing

If your component uses the existing design tokens — `bg-background`, `text-foreground`, `bg-card`, `text-primary-foreground`, `border-border`, `bg-muted`, etc. — it works in both palettes with zero code change. The tokens resolve to different values under `:root` vs `.dark`.

```tsx
<div className="bg-card text-card-foreground border border-border rounded-md p-4">
  Works in both modes.
</div>
```

## 2. Conditional dark-only styling

Use Tailwind's `dark:` variant (already wired via `@custom-variant dark (&:is(.dark *))` in `index.css`):

```tsx
<img
  src="/logo-light.svg"
  className="dark:hidden"
  alt=""
/>
<img
  src="/logo-dark.svg"
  className="hidden dark:block"
  alt=""
/>
```

## 3. Read the current theme from React (only when CSS is not enough)

```tsx
import { useTheme } from "next-themes";

export function SomeChart() {
  const { resolvedTheme } = useTheme();
  const gridColor = resolvedTheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  return <Chart gridColor={gridColor} />;
}
```

Guidance:
- Prefer CSS tokens when possible — they avoid re-render cascades and keep the component testable without a provider.
- `resolvedTheme` is `"light"` or `"dark"` — the actual palette in use.
- `theme` is the user's stored choice (`"light"` | `"dark"` | `"system"`) — only useful for the toggle UI itself.

## 4. Adding a new color token

1. Open `apps/web/src/index.css`.
2. Add the CSS variable under `:root` with the light-mode value.
3. Add the SAME variable under `.dark` with the dark-mode value (contrast-verified).
4. Expose it to Tailwind inside `@theme inline { … }` if you want it as a class like `bg-<name>`.
5. Add an assertion to the `dark-token-parity.test.ts` (feature 006) so it stays in sync.

**Example**:

```css
:root {
  --highlight: oklch(0.95 0.05 200);
  --highlight-foreground: oklch(0.20 0.06 200);
}

.dark {
  --highlight: oklch(0.25 0.05 200);
  --highlight-foreground: oklch(0.90 0.04 200);
}

/* in @theme inline {} */
--color-highlight: var(--highlight);
--color-highlight-foreground: var(--highlight-foreground);
```

## 5. Writing a component test that needs the `.dark` class

```ts
import { render } from "@testing-library/react";

function renderInDark(ui: React.ReactElement) {
  document.documentElement.classList.add("dark");
  const result = render(ui);
  return {
    ...result,
    cleanup: () => {
      document.documentElement.classList.remove("dark");
      result.unmount();
    },
  };
}
```

(The ThemeToggle tests do this internally — see `ThemeToggle.test.tsx` and `theme-persistence.integration.test.tsx`.)

## 6. Writing a test that needs to simulate the OS preference

```ts
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("prefers-color-scheme: dark") ? true : false,
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

## 7. Don'ts

- **Do NOT use `window.matchMedia` directly in a component** to pick a palette — use `useTheme()` from `next-themes` instead so the user's explicit choice is honoured.
- **Do NOT set `document.documentElement.classList` manually** in your component — only `NextThemesProvider` and the no-flash script own that class.
- **Do NOT hard-code hex colors** anywhere. Only `oklch()` tokens under `:root` / `.dark`.

## 8. FAQ

**Q: My tenant has branded colors. Do I need to do anything extra?**
A: In v1, tenant brand overrides only cover light mode. If the tenant needs dark mode to stay on-brand, they must also supply dark variants. Until then, dark mode uses the default BePro dark palette from `index.css`.

**Q: How do I test that my component renders correctly in dark mode?**
A: See §5 above. You can also manually toggle via the header's ThemeToggle while developing.

**Q: My third-party widget looks broken in dark mode. Blocker?**
A: Per clarified spec (FR-004, SC-004), third-party widgets are SHOULD, not MUST. File a known-gap ticket and proceed.
