# Feature Specification: JWT Authentication Module

**Feature Branch**: `002-jwt-auth-module`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "JWT authentication module with login, token rotation, refresh tokens, role-based middleware, and tenant context resolution for the BePro multi-tenant recruitment platform"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Login (Priority: P1)

A platform user (admin, manager, account executive, or recruiter) opens the BePro application and signs in with their email and password. Upon successful authentication, the system grants them access to the platform. The user's session is bound to their specific tenant (company account), ensuring they only see data belonging to their organization.

**Why this priority**: Login is the foundational capability. Without it, no other feature in the platform can function. Every user interaction begins with authentication.

**Independent Test**: Can be fully tested by submitting valid/invalid credentials and verifying that the user gains or is denied access to the platform.

**Acceptance Scenarios**:

1. **Given** a registered user with valid credentials, **When** they submit their email and password, **Then** the system authenticates them and grants access to the platform with their assigned role and tenant context.
2. **Given** a registered user with an incorrect password, **When** they submit their credentials, **Then** the system rejects the login attempt with a generic error message that does not reveal whether the email exists.
3. **Given** a deactivated user (`is_active: false`), **When** they attempt to log in with correct credentials, **Then** the system rejects the login with the same generic error message as an incorrect password.
4. **Given** a user attempting to log in, **When** they submit an email that does not exist in the system, **Then** the system responds with the same generic error message and takes approximately the same time as a valid-email attempt (to prevent timing-based user enumeration).

---

### User Story 2 - Seamless Session Continuity (Priority: P1)

A user is actively working on the platform when their short-lived access credential expires. The system silently renews their session in the background without interrupting their work. The user continues their task without being forced to log in again. Each renewal generates a new set of credentials, invalidating the previous ones (rotation).

**Why this priority**: Without session renewal, users would be logged out every 15-60 minutes, making the platform unusable for daily work. This is co-equal with login for a functional authentication system.

**Independent Test**: Can be fully tested by simulating an expired access credential and verifying the system transparently issues a new one without user intervention.

**Acceptance Scenarios**:

1. **Given** a user with an expired access credential but a valid refresh credential, **When** the system detects the expiration, **Then** it silently obtains a new access credential and the user's request succeeds without interruption.
2. **Given** a user with both an expired access credential and an expired refresh credential (7+ days inactive), **When** the system attempts renewal, **Then** the user is redirected to the login screen with a message indicating their session has expired.
3. **Given** a refresh credential that has already been used (rotated), **When** an attempt is made to use the old credential, **Then** the system rejects it and invalidates all active sessions for that user (potential credential theft detection).
4. **Given** a successful credential renewal, **When** the new credentials are issued, **Then** the previous refresh credential is invalidated and cannot be reused.

---

### User Story 3 - Role-Based Access Control (Priority: P2)

When a user navigates the platform, the system enforces their role-based permissions on every request. An admin can access all features within their tenant. A manager can supervise teams but cannot manage users or clients. An account executive sees only their assigned clients and the candidates linked to their recruiters. A recruiter sees only their own candidates and cannot change candidate status.

**Why this priority**: Role enforcement is essential for data integrity and security, but it depends on a working login and session system (P1 stories).

**Independent Test**: Can be fully tested by making requests as different roles and verifying each receives only the access their role permits.

**Acceptance Scenarios**:

1. **Given** a logged-in admin, **When** they access any resource within their tenant, **Then** the system allows the request.
2. **Given** a logged-in recruiter, **When** they attempt to access a resource that requires manager-level access, **Then** the system denies the request with a "forbidden" response.
3. **Given** a logged-in account executive, **When** they request candidates, **Then** the system returns only candidates belonging to their assigned clients.
4. **Given** a request with no authentication credentials, **When** it reaches a protected endpoint, **Then** the system rejects it with an "unauthorized" response.
5. **Given** a request with a tampered or malformed credential, **When** it reaches a protected endpoint, **Then** the system rejects it with an "unauthorized" response.

---

### User Story 4 - Tenant Isolation on Every Request (Priority: P2)

Every authenticated request automatically carries the user's tenant identity. The system resolves this identity and scopes all database operations to that tenant, ensuring a user from Tenant A can never read, modify, or even detect the existence of Tenant B's data — regardless of the application logic.

