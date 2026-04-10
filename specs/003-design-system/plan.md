# Implementation Plan: Design System

**Branch**: `003-design-system` | **Date**: 2026-04-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-design-system/spec.md`

## Summary

Define the complete visual design system for BePro's multi-tenant recruitment platform. The system replaces the current grayscale shadcn/ui defaults with a brand-aligned teal-green palette in OKLch color space, adds a Fraunces + Source Sans 3 typography system, defines 14 candidate status badge variants, provides CSS-only animations, establishes responsive layout patterns, and includes a `ThemeProvider` for per-tenant runtime theme injection — all without additional libraries.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: React 19.1, Tailwind CSS 4.1.10 (`@tailwindcss/vite`), class-variance-authority 0.7.1, lucide-react, sonner, clsx + tailwind-merge
**Storage**: N/A (CSS tokens only; tenant theme storage deferred to tenant module)
**Testing**: Vitest 3.2.3 + Testing Library (React) + jsdom
**Target Platform**: Cloudflare Pages (SPA), browsers: Chrome 111+, Firefox 113+, Safari 16.4+
**Project Type**: Frontend SPA design system (CSS tokens + React components)
**Performance Goals**: CLS < 0.1 (font loading), animations < 300ms, CSS var injection < 1ms
**Constraints**: CSS-only animations (no motion libraries), OKLch color space, Tailwind v4 CSS-based config (no tailwind.config.ts), `prefers-reduced-motion` support
**Scale/Scope**: 250+ daily recruiters, 14 FSM badge states, ~70 CSS custom properties, 8 animation keyframes, 7-level type scale

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Isolation | PASS | ThemeProvider injects per-tenant CSS vars from JWT/API context. No tenant data in CSS files. Theme data flows through existing tenant resolution middleware. |
| II. Edge-First | PASS | All CSS/tokens deployed to Cloudflare Pages. No server-side rendering or traditional server needed. Google Fonts loaded via CDN. |
| III. TypeScript Everywhere | PASS | ThemeProvider, badge component, and all code in TypeScript strict mode. TenantTheme interface defined. |
| IV. Modular by Domain | PASS | Design system is shared infrastructure (`components/ui/`, `components/theme-provider.tsx`), not a domain module. Adding it does not modify existing modules. LoginForm and App.tsx already use semantic token classes — they automatically pick up new values. |
| V. Test-First | PASS | Tests written first for: token rendering (light/dark), contrast verification, badge variant rendering, ThemeProvider injection, animation presence, reduced-motion behavior. |
| VI. Security by Design | PASS | No PII involved. Tenant theme data is non-sensitive (colors, radius). No XSS vectors — CSS custom properties are safe by design. |
| VII. Best Practices via Agents | PASS | Skills used: `tailwind-design-system`, `shadcn-ui`, `ui-ux-pro-max`, `frontend-design`, `design-system`. Agents used: `senior-frontend-engineer` (implementation), `Explore` (codebase analysis). |
| VIII. Spec-Driven Development | PASS | Full spec → clarify → plan → tasks → implement workflow followed. |

**Post-Phase 1 re-check**: All gates remain PASS. No constitution violations introduced by the design.

## Project Structure

### Documentation (this feature)

```text
specs/003-design-system/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: token entities & badge mapping
├── quickstart.md        # Phase 1: developer quickstart
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
apps/web/
├── index.html                          # Google Fonts <link> tags (MODIFY)
├── src/
│   ├── index.css                       # Design tokens — colors, typography, radius,
│   │                                   #   animations, badge vars (MODIFY)
│   ├── App.tsx                         # Wrap with ThemeProvider (MODIFY)
│   ├── components/
│   │   ├── theme-provider.tsx          # TenantThemeProvider (NEW)
│   │   └── ui/
│   │       ├── badge.tsx               # shadcn/ui + 14 FSM variants (NEW via shadcn CLI + extend)
│   │       ├── button.tsx              # shadcn/ui button (NEW via shadcn CLI)
│   │       ├── input.tsx               # shadcn/ui input (NEW via shadcn CLI)
│   │       └── card.tsx                # shadcn/ui card (NEW via shadcn CLI)
│   └── __tests__/
│       ├── design-tokens.test.tsx      # Token rendering, contrast, dark mode (NEW)
│       ├── badge-variants.test.tsx     # Badge 14 FSM states (NEW)
│       ├── theme-provider.test.tsx     # Tenant theme injection (NEW)
│       └── animations.test.tsx         # Animation presence, reduced-motion (NEW)
```

**Structure Decision**: Design system tokens live in `index.css` (existing file, extended). Shared UI components go in `src/components/ui/` (standard shadcn/ui location). ThemeProvider is a shared component in `src/components/`. Tests in `src/__tests__/` at the app level since they test cross-cutting concerns, not a specific domain module.

## Implementation Phases

### Phase 1: Design Tokens (P1 — Brand Colors + Typography)

**Goal**: Replace grayscale defaults with brand teal-green palette and install font system.

**Files touched**:
- `apps/web/index.html` — add Google Fonts `<link>` tags
- `apps/web/src/index.css` — replace all `:root` and `.dark` token values, add `--success`/`--warning`/`--info` tokens with `@theme inline` mappings, add `--font-heading`/`--font-sans` font families, add `--destructive-foreground`

**Color palette** (from research.md D2):
- Primary: `oklch(0.45 0.12 175)` / dark: `oklch(0.72 0.10 175)`
- Success: `oklch(0.52 0.14 145)` / dark: `oklch(0.68 0.12 145)`
- Warning: `oklch(0.75 0.16 85)` / dark: `oklch(0.78 0.14 85)`
- Info: `oklch(0.55 0.14 245)` / dark: `oklch(0.70 0.12 245)`
- Destructive: `oklch(0.55 0.22 25)` / dark: `oklch(0.68 0.18 25)`
- Surfaces carry faint teal tint (chroma 0.002-0.015 at H:175)

**Typography** (from research.md D3, D4):
- Fraunces variable serif (headings), Source Sans 3 humanist sans (body)
- 1.25 Major Third scale: h1 2.441rem → caption 0.64rem
- Loaded via `<link>` with `display=swap` and `preconnect`

**Tests**: Token rendering in light/dark, contrast ratios, font family application.

**Skills**: `tailwind-design-system`, `ui-ux-pro-max`

### Phase 2: Badge System (P2 — 14 FSM States)

**Goal**: Install shadcn/ui Badge component and extend with 14 candidate status variants.

**Files touched**:
- `apps/web/src/index.css` — add 28 badge CSS custom properties (14 bg + 14 fg) in `:root` and `.dark`, plus `@theme inline` mappings
- `apps/web/src/components/ui/badge.tsx` — install via `npx shadcn@latest add badge`, then extend `badgeVariants` with 14 `status-*` variants using dedicated badge tokens

**Badge variant pattern** (CVA):
```tsx
"status-registered": "border-transparent bg-badge-registered text-badge-registered-fg"
```

Each badge maps to dedicated CSS vars (e.g., `--badge-registered-bg`, `--badge-registered-fg`) registered in `@theme inline` as `--color-badge-registered` etc.

**Visual treatment**:
- In-progress states: lighter background, darker text (pastel appearance)
- Final states: slightly more saturated background to signal finality

**Tests**: All 14 variants render with correct classes, semantic groupings are visually distinct, contrast ratios pass.

**Skills**: `shadcn-ui`, `design-system`

### Phase 3: Component Patterns (P2 — Buttons, Inputs, Cards)

**Goal**: Install core shadcn/ui components that consume the design tokens.

**Files touched**:
- `apps/web/src/components/ui/button.tsx` — install via `npx shadcn@latest add button`
- `apps/web/src/components/ui/input.tsx` — install via `npx shadcn@latest add input`
- `apps/web/src/components/ui/card.tsx` — install via `npx shadcn@latest add card`

**Component customizations**:
- Button: Add `success` and `warning` variants alongside default shadcn variants
- Input: Add `error` prop that applies `border-destructive focus-visible:ring-destructive` and `aria-invalid`
- Card: Use as-is from shadcn/ui (already consumes `--card`, `--card-foreground`, `--border`)

**Tests**: Button variant rendering, input focus/error states, card token consumption.

**Skills**: `shadcn-ui`, `frontend-design`

### Phase 4: Animations & Motion (P3)

**Goal**: Add CSS-only entrance animations, micro-interactions, and loading spinner.

**Files touched**:
- `apps/web/src/index.css` — add `--animate-*` tokens and `@keyframes` inside `@theme inline`, add `prefers-reduced-motion` media query in `@layer base`

**Animations**:
- `animate-fade-in`: opacity 0→1, 200ms ease-out
- `animate-slide-in-up`: translateY(0.5rem)→0 + opacity, 300ms ease-out
- `animate-slide-in-down`: translateY(-0.5rem)→0 + opacity, 300ms ease-out
- `animate-scale-in`: scale(0.95)→1 + opacity, 200ms ease-out
- `animate-spin`: 360° rotation, 1s linear infinite (spinner)
- `animate-accordion-down`/`up`: height collapse (for future accordion component)

**Reduced motion**:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Tests**: Animation class presence, reduced-motion disabling.

**Skills**: `tailwind-design-system`

### Phase 5: ThemeProvider (P2 — Multi-tenant)

**Goal**: Create the `ThemeProvider` component for per-tenant CSS variable injection.

**Files touched**:
- `apps/web/src/components/theme-provider.tsx` — new component
- `apps/web/src/App.tsx` — wrap app with ThemeProvider

**ThemeProvider behavior**:
1. Accepts optional `TenantTheme` object (from auth/API response)
2. On mount/update, iterates theme entries and calls `document.documentElement.style.setProperty()` for each non-null value
3. On unmount, removes injected properties (cleanup)
4. When theme is null/undefined, BePro defaults from `index.css` are used
5. Exports `TenantTheme` TypeScript interface

**Integration with App.tsx**:
```tsx
<ThemeProvider theme={tenantTheme}>
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      {/* routes */}
    </BrowserRouter>
  </QueryClientProvider>
