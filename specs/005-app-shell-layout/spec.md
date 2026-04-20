# Feature Specification: App Shell & Main Layout

**Feature Branch**: `005-app-shell-layout`
**Created**: 2026-04-18
**Status**: Draft
**Input**: User description: "App shell and main layout for the BePro admin: top header, collapsible left sidebar, main content area, and optional footer. Must serve all authenticated roles (admin, manager, account_executive, recruiter, recruiter+freelancer) with role-based navigation."

## Clarifications

### Session 2026-04-19

- Q: How should the sidebar decide which nav item is "active" when the route is a child of a nav destination (e.g., `/candidates/123/edit`)? → A: Prefix match — the sidebar item stays highlighted for its own destination and every descendant route.
- Q: Where do breadcrumb labels for each route come from? → A: Dynamic only — every page supplies its own breadcrumb trail via a shell-provided hook; the shell renders whatever the page registers and nothing when nothing is registered.
- Q: How does the shell indicate that a route transition is in progress? → A: A thin top progress bar at the top of the viewport animates during transitions and disappears on completion; no per-page skeletons are required from the shell.
- Q: Does the v1 shell ship with product telemetry? → A: No — the shell emits named events through a thin no-op dispatcher (hook points only); no analytics vendor is wired in v1.
- Q: Does the header support switching tenants for users with access to more than one? → A: No — v1 is single-tenant per session. The header shows the current tenant name as a label only. Users with multi-tenant access sign out and back in (or pick at login) to switch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Authenticated shell on every protected route (Priority: P1)

Any authenticated user lands on a protected route (dashboard, candidates, users, etc.) and immediately sees a consistent application frame: a sticky header with branding and personal controls, a left sidebar showing only the navigation items allowed by their role, a main content area where the actual page renders, and an always-available way to log out. The frame persists across navigation — only the main content changes — so the user never loses orientation.

**Why this priority**: Without a persistent shell, every module page must reinvent its own chrome, users lose their bearings between sections, and basic actions like logging out or switching pages are inconsistent. This is the foundation that every subsequent module (candidates, placements, clients) depends on.

**Independent Test**: Log in as any role and visit three distinct protected routes. Verify the header stays identical, the sidebar highlights the current section, and logging out from the header returns the user to the login screen from any page.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the dashboard route, **When** the page loads, **Then** the header, sidebar, and main content area all render together within the same viewport without layout flicker.
2. **Given** a signed-in user clicking a sidebar item, **When** navigation completes, **Then** the header and sidebar remain in place and only the main content area updates.
3. **Given** a signed-in user on any protected route, **When** they open the user menu and choose "Cerrar sesión", **Then** the session ends and they are redirected to the login screen.
4. **Given** an unauthenticated visitor, **When** they reach the login screen or the forced password-change screen, **Then** the shell is **not** rendered — those flows appear full-bleed without header or sidebar.
5. **Given** a signed-in user scrolling a long page, **When** the page scrolls, **Then** the header remains sticky at the top of the viewport and the sidebar remains visible on the left.

---

### User Story 2 — Mobile drawer navigation (Priority: P1)

A user on a phone or narrow window sees a compact header with a hamburger button. Tapping it opens a slide-in drawer containing the same navigation groups as the desktop sidebar, plus a user card at the bottom with the user's name, role, and a logout action. Selecting a destination closes the drawer and navigates to the new page. The experience is thumb-friendly and respects safe-area insets on iOS.

**Why this priority**: Recruiters and account executives routinely check candidate status and notifications from their phones between client visits. A sidebar that overlaps the screen on mobile makes the product unusable on small viewports. Mobile navigation is not optional for this audience.

**Independent Test**: Resize the viewport below 768px. Verify the sidebar disappears and a hamburger button appears in the header. Tapping the hamburger opens a drawer; tapping a nav item closes it and navigates; tapping outside the drawer or pressing the close control dismisses it.

**Acceptance Scenarios**:

1. **Given** a viewport under 768px wide, **When** the user loads any protected page, **Then** the sidebar is hidden and a hamburger button appears in the header.
2. **Given** the mobile drawer is closed, **When** the user taps the hamburger, **Then** the drawer slides in from the left and focus moves into it.
3. **Given** the mobile drawer is open, **When** the user selects a navigation item, **Then** the drawer closes automatically and the new route renders.
4. **Given** the mobile drawer is open, **When** the user taps outside the drawer or presses Escape, **Then** the drawer closes and focus returns to the hamburger button.
5. **Given** the mobile drawer is open, **When** the user scrolls to the bottom, **Then** they see a user card with their name, role, and a "Cerrar sesión" action.

