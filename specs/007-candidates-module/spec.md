# Feature Specification: Candidates Module

**Feature Branch**: `007-candidates-module`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "Manage the full lifecycle of candidates for the recruitment platform, replacing the current Google Sheets + Forms workflow."

## Clarifications

### Session 2026-04-21

- Q: Which non-terminal states can branch to each negative terminal (Rejected, Declined, No Show, Discarded)? → A: Common-sense matrix — Rejected from Interview Scheduled / Attended / Pending / Approved; Declined from Approved only; No Show from Interview Scheduled only; Discarded from any non-terminal state.
- Q: What is the retention horizon for deactivated (soft-deleted) candidates under LFPDPPP? → A: Indefinite retention with mandatory annual compliance review — data stays intact; admins review and log the retention justification once per year.
- Q: Does reaching a terminal state auto-deactivate the candidate (is_active=false)? → A: Auto-deactivate only on negative terminals (Rejected, Declined, No Show, Discarded — plus Termination and Replacement when those states are reached). Positive terminals (Hired, In Guarantee, Guarantee Met) keep the candidate active for follow-up.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Register a new candidate with duplicate warning and privacy notice (Priority: P1)

A recruiter needs to add a candidate to the system in the context of a specific client opportunity. They collect the candidate's core information (first and last name, phone, email, current position, source where the candidate came from) plus any additional fields the target client requires for that role. Before submitting, the recruiter sees and the candidate acknowledges the LFPDPPP privacy notice. When the recruiter saves the record, the system checks for likely duplicates within the same tenant — specifically, another candidate with the same phone number attached to the same client — and if one is found, the recruiter receives a warning listing the existing candidate(s) and their current status, but can still proceed with creation after confirming that the duplicate is intentional. The recruiter may optionally attach the candidate's CV and/or other supporting documents at this moment.

**Why this priority**: Without registration, nothing else in the module has meaning. The duplicate warning and privacy notice are legally and operationally non-negotiable from day one; skipping either would create compliance risk (LFPDPPP) and data-quality debt that is very expensive to clean up after launch.

**Independent Test**: A recruiter logs in, opens a "New candidate" flow for Client X, fills out the core fields plus Client X's custom fields, sees the privacy notice and checks the acknowledgement, uploads a CV (optional), submits, and sees the new candidate appear in "My candidates" with status Registered. Attempting to create a second candidate with the same phone + Client X combination shows a warning; confirming proceeds with creation and both records remain in the system.

**Acceptance Scenarios**:

1. **Given** a recruiter on the "New candidate" page with Client X selected, **When** they complete all required fields, acknowledge the privacy notice, and submit, **Then** the candidate is created with status "Registered", assigned to that recruiter, and visible in "My candidates".
2. **Given** a recruiter submitting a new candidate whose phone + client matches an existing non-deactivated candidate in the same tenant, **When** they click Submit, **Then** the system displays a warning listing the existing candidate(s) with their current status and allows the recruiter to confirm and proceed or cancel.
3. **Given** a recruiter who has NOT acknowledged the privacy notice checkbox, **When** they attempt to submit, **Then** the system refuses submission and clearly indicates that the privacy acknowledgement is required.
4. **Given** a recruiter uploading a CV, **When** the upload completes successfully, **Then** the file is attached to the candidate's record and retrievable only by users authorized to view that candidate.
5. **Given** a recruiter whose client requires additional fields (e.g., desired salary, availability date) via the client's form configuration, **When** they open the "New candidate" form for that client, **Then** those additional fields are presented and validated per the client's rules before submission.

---

### User Story 2 — Role-scoped list, search, and filter (Priority: P1)

Every authenticated user who opens the candidates list sees only the candidates their role allows. Recruiters see only the candidates they themselves registered; account executives see only candidates whose client is assigned to them; managers and admins see every candidate within the tenant. On that scoped list, users can search by name/email/phone and filter by status, client, date range, recruiter (for managers and admins), and rejection category (when applicable). Each row displays enough information to identify and triage — name, client, status, last update, assigned recruiter.

