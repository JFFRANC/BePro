# Feature Specification: Users Module — User CRUD, Role Assignment, and Profile Management

**Feature Branch**: `004-users-module`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Users Module — User CRUD, Role Assignment, and Profile Management within Tenant. Build the users module for BePro's multi-tenant recruitment platform."

## Clarifications

### Session 2026-04-13

- Q: Should the system force a password change on first login and after admin reset? → A: Yes — force password change on first login and after admin reset (adds `mustChangePassword` flag).
- Q: Can an admin change a user's email after creation? → A: No — email is immutable after creation. Deactivate and recreate if needed.
- Q: Should bulk user import be included in this module's scope? → A: Yes — include bulk import (upload file with multiple users) to support migration from existing Google Sheets system.
- Q: What language should the user-facing interface use? → A: Spanish-only UI — all labels, error messages, buttons, and user-facing text in Spanish.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates a New User (Priority: P1)

An administrator needs to add new team members to the platform so they can begin working. The admin navigates to the user management section, fills in the new user's details (email, name, role, freelancer status), and sets an initial password. The system validates that the email is unique within the tenant, securely stores the password, and records the creation in the audit trail.

**Why this priority**: This is the foundational capability. Without user creation, no other user management feature has value. Every tenant needs at least one admin, and that admin needs to onboard the rest of the team.

**Independent Test**: Can be fully tested by creating a user via the admin interface and verifying the user appears in the system with the correct role and can log in.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they submit a valid user creation form with email, name, role, and password, **Then** the system creates the user, displays a success confirmation, and the new user can log in.
2. **Given** an authenticated admin, **When** they attempt to create a user with an email that already exists in the tenant, **Then** the system rejects the request and displays an inline error indicating the email is already in use.
3. **Given** an authenticated admin, **When** they submit the form with an invalid email format or a password that does not meet strength requirements, **Then** the system displays specific validation errors for each field.
4. **Given** a user with role manager, account executive, or recruiter, **When** they attempt to access the user creation form, **Then** the system denies access.
5. **Given** an authenticated admin, **When** they successfully create a user, **Then** the system records an audit event capturing who created the user, when, and what role was assigned.
6. **Given** a newly created user, **When** they log in for the first time with the admin-provided password, **Then** the system redirects them to a mandatory password change screen before granting access to any other part of the application.

---

### User Story 2 - Admin Browses and Searches the User Directory (Priority: P2)

An administrator or manager needs to view all users in their organization to monitor team composition, find specific people, or identify inactive accounts. They open the user list, which shows all users with their name, email, role, status, and last login date. They can search by name or email, filter by role or active status, and navigate through pages of results.

**Why this priority**: Visibility over the team is the second most important need. Admins and managers must be able to see who has access before they can manage, update, or deactivate anyone.

**Independent Test**: Can be fully tested by loading the user list with pre-existing users and verifying search, filter, and pagination all return correct results.

**Acceptance Scenarios**:

1. **Given** an authenticated admin or manager, **When** they open the user directory, **Then** the system displays a paginated list of all users in their tenant showing name, email, role, freelancer badge, active status, and last login date.
2. **Given** a user list with 50 users, **When** the admin types a partial name or email in the search bar, **Then** the list filters in real-time to show only matching users.
3. **Given** a user list, **When** the admin selects a role filter (e.g., "recruiter"), **Then** only users with that role are displayed.
4. **Given** a user list, **When** the admin toggles the "show inactive" filter, **Then** deactivated users are included or excluded accordingly.
5. **Given** an authenticated admin or manager, **When** they click on a user in the list, **Then** the system shows the full user detail view.

---

### User Story 3 - Admin Updates User Profile and Role (Priority: P3)

An administrator needs to modify a team member's information — for example, correcting a name, changing their role after a promotion, or toggling their freelancer status. The admin opens the user detail, makes changes, and saves. The system validates changes, applies them, and records the modification in the audit trail with both old and new values.

