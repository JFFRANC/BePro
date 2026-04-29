# Feature Specification: Password Reset (Self-Service)

**Feature Branch**: `009-password-reset`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description: "Build a password-reset flow for any active user via tokenized email link, sent from the Worker through a transactional email provider, with rate-limit, audit, refresh-token revocation on success, and Spanish-language UX."

## Clarifications

### Session 2026-04-28

- Q: How does the request endpoint resolve users when the same email exists in multiple tenants? → A: Email addresses must be globally unique across all tenants — the platform must not allow the same email to exist in more than one tenant. The request endpoint can therefore resolve a single user by `email` alone, with no tenant disambiguation.
- Q: Does a successful reset clear the brute-force lockout for that user? → A: Yes — on successful reset, the same transaction clears both `failedLoginAttempts` and `lockedUntil` for that user. Proving ownership of the email is a stronger authentication signal than the failed-password attempts the lockout was protecting against.
- Q: What is the retention policy for `password_reset_tokens` rows after they're used or expired? → A: A daily cleanup cron hard-deletes any row where `used_at IS NOT NULL` OR `expires_at < now()`. Pre-auth artifacts are ephemeral; canonical forensic history lives in `audit_events` (FR-011).
- Q: On the reset page, when does the token get validated? → A: Only on submit. There is no separate "verify" endpoint — the page renders the password form unconditionally, and the existing `confirm` endpoint returns the generic `400` if the token is invalid. The page renders that response as the inline Spanish expired/used message together with a "Solicitar otro enlace" button that returns to `/forgot-password`.
- Q: How does email transport behave in non-production environments (dev / preview / CI)? → A: `EmailService` is environment-aware. If `RESEND_API_KEY` is present, send via Resend. If it is absent, log a structured `email.suppressed` event with the recipient and the reset URL and skip the network call. The public response remains `200` either way. This prevents preview-branch deploys from accidentally emailing real users while keeping the developer signal visible in Worker tail logs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reset my password from the login page (Priority: P1)

An active user has forgotten their password. From the login page they click a "¿Olvidaste tu contraseña?" link, enter their email, receive a Spanish-language email with a reset link valid for 30 minutes, click the link, set a new password meeting the strength policy, and land on their dashboard already authenticated. No support ticket, no admin intervention.

**Why this priority**: This is the entire reason the feature exists. Without it, support has to manually reset passwords, which is slow, breaks the audit trail, and leaks human-in-the-loop liability under LFPDPPP. Shipping just this story (with stories 2 and 3, which are inseparable from it for security) is already a complete MVP.

**Independent Test**: A QA user with a known email completes the full flow against a stubbed email transport and ends up on the dashboard with a valid session, without needing any other story to be built.

**Acceptance Scenarios**:

1. **Given** I am an active user with a registered email, **When** I submit my email on `/forgot-password`, **Then** the page shows a confirmation message in Spanish that an email "ha sido enviado si la cuenta existe" and a reset email is dispatched to my inbox.
2. **Given** I have just received a reset email, **When** I click the link inside the 30-minute window and submit a new password that meets the complexity policy, **Then** I am redirected to `/` (dashboard) as an authenticated user with a fresh session.
3. **Given** I successfully complete the reset, **When** I check my email shortly afterward, **Then** the original reset link no longer works (single-use).

---

### User Story 2 — No email enumeration (Priority: P1)

An attacker probes the reset endpoint with a list of emails to discover which ones belong to real users. The system's response is identical — same status code, same message, same response time band — whether or not the email matches a real active user.

**Why this priority**: Email enumeration directly weaponizes any future credential-stuffing or phishing campaign, and this requirement constrains the shape of the public endpoint, so it must ship together with story 1. It is non-negotiable for the public release.

**Independent Test**: Hit the request endpoint 100 times with a mix of real and fake emails; the response payloads, status codes, and observed latency distributions are statistically indistinguishable.

**Acceptance Scenarios**:

1. **Given** an email that does not correspond to any user, **When** the request endpoint is called, **Then** the API returns `200` with the same Spanish confirmation copy used for valid emails and no email is sent.
2. **Given** an email that corresponds to a deactivated user, **When** the request endpoint is called, **Then** the API returns `200`, no email is sent, and no additional information is leaked.
3. **Given** repeated probes with valid and invalid emails, **When** response timing is measured, **Then** the timing does not let an observer classify which emails exist.

