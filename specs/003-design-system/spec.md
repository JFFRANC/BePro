# Feature Specification: Design System

**Feature Branch**: `003-design-system`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "Design System for BePro Recruitment Platform — Define the visual design system (CSS tokens, typography, color palette, component patterns) for the multi-tenant recruitment platform."

## Clarifications

### Session 2026-04-02

- Q: Brand primary color hue direction? → A: Teal-green (oklch ~0.55 0.12 175) — trustworthy, growth-oriented, premium feel.
- Q: Font pairing (heading + body)? → A: Fraunces (variable serif, headings) + Source Sans 3 (humanist sans, body). Distinctive yet professional, multiple weights, excellent Spanish support.
- Q: How to handle success/warning/info semantic colors missing from shadcn/ui defaults? → A: Add `--success`, `--warning`, `--info` (+ foreground variants) as new CSS custom properties in both `:root` and `.dark` scopes, alongside existing shadcn tokens.

### Session 2026-04-03

- Q: Multi-tenant theming strategy? → A: Default + overridable. BePro brand as default in `index.css`, plus a `ThemeProvider` that can inject per-tenant CSS custom property overrides from API/DB at runtime. No admin UI yet, but the architecture supports it. No if/else logic — purely data-driven via CSS variable injection. No extra libraries needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Brand Identity & Color Tokens (Priority: P1)

A developer opens `index.css` and finds a complete set of brand color tokens (primary, secondary, semantic colors, neutral scale) defined in OKLch that replace the current grayscale defaults. The colors convey professionalism and trustworthiness appropriate for a B2B recruitment platform serving Mexican agencies. All shadcn/ui semantic tokens (`--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--border`, `--ring`, etc.) are populated with brand-aligned values for both light and dark modes.

**Why this priority**: Without brand colors, every component renders in generic gray. This is the foundation that all other visual work depends on.

**Independent Test**: Apply the updated `index.css` to a blank page with shadcn/ui `Button` (all variants) and `Card` components. Verify that primary, secondary, destructive, and ghost buttons each have visually distinct, brand-consistent colors in both light and dark modes. Verify OKLch values produce correct colors across Chrome, Firefox, and Safari.

**Acceptance Scenarios**:

1. **Given** the design system tokens are applied, **When** a developer renders a primary button, **Then** it displays the brand primary color (a deep teal-green), not the default black/white.
2. **Given** the `.dark` class is toggled on the root element, **When** components render, **Then** all semantic colors shift to their dark-mode counterparts with sufficient contrast (WCAG AA — 4.5:1 for text, 3:1 for large text/UI).
3. **Given** a destructive action button, **When** it renders in light or dark mode, **Then** it uses a distinct red/coral color that signals danger, separate from all other semantic colors.
4. **Given** the neutral gray scale, **When** borders, muted backgrounds, and foreground text render, **Then** there are at least 8 perceptually uniform steps from lightest to darkest.

---

### User Story 2 — Typography System (Priority: P1)

A developer applies the design system fonts and sees a clear visual hierarchy: a distinctive display/heading font paired with a clean, readable body font. Both fonts are loaded from Google Fonts. The type scale covers headings (h1–h4), body, small, and caption sizes with defined line heights and letter spacing. The fonts feel premium and professional — not generic.

**Why this priority**: Typography defines 80% of a product's perceived quality. Without a type scale, every developer picks arbitrary sizes, breaking visual consistency.

**Independent Test**: Render a page with h1, h2, h3, h4, body text, small text, and a caption. Verify each level has a visually distinct size, appropriate line height, and consistent spacing. Verify the heading font differs from the body font and both render correctly.

**Acceptance Scenarios**:

1. **Given** the font files load successfully, **When** headings render, **Then** they use Fraunces (variable serif) and body text uses Source Sans 3 (humanist sans-serif).
2. **Given** the type scale, **When** all heading levels are rendered sequentially, **Then** each step is visibly smaller than the previous with a consistent ratio (approximately 1.25–1.333 modular scale).
3. **Given** body text rendered at the default size, **When** measured, **Then** line height is between 1.5 and 1.75 for optimal readability.
4. **Given** a slow network, **When** fonts have not loaded yet, **Then** a system font fallback stack renders without layout shift (FOUT handled via `font-display: swap`).

---

### User Story 3 — Candidate Status Badges (Priority: P2)