**Why this priority**: Role changes and profile corrections are frequent administrative tasks. Getting this wrong has security implications (wrong role = wrong access level), so it must be reliable and audited.

**Independent Test**: Can be fully tested by updating a user's role and verifying the change persists, the user's access level changes accordingly, and an audit record is created.

**Acceptance Scenarios**:

1. **Given** an authenticated admin viewing a user's profile, **When** they change the user's role from "recruiter" to "account_executive" and save, **Then** the system updates the role, and the user's permissions change on their next request.
2. **Given** an authenticated admin, **When** they update a user's name, **Then** the new name appears everywhere in the system.
3. **Given** an authenticated admin, **When** they toggle the freelancer flag on a recruiter, **Then** the system records the change for payment tracking purposes.
4. **Given** any profile update by an admin, **When** the save completes, **Then** the system records an audit event with the previous and new values for each changed field.
5. **Given** a non-admin user, **When** they attempt to change another user's role or profile, **Then** the system denies the action.

---

### User Story 4 - User Manages Their Own Profile and Password (Priority: P4)

Any authenticated user needs to view their own profile information and update their name. They also need to change their own password for security hygiene. When changing their password, the system requires the current password for verification before accepting the new one, and invalidates all other active sessions.

**Why this priority**: Self-service reduces admin burden and is a security best practice. Users should be able to change their password without involving an administrator.

**Independent Test**: Can be fully tested by a logged-in user editing their name and changing their password, then verifying they can log in with the new password and old sessions are invalidated.

**Acceptance Scenarios**:

1. **Given** an authenticated user (any role), **When** they navigate to their profile, **Then** the system displays their name, email, role, and freelancer status (email and role are read-only for non-admins).
2. **Given** an authenticated user, **When** they update their first name or last name and save, **Then** the changes are persisted and reflected immediately across the application.
3. **Given** an authenticated user, **When** they submit a password change with a correct current password and a valid new password, **Then** the system updates the password and invalidates all other active sessions.
4. **Given** an authenticated user, **When** they submit a password change with an incorrect current password, **Then** the system rejects the request with a clear error message.
5. **Given** an authenticated user, **When** they submit a new password that does not meet strength requirements (minimum 8 characters, mixed case, at least one number), **Then** the system displays specific validation errors.
6. **Given** a password change event, **When** the system processes it, **Then** an audit event is recorded (without logging the actual password values).

---

### User Story 5 - Admin Deactivates and Reactivates Users (Priority: P5)

When a team member leaves the company or should no longer have access, an administrator needs to deactivate their account. This must prevent login and revoke all active sessions immediately, but must never delete the user record (data protection compliance). Later, if the person returns, the admin can reactivate the account.

**Why this priority**: Timely deactivation is critical for security (revoke access when someone leaves). Data protection law (LFPDPPP) prohibits hard deletion of personal data, so this must be a soft operation.

**Independent Test**: Can be fully tested by deactivating a user and verifying they cannot log in, then reactivating and verifying access is restored.

**Acceptance Scenarios**:

1. **Given** an authenticated admin viewing a user's detail, **When** they click "Deactivate" and confirm the action, **Then** the system sets the user as inactive, immediately revokes all their active sessions, and the deactivated user can no longer log in.
2. **Given** an authenticated admin, **When** they attempt to deactivate their own account, **Then** the system prevents the action with a clear explanation (an admin cannot lock themselves out).
3. **Given** a deactivated user in the directory, **When** the admin clicks "Reactivate" and confirms, **Then** the user's account is restored and they can log in again.
4. **Given** a deactivation or reactivation event, **When** the action completes, **Then** the system records an audit event capturing who performed the action and when.
5. **Given** a non-admin user, **When** they attempt to deactivate or reactivate another user, **Then** the system denies the action.

---

### User Story 6 - Admin Resets Another User's Password (Priority: P6)

When a team member forgets their password or is locked out, an administrator can reset their password. The admin sets a new temporary password, which the user will use to log in. All the user's existing sessions are revoked for security.

