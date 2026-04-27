# Feature Specification: UX, Role Scoping, and Configurability Refinements

**Feature Branch**: `008-ux-roles-refinements`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "Cambios generales / Módulo de clientes / Candidatos / Login — header user menu, multi-assignment checkbox table, admin-managed formConfig fields, inline status transition dropdown on candidate list, Spanish dropdown labels, role-scoped visibility hardening, recruiter-only candidate creation, privacy-notice removal, login organization field hidden with default 'bepro'."

## Context & Current State *(mandatory)*

This feature is a cross-module refinement pass. Before planning, the following was verified against the codebase on branch `main` at commit `b0d58f0`:

**Already implemented (no work required beyond integration with new behavior):**
- Role-scoped candidate list visibility in the API (`apps/api/src/modules/candidates/service.ts:353-391`): recruiter sees own, AE sees via client assignments, manager/admin see all.
- Dynamic candidate form driven by client `formConfig` (`apps/web/src/modules/candidates/components/CandidateForm.tsx:50-65`, backend `buildDynamicSchema`).
- Tenant-slug field on login (`apps/web/src/modules/auth/components/LoginForm.tsx:20-23`) — will be hidden but kept underneath for future multi-tenant public sign-in.
- Privacy-notice UI (`PrivacyNoticeCheckbox.tsx`) and backend requirement (`service.ts:190-215`) — to be **removed / relaxed** (see FR-RP-*).

**Missing / partial (all driven by this feature):**
- Header user menu with logout and displayed identity (Header reserves space but is empty: `apps/web/src/components/layout/Header.tsx:21`).
- Inline per-row status transition on the candidate list (today transitions only exist on the detail page).
- Spanish labels for status and category dropdowns (today `CANDIDATE_STATUS_LABELS` are TitleCase English).
- Explicit API role guard for `POST /api/candidates` (today any authenticated user can call it).
- Admin UI to add custom fields to a client's `formConfig` beyond the 8 hardcoded toggles.
- Multi-select checkbox table for assigning AEs to a client (today single-select dropdown, one user at a time).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Identity & session control in the header (Priority: P1)

As any authenticated user, I want the application header to show who I'm logged in as and let me sign out in one click, so I always know my identity context and can end my session without hunting for a menu.

**Why this priority**: Identity visibility is a baseline UX expectation and session termination is a security/compliance requirement. Without it, users cannot easily switch accounts or confirm their role. All other stories assume a signed-in header.

**Independent Test**: Log in with any role; verify the header shows the user's full name and role; click the user icon; verify the dropdown shows a "Cerrar sesión" action that ends the session and redirects to login.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they view any authenticated page, **Then** the header displays their full name (and role or email as secondary text) alongside a user icon/avatar.
2. **Given** the header user icon, **When** the user clicks it, **Then** a menu opens with at least "Cerrar sesión".
3. **Given** the user clicks "Cerrar sesión", **When** the action completes, **Then** the session is ended on the server, local auth state is cleared, and the user is redirected to the login screen.
4. **Given** a user without a display name, **When** the header renders, **Then** fallback to email or initials is shown (no blank UI).

---

### User Story 2 — Recruiter-only candidate creation and role-scoped visibility hardening (Priority: P1)

As the system, I want to enforce at the API that only recruiters (including freelancer recruiters) can register a candidate, and I want every role to see only the candidates their scope permits, so the platform honors the company's operational model and prevents accidental cross-team leakage.

**Why this priority**: The current API accepts candidate creation from any authenticated role. This is a defect against the stated operating model and creates audit-trail noise. Visibility rules must match the role scope exactly.

**Independent Test**: Attempt `POST /api/candidates` as admin, manager, and AE — each must receive 403. Attempt as recruiter and recruiter-freelancer — each must succeed. Log in as each role and list candidates — verify the visible set matches the role scope.

**Acceptance Scenarios**:

1. **Given** an admin, manager, or AE token, **When** they call candidate create, **Then** the API returns 403 with a human-readable reason.
2. **Given** a recruiter (or freelancer-recruiter) token, **When** they call candidate create, **Then** the API accepts the request and records the creator.
3. **Given** a recruiter lists candidates, **When** the response is returned, **Then** only candidates where `registeringUserId = recruiter.id` are visible.
4. **Given** an AE (account_executive) lists candidates, **When** the response is returned, **Then** only candidates belonging to clients assigned to that AE are visible.
5. **Given** a manager lists candidates, **When** the response is returned, **Then** all tenant candidates are visible.
6. **Given** an admin lists candidates, **When** the response is returned, **Then** all tenant candidates are visible (god mode).
7. **Given** a "New Candidate" button in the UI, **When** a non-recruiter role views any page, **Then** the button is hidden.