---

### User Story 3 — Token lifecycle is short and single-use (Priority: P1)

Reset tokens are time-bounded and become useless the moment they are consumed or superseded. If a user requests a second reset email, only the most recent token works. If a user uses a token, it cannot be replayed.

**Why this priority**: Long-lived or reusable tokens turn a leaked email into a permanent backdoor. The behavior must be in the first release.

**Independent Test**: Generate two tokens for the same account in sequence; only the second succeeds. Use a token successfully; a second use of the same token fails. Wait past 30 minutes; the token fails.

**Acceptance Scenarios**:

1. **Given** I requested a reset 31 minutes ago, **When** I open the link, **Then** the reset page shows "el enlace ha expirado, solicita uno nuevo" and refuses to set a password.
2. **Given** I successfully reset my password, **When** I (or anyone) reuses the same link, **Then** the page shows the same expired/used message — no detail leaks about whether it was used vs. expired.
3. **Given** I requested two reset emails in a row, **When** I click the older link, **Then** it is rejected with the same expired/used message and only the newest link works.

---

### User Story 4 — Rate-limit prevents abuse as an email blaster (Priority: P2)

The public request endpoint cannot be turned into a free Spanish-language transactional email pipeline aimed at an unwitting victim. Per-email throttles cap how often anyone can trigger emails to a given address.

**Why this priority**: This is a defensive control that mitigates abuse but does not block the core happy path. It can ship in the same release without being a launch blocker — if rate-limit ships a day late, story 1 still works.

**Independent Test**: Issue two requests for the same email within 60 seconds; the second is throttled. Issue six requests for the same email within an hour; the sixth is throttled. The throttle response shape does not differentiate real from fake emails.

**Acceptance Scenarios**:

1. **Given** I just requested a reset for `juan@ejemplo.com`, **When** a second request for the same email arrives within 60 seconds, **Then** the system silently absorbs the second request (still returns `200`) without sending another email.
2. **Given** five reset requests for the same email have been accepted in the last hour, **When** a sixth arrives, **Then** the system silently absorbs it without sending another email.
3. **Given** the per-email throttle is active, **When** a request for a different email arrives, **Then** it is processed normally.

---

### User Story 5 — Successful reset kills any attacker session (Priority: P2)

A user resetting because they suspect their account was compromised expects all previously issued sessions on their account to stop working immediately. After a successful reset, every refresh token tied to that account is revoked, and any attacker holding a stolen session is forced back to the login screen the next time their access token expires.

**Why this priority**: This protects the most sensitive use of the feature (compromise recovery) but is not required for the basic "I forgot my password" path to work end-to-end.

**Independent Test**: Sign in on two browsers (A and B). From browser A, complete the reset flow. Browser B's existing session refresh attempt fails with an auth error.

**Acceptance Scenarios**:

1. **Given** I have an active session in another browser, **When** I successfully reset my password, **Then** that other session can no longer refresh and is forced back to the login screen.
2. **Given** I successfully reset my password, **When** I check my account, **Then** I have a brand-new session (new access + refresh tokens) issued at reset time.

---

### User Story 6 — Audit trail for every request and every reset (Priority: P3)

Compliance can later answer the question "did this user reset their own password, and when?" by inspecting the audit trail. Every reset request and every successful reset is recorded with `user_id`, timestamp, and outcome, but never the email body, the new password, or any other PII beyond what is already in `audit_events`.

**Why this priority**: Required for LFPDPPP defensibility, but the rest of the flow can be observed and validated even without the audit rows during initial integration testing.

**Independent Test**: Trigger the request endpoint and the confirm endpoint for a known user; query `audit_events` and find one `password_reset_requested` and one `password_reset_completed` row referencing that `user_id`, with no PII in the payload.

**Acceptance Scenarios**:

1. **Given** a reset request is accepted for an active user, **When** the request completes, **Then** an `audit_events` row of type `password_reset_requested` is written referencing only the `user_id`.
2. **Given** a reset confirm succeeds, **When** the confirmation completes, **Then** an `audit_events` row of type `password_reset_completed` is written referencing only the `user_id`.
3. **Given** a reset request is accepted for a non-existent or deactivated email, **When** the request completes, **Then** no audit row is created (no enumeration via the audit table).

---

### Edge Cases

- **Token expired (past 30 min)**: Reset page shows "el enlace ha expirado, solicita uno nuevo" and the confirm endpoint returns a generic `400`.
- **Token already used**: Same generic `400` and same Spanish copy as expired — the system MUST NOT differentiate "used" from "expired" to a caller.
- **User deactivated between request and confirm**: Confirm endpoint returns the same generic `400`; no new session issued, no password change applied.
- **Email transport failure (e.g., provider 5xx)**: Failure is logged server-side without leaking the email address; the public response is still `200` with the same Spanish copy. The user simply does not receive an email; they may request again subject to rate limits.
- **Multiple pending tokens for the same user**: Issuing a new token invalidates all earlier non-used tokens for that user. Only the most recent token can succeed.
- **User changes their email between request and confirm**: Token remains bound to the original `user_id` (not the email), so the link still works for that user.
- **Reset link opened on a device with no active session**: Flow proceeds normally; user is signed in directly upon successful reset.
- **Reset link opened while already signed in as a different user**: The active session is replaced by the session for the user identified by the token (the reset is the authoritative action).
- **Brand-new user who has never logged in**: Same flow works — a valid active user is enough; prior login history is not required.
- **User was locked out by failed login attempts before requesting reset**: Successful reset clears the lockout (`failedLoginAttempts = 0`, `lockedUntil = NULL`) in the same transaction, so the user is signed in immediately without having to wait out the lockout window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a public endpoint that accepts an email address (no tenant context) and triggers a password-reset email **if and only if** the email belongs to an active user, while always returning the same successful response shape regardless of outcome. Email-to-user resolution is unambiguous because emails are globally unique across tenants (see FR-015).
- **FR-015**: The platform MUST guarantee that an email address belongs to at most one user across all tenants. This invariant is a precondition for the email-only request endpoint and MUST be enforced at the schema level (a global unique constraint on `users.email`) before this feature ships.
- **FR-002**: The system MUST expose a public endpoint that accepts a reset token and a new password, validates the token, sets the new password, and — on success — establishes an authenticated session with the same response shape as the regular login endpoint.
- **FR-003**: Reset tokens MUST expire 30 minutes after issuance and MUST become invalid immediately after a single successful use.
- **FR-004**: Issuing a new reset token for a user MUST invalidate all previous non-consumed tokens for that user.
- **FR-005**: Reset tokens MUST be stored only as a one-way hash; the plaintext token MUST exist only inside the email and be compared via constant-time comparison on the server.
- **FR-006**: The system MUST send the reset email in Spanish (HTML + plain-text fallback) with a link of the form `${APP_URL}/reset-password?token=…` and MUST NOT include the user's password, password hash, or other sensitive PII beyond the addressee's email and full name.
- **FR-007**: The web app MUST provide a `/forgot-password` page (email input + Spanish copy + confirmation state) and a `/reset-password?token=…` page (new password + confirm password + strength feedback). The reset page MUST render the password form unconditionally (no pre-validation round-trip) and only validate the token on submit; on a `400` from the confirm endpoint it MUST render the generic Spanish expired/used message inline together with a "Solicitar otro enlace" button that navigates to `/forgot-password`. The login page MUST link to `/forgot-password` via "¿Olvidaste tu contraseña?".
- **FR-008**: New passwords submitted to the confirm endpoint MUST satisfy a minimum-strength policy (≥ 8 characters; at least one letter, one digit, and one non-alphanumeric character) and MUST be hashed with bcrypt cost factor ≥ 12 before storage.
- **FR-009**: The request endpoint MUST be rate-limited per email address: at most 1 accepted request per 60 seconds AND at most 5 accepted requests per rolling hour. Throttled requests MUST return the same successful response shape as accepted requests (no behavioral leak).
- **FR-010**: A successful reset MUST revoke all currently active refresh tokens for that user before issuing the new session.
- **FR-016**: A successful reset MUST clear the brute-force lockout state for that user — concretely the columns `failed_login_count = 0`, `first_failed_at = NULL`, and `locked_until = NULL` (the same set that `auth/service.ts` resets on a successful login) — atomically as part of the reset transaction, so that a user who reset after being locked out can immediately sign in (and is in fact already signed in by the reset itself).
- **FR-017**: The system MUST run a scheduled cleanup that hard-deletes any `password_reset_tokens` row where `used_at IS NOT NULL` OR `expires_at < now()`. Cadence is daily. Failure of a single run MUST NOT block the request/confirm flow; the next run is expected to catch up. The token table is, by design, an ephemeral store — long-term forensic history lives in `audit_events`.
- **FR-018**: The email transport (`EmailService`) MUST be environment-aware. When `RESEND_API_KEY` is configured, it MUST send via Resend. When it is absent, it MUST emit a structured server-side log event of the form `{ event: "email.suppressed", to, url }` and skip the network call. In both cases the public endpoint MUST return the same `200` response, so caller-visible behavior is identical and tests can assert against the suppression event. This prevents preview-branch deploys from emailing real users.
- **FR-011**: The system MUST write an audit event of type `password_reset_requested` for each accepted request that targets a real active user, and an audit event of type `password_reset_completed` for each successful reset, both referencing only the `user_id` and timestamp (no PII).
- **FR-012**: On successful reset, the web app MUST land the user on `/` (dashboard) using the same post-login flow used after a fresh login.
- **FR-013**: The system MUST NOT log the email address, the plaintext token, the new password, or any other PII in plain text on any code path. Operational logs MUST be safe to share with engineering without violating LFPDPPP.
- **FR-014**: All error responses to the confirm endpoint for expired, used, or otherwise invalid tokens MUST share a single user-facing Spanish message and HTTP status (`400`) so that "expired" and "already used" are indistinguishable to the caller.

