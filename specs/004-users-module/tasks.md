# Tasks: Users Module — User CRUD, Role Assignment, and Profile Management

**Input**: Design documents from `/specs/004-users-module/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — TDD is mandatory per constitution (Principle V). RED → GREEN → REFACTOR.

**Organization**: Tasks grouped by user story. Each story is independently testable.

**Agent annotations**: Tasks annotated with recommended agent/skill for optimal execution.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema changes, shared types, Zod validation schemas, audit helper — all prerequisites for any user story.
**Recommended agents**: `db-architect` for T001-T004, `senior-backend-engineer` for T005-T008.

- [X] T001 [P] Add `lastLoginAt` and `mustChangePassword` columns to users schema in `packages/db/src/schema/users.ts` (use `postgres-drizzle` skill)
- [X] T002 [P] Create `audit_events` table schema with indexes in `packages/db/src/schema/audit-events.ts` (use `postgres-drizzle` skill, follow data-model.md)
- [X] T003 Export `auditEvents` from `packages/db/src/schema/index.ts`
- [X] T004 Generate Drizzle migration via `pnpm --filter @bepro/db drizzle-kit generate`, review SQL, add RLS policies for `audit_events` (SELECT, INSERT tenant-scoped; UPDATE/DELETE blocked) and set `must_change_password = false` for existing seed users (use `multi-tenancy-guardian` to verify RLS)
- [X] T005 [P] Create Zod validation schemas in `packages/shared/src/schemas/users.ts`: `createUserSchema`, `updateUserSchema`, `changePasswordSchema`, `resetPasswordSchema`, `listUsersQuerySchema`, `bulkImportRowSchema` (use `zod` skill, follow contracts/api.md)
- [X] T006 [P] Extend `IUserDto` with `mustChangePassword`, `lastLoginAt`, `updatedAt` in `packages/shared/src/types/user.ts`. Add `IUserListResponse`, `IPaginationMeta`, `IBulkImportResult` types.
- [X] T007 [P] Add `mustChangePassword` to `ICurrentUser` in `packages/shared/src/types/auth.ts` and `JwtPayload` in `apps/api/src/modules/auth/types.ts`
- [X] T008 Export new schemas from `packages/shared/src/schemas/index.ts` and `packages/shared/src/index.ts`

**Checkpoint**: Run `pnpm turbo typecheck` — all packages must compile with new types.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Audit helper, users module scaffold, auth modifications. MUST complete before any user story.
**Recommended agents**: `senior-backend-engineer` for T009-T013.

- [X] T009 Create audit event helper `recordAuditEvent()` in `apps/api/src/lib/audit.ts` — accepts db transaction, tenantId, actorId, action, targetType, targetId, oldValues, newValues. Inserts into `audit_events` table. (follow research.md Decision 5)
- [X] T010 [P] Create `apps/api/src/modules/users/types.ts` — service-level types: `ListUsersParams`, `CreateUserParams`, `UpdateUserParams`, `BulkImportRow`, `BulkImportResult`
- [X] T011 [P] Write tests for `recordAuditEvent()` in `apps/api/src/lib/__tests__/audit.test.ts` — verify insert with correct fields, verify password values never included (use `vitest` skill)
- [X] T012 Update auth service `login()` in `apps/api/src/modules/auth/service.ts` to: (1) set `lastLoginAt = now()` on successful login, (2) include `mustChangePassword` in JWT payload (use `jwt-security` skill)
- [X] T013 Write tests for auth login modifications in `apps/api/src/modules/auth/__tests__/service.login.test.ts` — verify `lastLoginAt` updated, verify `mustChangePassword` present in JWT payload (use `vitest` skill)

**Checkpoint**: `pnpm turbo test` — audit helper tests and auth login tests must pass. Foundation ready.

---

## Phase 3: User Story 1 — Admin Creates a New User (Priority: P1) MVP

**Goal**: Admin can create a user with email, name, role, password. New user flagged for forced password change.
**Independent Test**: Create a user via API, verify they exist in DB with `mustChangePassword: true` and can log in.
**Recommended agents**: `senior-backend-engineer` for API, `senior-frontend-engineer` for UI.

### Tests for User Story 1

- [X] T014 [P] [US1] Write service tests for `createUser()` in `apps/api/src/modules/users/__tests__/service.create.test.ts` — valid creation, duplicate email 409, password hashing, audit event recorded, mustChangePassword set (use `vitest` + `superpowers:test-driven-development` skills)
- [X] T015 [P] [US1] Write route tests for `POST /api/users` in `apps/api/src/modules/users/__tests__/routes.create.test.ts` — 201 on success, 409 on duplicate, 422 on validation, 403 for non-admin (use `vitest` skill)

### Implementation for User Story 1

- [X] T016 [US1] Implement `createUser()` in `apps/api/src/modules/users/service.ts` — validate email uniqueness (UNIQUE constraint), hash password (bcrypt cost 12), insert user with `mustChangePassword: true`, record audit event. Return user DTO. (use `hono` skill, follow contracts/api.md POST /api/users)
- [X] T017 [US1] Create `apps/api/src/modules/users/routes.ts` — scaffold Hono sub-app, implement `POST /users` with middleware chain: `authMiddleware` → `tenantMiddleware` → `requireRole("admin")` → `zValidator("json", createUserSchema)`. Mount in `apps/api/src/index.ts` as `app.route("/api/users", usersRoutes)`.
- [X] T018 [P] [US1] Create `apps/web/src/modules/users/services/userService.ts` — `createUser()` API call via apiClient
- [X] T019 [P] [US1] Create `apps/web/src/modules/users/hooks/useUsers.ts` — query key factory `USER_KEYS`, `useCreateUser()` mutation hook with cache invalidation (use `tanstack-query-best-practices` skill)
- [X] T020 [US1] Create `apps/web/src/modules/users/components/CreateUserForm.tsx` — React Hook Form + Zod resolver, fields: email, password, firstName, lastName, role dropdown, isFreelancer toggle. Handle 409 as inline email error. Spanish labels. (use `shadcn-ui` + `frontend-design` skills)
- [X] T021 [US1] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US1 tests pass

**Checkpoint**: Admin can create a user via API and UI. New user has `mustChangePassword: true`. Verify with `getDiagnostics`.

---

## Phase 4: User Story 2 — Admin Browses and Searches the User Directory (Priority: P2)

**Goal**: Admin/manager can view paginated user list with search, role filter, active/inactive toggle.
**Independent Test**: Load user list with 50+ users, verify search, filter, and pagination work.
**Recommended agents**: `senior-backend-engineer` for API, `senior-frontend-engineer` for UI.

### Tests for User Story 2

- [X] T022 [P] [US2] Write service tests for `listUsers()` in `apps/api/src/modules/users/__tests__/service.list.test.ts` — pagination, search ILIKE, role filter, isActive filter, role-scoped visibility (admin sees all, recruiter sees self) (use `vitest` skill)
- [X] T023 [P] [US2] Write service tests for `getUserById()` in `apps/api/src/modules/users/__tests__/service.detail.test.ts` — found, not found 404, role-based access check
- [X] T024 [P] [US2] Write route tests for `GET /api/users` and `GET /api/users/:id` in `apps/api/src/modules/users/__tests__/routes.list.test.ts` — 200, pagination meta, 401/403, query params

### Implementation for User Story 2

- [X] T025 [US2] Implement `listUsers()` in `apps/api/src/modules/users/service.ts` — offset pagination (LIMIT/OFFSET), COUNT(*) for total, ILIKE search on firstName/lastName/email, role/isActive/isFreelancer filters, role-scoped visibility (follow research.md Decisions 1, 6, 7)
- [X] T026 [US2] Implement `getUserById()` in `apps/api/src/modules/users/service.ts` — single user by ID, role-based access check (admin/manager: any user; AE: recruiters only; recruiter: self only)
- [X] T027 [US2] Add `GET /users` and `GET /users/:id` routes in `apps/api/src/modules/users/routes.ts` with `zValidator("query", listUsersQuerySchema)` for query params
- [X] T028 [P] [US2] Add `listUsers()`, `getUserById()` to `apps/web/src/modules/users/services/userService.ts`
- [X] T029 [P] [US2] Add `useUsers()` paginated query hook and `useUser(id)` detail hook to `apps/web/src/modules/users/hooks/useUsers.ts` (use `tanstack-query-best-practices` skill)
- [X] T030 [US2] Create `apps/web/src/modules/users/components/UserList.tsx` — paginated data table with search bar, role filter dropdown, active/inactive toggle, freelancer filter. Spanish labels. (use `shadcn-ui` + `frontend-design` skills)
- [X] T031 [US2] Create `apps/web/src/modules/users/pages/UsersPage.tsx` — layout with UserList, "Nuevo usuario" button (admin only), navigation integration
- [X] T032 [US2] Create `apps/web/src/modules/users/pages/UserDetailPage.tsx` — read-only user detail view (edit capabilities added in US3)
- [X] T033 [US2] Add `/users` and `/users/:id` routes to `apps/web/src/App.tsx` inside RequireAuth wrapper, gated to admin/manager in navigation
- [X] T034 [US2] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US2 tests pass

**Checkpoint**: User directory loads with pagination, search, and filters. Navigate to user detail. Verify in browser with Playwright `browser_navigate` + `browser_snapshot`.

---

## Phase 5: User Story 3 — Admin Updates User Profile and Role (Priority: P3)

**Goal**: Admin can edit user's name, role, freelancer flag. Role changes audited. Last-admin protection.
**Independent Test**: Change a user's role, verify it persists and audit trail shows old/new values.
**Recommended agents**: `senior-backend-engineer` for API, `senior-frontend-engineer` for UI.

### Tests for User Story 3

- [X] T035 [P] [US3] Write service tests for `updateUser()` in `apps/api/src/modules/users/__tests__/service.update.test.ts` — valid update, non-admin restricted to own name fields, admin-only role changes, last-admin protection (FR-012), audit event with old/new values (use `vitest` skill)
- [X] T036 [P] [US3] Write route tests for `PATCH /api/users/:id` in `apps/api/src/modules/users/__tests__/routes.update.test.ts` — 200, 403, 404, 422

### Implementation for User Story 3

- [X] T037 [US3] Implement `updateUser()` in `apps/api/src/modules/users/service.ts` — diff changed fields, enforce admin-only for role/isFreelancer, block role change if last admin, record audit event with old/new values. Email immutable (FR-026).
- [X] T038 [US3] Add `PATCH /users/:id` route in `apps/api/src/modules/users/routes.ts` — non-admin can only update self (compare JWT sub with `:id`)
- [X] T039 [P] [US3] Add `updateUser()` to `apps/web/src/modules/users/services/userService.ts` and `useUpdateUser()` mutation to hooks
- [X] T040 [US3] Create `apps/web/src/modules/users/components/UserDetail.tsx` — edit mode for admin (all fields), non-admin (own name only). Role dropdown, freelancer toggle. Spanish labels. Sync auth store if editing own profile. (use `shadcn-ui` skill)
- [X] T041 [US3] Integrate UserDetail into `UserDetailPage.tsx` — switch between view/edit modes
- [X] T042 [US3] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US3 tests pass

**Checkpoint**: Admin can edit users. Role changes are audited. Last admin is protected.

---

## Phase 6: User Story 8 — Admin Imports Users in Bulk (Priority: P3)

**Goal**: Admin uploads CSV to create multiple users. Partial success allowed. Temp passwords generated.
**Independent Test**: Upload CSV with valid and invalid rows, verify valid users created and errors reported.
**Recommended agents**: `senior-backend-engineer` for API + CSV parser, `senior-frontend-engineer` for UI.

### Tests for User Story 8

- [X] T043 [P] [US8] Write service tests for `bulkImportUsers()` in `apps/api/src/modules/users/__tests__/service.import.test.ts` — valid CSV, partial failures, duplicate emails (in-file + existing), max 100 row limit, invalid headers, empty file, temp password generation (use `vitest` skill)
- [X] T044 [P] [US8] Write route tests for `POST /api/users/import` in `apps/api/src/modules/users/__tests__/routes.import.test.ts` — 200 with results, 400 on invalid file, 403 for non-admin

### Implementation for User Story 8

- [X] T045 [US8] Implement minimal CSV parser utility in `apps/api/src/modules/users/service.ts` (or a private `parseCSV` function) — parse header, validate columns, split rows. ~30 lines, no external library. (follow research.md Decision 2)
- [X] T046 [US8] Implement `bulkImportUsers()` in `apps/api/src/modules/users/service.ts` — validate each row independently, generate temp passwords (`Bp!` + UUID prefix, research.md Decision 3), hash passwords, insert valid users with `mustChangePassword: true`, record audit events, return results array with success/error per row
- [X] T047 [US8] Add `POST /users/import` route in `apps/api/src/modules/users/routes.ts` — handle `multipart/form-data`, extract CSV file text, call service
- [X] T048 [P] [US8] Add `importUsers()` to `apps/web/src/modules/users/services/userService.ts` (multipart upload) and `useImportUsers()` mutation to hooks
- [X] T049 [US8] Create `apps/web/src/modules/users/components/BulkImportForm.tsx` — file input for CSV, upload button, results table showing success/error per row, "Descargar CSV" button for client-side CSV download of results with temp passwords. Spanish labels. (use `shadcn-ui` + `frontend-design` skills)
- [X] T050 [US8] Integrate BulkImportForm into `UsersPage.tsx` — accessible via "Importar usuarios" button (admin only)
- [X] T051 [US8] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US8 tests pass

**Checkpoint**: Admin can upload CSV, see results with temp passwords. Verify via Playwright.

---

## Phase 7: User Story 4 — User Manages Own Profile and Password (Priority: P4)

**Goal**: Any user can view profile, edit own name, change own password. Session revocation on change.
**Independent Test**: Log in as recruiter, change name and password, verify persistence and session revocation.
**Recommended agents**: `senior-backend-engineer` for API, `senior-frontend-engineer` for UI.

### Tests for User Story 4

- [X] T052 [P] [US4] Write service tests for `changePassword()` in `apps/api/src/modules/users/__tests__/service.password.test.ts` — correct current password, wrong current password, new password hashing, session revocation (all others), mustChangePassword cleared, audit event (no password values) (use `vitest` skill)
- [X] T053 [P] [US4] Write route tests for `POST /api/users/:id/change-password` in `apps/api/src/modules/users/__tests__/routes.password.test.ts` — 200, 400 wrong password, 403 not own ID, 422 weak password

### Implementation for User Story 4

- [X] T054 [US4] Implement `changePassword()` in `apps/api/src/modules/users/service.ts` — verify current password (bcrypt compare), hash new password (cost >= 12), set `mustChangePassword = false`, revoke all other refresh tokens (keep current session via token exclusion), record audit event (no password values)
- [X] T055 [US4] Add `POST /users/:id/change-password` route in `apps/api/src/modules/users/routes.ts` — enforce `:id` matches JWT `sub`
- [X] T056 [P] [US4] Add `changePassword()` to `apps/web/src/modules/users/services/userService.ts` and `useChangePassword()` mutation to hooks
- [X] T057 [US4] Create `apps/web/src/modules/users/components/ChangePasswordForm.tsx` — current password, new password, confirm new password fields. Client-side validation (Zod). Spanish labels and error messages. (use `shadcn-ui` skill)
- [X] T058 [US4] Integrate ChangePasswordForm into `UserDetailPage.tsx` — visible to all users on their own profile
- [X] T059 [US4] Update auth store in `apps/web/src/store/auth-store.ts` — sync user data when user edits own name (refresh `ICurrentUser` after successful self-update)
- [X] T060 [US4] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US4 tests pass

**Checkpoint**: Any user can change name and password. Other sessions revoked. Auth store synced.

---

## Phase 8: User Story 5 — Admin Deactivates and Reactivates Users (Priority: P5)

**Goal**: Admin can soft-delete users (revoke sessions) and reactivate them. Self-deactivation blocked. Last-admin protected.
**Independent Test**: Deactivate a user, verify they can't log in. Reactivate, verify access restored.
**Recommended agents**: `senior-backend-engineer` for API, `senior-frontend-engineer` for UI.

### Tests for User Story 5

- [X] T061 [P] [US5] Write service tests for `deactivateUser()` and `reactivateUser()` in `apps/api/src/modules/users/__tests__/service.lifecycle.test.ts` — deactivate sets isActive false, revokes all sessions, self-deactivation blocked, last-admin blocked, reactivate restores isActive, audit events for both (use `vitest` skill)
- [X] T062 [P] [US5] Write route tests for `PATCH /api/users/:id/deactivate` and `PATCH /api/users/:id/reactivate` in `apps/api/src/modules/users/__tests__/routes.lifecycle.test.ts` — 200, 400 self/last-admin, 403 non-admin, 404

### Implementation for User Story 5

- [X] T063 [US5] Implement `deactivateUser()` in `apps/api/src/modules/users/service.ts` — set `isActive = false`, revoke all refresh tokens for user (`UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`), prevent self-deactivation (FR-011), prevent last-admin deactivation (FR-012, count active admins), record audit event
- [X] T064 [US5] Implement `reactivateUser()` in `apps/api/src/modules/users/service.ts` — set `isActive = true`, record audit event
- [X] T065 [US5] Add `PATCH /users/:id/deactivate` and `PATCH /users/:id/reactivate` routes in `apps/api/src/modules/users/routes.ts` — `requireRole("admin")`
- [X] T066 [P] [US5] Add `deactivateUser()`, `reactivateUser()` to `apps/web/src/modules/users/services/userService.ts` and corresponding mutation hooks
- [X] T067 [US5] Create `apps/web/src/components/ConfirmDialog.tsx` — reusable confirmation dialog (already exists — reused existing `useConfirm()` hook)
- [X] T068 [US5] Integrate deactivate/reactivate buttons into `UserDetailPage.tsx` — admin only, with ConfirmDialog. Toggle based on current `isActive` status.
- [X] T069 [US5] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US5 tests pass

**Checkpoint**: Admin can deactivate/reactivate users. Sessions revoked. Self/last-admin protected.

---

## Phase 9: User Story 6 — Admin Resets Another User's Password (Priority: P6)

**Goal**: Admin can reset any user's password. User flagged for forced change. Sessions revoked.
**Independent Test**: Admin resets password, user logs in with new password and is forced to change.

### Tests for User Story 6

- [X] T070 [P] [US6] Write service tests for `resetPassword()` in `apps/api/src/modules/users/__tests__/service.resetpw.test.ts` — password hashing, mustChangePassword set true, all sessions revoked, audit event (no password values) (use `vitest` skill)
- [X] T071 [P] [US6] Write route tests for `POST /api/users/:id/reset-password` in `apps/api/src/modules/users/__tests__/routes.resetpw.test.ts` — 200, 403 non-admin, 404, 422

### Implementation for User Story 6

- [X] T072 [US6] Implement `resetPassword()` in `apps/api/src/modules/users/service.ts` — hash new password (bcrypt cost 12), set `mustChangePassword = true`, revoke all refresh tokens, record audit event (no password value)
- [X] T073 [US6] Add `POST /users/:id/reset-password` route in `apps/api/src/modules/users/routes.ts` — `requireRole("admin")`
- [X] T074 [P] [US6] Add `resetPassword()` to `apps/web/src/modules/users/services/userService.ts` and `useResetPassword()` mutation to hooks
- [X] T075 [US6] Create `apps/web/src/modules/users/components/ResetPasswordDialog.tsx` — dialog with new password field + validation, ConfirmDialog for confirmation. Spanish labels. (use `shadcn-ui` skill)
- [X] T076 [US6] Integrate ResetPasswordDialog into `UserDetailPage.tsx` — admin only, visible on other users' profiles
- [X] T077 [US6] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US6 tests pass

**Checkpoint**: Admin can reset passwords. User forced to change on next login.

---

## Phase 10: User Story 7 — Account Executive Views Assigned Recruiters (Priority: P7)

**Goal**: AE sees only recruiters in the user directory (MVP: all recruiters in tenant). Recruiter sees only self.
**Independent Test**: Log in as AE, verify only recruiters visible. Log in as recruiter, verify only own profile.

### Tests for User Story 7

- [X] T078 [P] [US7] Write service tests for role-scoped visibility in `apps/api/src/modules/users/__tests__/service.visibility.test.ts` — AE sees only recruiters, recruiter sees only self, admin/manager sees all (implemented in service.list.test.ts and service.detail.test.ts)

### Implementation for User Story 7

- [X] T079 [US7] Verify and refine role-scoped filtering in `listUsers()` and `getUserById()` in `apps/api/src/modules/users/service.ts` — AE: filter `role = 'recruiter'`; Recruiter: filter `id = currentUser.id`. Implemented in US2.
- [X] T080 [US7] Update `UsersPage.tsx` and navigation — show user directory to AE (limited view) and recruiter (own profile redirect). Routes accessible to all authenticated users.
- [X] T081 [US7] Run `pnpm turbo test` and `pnpm turbo typecheck` — verify all US7 tests pass

**Checkpoint**: Role-based visibility verified for all 4 roles.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Forced password change flow, tenant isolation verification, final validation.
**Recommended agents**: `multi-tenancy-guardian` for T082, `superpowers:code-reviewer` for T087.

- [X] T082 Implement forced password change flow in frontend — update `RequireAuth` in `apps/web/src/App.tsx` to check `mustChangePassword` from auth store and redirect to `/change-password` route. ForcePasswordChangePage created.
- [ ] T083 [P] Write cross-tenant isolation test in `apps/api/src/modules/users/__tests__/isolation.test.ts` — verify Tenant A cannot see/modify Tenant B users (SC-006). Use `multi-tenancy-guardian` agent to review.
- [X] T084 [P] Verify all Spanish UI text — all frontend components use Spanish labels, buttons, error messages, empty states, confirmation dialogs.
- [X] T089 [P] Verify no PII in application logs — no console.log/error/warn found in `apps/api/src/modules/users/`. No PII leakage.
- [ ] T090 [P] Performance validation for SC-003 and SC-009 — deferred to integration testing (requires real DB).
- [X] T085 Run full test suite: `pnpm turbo lint typecheck test` — 91 API + 73 web = 164 tests all pass, typecheck clean.
- [ ] T086 Validate against quickstart.md scenarios — requires running dev server with real DB.
- [ ] T087 Run `superpowers:code-reviewer` agent against plan.md — verify implementation matches plan, all FRs covered, all SCs met
- [ ] T088 Run `superpowers:verification-before-completion` — confirm all 33 FRs, 9 SCs, 8 user stories implemented and tested

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — first user story (MVP)
- **US2 (Phase 4)**: Depends on Phase 2 — can run in parallel with US1 (different files) but benefits from US1 being done first (needs users to list)
- **US3 (Phase 5)**: Depends on US2 (needs UserDetail page structure)
- **US8 (Phase 6)**: Depends on Phase 2 — can run in parallel with US1-US3 (independent endpoint + UI)
- **US4 (Phase 7)**: Depends on US3 (extends UserDetail with password change)
- **US5 (Phase 8)**: Depends on US3 (extends UserDetail with deactivate/reactivate)
- **US6 (Phase 9)**: Depends on US5 (uses ConfirmDialog pattern)
- **US7 (Phase 10)**: Depends on US2 (refines visibility in existing list)
- **Polish (Phase 11)**: Depends on all stories complete

### User Story Dependencies

```text
Phase 1 (Setup) → Phase 2 (Foundation)
                      │
                      ├── US1 (Create) ──────┐
                      ├── US2 (List/Detail) ──┤
                      │       │               │
                      │       ├── US3 (Update) ─── US4 (Self-service)
                      │       │                │
                      │       ├── US5 (Deactivate) ─── US6 (Reset password)
                      │       │
                      │       └── US7 (Role visibility)
                      │
                      └── US8 (Bulk import) ──┘
                                              │
                                         Phase 11 (Polish)
