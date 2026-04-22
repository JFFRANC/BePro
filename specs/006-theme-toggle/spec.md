# Feature Specification: Theme Toggle — Light, Dark & System Modes

**Feature Branch**: `006-theme-toggle`
**Created**: 2026-04-20
**Status**: Draft
**Input**: User description: "implement dark light modes icons in the web app"

## Clarifications

### Session 2026-04-20

- Q: How should the user's theme mode (light/dark) compose with tenant branding? → A: Dark mode flips neutrals AND shifts tenant brand colors into their dark variant — both neutrals and brand have light + dark token variants, resolved at render time.
- Q: What should happen when the user has multiple tabs of the app open and changes theme in one of them? → A: Live-sync — the other tabs update within ~1 second without reloading.
- Q: Must every embedded third-party widget repaint in the chosen palette, or is that a SHOULD with follow-up tracking for exceptions? → A: SHOULD for third-party widgets (tracked as follow-up gaps); MUST remains for first-party surfaces (shell + modules).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Toggle between light and dark from the header (Priority: P1)

A signed-in user on any protected route sees a theme toggle control in the top header. Clicking it lets them switch the entire application between a light appearance and a dark appearance. The visible icon in the header reflects the currently active appearance (a sun when the app is in light mode, a moon when the app is in dark mode, a screen/monitor when the app is following the operating-system preference). The moment the user picks a new mode, every surface — header, sidebar, main content, dialogs, forms, charts — inverts its palette to match, without any flicker or reloading of the page.

**Why this priority**: Without a visible toggle, there is no way for users to choose their preferred appearance. This is the core of the feature. Everything else (persistence, OS follow, flash prevention) only adds value if the toggle itself works.

**Independent Test**: Log in, click the toggle in the header, verify every surface on the current page inverts its color palette. Click again, verify it inverts back. Works without any other part of this feature being present.

**Acceptance Scenarios**:

1. **Given** a signed-in user on the dashboard in light mode, **When** they click the theme toggle and select "Oscuro", **Then** the entire visible application switches to dark palette within one second and the toggle's icon changes to a moon.
2. **Given** a signed-in user in dark mode, **When** they click the theme toggle and select "Claro", **Then** the application switches to light palette within one second and the toggle's icon changes to a sun.
3. **Given** a signed-in user with the toggle open, **When** they select "Sistema", **Then** the application adopts whichever palette the user's operating system currently declares, and the toggle's icon changes to a monitor.
4. **Given** a signed-in user, **When** they open the theme toggle, **Then** the currently active mode is visibly marked (check, highlight, or equivalent affordance) so they can see their current choice at a glance.
5. **Given** a signed-in user in any mode, **When** they navigate to a different protected route, **Then** the chosen mode continues to apply on the new route without a flash of the wrong palette.

---

### User Story 2 — Follow the operating system by default and live (Priority: P2)

A user visiting for the first time on a device has never made a manual choice. The application should open in the palette that the operating system is currently advertising (light if the OS is in light mode, dark if the OS is in dark mode). If that user later changes the OS-level appearance while the web app is open and while "Sistema" is selected, the app should follow the change automatically — no reload required.

**Why this priority**: Respecting the OS preference is the modern accessibility default. Users with OS-level dark mode (e.g. at night) should not have to configure the app separately. Users who prefer manual control (US1) are unaffected.

**Independent Test**: Clear all storage, set OS to dark mode, open the app → it renders in dark palette. While the app is open, switch the OS to light → the app switches to light within a short delay without reload.

**Acceptance Scenarios**:

1. **Given** a fresh user with no saved preference, **When** they open the app while the operating system is in dark mode, **Then** the app renders in dark palette on first paint.
2. **Given** a fresh user with no saved preference, **When** they open the app while the operating system is in light mode, **Then** the app renders in light palette on first paint.
3. **Given** a signed-in user whose current theme mode is "Sistema", **When** the operating system changes its preference (e.g., the user toggles macOS appearance), **Then** the web app follows within three seconds without a page reload.
4. **Given** a signed-in user whose current theme mode is "Claro" or "Oscuro" (explicit), **When** the operating system changes its preference, **Then** the web app does NOT change appearance — the explicit choice wins.

---

### User Story 3 — Persist the preference across reloads without flash (Priority: P2)

A user who picks a mode keeps that mode on every future visit from the same browser — refreshing the page, closing and reopening the tab, or returning the next day all preserve the preference. When they open the app, the correct palette is applied on the very first paint — no white-to-dark flash and no dark-to-light flash.

**Why this priority**: A theme that resets on every reload is worse than no theme control at all. Flash of wrong theme is a documented user-experience failure and hurts perceived quality.

**Independent Test**: Set dark mode → hard-reload → the page renders dark before any content becomes visible (no brief white flash).

**Acceptance Scenarios**:

1. **Given** a signed-in user who has selected "Oscuro", **When** they hard-reload the page, **Then** the app renders in dark palette from the very first paint.
2. **Given** a signed-in user who has selected "Claro", **When** they close the browser tab and open the app again, **Then** the app renders in light palette on the first paint.
3. **Given** a signed-in user who has selected "Sistema", **When** they reload, **Then** the app renders in the OS-preferred palette on the first paint.
4. **Given** a user switching browsers or devices, **When** they log in on a new browser, **Then** the preference does NOT carry across — each browser tracks its own choice (v1 scope).

---

### User Story 4 — Keyboard and screen-reader accessibility (Priority: P2)

A user navigating with the keyboard can reach the theme toggle using Tab, open it with Enter or Space, move between the three options with arrow keys, and select one with Enter. Screen readers announce the control ("Cambiar tema", current value, expanded state). The focus indicator is clearly visible on the toggle and on each option.

**Why this priority**: Accessibility is a non-negotiable baseline for the shell. The theme toggle sits in the header — a prominent, keyboard-reachable area — so it must meet WCAG AA contrast and keyboard-operability requirements that the rest of the shell already satisfies.

**Independent Test**: With the mouse disconnected, Tab from the top of the page until focus lands on the theme toggle, open it with Enter, arrow-down to "Oscuro", press Enter — the app switches to dark.

**Acceptance Scenarios**:

1. **Given** a keyboard-only user, **When** they Tab through the header, **Then** the theme toggle receives focus with a visible focus ring.
2. **Given** the toggle has focus, **When** the user presses Enter or Space, **Then** the three options become visible.
3. **Given** the options are open, **When** the user presses arrow-down and then Enter on "Oscuro", **Then** the app switches to dark and the options close.
4. **Given** a screen-reader user, **When** their cursor reaches the toggle, **Then** they hear the control's purpose in Spanish, the current value, and (when open) the list of available options.

---

### Edge Cases

- **User has no operating-system preference signal** (rare, old browsers): the app falls back to light mode for anyone in "Sistema" mode.
- **Browser storage blocked or in private mode**: the toggle still works during the current session; preference simply doesn't persist beyond the tab. No error is shown to the user.
- **Rapid-fire toggling** (user clicks between modes quickly): each click completes within the 1-second target; intermediate clicks during transitions do not produce broken states.
- **User prefers reduced motion** (`prefers-reduced-motion: reduce`): the transition between modes is instantaneous rather than animated.
- **Third-party chrome** inside dialogs (e.g., a map component, a date picker popover): the chosen palette applies to these too, not just shell-owned surfaces.
- **Login and forced-password-change screens**: the chosen palette applies here as well (theme is globally scoped, not shell-scoped) — even though these screens bypass the shell chrome.
- **OS theme changes while app is in explicit "Claro" or "Oscuro"**: app does NOT follow — explicit choice wins (tracked in US2 scenario 4).
- **Multiple tabs open simultaneously**: changing the theme in one tab propagates to all other open tabs in the same browser within 1 second; no tab is left displaying a stale theme (FR-020).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The header MUST expose a theme-toggle control on every protected route, placed in the right cluster of the header where utility controls live.
- **FR-002**: The theme-toggle control MUST offer exactly three options: "Claro" (light), "Oscuro" (dark), and "Sistema" (follow operating system).
- **FR-003**: The control's visible icon MUST reflect the currently active mode: a sun when the effective palette is light, a moon when the effective palette is dark, a monitor when the mode is "Sistema".
- **FR-004**: When the user selects a new mode, every first-party surface of the application — header, sidebar, main content, dialogs, popovers, tooltips, toasts, forms, and tables authored inside this codebase — MUST repaint in the chosen palette within 1 second without a page reload. Embedded third-party widgets (e.g., maps, date pickers, command palette) SHOULD repaint in the chosen palette on the same timeline; any third-party surface that does not MUST be listed as a known gap and tracked as follow-up work, not blocking this feature.
- **FR-005**: On the very first visit (no stored preference), the system MUST default to "Sistema" and MUST paint in the operating system's currently advertised palette.
- **FR-006**: When the mode is "Sistema" and the operating system's palette preference changes, the application MUST update within 3 seconds without a page reload.
- **FR-007**: When the mode is "Claro" or "Oscuro" (explicit), the application MUST NOT react to operating-system palette changes.
- **FR-008**: The user's selected mode MUST persist across page reloads, tab closes, and browser restarts on the same browser.
- **FR-009**: On every page load, the correct palette MUST be applied on the very first paint — the user MUST NOT see a flash of the wrong palette before the correct one appears.
- **FR-010**: Persistence MUST be scoped per browser; the preference does NOT need to sync across browsers or devices in v1.
- **FR-011**: When a user chooses a mode, the system MUST emit a named event of kind "theme.change" carrying the selected value ("light", "dark", or "system") so that future analytics and telemetry wiring can consume it.
- **FR-012**: The theme toggle MUST be reachable with Tab, openable with Enter or Space, navigable among options with arrow keys, selectable with Enter, and closable with Escape.
- **FR-013**: The toggle trigger and each individual option MUST render a visible focus indicator that meets WCAG AA contrast against their respective backgrounds in both palettes.
- **FR-014**: The toggle and its options MUST carry an accessible label in Spanish ("Cambiar tema", or localized equivalent) that communicates purpose to assistive technologies; the currently active option MUST be announced as the selected value.
- **FR-015**: Both palettes (light and dark) MUST meet WCAG AA text-contrast requirements (4.5:1 for body text, 3:1 for large text and UI components) across every surface of the application, for every tenant — i.e., each tenant's brand color MUST have both a light-mode variant and a dark-mode variant that satisfy AA contrast against their respective mode's surfaces.
- **FR-015a**: When a tenant is active, selecting the dark mode MUST shift both the neutral surface tokens (background, card, muted, foreground) AND the tenant's brand tokens (primary, accent, destructive, etc.) to their dark variants simultaneously. The user MUST NOT see a mixed state where neutrals are dark but brand colors remain light-mode values.
- **FR-016**: If the user has declared `prefers-reduced-motion`, the transition between palettes MUST be instantaneous; otherwise a brief transition is acceptable but MUST NOT exceed 200ms.
- **FR-017**: When browser storage is unavailable or blocked, the toggle MUST continue to work within the current session and MUST NOT display an error to the user; the chosen preference simply does not persist beyond the session.
- **FR-018**: The chosen theme MUST apply to the login screen, the forced-password-change screen, and all protected routes alike (global palette, not scoped to the shell).
- **FR-019**: The toggle's open/closed state MUST expose correct ARIA semantics: the trigger carries `aria-expanded` reflecting the menu state; the menu uses `role="menu"`; each option uses `role="menuitemradio"` with `aria-checked` reflecting selection (`aria-checked="true"` on the active option, `"false"` on the others). Screen readers MUST announce the current value when focus lands on the trigger.
- **FR-020**: When the user changes the theme in one tab, every other open tab of the same application in the same browser MUST update to the new theme within 1 second without requiring a reload or user interaction in the other tabs.