---

### User Story 3 — Role-gated navigation (Priority: P2)

The sidebar only exposes destinations the signed-in user is allowed to reach. An administrator sees every group, including the Administración section (Users, Configuration, Audit). A manager sees everything except the items restricted to admins. An account executive sees recruitment and client sections but not Administración. A recruiter sees only the items relevant to candidate registration. A freelancer-flagged recruiter sees the same items as a recruiter. Hidden items are not rendered at all (not merely disabled), so users cannot attempt to access destinations outside their permissions.

**Why this priority**: Showing nav items a user cannot use is confusing and creates support load ("why can't I click this?"). It also hints at capabilities that should stay invisible to lower roles. Role gating is security-adjacent UX, not cosmetic.

**Independent Test**: Log in as each of the five role combinations in turn. Capture the set of visible nav items and compare against the expected visibility matrix. No unauthorized item should appear for any role.

**Acceptance Scenarios**:

1. **Given** an admin is signed in, **When** the sidebar renders, **Then** the Administración group is visible with all three items (Users, Configuration, Audit).
2. **Given** a recruiter is signed in, **When** the sidebar renders, **Then** the Administración group is **not** present in the DOM at all.
3. **Given** an account executive is signed in, **When** the sidebar renders, **Then** Recruitment and Clients groups are visible and Administración is not.
4. **Given** a recruiter with the freelancer flag is signed in, **When** the sidebar renders, **Then** the visible nav matches a standard recruiter (no extra or fewer items).
5. **Given** a manager is signed in, **When** the sidebar renders, **Then** Administración appears (Users and Audit visible), matching the manager permission set.

---

### User Story 4 — Sidebar collapse persistence and active-route highlighting (Priority: P2)

The user can collapse the sidebar to a narrow icon rail that only shows each item's icon, reclaiming horizontal space for the main content. Collapsing once is remembered forever: the next login, the next browser session, the next device visit to the same browser all start in the user's last-chosen state. Regardless of collapsed or expanded state, the current route is visually highlighted in the sidebar so the user always knows where they are.

**Why this priority**: Operators who use this product eight hours a day quickly develop a preference (usually collapsed for data-heavy screens, expanded for first-time onboarding). Losing that preference after every reload erodes trust in the product's polish.

**Independent Test**: Expand the sidebar, collapse it, reload the page. Verify it is still collapsed. Navigate to a section and verify the current item is visually distinct (color, background, or both). In collapsed state, hover over an icon and verify a tooltip shows the destination name.

**Acceptance Scenarios**:

1. **Given** the sidebar is expanded, **When** the user activates the collapse control, **Then** the sidebar shrinks to an icon-only rail and the main content expands to fill the reclaimed space.
2. **Given** the sidebar is in any state, **When** the user reloads the page, **Then** the sidebar restores its previous state (expanded or collapsed) before the user can interact.
3. **Given** the sidebar is collapsed, **When** the user hovers over an icon, **Then** a tooltip appears showing the item's full label.
4. **Given** the user is on any route that corresponds to a sidebar item, **When** the sidebar renders, **Then** that item is visually highlighted (distinct background, color accent, or indicator) in both expanded and collapsed states.
5. **Given** a sidebar with more items than fit in the viewport height, **When** the user attempts to reach a lower item, **Then** the sidebar scrolls internally without affecting the header or main content.

---

### User Story 5 — Theme toggle with persistence (Priority: P2)

A control in the header lets the user switch between light and dark themes. The choice is remembered across sessions. On first visit, the system defaults to the user's operating system preference.

**Why this priority**: The product will be used in bright offices and dim late-night sessions by recruiters reviewing candidate pipelines. A theme toggle is a baseline expectation for a modern admin tool, and tying it to system preference by default avoids a jarring white flash for users on OS-level dark mode.

**Independent Test**: Toggle the theme control in the header and verify colors invert across the whole shell immediately. Reload the page and verify the chosen theme persists. Clear the preference, set the operating system to dark mode, revisit the app, and verify it starts in dark mode.

**Acceptance Scenarios**:

1. **Given** the user is on any protected route, **When** they activate the theme toggle, **Then** the entire shell and main content switch themes without a full page reload.
2. **Given** the user has chosen a theme, **When** they reload or return the next day, **Then** the app starts in that theme.
3. **Given** the user has never set a preference, **When** they first sign in, **Then** the app respects the operating system's light/dark preference.
4. **Given** the user changes their operating system theme while the app is open and they have no explicit app preference, **When** the OS change broadcasts, **Then** the app updates to match.