</ThemeProvider>
```

For MVP, `tenantTheme` is `null` (BePro defaults). When the tenant module is built, the theme will come from the auth response.

**Tests**: CSS var injection on mount, cleanup on unmount, partial theme merging, null theme = no injection.

**Skills**: `react-vite-best-practices`

### Phase 6: Layout Patterns (P3)

**Goal**: Define responsive layout CSS utilities for auth (split-screen) and dashboard (sidebar + content).

**Files touched**:
- `apps/web/src/index.css` — add `@utility` definitions for layout patterns, or define as Tailwind class compositions in components

**Patterns**:
- Auth split-screen: CSS Grid with `grid-cols-[2fr_3fr]` at `lg:`, single column below
- Dashboard sidebar: CSS Grid with `grid-cols-[16rem_1fr]` at `lg:`, hidden sidebar below with sheet/drawer pattern
- Max-width container: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

**Note**: Layout components (AuthLayout, DashboardLayout) will be built in their respective domain modules (auth, dashboard). This phase only defines the CSS patterns/utilities.

**Tests**: Responsive breakpoint behavior (media query matching in tests).

**Skills**: `tailwindcss-advanced-layouts`, `frontend-design`

## Dependencies & Ordering

```
Phase 1 (Tokens + Typography)
  ↓