**Why this priority**: Tenant isolation is a non-negotiable security requirement per the platform constitution. It depends on authentication (P1) to provide the tenant identity.

**Independent Test**: Can be fully tested by making concurrent requests from users in different tenants and verifying that no cross-tenant data leakage occurs.

**Acceptance Scenarios**:

1. **Given** a user belonging to Tenant A, **When** they make any request, **Then** all data operations are automatically scoped to Tenant A without the user specifying their tenant.
2. **Given** two users from different tenants making simultaneous requests, **When** both requests are processed, **Then** each user sees only their own tenant's data with no cross-contamination.
3. **Given** a request with a valid credential but a tenant that has been deactivated, **When** the request reaches the system, **Then** it is rejected.

---

### User Story 5 - User Logout (Priority: P3)

A user explicitly signs out of the platform. The system invalidates the current session's refresh credential so it can no longer be used. Other active sessions on different devices remain valid — the user is only logged out from the session where they triggered the action. Concurrent sessions are allowed (e.g., desktop and phone).

**Why this priority**: Logout is important for security but is a lower-frequency action compared to login, session renewal, and access control.

**Independent Test**: Can be fully tested by logging out and verifying that subsequent requests with the old credentials are rejected.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they trigger a logout action, **Then** the system invalidates the current session's refresh credential and the user can no longer make authenticated requests from that session without logging in again.
2. **Given** a user who has logged out from one session, **When** they attempt to use the invalidated session's credentials, **Then** the system rejects the request.
3. **Given** a user logged in on two devices who logs out from device A, **When** they continue using device B, **Then** device B's session remains fully functional.

---

### User Story 6 - Brute-Force Protection (Priority: P3)

The system limits the rate of failed login attempts to prevent automated credential-guessing attacks. After a threshold of failed attempts for a specific account, additional login attempts for that account are temporarily blocked.

**Why this priority**: Important security hardening, but the platform's edge infrastructure provides baseline rate limiting. This story adds application-level protection for the login endpoint specifically.

**Independent Test**: Can be fully tested by sending multiple rapid failed login attempts and verifying the system begins rejecting them.

**Acceptance Scenarios**:

1. **Given** an account that has accumulated 5 failed login attempts within 15 minutes, **When** anyone attempts to log in to that account, **Then** the system rejects the attempt with a "too many attempts" message regardless of whether the credentials are correct.
2. **Given** a temporarily locked account, **When** the lockout period expires (15 minutes), **Then** login attempts for that account are accepted again.
3. **Given** a successful login, **When** counting failed attempts, **Then** the counter resets to zero.

---

### Edge Cases

- What happens when a user's role is changed while they have an active session? The current session retains the old role until the access credential expires (within 15-60 minutes), at which point the renewed credential reflects the updated role.
- What happens when a user is deactivated while they have an active session? The next request that requires credential validation (including renewal) is rejected.
- What happens when a refresh credential is used from a different network or device than the original login? The system accepts it — credential binding by device/IP is not in scope for v1 due to edge deployment constraints.
- What happens when the database is temporarily unavailable during a login attempt? The system returns a generic "service unavailable" error without revealing infrastructure details.
- What happens when two renewal requests arrive simultaneously with the same refresh credential? Only one succeeds; the other receives a rejection. The system handles this race condition gracefully without invalidating the user's session.
- What happens when a user belongs to a tenant that has been deactivated after their credential was issued? The system rejects the request at the tenant resolution step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate users via email and password.
- **FR-002**: System MUST hash stored passwords using a one-way hashing algorithm with a minimum work factor of 12 iterations.
- **FR-003**: System MUST issue a short-lived access credential (15-60 minutes) and a long-lived refresh credential (7 days) upon successful login.
- **FR-004**: System MUST support silent renewal of the access credential using the refresh credential without user interaction.
- **FR-005**: System MUST rotate refresh credentials on every renewal — issuing a new one and invalidating the previous one.
- **FR-006**: System MUST reject reuse of a previously rotated refresh credential and invalidate all active sessions for that user when reuse is detected (theft detection).
- **FR-007**: System MUST include the user's role and tenant identity in the access credential claims.
- **FR-008**: System MUST validate the access credential on every protected request and reject requests with expired, tampered, or missing credentials.
- **FR-009**: System MUST resolve the tenant context from the access credential claims and scope all database operations to that tenant on every request.
- **FR-010**: System MUST enforce role-based access control, allowing or denying requests based on the user's role as defined in the platform role matrix (admin, manager, account_executive, recruiter).
- **FR-011**: System MUST support a `is_freelancer` flag on recruiter accounts that does not change their permissions but marks them for downstream payment tracking.
- **FR-012**: System MUST invalidate only the current session's refresh credential upon logout; other active sessions for the same user MUST remain valid.
- **FR-012a**: System MUST deliver the refresh credential as a secure, httpOnly, SameSite cookie — never in the response body or accessible to client-side scripts.
- **FR-012b**: System MUST enforce CSRF protection on the refresh endpoint, since the credential is sent automatically by the browser as a cookie.
- **FR-013**: System MUST return identical error responses for "user not found" and "wrong password" scenarios to prevent user enumeration.
- **FR-014**: System MUST NOT log personally identifiable information (email, password attempts) in plain text, per LFPDPPP compliance.
- **FR-015**: System MUST enforce a rate limit on failed login attempts — maximum 5 failures per account within a 15-minute window, with a 15-minute lockout.
- **FR-016**: System MUST reject authentication attempts for deactivated users (`is_active: false`) and deactivated tenants.
- **FR-017**: System MUST use constant-time comparison for credential validation to prevent timing attacks.
- **FR-018**: System MUST record authentication events (login success, login failure, token renewal, logout) in the audit trail.

