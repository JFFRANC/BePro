# Tasks: JWT Authentication Module

**Input**: Design documents from `/specs/002-jwt-auth-module/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md  
**Branch**: `002-jwt-auth-module`

**Tests**: Required per constitution (Principle V: Test-First, NON-NEGOTIABLE). TDD: write tests first, verify they fail, then implement.

**Organization**: Tasks grouped by user story. Each story is independently testable after its phase completes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US6) this task belongs to
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update shared packages and environment configuration to support the auth module.

- [x] T001 [P] Update shared auth types — remove `refreshToken` from `IAuthResponse`, add `tenantSlug` to `ILoginRequest`, add `tenantId` to `ICurrentUser`, add `IAuthMeResponse` with tenant info in `packages/shared/src/types/auth.ts`
- [x] T002 [P] Update shared auth schemas — add `tenantSlug` field to `loginSchema`, create `refreshRequestSchema` (empty body + custom header validation) in `packages/shared/src/schemas/auth.ts`
- [x] T003 [P] Update API environment bindings — add `JWT_ACCESS_SECRET` to `Bindings` interface in `apps/api/src/types.ts`, add `Variables` type with `user` and `tenantId` to `HonoEnv`, add `JWT_ACCESS_SECRET` to `vars` in `apps/api/wrangler.jsonc`
- [x] T004 Install `bcryptjs` and `@types/bcryptjs` in `apps/api` via pnpm

---

## Phase 2: Foundational (Database + Core Infrastructure)

**Purpose**: Create database schemas, migrations, RLS policies, and DB client infrastructure. MUST complete before any user story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 [P] Create tenants table schema (id, name, slug, is_active, created_at, updated_at) with unique constraint on slug in `packages/db/src/schema/tenants.ts`
- [x] T006 [P] Create users table schema (id, tenant_id FK, email, password_hash, first_name, last_name, role, is_freelancer, is_active, failed_login_count, first_failed_at, locked_until, created_at, updated_at) with unique constraint on (tenant_id, email) in `packages/db/src/schema/users.ts`
- [x] T007 [P] Create refresh_tokens table schema (id, user_id FK, token_hash, family, is_revoked, expires_at, created_at) with indexes on token_hash and (user_id, family) in `packages/db/src/schema/refresh-tokens.ts`
- [x] T008 Export all schemas from `packages/db/src/schema/index.ts` and create DB client factory (`createDb` helper using `drizzle-orm/neon-http` + `@neondatabase/serverless`) in `packages/db/src/client.ts`, update `packages/db/src/index.ts` to export schemas + client
- [x] T009 Generate Drizzle migration via `pnpm --filter db db:generate`, then create a manual SQL migration for RLS policies: enable RLS on `users` table, create policy for SELECT/INSERT/UPDATE using `current_setting('app.tenant_id')::uuid`, block DELETE
- [x] T010 Create per-request DB helper that wraps Drizzle client creation from `c.env.DATABASE_URL` in `apps/api/src/lib/db.ts`
- [x] T011 Create seed script with a default tenant (slug: "bepro", name: "BePro Reclutamiento") and admin user (email: admin@bepro.mx, bcrypt-hashed password, role: admin) in `scripts/seed.ts`
- [x] T012 Create `packages/db/CLAUDE.md` documenting Drizzle + RLS patterns, schema conventions, migration workflow, and the `SET LOCAL` pattern for tenant isolation

- [x] T012b Configure CORS middleware — add `hono/cors` with restricted origins (localhost:5173 for dev, production domain for deploy) in `apps/api/src/index.ts`

**Checkpoint**: Database ready — schemas, migrations, RLS, seed data, and CORS in place.

---

## Phase 3: User Story 1 — User Login (Priority: P1) MVP

**Goal**: Users authenticate with email + password + tenant slug and receive an access token (JWT) plus a refresh token (httpOnly cookie).

**Independent Test**: Submit valid/invalid credentials to `POST /api/auth/login` and verify correct access grant or denial.

### Tests for User Story 1

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T013 [P] [US1] Write unit tests for login service — valid credentials returns tokens, wrong password returns null, non-existent email returns null (constant-time), inactive user returns null, inactive tenant returns null — in `apps/api/src/modules/auth/__tests__/service.login.test.ts`
- [x] T014 [P] [US1] Write integration tests for POST /api/auth/login — 200 with valid creds (response body has accessToken + user, Set-Cookie has refresh_token with httpOnly+SameSite+Secure+Path), 401 with wrong password (identical body to wrong email), 401 with non-existent email, 401 with inactive user, 401 with inactive tenant — in `apps/api/src/modules/auth/__tests__/routes.login.test.ts`

### Implementation for User Story 1

- [x] T015 [US1] Create auth module types — `JwtPayload` (sub, email, role, tenantId, isFreelancer, iat, exp), `AuthResult` (accessToken, expiresAt, user), `LoginParams` — in `apps/api/src/modules/auth/types.ts`
- [x] T016 [US1] Implement login function in auth service — look up tenant by slug, look up user by (tenant_id, email), verify password with bcryptjs (constant-time even on miss), generate JWT access token with `hono/jwt` sign(), generate opaque refresh token (crypto.randomUUID()), hash with SHA-256, store in refresh_tokens table, set httpOnly cookie via `hono/cookie` — in `apps/api/src/modules/auth/service.ts`
- [x] T017 [US1] Create auth routes file with `POST /login` endpoint — validate request body with `zValidator("json", loginSchema)`, call login service, return accessToken + user in response body, set refresh_token cookie — in `apps/api/src/modules/auth/routes.ts`
- [x] T018 [US1] Mount auth routes at `/api/auth` in `apps/api/src/index.ts`
- [x] T019 [US1] Verify all T013 and T014 tests pass. Run `pnpm --filter api test` and `pnpm --filter api typecheck`

**Checkpoint**: Login endpoint functional. Can authenticate users and receive tokens. MVP deployable.

---

## Phase 4: User Story 2 — Seamless Session Continuity (Priority: P1)

**Goal**: Expired access tokens are silently renewed via the refresh token cookie. Refresh tokens rotate on every use. Reuse of a rotated token revokes the entire family (theft detection).

**Independent Test**: Simulate expired access token, call `POST /api/auth/refresh` with valid cookie, verify new tokens are issued without user interaction.

### Tests for User Story 2

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T020 [P] [US2] Write unit tests for refresh service — valid token returns new access + rotated refresh, expired token returns null, revoked token returns null, reuse of rotated token revokes entire family — in `apps/api/src/modules/auth/__tests__/service.refresh.test.ts`
- [x] T021 [P] [US2] Write integration tests for POST /api/auth/refresh — 200 with valid cookie (new accessToken + new cookie), 401 with expired cookie, 401 with revoked cookie, 401 with missing cookie, 403 with missing X-Requested-With header, verify old cookie no longer works after rotation, verify entire family revoked on reuse detection, verify two simultaneous refresh requests with the same token result in exactly one success and one rejection — in `apps/api/src/modules/auth/__tests__/routes.refresh.test.ts`

### Implementation for User Story 2

- [x] T022 [US2] Implement refresh function in auth service — read refresh_token from cookie, hash it, look up in DB, verify not revoked and not expired, check for reuse (if revoked → revoke entire family), create new refresh token in same family, revoke old one, generate new JWT access token with fresh user data from DB — in `apps/api/src/modules/auth/service.ts`
- [x] T023 [US2] Add CSRF check helper — verify `X-Requested-With: fetch` header present — and add `POST /refresh` route to `apps/api/src/modules/auth/routes.ts`
- [x] T024 [US2] Verify all T020 and T021 tests pass. Run `pnpm --filter api test` and `pnpm --filter api typecheck`

**Checkpoint**: Token rotation works. Users stay authenticated transparently. Theft detection active.

---

## Phase 5: User Story 3 — Role-Based Access Control (Priority: P2)

**Goal**: Every protected request is validated for authentication (JWT) and authorization (role). Middleware rejects unauthorized access.

**Independent Test**: Make requests as different roles and verify each receives only the access their role permits.

### Tests for User Story 3

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T025 [P] [US3] Write unit tests for auth middleware — rejects missing Authorization header, rejects malformed Bearer token, rejects expired JWT, rejects tampered JWT, sets user context on valid JWT — in `apps/api/src/modules/auth/__tests__/middleware.auth.test.ts`
- [x] T026 [P] [US3] Write unit tests for requireRole middleware — allows request when user role is in permitted list, returns 403 when role is not in list, works with single and multiple permitted roles — in `apps/api/src/modules/auth/__tests__/middleware.role.test.ts`

### Implementation for User Story 3

- [x] T027 [US3] Implement auth middleware — extract JWT from `Authorization: Bearer <token>`, verify with `hono/jwt` verify(), reject 401 on failure, set `c.set("user", payload)` with JwtPayload on success — in `apps/api/src/modules/auth/middleware.ts`
- [x] T028 [US3] Implement requireRole factory middleware — `requireRole(...roles: UserRole[])` returns middleware that checks `c.get("user").role` against allowed roles, returns 403 if not permitted — in `apps/api/src/modules/auth/middleware.ts`
- [x] T029 [US3] Add `GET /me` endpoint to auth routes — protected by auth middleware, returns current user info from JWT claims enriched with tenant name/slug from DB — in `apps/api/src/modules/auth/routes.ts`
- [x] T030 [US3] Verify all T025 and T026 tests pass. Run `pnpm --filter api test` and `pnpm --filter api typecheck`

**Checkpoint**: Auth + role middleware functional. Protected endpoints reject unauthorized requests.

---

## Phase 6: User Story 4 — Tenant Isolation on Every Request (Priority: P2)

**Goal**: Every authenticated request automatically scopes all database operations to the user's tenant via `SET LOCAL app.tenant_id` inside a transaction, enforced by RLS.

**Independent Test**: Make concurrent requests from users in different tenants and verify zero cross-tenant data leakage.

### Tests for User Story 4

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T031 [P] [US4] Write unit tests for tenant middleware — calls `SET LOCAL app.tenant_id` with tenant_id from JWT, rejects request if tenant is inactive, rejects if tenant not found — in `apps/api/src/modules/auth/__tests__/middleware.tenant.test.ts`
- [x] T032 [P] [US4] Write cross-tenant isolation integration tests — create two tenants with one user each, make concurrent requests, verify User A in Tenant X sees zero records from Tenant Y, verify RLS blocks cross-tenant access even if application query lacks WHERE clause — in `apps/api/src/modules/auth/__tests__/isolation.test.ts`

### Implementation for User Story 4

- [x] T033 [US4] Implement tenant middleware — read `tenantId` from `c.get("user")`, verify tenant is active in DB, create a transaction-wrapped DB helper that calls `SET LOCAL app.tenant_id = tenantId` before every query batch, set it on context via `c.set("tenantId", tenantId)` — in `apps/api/src/modules/auth/middleware.ts`
- [x] T034 [US4] Apply auth middleware + tenant middleware as default middleware for all `/api/*` routes (excluding `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/health`) in `apps/api/src/index.ts`
- [x] T035 [US4] Verify all T031 and T032 tests pass. Run `pnpm --filter api test` and `pnpm --filter api typecheck`

**Checkpoint**: Tenant isolation enforced at database level. Cross-tenant leakage impossible.

---

## Phase 7: User Story 5 — User Logout (Priority: P3)

**Goal**: User can explicitly end the current session. Only the current session's refresh token is revoked; other sessions remain active.

**Independent Test**: Log out and verify the old refresh token is rejected while other sessions continue working.

### Tests for User Story 5

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T036 [P] [US5] Write integration tests for POST /api/auth/logout — 200 on valid logout (cookie cleared), 401 on missing cookie, 403 on missing X-Requested-With header, old refresh token rejected after logout, other sessions for same user remain valid — in `apps/api/src/modules/auth/__tests__/routes.logout.test.ts`

### Implementation for User Story 5

- [x] T037 [US5] Implement logout function in auth service — read refresh_token from cookie, hash it, look up in DB, mark as revoked, clear the cookie (Max-Age=0) — in `apps/api/src/modules/auth/service.ts`
- [x] T038 [US5] Add `POST /logout` route with CSRF check to `apps/api/src/modules/auth/routes.ts`
- [x] T039 [US5] Verify T036 tests pass. Run `pnpm --filter api test` and `pnpm --filter api typecheck`

**Checkpoint**: Logout works. Per-session revocation confirmed. Other sessions unaffected.

---

## Phase 8: User Story 6 — Brute-Force Protection (Priority: P3)

**Goal**: After 5 failed login attempts within 15 minutes for a specific account, additional attempts are blocked for 15 minutes regardless of credential correctness.

**Independent Test**: Send 5+ failed login attempts for the same account and verify the 6th is rejected; verify lockout expires after 15 minutes.

### Tests for User Story 6

> **Write these tests FIRST, ensure they FAIL before implementation**

- [x] T040 [P] [US6] Write unit tests for brute-force logic — first failure starts 15-min window, 5th failure triggers lockout, locked account rejects correct credentials, lockout expires after 15 minutes, successful login resets counter, failure window resets after 15 minutes of no failures — in `apps/api/src/modules/auth/__tests__/service.bruteforce.test.ts`
- [x] T041 [P] [US6] Write integration tests for brute-force on POST /api/auth/login — 5 failures → 429 on 6th attempt, 429 response includes "Too many attempts" message, correct credentials rejected during lockout, counter reset after successful login — in `apps/api/src/modules/auth/__tests__/routes.bruteforce.test.ts`

### Implementation for User Story 6

- [x] T042 [US6] Add brute-force logic to login service — before password check: if `locked_until` > now, return 429; on failure: if `first_failed_at` > 15 min ago reset counter, else increment; if count >= 5 set `locked_until` = now + 15 min; on success: reset `failed_login_count`, `first_failed_at`, `locked_until` — in `apps/api/src/modules/auth/service.ts`
- [x] T043 [US6] Update `POST /login` route to return 429 status with `{ "error": "Too many attempts. Try again later." }` when service indicates lockout — in `apps/api/src/modules/auth/routes.ts`
- [x] T044 [US6] Verify T040 and T041 tests pass. Run `pnpm --filter api test` and `pnpm --filter api typecheck`

**Checkpoint**: Brute-force protection active. Per-account lockout verified.

---

## Phase 9: Frontend Auth Integration

**Purpose**: Implement frontend auth flow — login form, token management, auto-refresh interceptor, auth state store.

- [x] T045 [P] Create API client with auth interceptor — attaches `Authorization: Bearer` header, detects 401, calls `/api/auth/refresh` with `X-Requested-With: fetch`, retries original request on success, redirects to login on refresh failure — in `apps/web/src/lib/api-client.ts`
- [x] T046 [P] Create auth Zustand store — stores `accessToken`, `user` (ICurrentUser), `isAuthenticated` boolean, `login()`/`logout()`/`setTokens()` actions — in `apps/web/src/store/auth-store.ts`
- [x] T047 Create `useAuth` hook — wraps auth store + TanStack Query for `/api/auth/me`, handles token refresh on mount, provides `login`, `logout`, `user`, `isLoading` — in `apps/web/src/modules/auth/hooks/useAuth.ts`
- [x] T048 Create `LoginForm` component — React Hook Form + Zod validation with `loginSchema`, fields for email + password + tenantSlug, error display, loading state, calls auth store login action — in `apps/web/src/modules/auth/components/LoginForm.tsx`
- [x] T049 Create login page and integrate routing — add `/login` route, redirect unauthenticated users to login, redirect authenticated users from login to dashboard — in `apps/web/src/App.tsx` and `apps/web/src/modules/auth/pages/LoginPage.tsx`
- [x] T050 Write frontend tests — LoginForm renders and validates fields, useAuth hook handles login/logout flow, api-client retries on 401 — in `apps/web/src/modules/auth/__tests__/`

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and cleanup.

- [x] T051 Run full test suite across all packages: `pnpm test`
- [x] T052 Run type-check across all packages: `pnpm typecheck`
- [x] T053 Run lint across all packages: `pnpm lint`
- [ ] T054 [P] Validate quickstart.md flow — follow the curl examples end-to-end against the running dev server
- [x] T055 [P] Add audit event recording stubs for login_success, login_failure, token_refresh, logout events in auth service — prepare interface for future audit module integration in `apps/api/src/modules/auth/service.ts`
- [x] T056 Verify PII compliance — grep all log statements and error responses to confirm no email, password, or token values appear in plain text

---

## Remediation: Constitution Compliance [Sync: Retrospective 2026-04-02]

**Purpose**: Fix CRITICAL Constitution Article I violations and wire audit event stubs. These tasks block deployment.

### CRITICAL-1 Fix: Login tenant_id filter

> **Tests FIRST, verify they FAIL, then fix implementation**

- [x] T057 [P] [US1] Update login service unit tests — add test verifying user lookup includes `tenant_id` filter, add test confirming wrong tenant returns null even with correct email+password — in `apps/api/src/modules/auth/__tests__/service.login.test.ts` [Sync: Gap Report]
- [x] T058 [P] [US1] Fix login user lookup — change `eq(users.email, params.email)` to `and(eq(users.tenantId, tenant.id), eq(users.email, params.email))` in `apps/api/src/modules/auth/service.ts:58-61` [Sync: Gap Report]

### CRITICAL-2 Fix: Tenant middleware SET LOCAL

> **Tests FIRST, verify they FAIL, then fix implementation**

- [x] T059 [P] [US4] Update tenant middleware tests — add test verifying `SET LOCAL app.tenant_id` is called via `tx.execute()`, add test verifying scoped DB client is set on context — in `apps/api/src/modules/auth/__tests__/middleware.tenant.test.ts` [Sync: Gap Report]
- [x] T060 [P] [US4] Add `db` to Variables type — add optional `db` property (transaction-scoped Drizzle client) to `Variables` in `apps/api/src/types.ts` [Sync: Gap Report]
- [x] T061 [P] [US4] Implement SET LOCAL in tenant middleware — wrap `await next()` inside `db.transaction()` with `SET LOCAL app.tenant_id`, set `c.set("db", tx)` for downstream handlers — in `apps/api/src/modules/auth/middleware.ts:37-52` [Sync: Gap Report]

### SIGNIFICANT-1 Fix: Wire audit event calls

- [x] T062 [US1] Wire `recordAuditEvent()` calls — add calls for `login_success`, `login_failure` (with attempt count), `token_refresh`, and `logout` at appropriate points in `apps/api/src/modules/auth/service.ts` [Sync: Gap Report]

### Verification

- [x] T063 Run full test suite + typecheck after all remediation: `pnpm test && pnpm typecheck` [Sync: Gap Report]

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────────────────────────────────────► No dependencies
Phase 2: Foundational ──────────────────────────────────► Depends on Phase 1
Phase 3: US1 Login (P1) ────────────────────────────────► Depends on Phase 2
Phase 4: US2 Refresh (P1) ──────────────────────────────► Depends on Phase 3 (login produces tokens)
Phase 5: US3 RBAC (P2) ─────────────────────┐
Phase 6: US4 Tenant Isolation (P2) ──────────┤──────────► Both depend on Phase 2 (can parallel with US1/US2)
Phase 7: US5 Logout (P3) ───────────────────────────────► Depends on Phase 3 (needs refresh tokens)
Phase 8: US6 Brute-Force (P3) ──────────────────────────► Depends on Phase 3 (enhances login)
Phase 9: Frontend ──────────────────────────────────────► Depends on Phase 3 (login endpoint) + Phase 5 (middleware)
Phase 10: Polish ───────────────────────────────────────► Depends on all previous phases
```

### User Story Dependencies

- **US1 (Login)**: Depends on Foundational only — **no other story dependencies**
- **US2 (Refresh)**: Depends on US1 (login creates the refresh token to be rotated)
- **US3 (RBAC)**: Depends on Foundational only — can parallel with US1/US2 (middleware can be tested with manually crafted JWTs)
- **US4 (Tenant Isolation)**: Depends on Foundational only — can parallel with US1/US2 (middleware tested independently)
- **US5 (Logout)**: Depends on US1 (needs refresh tokens to revoke)
- **US6 (Brute-Force)**: Depends on US1 (enhances the login flow)

### Within Each User Story

1. Tests MUST be written first and FAIL before implementation
2. Service layer before route layer
3. Run all tests and type-check at the end of each story phase

### Parallel Opportunities

- **Phase 1**: T001, T002, T003 can all run in parallel (different files)
- **Phase 2**: T005, T006, T007 can all run in parallel (different schema files)
- **Phase 3**: T013, T014 (tests) can run in parallel
- **Phase 4**: T020, T021 (tests) can run in parallel
- **Phase 5**: T025, T026 (tests) can run in parallel; US3 can run in parallel with US1/US2
- **Phase 6**: T031, T032 (tests) can run in parallel; US4 can run in parallel with US1/US2
- **Phase 7**: T036 (single test file)
- **Phase 8**: T040, T041 (tests) can run in parallel
- **Phase 9**: T045, T046 can run in parallel (different files)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all schema definitions in parallel:
Task T005: "Create tenants table schema in packages/db/src/schema/tenants.ts"
Task T006: "Create users table schema in packages/db/src/schema/users.ts"
Task T007: "Create refresh_tokens table schema in packages/db/src/schema/refresh-tokens.ts"

# Then sequentially:
Task T008: "Export schemas + create DB client factory"
Task T009: "Generate migration + RLS policies"
```

## Parallel Example: Two-Developer Split

```bash
# Developer A (API-focused):
Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 7 (US5) → Phase 8 (US6)

# Developer B (Middleware + Frontend):
Phase 1 → Phase 2 → Phase 5 (US3) → Phase 6 (US4) → Phase 9 (Frontend)

# Both converge at Phase 10 (Polish)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (Login)
4. **STOP and VALIDATE**: Test login endpoint end-to-end with curl
5. Deployable: users can log in and receive tokens

### Incremental Delivery

1. Setup + Foundational → Database and infra ready
2. **Add US1 (Login)** → Test independently → **MVP deployable**
3. **Add US2 (Refresh)** → Test independently → Sessions don't expire during use
4. **Add US3 (RBAC) + US4 (Tenant)** → Test independently → Security enforced
5. **Add US5 (Logout) + US6 (Brute-Force)** → Test independently → Full security hardening
6. **Add Frontend** → Complete auth experience
7. Polish → Production-ready

### Parallel Team Strategy (Hector + Javi)

1. **Both**: Complete Setup + Foundational together
2. **Once Foundational is done**:
   - Hector: US1 (Login) → US2 (Refresh) → US5 (Logout) → US6 (Brute-Force)
   - Javi: US3 (RBAC) → US4 (Tenant Isolation) → Frontend
3. Both converge at Phase 10 (Polish)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- TDD is mandatory per constitution — every phase starts with test tasks
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- Access token expiry: 15 minutes (per research.md R-008)
- Refresh token: opaque UUID, SHA-256 hashed in DB (per research.md R-003)
- Cookie: httpOnly, Secure, SameSite=Strict, Path=/api/auth (per research.md R-009)