---

### User Story 6 — Keyboard navigation and accessibility (Priority: P2)

Power users can drive the shell entirely from the keyboard. Pressing `/` focuses the global search field. Pressing `[` toggles the sidebar. Sequential shortcuts (e.g., pressing `g` then `d`) jump to major sections. A "skip to main content" link appears for screen readers and keyboard users. All interactive elements show a visible focus ring. Announcements (notifications badge, drawer state) are exposed to assistive technology.

**Why this priority**: Keyboard shortcuts materially speed up operators' work and reduce repetitive strain. Accessibility is also a requirement for enterprise buyers and a baseline for LFPDPPP-compliant public-facing platforms.

**Independent Test**: Disconnect the mouse. Navigate from the top of the page using only Tab, Enter, Escape, and the documented shortcuts. Verify every interactive element is reachable, every state change is perceivable, and an automated WCAG AA accessibility audit reports zero serious violations.

**Acceptance Scenarios**:

1. **Given** focus is anywhere in the app, **When** the user presses `/`, **Then** focus moves to the global search field.
2. **Given** focus is anywhere in the app, **When** the user presses `[`, **Then** the sidebar toggles between expanded and collapsed.
3. **Given** focus is anywhere in the app, **When** the user presses `g` then `d` within one second, **Then** the app navigates to the dashboard.
4. **Given** focus is anywhere in the app, **When** the user presses `g` then `c` within one second, **Then** the app navigates to the candidates list.
5. **Given** a keyboard user lands on any protected route, **When** they press Tab from the top of the page, **Then** the first focus target is a "Saltar al contenido principal" link that jumps past the nav into the main content.
6. **Given** any interactive element receives focus, **When** rendered, **Then** it shows a visible focus indicator that meets WCAG AA contrast.

---

### User Story 7 — Header utilities (user menu, notifications placeholder, search entry) (Priority: P3)

The header right cluster exposes the user's identity and quick actions. The user menu shows an avatar (initials fallback), full name, role badge, and offers "Mi perfil", "Cambiar contraseña", and "Cerrar sesión". A notifications bell is present as a visual placeholder for a future feature (no data source yet). A global search entry point in the header is clickable and keyboard-activatable, opening a search surface that shows "Próximamente" copy while the real search capability is built.

**Why this priority**: These controls anchor the header and shape users' first impression, but the full functionality of each (real notifications, actual search) arrives in later features. This story exists to scaffold the visual and interaction surface so later features slot in without layout churn.

**Independent Test**: Open the user menu and verify the avatar, name, role badge, and the three menu items render. Click "Cambiar contraseña" and verify navigation to the password-change screen. Click the notifications bell and verify it responds with a "Próximamente" state, no errors. Open the search entry and verify the command-palette surface appears with placeholder content.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the header user menu, **Then** it shows their avatar (or initials), full name, a role badge, and the three options.
2. **Given** the user menu is open, **When** the user chooses "Cambiar contraseña", **Then** they navigate to the password-change screen.
3. **Given** the user activates the search entry point (click or the cmd/ctrl+k shortcut), **When** the surface opens, **Then** it shows a placeholder message indicating search is coming soon; no data lookup is triggered.
4. **Given** the user clicks the notifications bell, **When** the popover opens, **Then** it shows a placeholder "Sin notificaciones por ahora"; no unread badge is shown in the absence of real data.
5. **Given** a user with a very long display name or tenant name, **When** either renders in the header, **Then** it is truncated with ellipsis and the full value is available via tooltip.

---

### Edge Cases