**Why this priority**: This is a support tool for admins. Less frequent than self-service password change, but critical when users are locked out and the organization doesn't use email-based recovery.

**Independent Test**: Can be fully tested by an admin resetting a user's password, then verifying the user can log in with the new password and old sessions are invalidated.

**Acceptance Scenarios**:

1. **Given** an authenticated admin viewing a user's detail, **When** they choose "Reset Password", enter a new password meeting strength requirements, and confirm, **Then** the system updates the user's password, revokes all their active sessions, and flags the account for a mandatory password change on next login.
2. **Given** an admin resetting a password, **When** the new password does not meet strength requirements, **Then** the system displays validation errors.
3. **Given** a password reset event, **When** the action completes, **Then** an audit event is recorded (without logging the actual password).
4. **Given** a non-admin user, **When** they attempt to reset another user's password, **Then** the system denies the action.

---

### User Story 7 - Account Executive Views Assigned Recruiters (Priority: P7)

An account executive manages specific clients and works with a subset of recruiters. When they access the user directory, they should only see the recruiters who are assigned to them — not the full team. This ensures appropriate data boundaries based on organizational structure.

**Why this priority**: This is the most complex access control rule and depends on the concept of "assignment" between account executives and recruiters. It is lower priority because it requires the clients module to define assignments. For MVP, account executives can see all recruiters in the tenant.

**Independent Test**: Can be fully tested by logging in as an account executive and verifying only assigned recruiters appear in their user directory view.

**Acceptance Scenarios (MVP)**:

1. **Given** an authenticated account executive, **When** they open the user directory, **Then** they see all recruiters in the tenant (assignment-based filtering deferred to clients module).
2. **Given** an authenticated account executive, **When** they attempt to view the detail of a non-recruiter user, **Then** the system denies access.
3. **Given** an authenticated recruiter, **When** they access the user directory, **Then** they see only their own profile.

> **Post-MVP**: When the clients module (005) establishes AE-to-recruiter assignments, scenario 1 will be refined so AEs see only their assigned recruiters.

---

### User Story 8 - Admin Imports Users in Bulk (Priority: P3)

When onboarding a new tenant or migrating from the existing Google Sheets system, an administrator needs to create many users at once. The admin uploads a structured file (CSV or spreadsheet) containing rows of user data (email, first name, last name, role, freelancer flag). The system validates every row, reports errors for invalid entries, and creates all valid users in a single operation. Each imported user is flagged for a mandatory password change on first login, and the admin receives a temporary auto-generated password for each user to distribute.

**Why this priority**: BePro is replacing a Google Sheets-based workflow. Without bulk import, onboarding an entire recruitment team would require creating users one by one — impractical for a real migration. This is critical for initial adoption.

**Independent Test**: Can be fully tested by uploading a file with a mix of valid and invalid rows, verifying valid users are created and invalid rows produce clear error reports.

**Acceptance Scenarios**:

1. **Given** an authenticated admin, **When** they upload a CSV file with 10 valid user rows (email, first name, last name, role, freelancer flag), **Then** the system creates all 10 users, each flagged for mandatory password change, and returns a summary with the temporary password for each user.
2. **Given** a CSV file with 3 valid and 2 invalid rows (e.g., duplicate email, missing required field), **When** the admin uploads the file, **Then** the system creates the 3 valid users and returns a clear error report identifying the 2 failed rows with specific reasons.
3. **Given** a CSV file where one row has an email that already exists in the tenant, **When** the admin uploads the file, **Then** that row is rejected with a "duplicate email" error while other valid rows are still created.
4. **Given** a CSV file with more than 100 rows, **When** the admin uploads it, **Then** the system rejects the file with a message indicating the maximum batch size (100 users per upload).
5. **Given** a successful bulk import, **When** the import completes, **Then** the system records an audit event for each created user, and all new users appear in the user directory.
6. **Given** a non-admin user, **When** they attempt to access the bulk import feature, **Then** the system denies access.