**Why this priority**: The scoped list is the primary workspace for every role in this module. Without correct visibility, recruiters either leak PII across teams (violating the role hierarchy and LFPDPPP) or cannot find their own work. P1 because every subsequent flow (status change, attachments, detail view) starts from this list.

**Independent Test**: Log in as each of the four role combinations in turn (admin, manager, account_executive, recruiter) and open the candidates list. Verify the count and identity of visible candidates matches the expected scope for that role.

**Acceptance Scenarios**:

1. **Given** a recruiter with 8 candidates of their own and 40 candidates belonging to other recruiters in the tenant, **When** they open the candidates list, **Then** exactly 8 candidates are visible.
2. **Given** an account executive assigned to Clients A and B, **When** they open the candidates list, **Then** every candidate for Clients A and B is visible and no candidate for other clients is visible, regardless of which recruiter registered them.
3. **Given** a manager or admin, **When** they open the candidates list, **Then** every active candidate in the tenant is visible.
4. **Given** any user on the list, **When** they type a partial name, phone, or email into the search, **Then** the list filters to matching rows within their scope within 1 second.
5. **Given** any user on the list, **When** they combine filters (status = Interview Scheduled + client = X + date range = last 30 days), **Then** the list shows only candidates matching all filters within their role scope.
6. **Given** a user from Tenant A, **When** they access the list, **Then** they NEVER see any candidate from Tenant B, even by attempting to open the candidate detail page by URL.

---

### User Story 3 — Advance a candidate through the status lifecycle (Priority: P2)

An account executive, manager, or admin moves a candidate through the hiring stages. They open the candidate detail page, see the current status and the available next statuses for that role at that state, and select one. The system refuses any transition not allowed by the finite-state machine (e.g., "Attended" directly to "Hired" without "Approved") and any transition not permitted for the user's role. When a rejection or decline is chosen, the user must also pick a rejection category before the transition is recorded. Every accepted transition creates an audit record (who, what, when, old, new, optional notes) in a shape the audit module will later consume.

**Why this priority**: Status progression is the product's reason to exist — tracking where every candidate is in the pipeline. P2 rather than P1 because P1 captures the population of the system; a newly registered tenant with zero candidates cannot demonstrate US3.

**Independent Test**: Log in as a manager, open a candidate currently in "Registered", move it to "Interview Scheduled", then to "Attended", then to "Approved", then to "Hired". Verify each transition succeeds and shows in the candidate's history. Attempt an illegal transition (Attended directly to Hired) and confirm refusal with a clear message. Log in as a recruiter and confirm no transition controls are visible.

**Acceptance Scenarios**:

1. **Given** a manager viewing a candidate in "Registered", **When** they select "Interview Scheduled", **Then** the status updates, the candidate history shows the transition, and any time-dependent states (e.g., interview date) are captured if applicable.
2. **Given** a user attempting a transition not allowed by the FSM (e.g., "Registered" → "Hired"), **When** they submit, **Then** the system refuses and explains why.
3. **Given** a user selecting "Rejected" or "Declined", **When** they submit, **Then** the system requires a rejection category to be chosen from a predefined list before the transition is recorded.
4. **Given** a recruiter viewing any candidate (including their own), **When** they open the status area, **Then** no transition controls are visible — status is read-only for this role.
5. **Given** an account executive, **When** they attempt to transition a candidate whose client is not assigned to them, **Then** the transition is refused.
6. **Given** any accepted transition, **When** the change is saved, **Then** an append-only audit record is produced with actor user id, timestamp (UTC), previous status, new status, and — if supplied — a free-text note.

---

### User Story 4 — Attach and manage supporting documents (Priority: P2)

Anyone who can edit a candidate (recruiters for their own candidates, AEs/managers/admins within their scope) may attach additional documents after initial creation: an updated CV, a cover letter, reference letters, background-check results, etc. Each document is stored against the candidate, is private to users who can see that candidate, and can be previewed or downloaded from the candidate detail page. Documents can be marked "obsolete" (soft-removed) but cannot be hard-deleted because the PII may be legally required.