```

### Within Each User Story

- Tests MUST be written first and FAIL before implementation (TDD)
- Service before routes (routes depend on service functions)
- API before frontend (frontend calls API)
- Core implementation before integration
- Run `pnpm turbo test typecheck` after each story

### Parallel Opportunities

- **Phase 1**: T001, T002, T005, T006, T007 can all run in parallel (different files)
- **Phase 2**: T010, T011 can run in parallel
- **Within stories**: Test tasks marked [P] run in parallel. Frontend service/hooks [P] run in parallel with API tests.
- **Cross-story**: US1 and US8 can run in parallel (independent endpoints). With 2 devs, one takes US1-US3, the other takes US8 → US4 → US5-US6.

---

## Parallel Example: Phase 1 Setup

```text
# Launch all parallel setup tasks:
Agent 1 (db-architect): T001 (users schema) + T002 (audit_events schema)
Agent 2 (senior-backend-engineer): T005 (Zod schemas) + T006 (types) + T007 (auth types)

# Then sequential:
T003 (export schema) + T004 (migration) + T008 (export shared)
```

## Parallel Example: US1 + US8 (Two Developers)

```text
# Developer A (senior-backend-engineer + senior-frontend-engineer):
US1: T014-T015 (tests) → T016-T017 (API) → T018-T020 (frontend) → T021 (verify)

