# Research: Design System

**Feature**: 003-design-system | **Date**: 2026-04-03

## Decision Log

### D1: Token Architecture (Tailwind v4 + shadcn/ui)

**Decision**: Use the existing two-layer indirection pattern with `@theme inline` for all runtime-overridable tokens.

**Rationale**: `@theme inline` tells Tailwind to resolve CSS variables at runtime (not build time). This is required for per-tenant theme injection. The chain is: `:root { --primary: oklch(...) }` → `@theme inline { --color-primary: var(--primary) }` → Tailwind generates `bg-primary { background-color: var(--color-primary) }` → browser resolves at runtime.

**Alternatives considered**:
- `@theme` (non-inline): Bakes values at build time. Cannot support runtime tenant overrides. Rejected.
- vanilla-extract/dynamic: Adds a parallel styling layer. Overkill for this use case. Rejected.
- Style Dictionary: Build-time only. Cannot inject from DB at runtime. Rejected.

### D2: Brand Color Palette

**Decision**: Primary teal-green at `oklch(0.45 0.12 175)` (light) / `oklch(0.72 0.10 175)` (dark). Surfaces carry faint teal tint (chroma 0.002-0.015 at H:175).

**Rationale**: User-specified anchor `oklch(0.55 0.12 175)` adjusted to L:0.45 in light mode for WCAG AA contrast (4.5:1) against white foreground text on buttons. Dark mode lightens to L:0.72 for readability on L:0.14 backgrounds. Surface tinting creates cohesive brand feel without being heavy-handed.

**Color space hue allocation**:
- Primary (teal): H:175
- Success (green): H:145 — 30° separation from primary ensures distinction
- Warning (amber): H:85
- Info (blue): H:245
- Destructive (red): H:25
- Chart magenta: H:330

### D3: Font Pairing & Loading

**Decision**: Fraunces (variable serif, headings) + Source Sans 3 (humanist sans, body), loaded from Google Fonts via `<link>` with `display=swap`.

**Rationale**: Both are variable fonts — a single request per family covers all weights. `display=swap` prevents FOIT. Fraunces provides editorial warmth; Source Sans 3 provides clean readability. Both have excellent Spanish/Latin character support.

**Loading strategy**: `<link rel="preconnect">` to `fonts.googleapis.com` and `fonts.gstatic.com`, followed by the stylesheet link. No self-hosting needed for MVP.

### D4: Type Scale

**Decision**: 1.25 Major Third modular scale, base 1rem (16px). Seven levels: h1 (2.441rem), h2 (1.953rem), h3 (1.563rem), h4 (1.25rem), body (1rem), small (0.8rem), caption (0.64rem).

**Rationale**: 1.25 ratio provides clear visual hierarchy without extreme size jumps. Line heights decrease as size increases (1.6 body → 1.15 h1) because larger type needs less relative leading. Negative letter-spacing on headings tightens naturally wide serif letterforms at display sizes.

### D5: Badge Variant Strategy

**Decision**: Use dedicated CSS custom properties per badge state (28 vars: 14 backgrounds + 14 foregrounds), grouped by semantic category with distinct hues within each group.

**Rationale**: Provides precise per-state control, enables per-tenant badge customization, and allows distinct hues within each semantic group for visual differentiation in 50+ row tables. WCAG AA compliance is easier to verify with explicit color pairs.

**Alternative considered**: Opacity modifiers on semantic tokens (`bg-success/15 text-success`). Simpler (fewer vars) and auto-adapts to dark mode, but same-base-color states are harder to distinguish in dense tables. Noted as a valid simplification if 28 vars proves unwieldy.

**Semantic groupings**:
- Progress (blue-teal, H:185-240): Registered, InterviewScheduled, Attended, Pending
- Success (green, H:135-158): Approved, Hired, InGuarantee, GuaranteeMet
- Negative (red-orange, H:15-50): Rejected, Declined, NoShow, Termination
- Neutral-terminal (gray, low chroma): Discarded, Replacement

### D6: Multi-Tenant Theme Injection

**Decision**: Pure CSS custom property injection via a `ThemeProvider` React component. No library needed.

**Rationale**: `document.documentElement.style.setProperty('--primary', value)` overrides `:root` values. The `@theme inline` chain propagates changes to all Tailwind utilities immediately. Browser CSS variable recalculation is sub-millisecond even for 30+ tokens.

**Dark mode handling**: The API sends dark-mode-aware theme values. The ThemeProvider injects both light and dark variants. Inline styles on `documentElement` have higher specificity than `.dark` class rules, so tenant dark-mode values must be injected conditionally based on current mode.

**Architecture**:
```
tenant_themes DB row → API response → ThemeProvider → CSS vars on <html> → Tailwind utilities
```

**Naming**: The component is called `ThemeProvider` (not `TenantThemeProvider`) for simplicity. The `TenantTheme` interface describes the data shape.

### D7: Animation Strategy

**Decision**: CSS-only animations using `--animate-*` tokens + `@keyframes` inside `@theme inline`. Respect `prefers-reduced-motion` via media query.

**Rationale**: `--animate-*` naming in `@theme inline` generates `animate-*` Tailwind utilities. CSS-only means no runtime JS for motion. `@keyframes` can be defined inside the `@theme inline` block.

**Animations defined**: fade-in, fade-out, slide-in-up, slide-in-down, scale-in, accordion-down, accordion-up, spin (for spinner).

### D8: Spacing & Radius

**Decision**: 4px base spacing scale matching Tailwind defaults. Border radius base at `0.5rem` with shadcn/ui multiplier system (sm: 0.6x, md: 0.8x, lg: 1x, xl: 1.4x).

**Rationale**: Tailwind v4 ships with a 4px-based spacing scale by default. No need to redefine — just use the built-in `space-*`, `p-*`, `m-*`, `gap-*` utilities. Custom spacing tokens only needed for non-standard values (sidebar width).

### D9: Component Installation Strategy

**Decision**: Install shadcn/ui components (Button, Badge, Input, Card) via `npx shadcn@latest add` during implementation. Extend Badge with CVA variants for 14 FSM states.

**Rationale**: shadcn/ui copies component source into `src/components/ui/`. Components automatically consume the design tokens from `index.css`. CVA (already installed) handles variant definitions. No need to build components from scratch.

### D10: Breakpoints

**Decision**: Use Tailwind v4 defaults (sm:640px, md:768px, lg:1024px, xl:1280px, 2xl:1536px). Do NOT put breakpoints in `@theme inline` — they must be static.

**Rationale**: B2B dashboard users are primarily on desktop. Default breakpoints cover all needed viewport ranges. Container queries (`@container`) may be used for dashboard widgets as a future enhancement.