### Key Entities *(include if feature involves data)*

- **PasswordResetToken**: Represents a single password-reset attempt for a user. Owns the token hash (never the plaintext), the issuing timestamp, the expiration timestamp, the consumption timestamp (nullable until used), and weak request fingerprints (hashed IP + user agent) for forensics. Bound to a single `user_id`. Pre-authentication artifact: not scoped by tenant context (the requester is unauthenticated at the time of issuance) but ownership is enforced by the `user_id` foreign key. **Lifecycle is intentionally short**: rows are hard-deleted by a daily cleanup cron once they are used or expired (FR-017). The table is never expected to hold more rows than `pending_resets_per_day × 30min/24h ≈ a small constant`.
- **AuditEvent (existing entity, extended use)**: Receives two new event types, `password_reset_requested` and `password_reset_completed`. Stores `user_id`, timestamp, and event type only — no PII payload.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user who has forgotten their password can complete the full flow (request email → click link → set new password → arrive at dashboard) in under 2 minutes end-to-end on a typical broadband connection, assuming the email arrives within 60 seconds.
- **SC-002**: Support tickets categorized as "manual password reset" drop by ≥ 90% within the first month after launch versus the prior month.
- **SC-003**: For any input email, the request endpoint returns a byte-identical response payload, the same HTTP status (`200`), and the same set of `Set-Cookie`/headers, regardless of whether the email belongs to a real, deactivated, or non-existent user. Verified by an automated parity test across the three cases. The stronger statistical timing-attack property (≥ 1,000-iteration probe at < 50% classification accuracy) is **out of scope for CI** because in-process timing measurements inside Vitest are too noisy to be a reliable gate; it is instead defended by construction (the dummy-work helper that mirrors the success-path cost on the miss branch — see plan.md §"Phase 4 (US2)") and verified by manual SecOps audit before public launch.
- **SC-004**: 100% of accepted reset requests for active users produce exactly one audit event of type `password_reset_requested`; 100% of successful resets produce exactly one audit event of type `password_reset_completed`. (Verified by integration test asserting the audit row exists per call.)
- **SC-005**: 0 reset tokens remain valid past their 30-minute window or after first successful use, verified by automated tests that walk the lifecycle.
- **SC-006**: After a successful reset, any session that existed on another device for that user is forcibly logged out within one access-token lifetime (≤ 60 minutes) — verified by an integration test that simulates a parallel session.
- **SC-007**: The request endpoint absorbs at least 5 requests per email per rolling hour without sending more than one email in any 60-second window — verified by a rate-limit test.