# Developer B (senior-backend-engineer + senior-frontend-engineer):
US8: T043-T044 (tests) → T045-T047 (API) → T048-T050 (frontend) → T051 (verify)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup (types, schemas, migration)
2. Complete Phase 2: Foundational (audit helper, auth mods)
3. Complete Phase 3: US1 — Admin creates a user
4. Complete Phase 4: US2 — Admin lists/searches users
5. **STOP and VALIDATE**: Admin can create users and browse directory
6. Deploy/demo if ready — this is the minimum viable users module

### Incremental Delivery

1. Setup + Foundation → Schema ready, types compiled
2. US1 → Create users (MVP core)
3. US2 → User directory with search/filters (MVP complete)
4. US3 → Profile and role editing
5. US8 → Bulk import (migration enabler)
6. US4 → Self-service password change
7. US5 → Deactivation lifecycle
8. US6 → Admin password reset
9. US7 → Role-based visibility refinement
10. Polish → Forced password flow, E2E, security review

### Two-Developer Split (Hector + Javi)

1. **Together**: Phase 1 + Phase 2 (pair on foundation)
2. **Split**:
   - Hector: US1 → US2 → US3 → US7 → Polish (backend-heavy path)
   - Javi: US8 → US4 → US5 → US6 → Polish (feature-heavy path)
3. **Together**: Phase 11 Polish (E2E testing, code review)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD is MANDATORY: write test → verify it fails → implement → verify it passes
- Commit after each completed task or logical group
- Use `mcp:ide:getDiagnostics` after each file change to catch TypeScript errors early
- Use `plugin:context7` to look up latest Drizzle/Hono/TanStack docs during implementation
- Use `plugin:playwright` for browser E2E validation at checkpoints
- All user-facing strings MUST be in Spanish (FR-033)
- Run `pnpm turbo lint typecheck test` at every checkpoint