- A user's tenant name or full name exceeds the allotted header width → truncated with ellipsis and a hover tooltip reveals the full text.
- The sidebar has more items than vertical space (future growth) → the sidebar scrolls internally; the header and footer never scroll.
- The offline banner is visible → it appears above the sticky header without obscuring it; the header sticks to the bottom of the banner, not the top of the viewport.
- The signed-in user's role is missing or corrupted → the shell renders with only default-visible items (Dashboard) and logs a client-side diagnostic; the user is not blocked from using the app.
- The viewport rotates from portrait to landscape on mobile mid-navigation → the drawer state resolves correctly (closed); no layout jump.
- The user is mid-keyboard-shortcut (pressed `g`, waiting for second key) when focus moves into a text input → the sequence is abandoned so shortcut keys do not intercept typing.
- The user is viewing the forced password-change screen → the shell is **not** rendered; only the focused task is visible.
- A browser reload during active navigation → the shell restores last-known sidebar state without flashing the opposite state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render a persistent application shell — sticky header, collapsible left sidebar, and main content area — on every authenticated route except login and forced password change.
- **FR-002**: The system MUST show the BePro logo and the current tenant's display name on the left side of the header. The tenant name MUST be a non-interactive label in v1 — it is not a switcher and does not open a menu.
- **FR-003**: The header MUST expose a global search entry point that can be activated by click or by the keyboard shortcut `cmd+k` / `ctrl+k`.
- **FR-004**: The header MUST expose a theme toggle that switches between light and dark themes; the chosen theme MUST persist across sessions.
- **FR-005**: The header MUST expose a notifications control as a placeholder for a future notifications feature; activating it MUST show a "no notifications" empty state.
- **FR-006**: The header MUST expose a user menu showing the user's avatar (initials if no image), full name, role badge, and actions for "Mi perfil", "Cambiar contraseña", and "Cerrar sesión".
- **FR-007**: The sidebar MUST organize navigation into groups: Principal (Dashboard), Reclutamiento (Candidatos, Vacantes, Entrevistas, Colocaciones), Clientes (Empresas cliente, Contactos), and Administración (Usuarios, Configuración, Auditoría).
- **FR-008**: The sidebar MUST show a distinct icon next to every navigation item.
- **FR-009**: The sidebar MUST be collapsible to a narrow icon-only rail; the collapsed/expanded state MUST persist across sessions for the same user on the same browser.
- **FR-010**: In the collapsed state, the sidebar MUST show a tooltip with the full label when the user hovers over or keyboard-focuses an icon.
- **FR-011**: The sidebar MUST visually highlight the navigation item whose destination is a prefix of the currently active route, so that child/detail routes (e.g., `/candidates/123/edit`) continue to highlight the parent item (`Candidatos`). When two items would both match by prefix, the most specific (longest) match wins.
- **FR-012**: The sidebar MUST hide (not disable) navigation items the signed-in user's role does not permit, based on the existing role-based permission model.
- **FR-013**: The Administración group MUST be visible only to admin and manager roles.
- **FR-014**: A development-only "Design system" entry point MUST exist and MUST NOT be rendered in production builds.
- **FR-015**: On viewports narrower than 768px, the sidebar MUST be replaced by a slide-in drawer triggered by a hamburger button in the header.
- **FR-016**: The mobile drawer MUST close automatically when the user activates a navigation item.
- **FR-017**: The mobile drawer MUST be dismissible by tapping outside it or pressing Escape.
- **FR-018**: The mobile drawer MUST include a user card at the bottom showing the user's name, role, and a logout action.
- **FR-019**: The main content area MUST render a breadcrumb row above the page content whose contents are supplied by the currently active page via a shell-provided mechanism. Each page is responsible for registering its own breadcrumb trail (labels and links). When a page registers no breadcrumb trail, the breadcrumb row MUST NOT render (no empty placeholder, no "undefined" segments).
- **FR-020**: The main content area MUST support the existing page-header component and MUST apply a responsive maximum width so content remains readable on wide displays.
- **FR-021**: The system MUST provide a "Saltar al contenido principal" link as the first tab stop for keyboard users and screen readers.
- **FR-022**: The system MUST render a visible focus indicator on every interactive element that receives keyboard focus.
- **FR-023**: The system MUST recognize the following keyboard shortcuts globally unless focus is inside a text input or textarea: `/` focuses the global search field; `[` toggles the sidebar; `g` then `d` within one second navigates to the dashboard; `g` then `c` within one second navigates to the candidates list.
- **FR-024**: The system MUST display the existing offline banner above the header without obscuring the header or main content.
- **FR-025**: The system MUST truncate overflowing tenant names and user names with an ellipsis and surface the full value via tooltip.
- **FR-026**: The system MUST NOT render the shell on the login screen or the forced-password-change screen.
- **FR-027**: On first visit with no saved theme preference, the system MUST default to the operating system's current light/dark preference and update live when the OS preference changes (while no explicit user choice exists).
- **FR-028**: The system MUST remember the user's theme choice across sessions on the same browser.
- **FR-029**: The sidebar MUST scroll internally when its items exceed the available vertical space, without affecting the header or main content.
- **FR-030**: The shell MUST continue to render usefully (at minimum, Dashboard and logout) when the user's role data is missing or malformed.
- **FR-031**: The shell MUST display a thin top progress indicator at the top of the viewport whenever a route transition or a page's initial data load is in progress, and MUST hide it as soon as the incoming page is ready. The indicator MUST be exposed to assistive technology so screen-reader users are informed that navigation is pending. The shell MUST NOT require individual pages to implement their own loading skeletons.
- **FR-032**: The shell MUST emit named product events (at minimum: navigation, sidebar toggle, keyboard-shortcut use, theme change, mobile drawer open/close) through a single in-app event dispatcher. In v1 the dispatcher MUST be a no-op (it accepts events and discards them) so later features can subscribe or forward to an analytics provider without changing call sites. No third-party analytics vendor is wired in v1.