## Assumptions

- **Email transport** uses Resend, accessed from the Worker via `fetch`. Provider credentials live in Workers Secrets (`RESEND_API_KEY`, `RESEND_FROM_DOMAIN`). This stays inside §II Edge-First (no traditional servers). When `RESEND_API_KEY` is unset (dev / preview / CI), the transport degrades to structured-log-only suppression per FR-018 instead of failing or accidentally sending real emails.
- **Per-email rate-limit storage** uses a Cloudflare KV namespace (or the same primitive already used by the auth module's lockout counter). KV's eventual consistency is acceptable here because the throttle is defensive rather than safety-critical and the upper bound (5/hour) tolerates small drift.
- **The reset link host** is `${VITE_APP_URL}` (the public web app origin already used elsewhere). The link path is fixed: `/reset-password?token=…`.
- **Password complexity** matches the existing user-create policy: minimum 8 characters, at least one letter, at least one digit, at least one non-alphanumeric character. If a stricter policy is later adopted, both flows should change together.
- **Email content** is bilingual-ready in code (template structure) but ships in Spanish only for v1, matching the rest of the product copy.
- **Token storage** is in a new dedicated table rather than reusing `refresh_tokens`, because the lifecycle, indexing pattern, and security boundary are different (pre-auth, hash-only lookup, 30-min TTL).
- **Tenant context** is intentionally absent for this flow — the requester is not yet authenticated, so the request endpoint resolves the user purely by email and the confirm endpoint resolves the user purely by token. RLS does not apply to `password_reset_tokens`; isolation is enforced by `user_id` ownership and the fact that the public endpoints expose no tenant-discriminating signal.
- **Global email uniqueness** (FR-015) is the precondition that makes the email-only request endpoint safe and unambiguous. The current `users` table is unique on `(tenant_id, email)`; promoting that to a global unique on `email` is a prerequisite migration for this feature. The plan must include (a) a data audit confirming no current cross-tenant email collisions, (b) a migration that drops the composite unique and adds the global unique, and (c) a forward guard in the user-create / user-update flow that rejects collisions across tenants.
- **Existing in-app password change** in the user profile remains the canonical flow for authenticated changes; this feature does not modify or replace it.
- **Privacy notice** does not need to be re-presented during reset — the user is changing credentials, not consenting to data processing again. LFPDPPP audit obligations are met by `audit_events`.

## Out of Scope (v1)

- SMS-based reset, security questions, passkeys / WebAuthn.
- Admin-initiated reset for another user from an internal console.
- In-app password change for an already-authenticated user (already exists in profile).
- Internationalization beyond Spanish for v1.
- Notifying the user by email *that* their password was changed (post-reset confirmation email) — can be added later.

## Constitution Alignment

- **§I Multi-Tenant Isolation**: The `password_reset_tokens` table is intentionally not tenant-scoped (pre-auth artifact) and the public endpoints expose no tenant-discriminating behavior. The flow does not bypass RLS for any tenant-scoped table; it only writes to `users.password_hash` and `audit_events` for the resolved `user_id`, both of which already enforce tenant ownership through the user record.
- **§II Edge-First**: Email transport is Resend-over-`fetch` from the Worker. No new long-running services are introduced.
- **§III TypeScript Everywhere**: Request and confirm payloads are validated by Zod schemas in `packages/shared` so frontend and API agree on the contract.
- **§V Test-First**: Integration tests stub the email transport and assert (a) the request returns identical responses for real, fake, and deactivated emails; (b) tokens expire at 30 min, are single-use, and are invalidated by re-issuance; (c) successful reset revokes all refresh tokens; (d) rate-limit windows behave correctly.
- **§VI Security by Design**: bcrypt cost ≥ 12 on the new hash; tokens stored as SHA-256 hash with constant-time comparison; rate-limit per email; audit trail via `audit_events`; no PII in logs; LFPDPPP-safe email body (no password, no hash).