A recruiter views a candidate list and each candidate's status is shown as a color-coded badge. All 14 FSM states (Registered, InterviewScheduled, Attended, Approved, Pending, Rejected, Declined, Discarded, NoShow, Hired, InGuarantee, GuaranteeMet, Termination, Replacement) have visually distinct badge styles grouped by semantic meaning: progress states (blue/teal tones), success states (green tones), negative states (red/orange tones), and neutral/terminal states (gray tones). Badges are instantly scannable in a table with 50+ rows.

**Why this priority**: The candidate list is the most-used screen by 250+ recruiters. Status badges are the primary visual indicator of workflow progress. Without distinct colors, recruiters must read text labels — which is slow when scanning tables.

**Independent Test**: Render all 14 badges in a row. Verify each is visually distinguishable from its neighbors, that semantic groupings are intuitive (green = good, red = bad, blue = in progress), and that all pass WCAG AA contrast against both light and dark backgrounds.

**Acceptance Scenarios**:

1. **Given** 14 candidate status values, **When** each renders as a badge, **Then** no two badges within the same semantic group share identical colors, and badges across groups are clearly different.
2. **Given** a recruiter viewing a candidate table in dark mode, **When** status badges render, **Then** all badge text meets WCAG AA contrast (4.5:1) against the badge background.
3. **Given** a badge for a final/terminal state (GuaranteeMet, Termination, Replacement, Rejected, Declined, Discarded), **When** it renders, **Then** it includes a subtle visual cue (solid background for finals vs. outlined for in-progress) to signal finality.

---

### User Story 4 — Component Patterns (Priority: P2)

A developer building a form (e.g., candidate registration) uses input fields, buttons, cards, and layout patterns defined by the design system. Input fields have consistent padding, border radius, focus rings using the brand primary color, icon slots, and error states. Buttons come in primary, secondary, destructive, outline, and ghost variants. Cards have a consistent shadow/border treatment. All components respect the spacing scale and border radius tokens.

**Why this priority**: Consistent components eliminate per-developer styling decisions and accelerate module development (auth, candidates, clients, placements all need forms and cards).

**Independent Test**: Build a sample form with 3 inputs (text, email with icon, password with error), 4 button variants, and a card wrapper. Verify focus rings use brand primary, error inputs show destructive color, and spacing between elements follows the scale. Verify all render correctly in both light and dark mode.

**Acceptance Scenarios**:

1. **Given** an input field receives focus, **When** the focus ring appears, **Then** it uses the brand primary color (not browser default or generic blue).
2. **Given** an input field in error state, **When** it renders, **Then** the border color, focus ring, and helper text all use the destructive color.
3. **Given** four button variants (primary, secondary, destructive, ghost), **When** rendered side by side, **Then** each has a distinct visual treatment: primary has solid brand fill, secondary has outline/subtle fill, destructive has red fill, ghost has no background until hover.
4. **Given** the spacing scale, **When** a form is built with standard gaps, **Then** the vertical rhythm between form fields is consistent (following a base-4 spacing unit).

---

### User Story 5 — Animation & Motion (Priority: P3)

A user navigates the platform and encounters smooth, subtle animations: page content fades in on load, cards slide up on entrance, buttons have hover/active micro-interactions, and loading states use a branded spinner. All animations are CSS-only (no JavaScript motion libraries), respect `prefers-reduced-motion`, and do not exceed 300ms duration.

**Why this priority**: Motion adds polish and perceived quality but is not blocking for feature development. It enhances rather than enables the core experience.

**Independent Test**: Navigate between two pages and verify content animates in. Hover over buttons and verify scale/shadow transitions. Enable `prefers-reduced-motion` in system settings and verify all animations are disabled or reduced to opacity-only.

**Acceptance Scenarios**:

1. **Given** a page loads, **When** the main content area renders, **Then** it animates in with a fade + slight upward slide over 200–300ms.
2. **Given** `prefers-reduced-motion: reduce` is enabled, **When** any animation would play, **Then** it is either removed entirely or reduced to a simple opacity fade.
3. **Given** a button in its default state, **When** the user hovers, **Then** a subtle brightness/shadow transition occurs within 150ms.
4. **Given** a loading state, **When** a spinner renders, **Then** it uses the brand primary color and has a smooth rotation animation.

---

### User Story 6 — Layout Patterns (Priority: P3)

A developer building the auth pages uses a split-screen layout pattern (brand panel + form panel). A developer building dashboard pages uses a sidebar + content layout pattern. Both patterns are responsive: the split-screen collapses to single column on mobile, the sidebar collapses to a hamburger/sheet on mobile. Breakpoints, max-width containers, and spacing are defined by the design system.

**Why this priority**: Layout patterns are reusable scaffolding. Auth and dashboard layouts are needed by most modules, but specific component content matters more than layout shells for early development.