### Key Entities *(include if feature involves data)*

- **Navigation Item**: A labeled, icon-bearing destination in the sidebar. Attributes: label (Spanish), destination route, icon identifier, minimum required permission(s), group it belongs to, optional visibility flag (e.g., dev-only).
- **Navigation Group**: A named grouping of navigation items. Attributes: label (Spanish, optional — some groups are unlabeled), ordered list of items, optional minimum required permission(s) for the whole group.
- **Sidebar State**: The user's UI preference for the sidebar. Attributes: collapsed (boolean), last updated timestamp. Scoped to the user's browser.
- **Theme Preference**: The user's UI preference for color theme. Attributes: value (`light`, `dark`, or `system`), last updated timestamp. Scoped to the user's browser.
- **Breadcrumb Trail**: The ordered list of navigational crumbs for the currently active page. Attributes: ordered crumbs, each with a Spanish label and an optional destination link (last crumb is always plain text). Owned by the active page, cleared automatically when the page unmounts. Not persisted.
- **Telemetry Event**: A named product event emitted by the shell at a user interaction point (navigation, sidebar toggle, shortcut use, theme change, drawer open/close). Attributes: event name, structured payload. In v1 the event is discarded by the dispatcher; later features will subscribe without changing emission sites.
- **User Identity Summary** (consumed, not owned by this feature): first name, last name, role, freelancer flag, tenant name, avatar image URL (nullable).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the user's session is verified, the shell renders and becomes interactive in under 150 milliseconds, as measured by time from route entry to first nav click being accepted.
- **SC-002**: Navigation visibility for all five role combinations (admin, manager, account_executive, recruiter, recruiter+freelancer) matches the expected visibility matrix with 100% accuracy, verified by automated tests that fail on any drift.
- **SC-003**: The shell passes WCAG 2.1 AA automated audit (zero serious or critical violations) and a full keyboard-only traversal completes every documented user flow.
- **SC-004**: The shell renders correctly without horizontal scrollbars on all viewport widths from 320 pixels to 1920 pixels.
- **SC-005**: Sidebar collapsed/expanded state and theme preference restore correctly on 100% of page reloads during a test session — no flicker of the opposite state during the first paint.
- **SC-006**: Mobile drawer open/close/route-change flow completes in under 300 milliseconds on a mid-tier mobile device and automatically closes when a navigation item is selected in 100% of cases.

## Assumptions

- The existing authentication context (who the user is, their role, their tenant) is available before any shell-protected route renders; this feature does not re-implement session handling.
- The existing design-system tokens (colors, typography, spacing) from feature 003 are sufficient for all shell visuals; no new brand tokens are introduced.
- The existing role-based permission system (the ability provider already in the app) is the source of truth for who can see which nav item; this feature does not define new permissions.
- The existing offline banner component is used as-is and composed above the header.
- A "Mi perfil" destination may not exist yet as a real page; the link can point to a placeholder screen until the profile module lands.
- The global search and notifications features are out of scope for this feature; only their entry-point surfaces and empty states are delivered.
- The optional footer is not included in the initial delivery unless a concrete need (copyright, version info, support link) emerges during implementation; the shell leaves room for it without requiring it.
- Internationalization is limited to Spanish for all user-facing strings introduced here, matching the rest of the product.
- Keyboard-shortcut customization is out of scope; the documented shortcuts are fixed for v1.
- Persistent client-side storage is available in the user's browser; when it is not (e.g., private-browsing modes), the shell gracefully defaults to the expanded sidebar and the system theme each session without erroring.
- Product analytics vendor selection, consent UX, and LFPDPPP review are deferred to a later feature; the shell prepares event hook points but does not ship a real analytics pipeline in v1.
- Each authenticated session is bound to exactly one tenant. In-session tenant switching is out of scope for v1 and would require changes to the auth module, which owns session/tenant binding.