---

### Edge Cases

- What happens when the last admin in a tenant is deactivated? The system must prevent this — a tenant must always have at least one active admin.
- What happens when an admin changes their own role to a non-admin role? The system must prevent this if they are the last admin.
- What happens when a user whose profile is being edited logs in simultaneously? The profile changes take effect on their next authenticated request.
- What happens when a user changes their password while logged in on multiple devices? All other sessions are immediately invalidated; only the session that initiated the password change remains active.
- What happens when two admins try to edit the same user simultaneously? The last save wins, and both audit events are recorded.
- What happens when a deactivated user's refresh token is used? The system rejects the token and returns an authentication error.
- How does the system handle an email that is unique within this tenant but exists in another tenant? This is allowed — email uniqueness is scoped to the tenant, not globally.
- What happens when a user's real-world email changes (name change, company rebrand)? The admin deactivates the old account and creates a new one. Email is immutable — it serves as the permanent user identifier within the tenant.
- What happens when a bulk import file is empty or has only headers? The system rejects the file with a clear error message.
- What happens when a bulk import file has columns in the wrong order or missing headers? The system validates the header row and rejects the file with a message indicating expected format.
- What happens when a bulk import contains duplicate emails within the same file? The first occurrence is created; subsequent duplicates in the same file are rejected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow admins to create new users within their tenant by providing email, first name, last name, role, freelancer status, and an initial password.
- **FR-002**: System MUST enforce email uniqueness per tenant — duplicate emails within the same tenant are rejected with a clear error.
- **FR-026**: System MUST treat email as immutable after user creation. Email cannot be changed by any role. If a user's email needs to change, the admin must deactivate the account and create a new one.
- **FR-003**: System MUST validate password strength on creation and change: minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number.
- **FR-004**: System MUST store passwords using a secure one-way hash (never in plain text, never reversible).
- **FR-005**: System MUST display a paginated user directory for admins and managers, with the ability to search by name or email and filter by role, active status, and freelancer flag.
- **FR-006**: System MUST support pagination for the user list with a configurable page size (default 20 users per page).
- **FR-007**: System MUST allow admins to update any user's first name, last name, role, and freelancer status.
- **FR-008**: System MUST allow any authenticated user to update their own first name and last name.
- **FR-009**: System MUST restrict role changes to admins only — no other role can modify a user's role.
- **FR-010**: System MUST allow admins to deactivate users (soft delete), which immediately prevents login and revokes all active sessions for that user.
- **FR-011**: System MUST prevent an admin from deactivating themselves.
- **FR-012**: System MUST prevent deactivation or role change of the last active admin in a tenant.
- **FR-013**: System MUST allow admins to reactivate previously deactivated users.
- **FR-014**: System MUST allow any authenticated user to change their own password after verifying their current password.
- **FR-015**: System MUST revoke all other active sessions when a user changes their password (only the current session remains).
- **FR-016**: System MUST allow admins to reset any other user's password, which revokes all of that user's active sessions.
- **FR-027**: System MUST allow admins to upload a CSV file to create multiple users in a single operation. The CSV must contain columns: email, first name, last name, role, freelancer flag (true/false).
- **FR-028**: System MUST validate every row in a bulk import file independently — valid rows are created, invalid rows are reported with specific error reasons. Partial success is allowed.
- **FR-029**: System MUST enforce a maximum batch size of 100 users per bulk import upload.
- **FR-030**: System MUST generate a temporary password for each user created via bulk import and return it to the admin in the import results. Each imported user is flagged for mandatory password change on first login.
- **FR-031**: System MUST validate the CSV header row and reject files with missing or unrecognized columns before processing any data rows.
- **FR-032**: System MUST reject duplicate emails within the same import file (first occurrence wins, subsequent duplicates are reported as errors).
- **FR-033**: All user-facing text (labels, buttons, error messages, validation messages, confirmation dialogs, empty states) MUST be in Spanish. No internationalization framework is required — hardcoded Spanish strings are acceptable.
- **FR-025**: System MUST flag newly created users and users whose password was reset by an admin for a mandatory password change on their next login. The user cannot access any other functionality until they set a new password. (Enforced at the UI layer — see research.md Decision 4.)
- **FR-017**: System MUST never hard-delete user records — deactivation uses a soft-delete flag (LFPDPPP compliance).
- **FR-018**: System MUST record an audit event for every user mutation: creation, profile update, role change, deactivation, reactivation, password change, and password reset. Audit events capture who performed the action, when, and the before/after values of changed fields (excluding password values).
- **FR-019**: System MUST track each user's last login timestamp, updated automatically upon successful authentication.
- **FR-020**: System MUST enforce role-based visibility: admins and managers see all users; account executives see only assigned recruiters; recruiters see only their own profile.
- **FR-021**: System MUST never log passwords or personally identifiable information (email, names) in plain text in application logs.
- **FR-022**: System MUST ensure all user data is scoped to the tenant — no user in one tenant can view or modify users in another tenant.
- **FR-023**: System MUST display a confirmation dialog before destructive actions (deactivation, password reset).
- **FR-024**: System MUST show the user's last login date in the user directory and detail views.