---

### User Story 3 — Inline status transition on the candidate list (Priority: P1)

As a recruiter, AE, manager, or admin, I want a per-row status-change dropdown in the candidate list so I can move candidates through the funnel without navigating into each detail page.

**Why this priority**: The list is the main working surface; moving candidates one by one via detail pages is the single biggest pain point reported. This delivers measurable time savings on routine workflows.

**Independent Test**: Log in as a recruiter with candidates in multiple statuses; open the candidate list; from any row, click the per-row status dropdown; verify only transitions valid for (a) the candidate's current status and (b) the viewer's role are shown; select one; verify the row updates without a full page navigation and the audit trail records the change.

**Acceptance Scenarios**:

1. **Given** a candidate row, **When** the user opens the per-row status menu, **Then** the menu shows only statuses reachable by a valid FSM transition from the current status AND allowed for the user's role.
2. **Given** a transition that requires a reason/category (e.g., rejection or decline), **When** selected, **Then** the user is prompted for the required category before the transition is committed.
3. **Given** the user confirms a transition, **When** it succeeds, **Then** the row re-renders with the new status and an audit event is persisted.
4. **Given** the user's role has no valid transitions from the current status, **When** the per-row menu is opened, **Then** it is disabled or shows an empty/explanatory state.
5. **Given** the menu is rendered for many rows, **When** the list is scrolled, **Then** actions are grouped visually by category inside the dropdown (e.g., "Avanzar", "Rechazar", "Reactivar").

---

### User Story 4 — Spanish labels on enum dropdowns (Priority: P2)

As a Spanish-speaking user, I want status and category dropdowns in the candidate UI to show Spanish human-readable labels instead of raw English enum values, so the interface matches the rest of the application.

**Why this priority**: Usability defect, non-blocking but highly visible. Cheap to fix.

**Independent Test**: Open any dropdown that currently shows status values ("Registered", "Interview Scheduled", "Approved", etc.) and verify each option renders its Spanish label. The same applies to rejection and decline categories, and to any `form-config` field-type enum ("text", "number", "select") if rendered to end users.

**Acceptance Scenarios**:

1. **Given** a status dropdown, **When** rendered, **Then** each option displays a Spanish label (e.g., "Registrado", "Entrevista programada", "Aprobado").
2. **Given** a category dropdown, **When** rendered, **Then** rejection and decline category labels come from the tenant-managed category label (already Spanish) or a Spanish fallback if unset.
3. **Given** any dropdown exposed to end users, **When** no Spanish label is defined, **Then** the missing label is flagged in a QA sweep, not silently shown as an English token.

---

### User Story 5 — Multi-assignment of users to a client (Priority: P2)

As an admin or manager, I want to assign multiple AEs to a client at once through a checkbox table, so onboarding a client is a single operation instead of N sequential selects.

**Why this priority**: Operational efficiency for admins during client onboarding. Current single-select flow is a known friction point.

**Independent Test**: Open a client's detail page as admin; open the assignment section; see a table listing eligible users with a checkbox per row, a search/filter input, and their current assignment state; select multiple checkboxes; save; verify all selected users are now assigned and deselected ones are unassigned.

**Acceptance Scenarios**:

1. **Given** the client assignment section, **When** opened, **Then** eligible users render in a table with columns for name, email, role, and a checkbox for assignment state.
2. **Given** the user selects multiple checkboxes and saves, **When** the operation completes, **Then** all selected users are assigned and all deselected users have their assignment removed, in one transaction.
3. **Given** a large tenant, **When** the table is opened, **Then** a search/filter input narrows the visible rows.
4. **Given** an operation that partially fails, **When** saving, **Then** the user sees which rows failed and the successful rows are persisted.

---

### User Story 6 — Admin-managed custom fields in client formConfig (Priority: P3)

As an admin, I want to add a new custom field to a client's `formConfig` (beyond the 8 hardcoded toggles), so I can capture client-specific data without a code change.

**Why this priority**: Unblocks onboarding of clients with bespoke intake needs, but the current 8 toggles cover today's clients. Lower urgency than the other stories.

**Independent Test**: As admin, open a client's form configuration; click "Añadir campo"; define a field (key, Spanish label, field type, options if applicable, required flag); save; open the candidate registration form for that client and verify the new field is rendered and validated per its definition.

