# Feature Specification: UI/UX Visual Refresh

**Feature Branch**: `009-ui-visual-refresh`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "UI/UX visual refresh across all screens — introduce a new blueish color palette (replacing current design tokens), add subtle motion and animations for page transitions and interactive elements (cards, buttons, list items), and apply polish passes (spacing, typography, empty states, loading states). Modernize cards and all shared components so the UI has a distinctive, production-grade look and feel — explicitly avoid the generic 'AI-generated' aesthetic (no cookie-cutter gradients, no pastel defaults, no oversized rounded corners everywhere). Independent of the 008 roles work; purely visual/UX layer."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cohesive visual foundation: blueish palette, typography, radius, shadow (Priority: P1)

Every internal user of BePro (admin, manager, account executive, recruiter) opens the platform and immediately recognizes a cohesive, distinctive visual identity — a unified blueish brand color, a consistent typography scale, a restrained border-radius system, and an intentional shadow hierarchy. All four token families live in a single place and propagate to every screen (login, dashboards, candidate list/detail, clients list/detail, users admin, shell) in both light and dark modes.

**Why this priority**: The foundation tokens (color + typography + radius + shadow) are the most visible and highest-leverage change. They establish the product's identity in a single pass and are a prerequisite for every other story (modernized components, motion, empty/loading/error all consume these tokens). Shipping them as one unit prevents partial-refresh inconsistency.

**Independent Test**: Can be validated by (a) walking every screen in the app — in both light and dark mode — and confirming no residual legacy colors, typography, radius, or shadow appear; (b) running the automated contrast + typography audits which must both be GREEN; (c) confirming every foreground/background pair used for text meets WCAG AA.

**Acceptance Scenarios**:

1. **Given** the new palette is applied, **When** a user navigates through every top-level screen in light mode, **Then** they see the same primary blueish hue used consistently for brand accents (buttons, active nav, links, focused states) with no residual old-palette colors visible.
2. **Given** the user toggles to dark mode, **When** they navigate the same screens, **Then** every palette token has a dark-mode variant applied and contrast remains WCAG AA compliant.
3. **Given** a designer or stakeholder reviews the app, **When** they describe the visual identity, **Then** they describe it as distinctive and professional — not as "generic" or "AI-generated."

---

### User Story 2 - Modernized, production-grade cards and shared components (Priority: P2)

When users interact with cards (candidate cards, client cards, stat cards, list items), buttons, badges, inputs, tables, and dialogs, the components feel polished and deliberate — not cookie-cutter. Border radius is restrained and consistent across a defined scale (no oversized pill-shaped surfaces where a modest radius suffices). Shadows, borders, and surface layering feel intentional. Typography hierarchy is crisp and readable.

**Why this priority**: Components are the building blocks reused on every screen. Modernizing them once propagates quality everywhere. This is second priority because it depends on the palette from P1.

**Independent Test**: Reviewer inspects a representative sample of screens (dashboard, candidates list, candidate detail, users admin) and confirms the cards, buttons, badges, inputs, tables, and dialogs all use the new unified visual language. No one screen looks out of place.

**Acceptance Scenarios**:

1. **Given** a recruiter views the candidates list, **When** they scan candidate cards, **Then** each card has a consistent radius, shadow, border, spacing, and hover treatment — with no two cards using visually different styles.
2. **Given** any user opens a dialog or modal, **When** the dialog appears, **Then** it uses the same radius scale, surface treatment, and typography hierarchy as the rest of the app.
3. **Given** a stakeholder reviews the app, **When** they look at buttons, badges, and form inputs, **Then** they describe the controls as "production-grade" / "refined" — no oversized pill buttons, no pastel defaults, no cookie-cutter gradients.

---

### User Story 3 - Rich, choreographed motion across the product (Priority: P2)