Phase 2 (Badges)  ←→  Phase 3 (Components)  [parallel]
  ↓                        ↓
Phase 4 (Animations) ←→ Phase 5 (ThemeProvider)  [parallel]
  ↓                        ↓
Phase 6 (Layout Patterns)
```

- Phase 1 must complete first (all other phases depend on tokens)
- Phases 2 & 3 can run in parallel (independent component installations)
- Phases 4 & 5 can run in parallel (animations are CSS-only; ThemeProvider is React-only)
- Phase 6 depends on tokens being stable but can start after Phase 1

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| OKLch values produce unexpected colors in some browsers | Medium | Test in Chrome, Firefox, Safari. Add sRGB fallbacks for `--primary`, `--destructive`, `--background`, `--foreground` using `@supports` |
| Fraunces font loading causes CLS > 0.1 | Medium | Use `display=swap` + `preconnect`. Set fallback font with matching metrics. Measure CLS via Lighthouse. |
| Badge colors are too similar in dense tables | High | User-test with 50+ row table. Each semantic group uses distinct hue angles (15-20° apart within group). If insufficient, increase chroma. |
| Tenant theme injection causes flash of default theme | Low | ThemeProvider runs in `useLayoutEffect` (not `useEffect`) to inject before paint. For MVP, no tenant themes are injected. |
| Dark mode tenant overrides conflict with `.dark` class | Medium | API sends separate light/dark theme values. ThemeProvider conditionally injects based on current mode. Document this pattern. |

## Complexity Tracking

> No constitution violations to justify. All gates pass.