**Why this priority**: Attachments enrich the candidate record and are expected from any professional recruitment tool, but the core pipeline can be demonstrated without them — hence P2.

**Independent Test**: Open an existing candidate as a recruiter, upload an additional document, reload the page, confirm the document appears in the list. Mark the document "obsolete" and confirm it drops from the default view but is still retrievable via an "include obsolete" toggle.

**Acceptance Scenarios**:

1. **Given** a user with edit permission on a candidate, **When** they upload a supported file type under the size limit, **Then** the file attaches and appears in the documents list with uploader name and timestamp.
2. **Given** a user without edit permission, **When** they view the candidate, **Then** the upload control is not visible and any document list they see is read-only.
3. **Given** any user attempting to upload a file exceeding the size limit or a disallowed type, **When** they submit, **Then** the upload is refused with a clear reason.
4. **Given** a user in Tenant A, **When** they construct a file URL for a document that belongs to Tenant B, **Then** access is denied.
5. **Given** a document marked obsolete, **When** it is retrieved via "include obsolete", **Then** it can be viewed but NOT downloaded unless the actor has a role that permits archival access.

---

### User Story 5 — Capture rejection and decline categories for business intelligence (Priority: P3)

When a candidate is rejected or declines, the user who performs the transition picks a category from a predefined list (e.g., for rejection: "Not qualified", "Overqualified", "Salary mismatch", "Failed background check"; for decline: "Counter offer accepted", "Moved location", "Withdrew without reason"). Categories are tenant-configurable by admins. The category is stored on the candidate and on the audit record of the transition. Reporting surfaces can later aggregate by category without ever exposing candidate PII.

**Why this priority**: Rejection analytics power better hiring decisions over time, but no immediate operational flow depends on them. P3.

**Independent Test**: A manager rejects a candidate, picks "Salary mismatch", and the candidate record shows that category. Later, a report run by an admin returns counts by category without revealing any candidate's name, phone, or email.

**Acceptance Scenarios**:

1. **Given** a user transitioning a candidate to "Rejected" or "Declined", **When** they submit without selecting a category, **Then** submission is refused.
2. **Given** an admin editing the list of rejection/decline categories for their tenant, **When** they add, rename, or deactivate a category, **Then** the change applies to future transitions only — historical records keep their original category label.
3. **Given** a reporting query aggregating by rejection category, **When** results are rendered, **Then** no PII (name, phone, email, CURP, RFC) appears in the output.

---

### User Story 6 — Audit trail compatible with future audit module (Priority: P3)

Every status transition and every edit to a candidate's core PII fields (name, phone, email) produces an append-only record capturing: acting user id, tenant id, candidate id, action type, UTC timestamp, old value, new value, and optional actor-provided note. These records are never modified or deleted. The shape is locked to the contract expected by the future audit module so that module can absorb the records unchanged.

**Why this priority**: The records are invisible to end users and do not drive product behavior in v1 — they are insurance for compliance, dispute resolution, and future analytics. P3 because the structural requirement must be met now (the records are written), even if no UI consumes them yet.

**Independent Test**: Perform a status transition and a PII edit on a candidate. Inspect the audit store and verify two append-only records with the expected fields are present. Attempt to modify or delete one of the records and confirm refusal.

**Acceptance Scenarios**:

1. **Given** any accepted status transition, **When** the transition completes, **Then** exactly one audit record is written capturing the fields listed above.
2. **Given** any edit to a candidate's name, phone, or email, **When** the edit completes, **Then** one audit record per changed field is written with the prior and new values.
3. **Given** an existing audit record, **When** any actor (including admin) attempts to modify or delete it, **Then** the attempt is refused.

---

### Edge Cases