Motion is a first-class part of this refresh — not a polish afterthought. From the moment a user lands on the **login screen** through the **dashboard**, **list views**, **detail pages**, **forms**, **dialogs**, and **side sheets**, deliberate choreography guides the eye and reinforces the product's modern feel. Every page entrance has a staggered reveal; every list renders with a gentle item-by-item cascade; stat cards count up on the dashboard; the sidebar active indicator glides between items; form fields respond to focus with a crisp scale-in focus ring; toasts, dialogs, and sheets have purpose-built enter/exit motion. Durations are capped per-surface (see `contracts/motion.md`) and every animated class has a `prefers-reduced-motion` counterpart that preserves parity without movement.

**Why this priority (P2, not P3)**: The user's explicit directive is "lots of animations from login to all pages." Motion is a signature of the refresh alongside the palette (US1) and components (US2), not a final polish pass. It is P2 because it delivers the aesthetic promise of the feature — upgraded from P3 after stakeholder input.

**Independent Test**: (a) Load the login screen: form fields cascade into place on first paint. (b) Log in and watch the dashboard mount: stat cards count up from 0, list widgets stagger in. (c) Navigate to candidates list: header + filter bar + rows enter in choreographed sequence. (d) Open a dialog or sheet: purpose-built enter motion completes ≤ 250ms; exit ≤ 200ms. (e) Toggle `prefers-reduced-motion: reduce` at the OS level and re-run the same flow: all transforms/translations are suppressed, content appears instantly with opacity-only transitions, no layout breakage, no functional regression.

**Acceptance Scenarios**:

1. **Given** a user opens the login screen, **When** the page paints, **Then** the logo, heading, form fields, submit button, and footer reveal in a staggered sequence (80ms increments, cumulative ≤ 500ms) that completes before the user can interact.
2. **Given** a user lands on the dashboard, **When** data arrives, **Then** each stat-card numeric value counts up from 0 to its target over ≤ 600ms (reduced-motion users see the target value instantly) and adjacent widgets enter with a 40–60ms stagger.
3. **Given** a user opens a list view (candidates, clients, users), **When** rows render, **Then** the first ~10 rows stagger in at 40ms intervals (cumulative ≤ 400ms) and later rows appear instantly.
4. **Given** a user focuses a form field, **When** the field gains focus, **Then** the focus ring scales from 0 to full over 120ms with `ease-out`, giving crisp visual feedback that respects reduced-motion (opacity-only fallback).
5. **Given** a user hovers a card, button, or list row, **When** the cursor enters/leaves, **Then** the element responds with a confident shadow / color transition in 120–150ms.
6. **Given** a user navigates between routes, **When** the page transitions, **Then** the new route fades and slides in ≤ 400ms; interrupted transitions resolve immediately to the new route without layering.
7. **Given** a user has `prefers-reduced-motion: reduce` enabled, **When** they walk any of the above flows, **Then** every transform/translate is suppressed, opacity-only transitions remain, animations that convey meaning (e.g., count-up) skip to the final value, and functionality is unchanged.

---

### User Story 4 - Polished empty, loading, and error states (Priority: P3)

Every primary list and detail view shows a thoughtful empty state (when there is no data), loading state (while data is being fetched), and error state (when data fetching fails). These states use the same visual language as the rest of the app — no raw spinners alone, no bare error messages.

**Why this priority**: Edge states are where quality gaps are most visible. Polishing them is a high-impact / low-complexity pass that prevents the refresh from feeling incomplete.

**Independent Test**: Reviewer forces each primary view into empty, loading, and error states (via empty datasets, network throttling, and simulated failures) and confirms each state has a dedicated treatment consistent with the app's visual language.

**Acceptance Scenarios**:

1. **Given** a user visits a list view with no records, **When** the empty state renders, **Then** it shows an on-brand illustration or icon, a helpful message, and — where applicable — a primary call-to-action to create the first record.
2. **Given** a user visits any view while data is being fetched, **When** the loading state renders, **Then** it shows skeleton placeholders that match the shape of the final content, not a bare spinner.
3. **Given** a user visits any view and the data request fails, **When** the error state renders, **Then** it shows a clear message and a retry action, styled consistently with the rest of the app.