### Key Entities

- **User**: A person with access to the platform within a specific tenant. Key attributes: email (unique per tenant), first name, last name, role (admin, manager, account executive, recruiter), freelancer flag, active status, must-change-password flag, last login timestamp. Belongs to exactly one Tenant.
- **Tenant**: The organization that owns the user. Users cannot exist without a tenant. Each tenant has its own isolated set of users.
- **Audit Event**: An immutable record of a change made to a user. Captures the actor (who), action (what), timestamp (when), and changed values (old/new). Passwords are never included in audit data.
- **Session (Refresh Token)**: Represents an active login session. Multiple sessions can exist per user (multi-device). Deactivation and password changes revoke all sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create a new user in under 1 minute, and that user can log in immediately.
- **SC-002**: An admin can find any user in a 100+ person tenant within 10 seconds using search or filters.
- **SC-003**: The user directory loads the first page of results in under 2 seconds, even with 500 users in the tenant.
- **SC-004**: Every user mutation (create, update, deactivate, reactivate, password change, password reset) produces a verifiable audit trail entry.
- **SC-005**: A deactivated user cannot access any part of the system — login is rejected, and any existing session is immediately invalid.
- **SC-006**: Users from Tenant A can never see or modify users belonging to Tenant B, verified through automated isolation tests.
- **SC-007**: 100% of password changes and resets successfully invalidate all other active sessions for the affected user.
- **SC-008**: The last remaining admin in a tenant cannot be deactivated or have their role changed, preventing tenant lockout.
- **SC-009**: An admin can import 50 users via CSV in under 30 seconds, with a clear report of successes and failures.

## Assumptions

- The authentication module (002-jwt-auth-module) is fully operational and provides JWT-based login, refresh token rotation, role-based middleware, and tenant resolution.
- The user database table already exists with all required columns (created in the auth module migration). Only the `lastLoginAt` column needs to be added.
- Email-based account recovery (forgot password via email link) is out of scope for this module. Password resets are admin-initiated only.
- Account executive-to-recruiter assignment depends on the clients module (not yet built). For MVP, the scoped visibility rule (User Story 7) will be implemented with a simplified approach: account executives see all recruiters in the tenant until the assignment relationship is established by the clients module.
- The audit event infrastructure is a lightweight, service-level helper for this module. A full audit module (007) will be built later and will subsume this helper.
- There is no self-registration. All users are created by an admin.
- The user list frontend page is accessible via the main application navigation, gated by role (admin and manager only).
- Password strength requirements (8+ chars, mixed case, number) are sufficient for the current user base and may be strengthened later.
- The user interface is Spanish-only. All user-facing labels, messages, and text are in Spanish. Internationalization (i18n) is not needed for this module.