- **Recruiter deactivation**: when a recruiter is deactivated, their already-registered candidates remain visible to managers/admins/the relevant AE, and the recruiter's name continues to appear in historical records (audit trail integrity).
- **Client deactivation**: a deactivated client no longer shows in the "New candidate" client selector, but its existing candidates remain visible and manageable by their scope.
- **Phone formatting**: candidates with phone numbers written in slightly different formats (e.g., "+52 55 1234 5678" vs "5512345678") are considered the same for duplicate detection only after normalization (removing spaces, dashes, parentheses, leading +country).
- **Cross-client duplicates**: the same person can legitimately be a candidate for two different clients simultaneously; the duplicate-warning rule triggers on (phone, client) pairs only.
- **CURP/RFC capture**: when the client's form configuration requests CURP or RFC, these fields are treated with the same PII handling as phone/email — never logged in plain text.
- **Transition with stale data**: if a manager opens a candidate and attempts to transition from a status that has already changed (another user moved it), the system refuses and shows the current state.
- **Concurrent PII edits**: optimistic concurrency in this module is scoped to status changes only. Two near-simultaneous PATCH edits to different PII fields MAY both succeed (last-writer-wins per field); the audit trail captures both operations independently. Field-level conflict detection (e.g., a `row_version` column) is intentionally deferred until measured pain emerges.
- **File upload interrupted**: if an upload is aborted mid-flight, no partial document attaches to the candidate and no storage is orphaned.
- **Candidate reactivation**: a soft-deleted (deactivated) candidate can be reactivated only by an admin; reactivation reinstates full access within its original role scope.
- **Massive listing**: the list remains responsive with 10,000+ candidates in a single tenant through pagination and indexed filtering.
- **Extremely long source names or free-text fields**: fields are truncated on display with full value available via tooltip/detail view, never silently lost.

## Requirements *(mandatory)*

### Functional Requirements

#### Tenant isolation and data handling (cross-cutting)

- **FR-001**: Every candidate record MUST be scoped to exactly one tenant; cross-tenant reads and writes MUST be impossible by any path (URL, API, database).
- **FR-002**: Tenant scoping MUST be enforced at the database level, not merely in the application layer.
- **FR-003**: Candidates MUST NOT be hard-deleted; deactivation uses an `is_active` flag only (LFPDPPP compliance).
- **FR-003a**: Retention of deactivated candidate records is indefinite by default. To satisfy LFPDPPP data-minimization, tenant admins MUST complete and log a retention-justification review at least once every 12 months. The system MUST surface an in-app banner to any admin user who loads an admin surface within 30 days of the review deadline (and continue escalating it after the deadline passes) and MUST record each completed review (actor, timestamp, free-text justification) in an append-only log. Out-of-band reminders (email, push, SMS) are explicitly OUT OF SCOPE for this module and are deferred to a future notifications module — admins who never log in during the reminder window will not be reached by this module alone.
- **FR-004**: PII fields (first name, last name, phone, email, CURP, RFC) MUST NOT appear in plain-text logs at any log level.
- **FR-005**: Uploaded files MUST be stored with per-tenant isolation; a user from one tenant MUST NOT be able to access another tenant's files by guessing or constructing URLs.

#### Registration (US1)

- **FR-010**: The system MUST allow a recruiter, account executive, manager, or admin to register a new candidate in the context of exactly one client.
- **FR-011**: Every candidate record MUST capture: first name, last name, phone, email, current position, source, client id, registering-user id, created-at timestamp, `is_active` flag, and status.
- **FR-011a**: When the client's `form_config` requests CURP, RFC, a secondary phone, or any other PII-class identifier, those values MUST receive the same treatment as the core PII (FR-004): never appearing in plain-text logs at any level, redacted by the same helper, and producing per-field audit rows under FR-061 when edited. Storage location is the candidate's `additional_fields` JSONB.
- **FR-011b**: Authorization for `PATCH /api/candidates/:id` (PII + additional_fields edits, status NOT included): the registering recruiter MAY edit only while the candidate's status is exactly `registered`; once status advances past `registered`, only account_executive (within their client scope), manager, and admin MAY edit. Status changes go through the transitions endpoint exclusively (FR-032/FR-033/FR-034 still govern transitions).
- **FR-012**: The client's per-client form configuration MUST be applied at registration time; required additional fields MUST be enforced, and optional additional fields MUST be stored alongside the core fields.
- **FR-013**: Before a candidate can be submitted, the person submitting MUST explicitly acknowledge the LFPDPPP privacy notice via a discrete control; acknowledgement MUST be recorded with a timestamp.
- **FR-014**: On submission, the system MUST detect likely duplicates within the same tenant defined as another active candidate with the same (normalized phone, client) pair.
- **FR-015**: When duplicates are detected, the system MUST warn the submitter with a list of matching candidates and their current status, but MUST allow the submitter to confirm and proceed; on confirmation the new record is created and the relationship to each duplicate is recorded.
- **FR-016**: A newly created candidate MUST start in status "Registered" and MUST be assigned to the user who created it as its registering user.
- **FR-017**: Supported file types for the optional attachment step MUST be defined and enforced; unsupported types MUST be refused with a clear message.
- **FR-018**: File uploads MUST have a per-file size cap defined and enforced; files exceeding the cap MUST be refused with a clear message.