**Acceptance Scenarios**:

1. **Given** the form-config editor, **When** an admin adds a new custom field, **Then** they can specify key (unique within the client), label, field type (see Assumptions), options for enumerated types, and whether the field is required.
2. **Given** a new custom field saved for a client, **When** a recruiter opens that client's candidate form, **Then** the custom field is rendered with the correct widget, label, and validation.
3. **Given** an existing custom field, **When** the admin edits its label or required flag, **Then** existing candidate records remain valid and subsequent registrations reflect the new definition.
4. **Given** an admin attempts to add a field with a duplicate key, **When** saving, **Then** an inline validation error appears.

---

### User Story 7 — Privacy notice removed from the candidate flow (Priority: P2)

As the product, I want the online privacy-notice acknowledgement to be removed from the candidate registration flow, because the candidate is never self-registering — the recruiter registers them — so an in-product consent click between the system and the recruiter is not the right compliance model.

**Why this priority**: Correctness / compliance hygiene. The current UX suggests the candidate is consenting online, which is misleading. Compliance documentation for LFPDPPP is handled offline by the recruiter.

**Independent Test**: Open the new-candidate form — the privacy-notice checkbox is gone. Submit a candidate — the API accepts the request without a privacy-notice payload. Existing candidate records retain their historical `privacy_notice_id` value in the database; the candidate detail UI no longer surfaces it.

**Acceptance Scenarios**:

1. **Given** the new-candidate form, **When** rendered, **Then** no privacy-notice checkbox is displayed.
2. **Given** a candidate create request without a privacy-notice payload, **When** the API processes it, **Then** the request succeeds.
3. **Given** an existing candidate that has a historical privacy-notice record, **When** their detail is viewed, **Then** the candidate detail UI does not surface the notice; the underlying DB row remains intact for LFPDPPP evidentiary retrieval via ops/backoffice tooling.
4. **Given** privacy-notice tables and historical data, **When** this change is deployed, **Then** no existing data is deleted (append-only audit trail preserved).

---

### User Story 8 — Login simplification (Priority: P3)

As a BePro employee, I want the login screen to not ask me for an organization, because today there is only one tenant ("bepro"), so the login should just ask for email and password.

**Why this priority**: Small UX polish; not blocking. Keeping the tenant field hidden lets us restore it cheaply when multi-tenant public sign-in comes later.

**Independent Test**: Open the login page. Verify only email and password are visible. Submit credentials — the client sends `tenantSlug = "bepro"` underneath.

**Acceptance Scenarios**:

1. **Given** the login screen, **When** rendered, **Then** the tenant/organization input is not visible.
2. **Given** the user submits email and password, **When** the client calls the auth API, **Then** it includes `tenantSlug = "bepro"`.
3. **Given** we need to restore the field later, **When** a feature flag or config toggles it on, **Then** the field re-appears with its existing validation.

---

### Edge Cases

- A recruiter in frozen/terminated state attempts to open the New Candidate form — it must be blocked both in UI and API.
- A user transitions a candidate inline and the FSM rule has changed server-side (stale client) — the API returns a clear "invalid transition" error and the UI re-fetches the row.
- An admin removes themselves from a client's assignment — must still be able to revert the change; the table must not lock out admins.
- An admin deletes a custom formConfig field that has historical values on candidates — historical values are preserved; the field is marked "archived" in the config so no new data is collected under that key.
- Logout is pressed while a mutation is in flight — the mutation is cancelled or allowed to complete, and no half-applied UI state is left behind.
- Privacy-notice table still has active rows at deploy time — the rows remain in the database (DB-level SELECT works; no UI surface reads them post-deploy); new writes are not required.

## Requirements *(mandatory)*

### Functional Requirements — Header & Session

- **FR-HD-001**: The application header MUST render the logged-in user's display name (fallback: email) and a user icon/avatar on every authenticated route.
- **FR-HD-002**: The user icon MUST open a menu containing, at minimum, a "Cerrar sesión" action.
- **FR-HD-003**: Selecting "Cerrar sesión" MUST end the server session (refresh-token revocation), clear client auth state, and redirect to the login route.
- **FR-HD-004**: Per-user profile picture upload and display is OUT OF SCOPE for the MVP; the header MUST render initials or a generic avatar as a fallback.

### Functional Requirements — Candidate creation gating