**Independent Test**: Render the auth split-screen layout at desktop (1280px), tablet (768px), and mobile (375px) widths. Verify the brand panel hides on mobile. Render the dashboard layout at the same breakpoints and verify the sidebar collapses.

**Acceptance Scenarios**:

1. **Given** the auth page at desktop width (>=1024px), **When** it renders, **Then** a split-screen shows: left panel (brand illustration/color, ~40% width) and right panel (login form, ~60% width).
2. **Given** the auth page at mobile width (<768px), **When** it renders, **Then** only the form panel is visible, taking full width.
3. **Given** the dashboard layout at desktop width, **When** it renders, **Then** a fixed sidebar (240–280px) sits alongside a scrollable content area.
4. **Given** the dashboard layout at mobile width, **When** it renders, **Then** the sidebar is hidden and accessible via a hamburger menu or sheet component.

---

### Edge Cases

- What happens when OKLch colors are rendered in browsers without full OKLch support? Fallback sRGB values should be provided for critical colors (primary, destructive, background, foreground).
- How does the design system behave when custom fonts fail to load? The fallback font stack must prevent layout shift and remain readable.
- What happens when a status badge receives an unknown/unexpected status value? A neutral gray default badge should render rather than breaking the UI.
- How do semantic colors behave at extreme viewport sizes (very small or ultra-wide)? Spacing and font sizes should scale predictably within reasonable bounds.
- What happens when a tenant theme provides only partial overrides (e.g., primary color but no secondary)? The ThemeProvider should merge tenant overrides with BePro defaults — unspecified tokens fall back to the default theme.
- What happens when a tenant theme provides invalid OKLch values? The CSS fallback mechanism should gracefully use BePro defaults rather than rendering broken colors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a brand color palette with primary, secondary, accent, muted, and destructive semantic colors (existing shadcn/ui tokens) plus new `--success`, `--warning`, and `--info` tokens (each with `--*-foreground` variant) — all specified in OKLch color space.
- **FR-002**: System MUST provide both light and dark mode values for every semantic color token, using `:root` and `.dark` CSS scopes.
- **FR-003**: System MUST define a neutral gray scale with at minimum 8 perceptually uniform steps in OKLch.
- **FR-004**: All text/background color combinations MUST meet WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text and UI components).
- **FR-005**: System MUST use Fraunces (variable serif) for headings and Source Sans 3 (humanist sans-serif) for body text, loaded from Google Fonts.
- **FR-006**: System MUST define a modular type scale covering h1, h2, h3, h4, body, small, and caption with explicit font-size, line-height, and letter-spacing values.
- **FR-007**: System MUST adopt Tailwind CSS v4's built-in spacing scale (4px base unit) as the canonical spacing system — no custom spacing tokens are needed since TW v4 ships with a complete 4px-based scale (`space-1` = 4px through `space-32` = 128px).
- **FR-008**: System MUST define border-radius tokens compatible with the existing shadcn/ui radius variable system (`--radius` base with sm, md, lg, xl multipliers).
- **FR-009**: System MUST define 14 distinct badge color variants for the candidate FSM states, grouped by semantic meaning: progress (Registered, InterviewScheduled, Attended, Pending), success (Approved, Hired, InGuarantee, GuaranteeMet), negative (Rejected, Declined, NoShow, Termination), and neutral-terminal (Discarded, Replacement).
- **FR-010**: System MUST define input field styles including default, focus (using brand primary ring), error (using destructive color), and disabled states.
- **FR-011**: System MUST define button variants: primary, secondary, destructive, outline, and ghost — each with hover, active, focus, and disabled states.
- **FR-012**: System MUST define CSS-only animations for entrance (fade-in, slide-up), hover micro-interactions, focus transitions, and a loading spinner.
- **FR-013**: All animations MUST respect `prefers-reduced-motion` by disabling or reducing motion.
- **FR-014**: System MUST define responsive breakpoints and layout patterns: split-screen for auth pages, sidebar + content for dashboard pages.
- **FR-015**: System MUST define chart colors (`--chart-1` through `--chart-5`) that are visually distinct, brand-aligned, and accessible.
- **FR-016**: System MUST provide sRGB fallback values for critical OKLch tokens to support browsers with incomplete OKLch support.
- **FR-017**: System MUST define sidebar tokens (background, foreground, primary, accent, border, ring) for both light and dark modes.
- **FR-018**: System MUST define all design tokens as CSS custom properties that can be overridden at runtime per tenant, without code changes or conditional logic.
- **FR-019**: System MUST include a `ThemeProvider` component that accepts a tenant theme configuration (from API/DB) and injects CSS custom property overrides on `document.documentElement`.
- **FR-020**: System MUST render BePro's default brand theme (from `index.css`) when no tenant theme overrides are provided.
- **FR-021**: Runtime theme injection MUST propagate immediately to all components using Tailwind utility classes (via the existing `@theme inline` mapping) without requiring a page reload.