#### Listing, search, and filter (US2)

- **FR-020**: The candidates list MUST show only candidates visible to the actor per the role rules: recruiter → own; account executive → clients assigned to them; manager and admin → all in tenant. Deactivated candidates (including those auto-deactivated by reaching a negative-terminal state per FR-038) are hidden by default.
- **FR-021**: The list MUST support search by partial match on name, email, or phone within the actor's scope.
- **FR-022**: The list MUST support filters combinable with AND semantics by status (single or multiple), client, date range (created or last-updated), recruiter (only visible for managers and admins), and rejection category.
- **FR-023**: The list MUST support pagination appropriate to a tenant with up to 50,000 candidate records.
- **FR-024**: Each row MUST display: candidate name, client, status, last updated timestamp, and registering recruiter.
- **FR-025**: A toggle MUST exist to include deactivated candidates in the list (available to managers and admins only).

#### Status lifecycle (US3)

- **FR-030**: The system MUST enforce a 14-state finite-state machine for candidates: Registered, Interview Scheduled, Attended, Pending, Approved, Hired, In Guarantee, Guarantee Met, Rejected, Declined, No Show, Termination, Discarded, Replacement.
- **FR-031**: Transitions MUST be validated; any transition not defined as allowed by the FSM MUST be refused with an explanatory message. Skipping states (e.g., Registered → Hired) is NOT permitted.
- **FR-031a**: Negative-terminal transitions MUST follow this matrix: `Rejected` is reachable only from Interview Scheduled, Attended, Pending, or Approved; `Declined` is reachable only from Approved; `No Show` is reachable only from Interview Scheduled; `Discarded` is reachable from any non-terminal state (Registered, Interview Scheduled, Attended, Pending, Approved). Any attempt outside this matrix MUST be refused.
- **FR-032**: Recruiters MUST NOT be able to change a candidate's status; the status control is read-only for that role.
- **FR-033**: Account executives MUST be able to transition candidates only within their assigned clients.
- **FR-034**: Managers and admins MUST be able to perform any FSM-legal transition on any candidate within their tenant.
- **FR-035**: Transitions to "Rejected" or "Declined" MUST require the actor to pick a category from the tenant's configured list before the transition is accepted.
- **FR-036**: Every accepted transition MUST be atomic with the audit record (both succeed or neither persists).
- **FR-037**: The system MUST refuse a transition if the candidate's current status has changed since the actor loaded the page (optimistic concurrency — reject stale writes), surfacing the current status.
- **FR-038**: Reaching a negative-terminal state (Rejected, Declined, No Show, Discarded, Termination, Replacement) MUST atomically set the candidate's `is_active` flag to `false` as part of the same transition. Reaching a positive-terminal state (Hired, In Guarantee, Guarantee Met) MUST leave `is_active` unchanged — these candidates remain visible in the default list. Reactivation from a negative-terminal state requires an admin action (FR-038a).
- **FR-038a**: An admin (and only an admin) MAY reactivate a candidate that has reached a negative-terminal state. Reactivation MUST set `is_active = true`, leave the terminal `status` value intact (so lifecycle history is preserved), and write exactly one append-only audit record with action `candidate.reactivated` capturing actor user id, tenant id, candidate id, UTC timestamp, and an OPTIONAL free-text justification note. Reactivation MUST NOT be available from a positive-terminal state (those rows already keep `is_active = true`) nor from any non-terminal state.