---

### Edge Cases

- **Dark mode parity**: Every new token and component variant must exist in both light and dark modes with equivalent contrast and readability.
- **Reduced motion**: Users with `prefers-reduced-motion: reduce` must receive reduced or suppressed motion without functional regressions.
- **High-density data**: Tables, long candidate lists, and dashboard widgets must remain scannable — visual polish must not trade off legibility or information density.
- **Contrast at the edges**: Disabled states, placeholder text, and secondary text must still meet WCAG AA contrast under the new palette.
- **Localization width**: New typography and spacing must tolerate Spanish strings, which can run ~20–30% longer than English equivalents in certain labels.
- **Existing role/permission UI**: The refresh must not regress the dashboards or components introduced by the in-flight roles work (branch `008-ux-roles-refinements`) — any conflicts at merge time are resolved in favor of preserving both the role logic and the new visuals.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST expose a consolidated set of design tokens (color, spacing, radius, shadow, motion) that every screen and component consumes — no hard-coded colors, radii, or shadows in individual components.
- **FR-002**: Every new color token MUST have a light-mode and dark-mode variant.
- **FR-003**: Every foreground/background pair used for text MUST meet WCAG AA contrast (4.5:1 for normal text, 3:1 for large text and UI glyphs).
- **FR-004**: All motion MUST respect the user's `prefers-reduced-motion` system preference. When reduced motion is requested, transforms and translations MUST be suppressed while preserving functional feedback (e.g., opacity changes are acceptable).
- **FR-005**: Per-surface motion budgets MUST be respected: primary-interaction animations (hover, press, state change) ≤ 250ms; dropdown/popover/tooltip enter ≤ 120ms; dialog/sheet enter ≤ 250ms; route transitions ≤ 400ms; list-item stagger ≤ 400ms cumulative; stat-card count-up ≤ 600ms; login entrance choreography ≤ 500ms cumulative. Detailed per-surface durations and easing curves are defined in `contracts/motion.md`.
- **FR-005a**: The app MUST ship deliberate entrance choreography on the login screen, the dashboard, list views (candidates, clients, users), and detail views — not only interaction-level motion. Reduced-motion users receive functional parity without movement.
- **FR-006**: Shared components — at minimum: Button, Card, Badge, Input, Select, Textarea, Table, Dialog, Sheet, Popover, Tooltip, Dropdown, Skeleton, Avatar, Breadcrumb — MUST be updated to the new visual language and MUST be applied app-wide through existing shared usage.
- **FR-007**: Every primary list and detail view **that exists in the authenticated product today** MUST have dedicated empty, loading, and error states using the new visual language. Explicit in-scope views: candidates (list + detail), clients (list + detail), users (admin list + detail), the role-based dashboard, and the login screen's error state. Modules that do not yet exist in the codebase (placements, audit log) are explicitly **out of scope for this feature** and will adopt the same treatment when those modules ship.
- **FR-008**: Border-radius usage MUST follow a defined scale (e.g., sm / md / lg / full) with documented intent per scale. Pill/full radius is reserved for chips, avatars, and status dots — not for large surfaces.
- **FR-009**: Typography MUST follow a defined scale (display / h1 / h2 / h3 / body / caption / code) applied consistently across screens, exposed as CSS-variable tokens (font-size, line-height, letter-spacing, weight) so every consumer references a named step — not ad-hoc Tailwind utility classes. The token set is enumerated in `contracts/design-tokens.md`.
- **FR-010**: The refresh MUST NOT change the public API (props, events, slots) of any shared component — only visual presentation changes are in scope.
- **FR-011**: The refresh MUST NOT change user-facing copy or information architecture; no screens are added or removed by this feature.
- **FR-012**: The refresh MUST preserve existing accessibility features (keyboard focus order, visible focus rings, ARIA attributes) and MUST NOT reduce focus-ring visibility under the new palette.
- **FR-013**: The refresh MUST use the app's existing theme toggle (feature 006) without changes — both modes remain user-selectable and persist as before.
- **FR-014**: The refresh MUST NOT introduce new runtime dependencies that materially increase the production bundle size beyond a defined ceiling (see SC-005).