### Key Entities

- **User**: Represents a person who can authenticate with the system. Key attributes: email (unique within tenant), hashed password, role, tenant membership, freelancer flag, active status.
- **Refresh Credential**: Represents a long-lived token used to obtain new access credentials. Key attributes: associated user, expiration, usage status (used/active), family identifier (for rotation tracking).
- **Tenant**: Represents an organization account. Key attributes: identifier, name, active status. Every user belongs to exactly one tenant.
- **Authentication Event**: An audit record of authentication-related actions. Key attributes: event type, associated user (anonymized in logs), timestamp, success/failure status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the login process (from entering credentials to seeing the dashboard) in under 3 seconds.
- **SC-002**: Session renewal happens transparently — 0% of active users are forced to re-login due to access credential expiration during normal use.
- **SC-003**: 100% of requests from User A in Tenant X return zero records belonging to Tenant Y, verified by automated cross-tenant isolation tests.
- **SC-004**: Reuse of a rotated refresh credential triggers immediate session invalidation 100% of the time.
- **SC-005**: All 4 roles (admin, manager, account_executive, recruiter) are correctly enforced — unauthorized actions are blocked with a 0% bypass rate in role-based access tests.
- **SC-006**: Failed login attempts exceeding the threshold are blocked within 1 second, with zero successful logins allowed during the lockout window.
- **SC-007**: No PII appears in any system log output, verified by log audit.

## Clarifications

### Session 2026-04-01

- Q: Brute-force lockout scope — per-IP, per-account, or hybrid? → A: Per-account only. Block login attempts for the specific account after 5 failures within 15 minutes.
- Q: Are concurrent sessions allowed, and does logout invalidate one or all sessions? → A: Concurrent sessions allowed. Logout invalidates only the current session's refresh credential, not all sessions.
- Q: How is the refresh credential delivered and stored — httpOnly cookie or response body? → A: httpOnly cookie (secure, SameSite). Requires CSRF protection. Credential is never accessible to JavaScript.

## Assumptions

- Users will always access the platform via a web browser; native mobile applications are out of scope for v1.
- User accounts are pre-provisioned by an admin — self-registration is not part of this module (covered by the `users` module).
- Password reset / "forgot password" flow is out of scope for this module and will be addressed separately.
- The platform's edge infrastructure provides baseline network-level rate limiting and DDoS protection; this module adds application-level brute-force protection on top.
- A user belongs to exactly one tenant; multi-tenant user access is not supported.
- The refresh credential is delivered and stored as a secure, httpOnly, SameSite cookie. This eliminates XSS exposure of the long-lived credential and requires CSRF protection on the refresh endpoint.
- The `audit` module does not yet exist; this module will define the authentication event structure but the full audit trail integration will be completed when the audit module is built.
- Access credential expiry duration is 15 minutes (decided during technical planning, per research.md R-008). Within the constitution's 15-60 minute range.