#### Attachments (US4)

- **Edit permission (definition for FR-011b, FR-040, and PATCH authorization)**: An actor has edit permission on a candidate if and only if (a) the actor is the registering recruiter AND the candidate's status is exactly `registered`, OR (b) the actor is an account executive AND the candidate's `client_id` is in the actor's client assignments, OR (c) the actor is a manager or admin in the candidate's tenant. This single definition governs FR-011b (PATCH on PII), FR-040 (attach files), and the obsolete-toggle in FR-043.
- **FR-040**: Users with edit permission (as defined above) on a candidate MUST be able to attach additional files after registration. Implementation note: file bytes transit the Workers runtime (server-proxied upload) today; direct-to-R2 presigned-PUT uploads are a future optimization and are not a requirement of this module. See `contracts/candidates-api.md` §6–§7 and ADR-002 for the rationale.
- **FR-041**: Each attached file MUST record uploader user id, upload timestamp, file name, size, MIME type, and optional tag (e.g., "CV", "Cover letter").
- **FR-042**: Attached files MUST inherit the candidate's visibility rules — only users who can see the candidate can see its attachments.
- **FR-043**: Attachments MUST be markable as "obsolete"; obsolete attachments remain retrievable via an explicit opt-in but are hidden from the default view.
- **FR-044**: Files MUST NEVER be hard-deleted; soft-mark only.

#### Rejection / decline categories (US5)

- **FR-050**: Each tenant MUST maintain its own list of rejection categories and decline categories, editable by admins.
- **FR-051**: Adding, renaming, or deactivating a category MUST apply only to future transitions; historical records MUST retain their original category label and MUST remain queryable.
- **FR-052**: Category-based aggregations (reports) MUST NOT expose any candidate PII.

#### Audit trail (US6)

- **FR-060**: Every accepted status transition MUST produce exactly one append-only audit record capturing: actor user id, tenant id, candidate id, action type, UTC timestamp, previous status, new status, optional actor-supplied note.
- **FR-061**: Every edit to a candidate's PII fields (first name, last name, phone, email, CURP, RFC) MUST produce one append-only audit record per changed field capturing: actor user id, tenant id, candidate id, action type = "edit", field name, UTC timestamp, previous value, new value.
- **FR-062**: Audit records MUST be append-only — no actor (including admin) may modify or delete them.
- **FR-063**: The audit record shape MUST be compatible with a future dedicated audit module so records can migrate unchanged.

### Key Entities

