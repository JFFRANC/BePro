# Feature Specification: User Creation with Primary Client Assignment

**Feature Branch**: `010-user-client-assignment`
**Created**: 2026-04-29
**Status**: Draft
**Input**: User description: "Extend the user-creation flow so a primary client can be selected at create time, captured alongside the user as part of a single create action."

## Clarifications

### Session 2026-04-29

- Q: Who can use the create-user flow once it gains the "Cliente" field? → A: Admin only (preserves spec 004's role matrix; the "(or manager)" wording in the original user input is corrected to "admin only").
- Q: Which target roles should the "Cliente" field appear for and write a `client_assignments` row for? → A: Only `account_executive` and `recruiter` (matches the existing batch-flow invariant that rejects admin/manager; manager scoping is a separate future feature).
- Q: What should `accountExecutiveId` be on the new assignment row for a recruiter created via this flow? → A: NULL — the modal does not ask for a "líder" AE; the existing 008 batch flow remains the canonical place to set/change it later. (For an `account_executive` row, `accountExecutiveId` is also NULL — AE rows do not carry their own líder.)
- Q: What error should the server return when the chosen client belongs to a different tenant? → A: Reuse the same `"cliente inactivo o inexistente"` 400 response used for inactive/nonexistent clients — uniform surface, no cross-tenant enumeration leak (consistent with the no-enumeration pattern from feature 009).
- Q: When the server rejects the create request with `"cliente inactivo o inexistente"`, what should the modal do? → A: Auto-refetch the active-clients list and re-render the dropdown, preserving all other entered values; the operator picks again without losing their work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provision an account executive or recruiter with a primary client in one step (Priority: P1)

An administrator opens the "Create user" modal, fills the standard fields (name, email, role), picks a role of *account_executive* or *recruiter* (with or without the freelancer flag), selects a primary "Cliente" from the dropdown of active clients, and submits. The system creates the user **and** records their assignment to that client in a single atomic action.

**Why this priority**: This is the core problem the feature solves. Without it, a freshly created user has no client until an admin runs the existing 008 batch-assignment flow as a second action — a recurring source of friction and partial setup.

**Independent Test**: Sign in as an admin, open the create-user modal, fill in valid data with role *recruiter* and a valid client, submit, and verify the new user appears in the user list AND the chosen client appears as their assignment in the client-assignments view. No extra steps required.

**Acceptance Scenarios**:

1. **Given** an admin viewing the user list, **When** they create a user with role *account_executive* and select an active client "ACME", **Then** the user is created and a single `client_assignments` row links the new user to "ACME" within the same tenant.
2. **Given** the same modal with a recruiter role and a valid client selected, **When** submitted, **Then** the freelancer flag toggle does not affect the assignment behavior — the recruiter is still assigned to the chosen client.
3. **Given** a non-admin operator (manager, account executive, or recruiter), **When** they attempt to open the create-user modal, **Then** the system denies access (matches spec 004's role matrix).

---

### User Story 2 - Newly created recruiter sees only their assigned client and its candidates (Priority: P1)

A recruiter created via this flow logs in for the first time. Their dashboard, candidate list, and any client-scoped views are limited to the single client chosen at creation time, with no setup required.

**Why this priority**: A recruiter without an assigned client cannot do their job at all — they see nothing. Capturing the client at creation time is what makes the user *immediately useful*. If this fails, the feature has not delivered value even though the user record exists.

**Independent Test**: Create a recruiter with client "ACME" via the new flow, then sign in as that recruiter and verify the candidate list and dashboards reflect only "ACME"-scoped data — no further admin action needed.

**Acceptance Scenarios**:

1. **Given** a recruiter user just created with client "ACME", **When** they sign in for the first time, **Then** their candidate list, dashboards, and client filters show "ACME" data only.
2. **Given** the same recruiter, **When** they attempt to register a candidate, **Then** the client field is pre-scoped to "ACME" without manual selection.

---

### User Story 3 - Creating an admin or manager does not require a client (Priority: P2)

An administrator creating another *admin* or a *manager* should not see a "Cliente" field — these roles are not assigned to clients (the existing system explicitly forbids it). The user is created with no assignment row.

**Why this priority**: A tier-2 polish concern: showing the field for admin/manager would confuse the operator and risk creating an assignment row the existing batch flow refuses to manage. The system already supports admin/manager without assignments, so this is about correctness of the modal, not a missing capability.

**Independent Test**: Open the create-user modal, switch role to *admin* (or *manager*), and confirm the "Cliente" field is hidden, the form remains submittable, and no assignment row is written for the new user.

**Acceptance Scenarios**:

1. **Given** the create-user modal, **When** the operator selects role *admin*, **Then** the "Cliente" field is hidden and is not required to submit.
2. **Given** the create-user modal, **When** the operator selects role *manager*, **Then** the "Cliente" field is hidden and is not required to submit.
3. **Given** an admin or manager user just created, **When** an operator opens the assignments view, **Then** the new user has zero rows in `client_assignments`.

---

### User Story 4 - Existing batch-assignment flow continues to work for adding/changing clients later (Priority: P3)

After a user is created with a primary client (or none, in the case of admin or manager), an administrator who needs to add additional clients or change the assignment continues to use the 008 multi-AE batch-assignment flow exactly as before. Nothing in that flow changes.

**Why this priority**: Confidence/regression-prevention story. Multi-client handling and post-creation edits are explicitly out of scope here; the value is that the new flow does not break or reroute the existing one.

**Independent Test**: Use the existing batch-assignment screen on a user created via this new flow and verify it lists their primary assignment and allows adding/removing clients with no behavioral change versus 008.

**Acceptance Scenarios**:

1. **Given** a user created with primary client "ACME", **When** an admin opens the batch-assignment view, **Then** "ACME" appears as a current assignment and additional clients can be added or removed using the existing controls.
2. **Given** the existing batch-assignment screens and operations from feature 008, **When** any of them are performed, **Then** their behavior is unchanged versus before this feature shipped.

---

### Edge Cases

- **E-01 — Duplicate email under concurrency**: Two simultaneous create-user requests share the same email within the same tenant. The existing email-uniqueness rule rejects the second one, and the entire create operation (user plus assignment) rolls back as a unit — no orphan assignment is left behind.
- **E-02 — Client deactivated between modal open and submit**: The client appeared in the dropdown when the modal opened but was deactivated by another admin before submit. The server rejects the request with a clear "cliente inactivo o inexistente" error and no user is created. The modal then auto-refetches the active-clients list, re-renders the dropdown, preserves all other entered values, and lets the operator re-pick without re-typing the user's data.
- **E-03 — Role switched after a client was selected**: The operator picks role *recruiter* and a client, then changes role to *admin* or *manager*. The "Cliente" field disappears and the previously selected value is cleared before submit. Even if a stale client value reaches the system with role *admin* or *manager*, the system tolerates it as a no-op (no assignment written).
- **E-04 — Client deactivated after a recruiter is already assigned**: Out of scope for this feature. The recruiter's existing scoping behavior is unchanged and is owned by other features.
- **E-05 — No active clients exist**: An operator chooses a role that requires a client, but no active clients exist in the tenant. The form prevents submission with a clear message that a client must be created first; no half-created users.
- **E-06 — Non-admin operator attempts the flow**: A user whose role is not *admin* attempts to open the create-user modal or POST a create-user request directly. The system denies access at both the UI guard and the server (consistent with spec 004's role matrix).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The user-creation modal MUST render a "Cliente" field whenever the chosen role is *account_executive* or *recruiter* (regardless of the freelancer flag), and MUST hide the field when the role is *admin* or *manager*.
- **FR-002**: The "Cliente" field MUST be required when the role is *account_executive* or *recruiter*, validated at the form layer before the request is sent.
- **FR-003**: When the create-user request includes a primary client, the system MUST persist the user record AND a single `client_assignments` row in one atomic operation, with `accountExecutiveId` set to NULL on that row regardless of role (for an account executive the row represents themselves on the client; for a recruiter, the líder AE is set later via the existing batch flow). If either write fails, neither MUST be persisted.
- **FR-004**: The system MUST verify that the chosen client belongs to the same tenant and is currently active. If it does not — for any reason (inactive, soft-deleted, nonexistent, or belonging to a different tenant) — the request MUST be rejected with HTTP 400 and the message "cliente inactivo o inexistente", and no records MUST be created. The error wording MUST NOT differentiate cross-tenant from same-tenant-inactive cases (no enumeration leak).
- **FR-005**: When the role is *admin* or *manager*, the system MUST ignore any client value submitted with the request and MUST NOT create an assignment row. This is treated as a defensive no-op rather than a validation failure, consistent with the existing batch-flow invariant that admin/manager are not assignable to clients.
- **FR-006**: The audit event already emitted when a user is created MUST include the assigned client identifier when one was captured. When no client was captured (admin or manager role), the field MUST be absent or null.
- **FR-007**: The "Cliente" field options MUST be populated from the same source of active clients used elsewhere in the application, so that activation/deactivation of clients is reflected without manual sync. When the server rejects a submission with the "cliente inactivo o inexistente" error, the modal MUST auto-refetch this list and re-render the dropdown while preserving all other entered field values, so the operator can re-pick without re-entering data.
- **FR-008**: The existing post-creation batch-assignment flow (used to add/remove additional client assignments after a user already exists) MUST continue to behave identically — no changes to its endpoints, payload shape, or screens.
- **FR-009**: Access to the create-user flow MUST be limited to operators with role *admin* (per spec 004). The "Cliente" dropdown MUST list every active client in the operator's tenant, and the server MUST reject any submission whose chosen client is not active or not in the same tenant — using the uniform "cliente inactivo o inexistente" error per FR-004.
- **FR-010**: Tenant isolation MUST hold across both writes: the user, the assignment, and the audit event are all stamped with the same tenant; no cross-tenant data is reachable from this flow under any combination of inputs.

### Key Entities *(include if feature involves data)*

- **User**: The newly created member of the tenant. Carries name, email, role, freelancer flag, active flag, and tenant scope. Existing entity; no new fields required for this feature.
- **Client**: A client company within the tenant. The dropdown lists only active clients in the operator's scope. Existing entity; read-only here.
- **Client Assignment**: An association between a user and a client within a tenant. May optionally carry a `accountExecutiveId` indicating the recruiter's líder AE on that client; this feature always writes that field as NULL — the líder is set later via the existing batch flow when needed. This feature creates at most one assignment row per new user-creation request. Existing entity; no new columns required.
- **Audit Event**: Append-only record of the user-creation action. Extended in this feature to optionally carry the assigned client identifier.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with a primary client can be fully provisioned in a single modal submission. The number of operator actions required to provision a client-scoped user drops from 2 (create user, then run batch assignment) to 1.
- **SC-002**: For at least 95% of newly created client-scoped users, the assignment row exists immediately after the create request returns success — verified by the assignment being visible in the assignments view without any subsequent admin action.
- **SC-003**: Zero half-created users exist as a result of this flow. When a client validation fails or the assignment write fails, the user record is also absent.
- **SC-004**: A recruiter created through this flow can sign in and see their client's candidate list on first login with no further setup, measured as time-to-first-useful-screen of under 30 seconds from account creation handoff.
- **SC-005**: No regressions in the existing post-creation batch-assignment flow: every prior acceptance scenario for that flow continues to pass after this feature ships.
- **SC-006**: No cross-tenant leakage: in adversarial scenarios where an operator submits a `clientId` belonging to another tenant, the request is rejected and no assignment is written.

## Assumptions

- The "primary client" captured here represents a *first* client assignment, not a special "primary" flag — the existing assignments model treats all assignments equally, and adding extra clients later via the existing batch flow remains the way to scale beyond one client. The new assignment row never carries a líder (`accountExecutiveId` is always NULL on creation); pairing recruiters with a líder AE is handled exclusively by the existing batch flow.
- The roles eligible for a client at creation time are exactly *account_executive* and *recruiter* (with or without the freelancer flag), matching the existing batch-flow invariant that rejects admin/manager. Manager scoping to clients is explicitly out of scope and would be its own feature.
- Tenants always have at least one active client by the time client-scoped users are created. If they do not, the form gracefully blocks submission and points the operator to create a client first.
- The list of active clients fits comfortably in a single dropdown for typical tenants. Pagination or search inside the dropdown is not required for v1.
- Auditing of user creation is already in place; this feature only enriches the existing audit payload, not its trigger or storage.
- The 008 batch-assignment flow is the canonical place to add/remove/change assignments after creation. Editing the primary client through this new modal post-creation is explicitly out of scope.
- Bulk user import is out of scope; this feature only addresses the interactive single-user create modal.