### Key Entities

- **Design Token**: A named CSS custom property that maps to a visual value (color, size, spacing). Organized by category: color, typography, spacing, radius, animation.
- **Semantic Color**: A purpose-driven color token (e.g., `--primary`, `--destructive`) that abstracts away the actual color value and changes between light/dark modes.
- **Badge Variant**: A status-specific styling set (background, text color, border) mapped to one of the 14 candidate FSM states.
- **Type Scale Step**: A named level in the typography hierarchy (h1–h4, body, small, caption) with associated font-family, font-size, line-height, letter-spacing, and font-weight.
- **Tenant Theme**: A data record containing CSS custom property overrides for a specific tenant (colors, radius, font family, logo URL). Stored in the database, fetched at runtime, injected via `ThemeProvider`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every semantic color token — standard shadcn/ui (`--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--border`, `--ring`, `--input`, `--card`, `--popover`, `--sidebar-*`, `--chart-*`) plus new (`--success`, `--warning`, `--info` with foreground variants) — has a non-grayscale, brand-aligned OKLch value defined for both light and dark modes.
- **SC-002**: All 14 candidate status badges are visually distinguishable — no two badges within the same semantic group share the same hue, and cross-group differences are obvious at a glance.
- **SC-003**: All text-on-background combinations meet WCAG AA contrast ratio (4.5:1 normal text, 3:1 large text/UI).
- **SC-004**: The type scale produces a clear visual hierarchy — when all 7 levels (h1–h4, body, small, caption) are rendered, each is immediately distinguishable from adjacent levels.
- **SC-005**: Both light and dark modes render correctly with no missing token values, invisible text, or broken contrast.
- **SC-006**: Animations are smooth (no jank), do not exceed 300ms, and are fully disabled when `prefers-reduced-motion` is enabled.
- **SC-007**: The split-screen auth layout and sidebar dashboard layout respond correctly at desktop (>=1024px), tablet (768–1023px), and mobile (<768px) breakpoints.
- **SC-008**: Fonts load without causing visible layout shift (CLS < 0.1 as measured by Lighthouse).
- **SC-009**: When a tenant theme is injected at runtime, all components update to the tenant's colors/radius within the same render frame — no flash of default theme after initial load.
- **SC-010**: When no tenant theme is provided, the BePro default theme renders correctly with no missing or broken tokens.

## Assumptions

- The existing shadcn/ui token structure in `index.css` (`:root` / `.dark` scopes with OKLch values) is the correct foundation and will be extended, not replaced.
- No shadcn/ui components are installed yet — this spec defines tokens and patterns that will be consumed when components are added.
- Google Fonts are acceptable for font loading (no requirement for self-hosted fonts in MVP). Confirmed pairing: **Fraunces** (headings) + **Source Sans 3** (body).
- The brand color direction is confirmed as **teal-green** (oklch ~0.55 0.12 175) — conveying trust, growth, and professionalism. Aligns with recruitment/HR industry conventions (Personio, Greenhouse) and avoids the generic purple/blue SaaS gradient look.
- The spacing base unit is 4px (matching Tailwind's default `0.25rem` scale), not 8px.
- CSS-only animations mean no runtime JavaScript for motion — `@keyframes`, `transition`, and `animation` CSS properties only.
- Browser support targets: Chrome 111+, Firefox 113+, Safari 16.4+ (all have OKLch support). Older browsers get sRGB fallback for critical colors only.
- The 14 candidate FSM states are final as specified in the platform design document: Registered, InterviewScheduled, Attended, Approved, Pending, Rejected, Declined, Discarded, NoShow, Hired, InGuarantee, GuaranteeMet, Termination, Replacement.
- Chart colors are used for dashboard analytics and reporting — they should be brand-aligned but distinct from the status badge colors.
- Multi-tenant theming is architecturally supported (ThemeProvider + CSS variable injection) but no tenant admin UI or `tenant_themes` DB table is built in this feature. Those are deferred to a future tenant-management module.
- The ThemeProvider receives tenant theme data from the existing auth/tenant resolution flow (already available from JWT claims and API response). No new API endpoint is needed for MVP — the theme can be embedded in the tenant config response.