- **Candidate**: one record per person-per-client-per-tenant. Attributes: id, tenant id, client id, registering user id, first name, last name, phone (normalized form stored), email, current position, source, status, per-client-form additional fields payload, rejection/decline category (when applicable), privacy-notice-acknowledged-at, is_active, created_at, updated_at.
- **CandidateAttachment**: one record per file attached to a candidate. Attributes: id, candidate id, tenant id, uploader user id, file name, MIME type, size, storage reference, tag, is_obsolete, uploaded_at.
- **CandidateDuplicateLink**: relates a newly created candidate to the existing candidate(s) that triggered a duplicate warning at the time of its creation, so the relationship is preserved for later review.
- **RejectionCategory / DeclineCategory**: tenant-scoped list of labels usable on transitions to Rejected or Declined. Attributes: id, tenant id, label, is_active.
- **CandidateStatusTransition (audit shape)**: append-only record emitted per transition, as described in FR-060. Compatible with the future audit module.
- **CandidateFieldEdit (audit shape)**: append-only record emitted per PII field edit, as described in FR-061. Compatible with the future audit module.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A recruiter can register a typical candidate from empty form to confirmation in under 90 seconds. **Verification**: a dedicated wall-clock benchmark (form render → 201 response, median over ≥10 runs against a representative fixture) — unit / route tests alone cannot assert this.
- **SC-002**: On a tenant with 10,000 active candidates, the candidates list renders the first page and responds to a filter combination (status + client + date range) within 1 second. **Verification**: seeded 10k-row Neon branch + `EXPLAIN ANALYZE` on every list/filter query — no seq-scan allowed; any plan exceeding the budget fails the test.
- **SC-003**: Across the four role combinations, the candidates list shows exactly the set of candidates each role is authorized to see — zero leakage — when verified with a scripted cross-role check.
- **SC-004**: Cross-tenant isolation is verified by an automated check: a request from Tenant A NEVER receives any Tenant B candidate data, attachment data, or audit record, under any endpoint, URL, or parameter combination. **Verification**: mocked service-layer assertions are necessary-but-not-sufficient; this SC is met only when a real-Neon integration test executes RLS policies under `SET LOCAL app.tenant_id` and proves isolation across every tenant-scoped endpoint. Constitution Principle I mandates this depth.
- **SC-005**: 100% of status transitions produce an audit record; spot-checked over 1,000 transitions, every record has all required fields populated. **Verification**: `apps/api/src/modules/candidates/__tests__/audit.sweep.test.ts` randomized FSM-legal sweep asserting every resulting `audit_events` row matches the `candidate.status.changed` shape in contracts §13.
- **SC-006**: An attempted illegal FSM transition is refused and reported with a clear explanatory message in 100% of cases across the full transition matrix.
- **SC-007**: A randomized sample of application logs collected over a 24-hour period contains zero plain-text occurrences of candidate phone, email, or name.
- **SC-008**: A recruiter can find one specific candidate among 10,000 via search in under 3 seconds end-to-end. **Verification**: Playwright E2E timing test at `apps/web/e2e/candidate-search.spec.ts` against the 10k seed — type a unique substring, assert the matching row is visible in under 3 s wall-clock.
- **SC-009**: Duplicate detection correctly identifies 95%+ of (same phone, same client) duplicates at submission time, measured against a labelled test set, without blocking the recruiter from proceeding. **Verification**: labelled fixture at `apps/api/src/modules/candidates/__tests__/fixtures/duplicates.json` (≥200 candidate pairs covering Mexican mobile formats, with/without country code, dashes, parens, dots, spaces, leading +52 vs raw 10-digit) driving `duplicates.recall.test.ts` — ≥95% true-positive recall asserted.

## Assumptions

- The auth module is already in place and every authenticated request carries a verified tenant id and user role.
- The users module exposes user identity (id, display name, role, assigned clients) to the candidates module via its stable public interface.
- The clients module exposes each client's id, display name, assigned account executives, and per-client form configuration (shape and required fields) via its stable public interface. The candidates module consumes this configuration without owning it.
- Audit records defined in FR-060 and FR-061 are persisted in the **existing** `audit_events` table, which is the future audit module's owned table. No module-owned audit store is created and no record migration is required when the audit module ships — the audit module simply takes over query and projection responsibilities.
- Placements, guarantee tracking, terminations, and replacements are out of scope for this module. The states "In Guarantee", "Guarantee Met", "Termination", and "Replacement" remain in the candidate FSM so lifecycle history is complete, but the business logic around the guarantee period (duration, calendar, reminders) lives in the future placements module. The candidates module only stores the current status and its transition history.
- The recruitment domain is Mexico-focused; LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de los Particulares) compliance is the baseline privacy regulation.
- Rejection and decline category defaults are seeded per tenant on tenant provisioning; admins can customize them thereafter.
- Phone number normalization for duplicate detection removes whitespace, dashes, parentheses, and a leading `+` followed by a country code.
- File storage is tenant-isolated at the storage layer (bucket or path prefix); this module relies on that isolation rather than re-implementing it.
- The front end is a single-page application; client-side state and server-side state are reconciled via optimistic-update patterns already established in earlier modules.
- Row-Level Security policies in `0005_candidates_rls.sql` are the safety net for cross-tenant isolation, not the application-level filters. Both application filters AND RLS MUST be verified by at least one real-Neon integration test per tenant-scoped table in this module. Mocked service-layer assertions alone are insufficient to satisfy Constitution Principle I (Multi-Tenant Isolation, NON-NEGOTIABLE).