### Key Entities

- **Theme preference**: a single per-browser record with one of three values — "Claro", "Oscuro", or "Sistema" — plus an implicit rule "when value is Sistema, resolve to the operating system's current preference at render time".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Switching modes repaints the entire visible application within 1 second, measured from click to final paint, on a mid-tier consumer device.
- **SC-002**: Zero perceivable flash of wrong palette on page reload — a user watching the reload sees the chosen palette from the first rendered frame.
- **SC-003**: The theme preference survives 100% of reloads and tab closes within the same browser session; the preference survives at least 30 days in the same browser across sessions (bounded only by the browser's own storage retention).
- **SC-004**: 100% of first-party shell and module surfaces (header, sidebar, main, dialogs, popovers, tooltips, toasts, forms, tables) render correctly in both palettes — no surface shows text that is unreadable against its background. Third-party widgets used by the app target the same bar, but any gap is permitted to ship as a tracked follow-up rather than block the feature.
- **SC-005**: A keyboard-only user can switch themes end-to-end (reach the toggle, open it, select a mode, confirm the change took effect) without touching the mouse.
- **SC-006**: Body text in both palettes achieves at least 4.5:1 contrast, and UI component boundaries achieve at least 3:1 contrast, across every protected route.
- **SC-007**: When "Sistema" is active, changing the operating-system appearance reflects in the app within 3 seconds.
- **SC-008**: In private-browsing / storage-blocked contexts, the toggle still operates within the session without showing any error; no user-visible regression versus normal browsing.
- **SC-009**: When the user changes theme in one tab with another tab already open, the second tab reflects the new theme within 1 second, verified end-to-end across two open tabs of the same browser.

## Assumptions

- A dark palette and a light palette already exist as a set of design tokens in the web application (feature 003 established these tokens), covering BOTH neutral surface tokens and the set of brand/semantic tokens (primary, accent, destructive, warning, success, etc.). Tenant branding is expected to supply both a light and a dark variant of its brand tokens; any tenant that only defines a light-mode brand value MUST have a sensible default dark-mode variant derived or declared before that tenant can be used in dark mode. This spec does not re-derive tokens — it wires them to a user-facing control.
- The application shell (header with right-cluster slot, sidebar, main) already exists from feature 005 and is the mounting point for the theme toggle.
- Authentication state and per-tenant theming are orthogonal concerns — this feature does not alter tenant-level theming or per-user server-side preference syncing.
- The preference scope is per browser only for v1. Per-user server-side syncing across devices is out of scope.
- The toggle is a single control in the header; there is no separate toggle in a settings page or user menu in v1.
- "Dark" and "light" are the only two palettes; high-contrast and custom-accent modes are out of scope.
- The feature affects all tenants uniformly in v1 — there is no tenant-level override to disable dark mode.
- All 3rd-party UI primitives consumed by the app (dialogs, date pickers, maps, charts) are expected to support the palette token system or fall back gracefully. Per FR-004 and SC-004, third-party coverage is a SHOULD rather than a MUST: any widget that does not repaint correctly is documented as a known gap and tracked as follow-up work, not as a blocker for shipping this feature. First-party surfaces remain a hard MUST.
