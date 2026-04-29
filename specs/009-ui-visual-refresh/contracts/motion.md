# Contract: Motion

**Feature**: 009-ui-visual-refresh
**Phase**: 1 (Design & Contracts)
**Consumers**: every interactive component (buttons, cards, inputs, dialogs, sheets, popovers, tooltips, dropdowns, tabs, toasts, skeletons, route transitions)

## Principles

1. **Motion is deliberate and abundant.** Login, dashboard, lists, details, forms — every key surface has a purpose-built entrance and response. Motion is not an afterthought; it is a signature of this refresh.
2. **Confident, not gimmicky.** No bouncing springs, no rotating flourishes, no decorative shimmer on primary surfaces. Motion communicates state, hierarchy, and rhythm.
3. **Budgeted.** Every surface has a duration ceiling (see table below). Primary interactions ≤ 250ms. Route transitions ≤ 400ms. Cumulative staggers ≤ 500ms. Count-ups ≤ 600ms.
4. **Respect the user.** `prefers-reduced-motion: reduce` suppresses transforms and translations while preserving opacity feedback so functionality stays intact. Count-ups skip to the final value. Staggers become simultaneous opacity fades. No exceptions.
5. **No new runtime deps.** Delivered entirely via Tailwind utility classes, `tw-animate-css` (already installed), and CSS `@keyframes`. The motion vocabulary stays small and composable.

## Budget

| Surface | Duration | Easing | Reduced-motion fallback |
|---|---|---|---|
| Button hover | 120ms | `ease-out` (`cubic-bezier(0, 0, 0.2, 1)`) | Opacity-only |
| Button press (active) | 80ms | `ease-out` | Opacity-only |
| Card hover | 150ms | `ease-out` | Opacity-only |
| List item hover (table row, list row) | 120ms | `ease-out` | Opacity-only |
| Dialog enter | 200ms (fade + 8px Y slide) | `ease-out` | Fade only |
| Dialog exit | 150ms | `ease-in` (`cubic-bezier(0.4, 0, 1, 1)`) | Fade only |
| Sheet (side drawer) enter | 250ms (slide) | `ease-out` | Fade only |
| Sheet exit | 200ms | `ease-in` | Fade only |
| Dropdown / Popover enter | 120ms (fade + 4px Y slide) | `ease-out` | Fade only |
| Dropdown / Popover exit | 100ms | `ease-in` | Fade only |
| Tooltip appear | 100ms fade + 200ms delay | `ease-out` | Fade only, delay unchanged |
| Tooltip dismiss | 100ms fade | `ease-in` | Fade only |
| Toast (sonner) enter | 250ms (fade + 4px Y slide) | `ease-out` | Fade only |
| Toast exit | 150ms | `ease-in` | Fade only |
| Tabs indicator slide | 200ms | `ease-out` | Instant color swap (no slide) |
| Route / page transition | 350ms (fade + optional 4px Y translate) | `ease-out` | Fade only |
| Skeleton pulse | 1500ms loop (opacity 0.6 ↔ 1.0) | `ease-in-out` | **Animation disabled**; static opacity 0.7 |

### Entrance choreography (page-level and list-level)

| Surface | Duration | Stagger | Easing | Reduced-motion fallback |
|---|---|---|---|---|
| Login screen entrance | cumulative ≤ 500ms | 80ms between: logo → heading → form fields → submit button → footer | `ease-out` | All reveal simultaneously, opacity-only, 150ms |
| Dashboard mount (widgets) | 180ms per widget | 40–60ms between widgets | `ease-out` | Opacity-only, 150ms, no stagger |
| List mount (first ~10 rows) | 180ms per row (fade + 4px Y translate) | 40ms between rows | `ease-out` | Opacity-only, 150ms, no stagger (rows appear simultaneously) |
| Detail view mount | 200ms fade + 4px Y | header → hero → body stagger, ≤ 300ms cumulative | `ease-out` | Opacity-only, 150ms |
| Stat-card count-up | 600ms numeric interpolation (0 → target, ease-out) | — | `ease-out` | Final value shown immediately, no interpolation |
| Sidebar active indicator slide | 200ms (when user navigates, the indicator glides between items) | — | `ease-out` | Instant color swap (no slide) |
| Form field focus ring | 120ms scale-in (0 → 100%) | — | `ease-out` | Opacity-only fade (no scale) |
| Form validation error reveal | 150ms fade + 2px Y | — | `ease-out` | Opacity-only |
| Card hover lift | 150ms `translate-y-[-1px]` + shadow upgrade `sm` → `md` | — | `ease-out` | Shadow upgrade only, no translate |
| List row hover highlight | 120ms color swap | — | `ease-out` | Instant color swap |

## Implementation notes

- Primary implementation is Tailwind's `transition-*` utilities plus `duration-*` and `ease-*`.
- Enter/exit animations on shadcn primitives use `tw-animate-css` classes (`animate-in`, `animate-out`, `fade-in`, `slide-in-from-top-2`, etc.) already established by feature 005.
- For every animated element, the author MUST add a `motion-reduce:` variant that:
  - Replaces `translate-*`, `scale-*`, `rotate-*` classes with no-op equivalents OR
  - Replaces the whole animation with an opacity-only transition.
- Example pattern:
  ```tsx
  className={cn(
    "transition-transform duration-150 ease-out",
    "motion-reduce:transition-none motion-reduce:transform-none",
    "hover:scale-[1.02] motion-reduce:hover:scale-100"
  )}
  ```

## Anti-patterns (explicitly disallowed)

- **No bouncing springs.** `ease-out` / `ease-in` only.
- **No indefinite idle animations** (spinning logos, shimmering gradients). Skeletons pulse at 1500ms and stop as soon as content loads.
- **No decorative parallax** or scroll-triggered reveals on list views.
- **No rotation on hover** for buttons / cards / icons (save rotation for meaningful state changes — chevron open/close, loading spinner on a pending button).
- **No "wow" intro animations on first load.** Splash/marketing is out of scope.

## Automated validation

Each animated component ships with a Vitest test that asserts:

1. The base motion class chain is present (e.g., `transition-transform duration-150 ease-out` on a hover-animated button).
2. A `motion-reduce:` counterpart class is present that overrides the transform/translate.
3. When `matchMedia('(prefers-reduced-motion: reduce)')` is mocked to return `matches: true`, the component's computed visual does not emit a transform keyframe (verified via class assertion since jsdom does not paint).

`prefers-reduced-motion` is mocked via a Vitest setup file that provides a deterministic `matchMedia` implementation.