### Key Entities *(not applicable)*

This is a presentational feature. No new data entities are introduced; the feature consumes and restyles existing views.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of production screens render with the new palette — verified by a screen-by-screen visual audit before merge. Zero residual legacy colors remain.
- **SC-002**: Every foreground/background token pair used for text passes WCAG AA automated contrast checks in both light and dark modes (0 violations in the audit).
- **SC-003**: In internal review, every team member rates overall visual quality ≥ 4 out of 5 on a blind before/after comparison.
- **SC-004**: No new accessibility violations are reported by automated tooling or manual review, compared to the pre-refresh baseline (regression count = 0).
- **SC-005**: Production bundle size for the web app does not increase by more than 5% versus the pre-refresh baseline.
- **SC-006**: Lighthouse performance and accessibility scores do not drop by more than 5 points versus the pre-refresh baseline on the dashboard and candidates list.
- **SC-007**: Zero user-reported visual regressions (broken layouts, unreadable text, misaligned components) within 2 weeks of deployment to staging.
- **SC-008**: Reviewers explicitly describe the UI as "distinctive" or "production-grade" and do NOT describe it as "generic" or "AI-generated" in blind post-refresh feedback.

## Assumptions

- **Scope = every currently-shipping screen that exists in the codebase today**: Login, role-based dashboard, candidates (list + detail + create/edit), clients (list + detail), users admin (list + detail), and the shared shell (sidebar, topbar, breadcrumb, command palette, toasts). Modules not yet in the repository — placements, audit log, tenant settings — are **explicitly deferred** and will pick up the refresh when they ship.
- **Motion is first-class**: This refresh ships with deliberate entrance choreography on login, dashboard, list views, and detail views — not only interaction-level motion. Motion budgets live in `contracts/motion.md`; reduced-motion parity is mandatory.
- **Single-brand palette**: This refresh stays single-brand. Tenant-level palette overrides remain deferred per feature 003-design-system and are out of scope here.
- **Free-hand palette selection**: No external brand guide from BePro marketing constrains the palette. The designer/developer picks the specific blueish hues, as long as WCAG AA and distinctiveness requirements are met.
- **Existing component library continues**: The refresh is applied on top of the existing shared component layer (shadcn/ui + Tailwind tokens from feature 003), not a replacement library.
- **Coordination with 008-ux-roles-refinements**: Any components or dashboards touched by the in-flight roles refinement branch are the responsibility of the merge-later party to reconcile. This feature does not block or gate on 008.
- **Copy and information architecture unchanged**: If a screen needs new copy or navigation changes, those are tracked as separate work and not bundled into this refresh.
- **No backend changes**: This feature introduces no API, database, or server changes.
- **Manual visual audit is acceptable**: Automated visual regression testing (e.g., screenshot diffing) is not required for merge, though a scripted WCAG contrast check is required per SC-002.

## Dependencies

- **Feature 003-design-system**: Provides the existing Tailwind token layer and shadcn/ui component foundation the refresh builds on.
- **Feature 005-app-shell-layout**: Provides the app shell (sidebar, topbar, breadcrumb) that must be restyled as part of the refresh.
- **Feature 006-theme-toggle**: Provides the light/dark mode mechanism; the refresh extends both modes without modifying the toggle itself.

## Out of Scope

- **Tenant-specific theming / white-labeling**: Deferred.
- **Changes to information architecture**: No new screens, no removed screens, no restructured navigation.
- **Changes to functional behavior**: No new capabilities, no new permissions, no new flows.
- **Mobile-native redesign**: The web-responsive layout is updated, but no native mobile app work is in scope.
- **Marketing site**: This refresh applies only to the authenticated product.
- **Localization scope change**: Spanish and English continue to be supported at parity; no new locales are added.