- **FR-CG-001**: The API MUST reject `POST /api/candidates` with a 403 for any role other than `recruiter` (with or without `is_freelancer`).
- **FR-CG-002**: The UI MUST hide the "New Candidate" entry points (buttons, menu items, routes) from roles that cannot create candidates.
- **FR-CG-003**: The list filter for "my candidates" for recruiters MUST be the default and only option (cannot be cleared to see others').

### Functional Requirements — Inline status transitions on the list

- **FR-ST-001**: The candidate list MUST include a per-row action column that opens a dropdown of valid status transitions.
- **FR-ST-002**: The dropdown MUST only show transitions that are both (a) valid FSM moves from the row's current status and (b) authorized for the viewer's role.
- **FR-ST-003**: When a selected transition requires a category (rejection/decline), a secondary prompt MUST capture it before the transition is committed.
- **FR-ST-004**: Options inside the dropdown MUST be visually grouped by category (e.g., "Avanzar", "Rechazar", "Reactivar").
- **FR-ST-005**: Successful transitions MUST update the row in place without a full page reload and MUST append an audit event.
- **FR-ST-006**: Failed transitions (e.g., stale client, validation error) MUST show a user-friendly message and re-fetch the row.

### Functional Requirements — Dropdown localization

- **FR-LC-001**: All status and category dropdowns exposed to end users MUST render Spanish labels; raw English enum tokens MUST NOT be shown.
- **FR-LC-002**: A central Spanish label map MUST exist for candidate statuses (source of truth for `CANDIDATE_STATUS_LABELS`).
- **FR-LC-003**: Tenant-managed category labels (rejection, decline) MUST continue to be editable per tenant and render as-is.

### Functional Requirements — Client assignment (multi-select)

- **FR-AS-001**: The client assignment UI MUST present eligible users in a table with: name, email, role, and a per-row checkbox reflecting current assignment.
- **FR-AS-002**: The user MUST be able to toggle multiple checkboxes and persist the combined change as a single save operation.
- **FR-AS-003**: The save operation MUST add newly selected users and remove newly deselected users.
- **FR-AS-004**: A search/filter input MUST narrow the visible rows by name or email.
- **FR-AS-005**: On partial failure the UI MUST report which rows failed and keep the successful ones persisted.
- **FR-AS-006**: Scope is limited to the existing AE↔client assignment relation. No new recruiter↔AE direct assignment is introduced in this feature; AE visibility continues to derive from `ClientAssignment`.

### Functional Requirements — Admin-managed custom formConfig fields

- **FR-FC-001**: Admins MUST be able to add a custom field to a client's `formConfig`, specifying key, Spanish label, field type, required flag, and options for enumerated types.
- **FR-FC-002**: Custom field keys MUST be unique within a single client's formConfig.
- **FR-FC-003**: Edited labels or required flags on custom fields MUST affect new candidate registrations without invalidating existing candidate records.
- **FR-FC-004**: Removing a custom field from a client's formConfig MUST archive the field (preserve historical values) rather than hard-delete it.
- **FR-FC-005**: The 8 existing toggle-style fields (`showAge`, `showPlant`, `showShift`, `showComments`, `showPosition`, `showMunicipality`, `showInterviewTime`, `showInterviewPoint`) MUST continue to work unchanged.
- **FR-FC-006**: Supported field types in this MVP are limited to primitives already renderable by the dynamic form: `text`, `number`, `date`, `checkbox`, and `select` (with enumerated options). Rich types (multi-select, textarea, file upload, geo) are explicitly deferred to a later feature.

### Functional Requirements — Privacy notice removal

- **FR-RP-001**: The new-candidate form MUST NOT display a privacy-notice checkbox.
- **FR-RP-002**: The candidate-create API MUST accept requests without a privacy-notice payload and MUST NOT require a `privacy_notice_id`.
- **FR-RP-003**: Historical `privacy_notices` rows and the `candidates.privacy_notice_id` value on existing candidate records MUST be preserved at rest in the database. The candidate detail UI no longer surfaces these records (per FR-RP-005); evidentiary retrieval is performed via DB/ops tooling, not the end-user UI.
- **FR-RP-004**: The append-only audit trail MUST continue to reflect the historical acknowledgement for candidates registered before this change.
- **FR-RP-005**: Privacy-notice surfaces MUST be removed from the UI entirely, including the new-candidate checkbox, the tenant-admin notice-management page, and the "accepted at / accepted by" section on candidate detail.
- **FR-RP-006**: The `privacy_notices` table and the `candidates.privacy_notice_id` column MUST remain in the database schema (no DROP / ALTER in this feature); no new rows are written to `privacy_notices` and no new `candidates` row sets `privacy_notice_id` after this feature ships.

### Functional Requirements — Login simplification

- **FR-LG-001**: The login screen MUST NOT render the organization/tenant input in the default build.
- **FR-LG-002**: The client MUST submit `tenantSlug = "bepro"` to the auth API when the field is hidden.
- **FR-LG-003**: Restoring the field (via config toggle) MUST re-enable its current validation without further code change.

### Key Entities *(data involved)*

- **User**: Existing. No schema change required for header display; future `avatar_url` is out of scope.
- **Client**: Existing. Its `formConfig` JSON extends to include a `fields` array (already typed in `packages/shared/src/candidates/form-config.ts`). Admin UI will start writing arbitrary entries to this array.
- **Candidate**: Existing. `registeringUserId` remains the single source of truth for "who registered this candidate".
- **ClientAssignment**: Existing link between user and client, scope: AE↔client. Multi-select UI writes to this table.
- **CandidateStatusTransition (audit event)**: Existing. Inline transitions append to the same audit stream as detail-page transitions.
- **PrivacyNotice**: Existing. Preserved read-only; new writes not required after this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Recruiters complete an inline status transition from the list with p95 ≤ 500 ms end-to-end (click → row reflects new status and audit event persisted) on a tenant list rendering 200 candidates. This is the measurable form of the "≈3× faster than the current detail-page flow" intent.
- **SC-002**: 100% of candidate-create API calls by non-recruiter roles return 403 in automated tests; no candidate record is created by a non-recruiter after this feature lands.
- **SC-003**: The login screen shows exactly two fields (email, password) by default; existing tenant-aware tests pass by sending `tenantSlug = "bepro"`.
- **SC-004**: A QA sweep of candidate UI finds zero English enum tokens in status or category dropdowns.
- **SC-005**: Admins can assign N AEs to a client in a single save with p95 batch latency ≤ 300 ms for diffs up to 50 rows (plan.md perf goal). UX target: assigning 10 AEs completes end-to-end in under 30 seconds (≈10× faster than the 10-sequential-select baseline).
- **SC-006**: An admin can create, rename, mark required/optional, and archive a custom formConfig field for a client entirely from the admin UI — zero engineering intervention — and the next candidate registration for that client reflects the change.
- **SC-007**: Every authenticated page renders the user's identity in the header; zero pages leave the slot blank.
- **SC-008**: Logout ends the server session (refresh token revoked) and leaves the client auth store cleared, verified by an integration test.

## Assumptions

- **A-01**: "BePro" is the only operational tenant in the MVP; hiding the organization field is safe. When a second tenant is onboarded, the field is re-enabled via config.
- **A-02**: The multi-select assignment change modifies UI and the batch-save endpoint only; the underlying `ClientAssignment` schema already supports many-to-many. Scope is AE↔client only (FR-AS-006).
- **A-03**: Recruiters (including freelancer recruiters) are the only role allowed to register a candidate. Other roles can transition, comment, and view within their scope but cannot create.
- **A-04**: AE visibility continues to derive from `ClientAssignment` (AE sees candidates of their clients). No separate recruiter↔AE direct assignment in the MVP (FR-AS-006).
- **A-05**: Admins retain the ability to *reactivate* candidates (FR-038a in the candidates module remains unchanged) even though they cannot *create* them.
- **A-06**: Profile picture upload is explicitly deferred. The avatar fallback is initials-on-color-tile, consistent with the existing `avatar.tsx` shadcn component.
- **A-07**: Historical privacy-notice records must be preserved for LFPDPPP evidentiary value; dropping the table is out of scope for this feature.
- **A-08**: Spanish labels for statuses are frozen for v1 (no i18n framework introduced); we keep a single translation map next to the enum.
- **A-09**: Custom formConfig field types in the MVP are limited to primitives already renderable by the dynamic form (`text`, `number`, `select`, `checkbox`, `date`) per FR-FC-006.

## Out of Scope

- User profile picture upload and storage.
- Full i18n framework (only a Spanish label map for existing English enums is in scope).
- Multi-tenant public sign-in (tenant field stays hidden, not removed).
- A new recruiter↔AE explicit assignment (deferred to a later feature).
- Rich custom field types (multi-select, textarea, file upload, geo).
- Tenant-admin privacy-notice management surface (removed from UI; DB preserved read-only).
- Bulk status transitions across multiple rows in the same submit (only per-row for this feature).
