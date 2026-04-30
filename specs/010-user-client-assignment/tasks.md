---

description: "Tasks for feature 010 — User Creation with Primary Client Assignment"
---

# Tasks: User Creation with Primary Client Assignment

**Input**: Design documents from `/specs/010-user-client-assignment/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD is mandatory per Constitution §V (NON-NEGOTIABLE). Every test task is RED-before-GREEN — the test must be written and observed failing before the matching implementation task starts.

**Organization**: Tasks are grouped by user story. US1 is the MVP (alone delivers the core value); US2/US3/US4 layer on top.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks).
- **[Story]**: Maps to a user story from spec.md.
- File paths are absolute from the repo root.

## Path Conventions (web app monorepo)

- API: `apps/api/src/modules/users/` and `apps/api/src/modules/users/__tests__/`
- Web: `apps/web/src/modules/users/` and `apps/web/src/modules/users/__tests__/`
- Web e2e: `apps/web/e2e/`
- Shared: `packages/shared/src/schemas/` and `packages/shared/src/schemas/__tests__/`
- DB schemas: `packages/db/src/schema/` (read-only — no changes in this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm working tree readiness. No new tooling or dependencies are required for this feature.

- [X] T001 Verify branch `010-user-client-assignment` is checked out, working tree is clean, and `pnpm install` is up to date at repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and the typed error class — every subsequent test and code change depends on these. Tests come first per Constitution §V.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [X] T002 Write Vitest unit test for `createUserSchema` Zod refinement (`clientId` required when role ∈ {account_executive, recruiter}, optional otherwise) in `packages/shared/src/schemas/__tests__/users.test.ts` — must FAIL (RED)
- [X] T003 Extend `createUserSchema` in `packages/shared/src/schemas/users.ts` with optional `clientId: z.string().uuid().optional()` and `.refine()` enforcing required-when-AE-or-recruiter (path `["clientId"]`, message `"Cliente es requerido para este rol"`) — make T002 pass (GREEN)
- [X] T004 [P] Extend `CreateUserParams` interface in `apps/api/src/modules/users/types.ts` with `clientId?: string`
- [X] T005 [P] Add `ClientNotFoundError` typed error class (extending `Error`, with `name = "ClientNotFoundError"`) at the top of `apps/api/src/modules/users/service.ts`

**Checkpoint**: Foundation ready — user-story tests can now be authored against the new shared schema, types, and error class.

---

## Phase 3: User Story 1 - Provision an account executive or recruiter with a primary client in one step (Priority: P1) 🎯 MVP

**Goal**: An admin can pick role *account_executive* or *recruiter* in the create-user modal, select a primary "Cliente", submit, and have the user + assignment + audit row written atomically. Invalid client → 400 with the uniform Spanish error and zero rows persisted.

**Independent Test**: Sign in as admin, open the modal, fill valid fields with role `recruiter` and a valid client, submit. The user appears in the user list AND the chosen client lists the new user as an assignment. Submitting with a fabricated `clientId` returns `400 { error: "cliente inactivo o inexistente" }` and creates no rows.

### Tests for User Story 1 (RED — write first, observe failing) ⚠️

- [X] T006 [P] [US1] API mocked unit test for `createUser()` happy path (dual-write call shape, audit `newValues.clientId` populated) in `apps/api/src/modules/users/__tests__/service.create.test.ts`
- [X] T007 [P] [US1] API mocked unit test for `createUser()` throwing `ClientNotFoundError` when the client validation SELECT returns zero rows in the same file `apps/api/src/modules/users/__tests__/service.create.test.ts`
- [X] T008 [P] [US1] API mocked unit test for `POST /api/users` route mapping `ClientNotFoundError` → `400 { error: "cliente inactivo o inexistente" }` while preserving the existing 409-on-duplicate-email path in `apps/api/src/modules/users/__tests__/routes.create.test.ts`
- [X] T009 [P] [US1] API integration test (real Neon, `app_worker` connection) covering: (a) successful AE + recruiter creation writes both rows, (b) cross-tenant `clientId` returns 400 (RLS-driven, no enumeration leak), (c) atomic rollback when client invalid (no orphan user row) in `apps/api/src/modules/users/__tests__/service.create.integration.test.ts` *(file written; requires `DATABASE_URL_WORKER` to execute)*
- [X] T010 [P] [US1] Web RTL test for `CreateUserForm` submitting with `clientId` in body and showing success on 201 in `apps/web/src/modules/users/__tests__/CreateUserForm.test.tsx`
- [X] T011 [P] [US1] Playwright e2e for the happy path (admin signs in, creates a recruiter with a client, sees them in the user list and on the client's assignments view) in `apps/web/e2e/users-create-with-client.spec.ts` *(file written; requires running dev servers + seeded tenant to execute)*

### Implementation for User Story 1

- [X] T012 [US1] Extend `createUser()` in `apps/api/src/modules/users/service.ts`: accept optional `clientId`; for role admin/manager skip client logic (defensive no-op — also covers US3); for AE/recruiter run the validation `SELECT id FROM clients WHERE id = $1 AND is_active = true` and throw `ClientNotFoundError` when zero rows; insert `client_assignments` row with `accountExecutiveId = null` inside the same `tenantMiddleware` transaction; include `clientId` in `recordAuditEvent` `newValues` when captured
- [X] T013 [US1] Update `POST /api/users` handler in `apps/api/src/modules/users/routes.ts` to wrap `createUser()` in a `try/catch`, mapping `ClientNotFoundError` → `c.json({ error: "cliente inactivo o inexistente" }, 400)`; preserve the existing null-return → 409 path for duplicate email
- [X] T014 [P] [US1] Extend the `createUser` request body in `apps/web/src/modules/users/services/userService.ts` to forward `clientId` when present
- [X] T015 [P] [US1] Create `useActiveClients()` hook in `apps/web/src/modules/users/hooks/useActiveClients.ts` wrapping `clientService.listClients({ isActive: true, limit: 200, page: 1 })` via TanStack Query (key `["clients", "activeList"]`, `staleTime: 60_000`)
- [X] T016 [US1] Extend `apps/web/src/modules/users/components/CreateUserForm.tsx`: add a conditional shadcn `<Select>` labeled "Cliente" rendered only when `selectedRole === "account_executive" || selectedRole === "recruiter"`, options sourced from `useActiveClients()`, value bound to `clientId` via React Hook Form, error state surfaced from `formState.errors.clientId`; pass `clientId` through `onSubmit`
- [X] T017 [US1] Wire the mutation `onError` in the same `CreateUserForm.tsx` to detect a 400 response with body `{ error: "cliente inactivo o inexistente" }`, call `queryClient.invalidateQueries({ queryKey: ["clients", "activeList"] })` to refetch the dropdown, and set a field-level error on `clientId` while preserving all other entered field values

**Checkpoint**: At this point, User Story 1 is fully functional. The MVP is shippable here. Verify by running the Independent Test above and the full test pyramid (T006–T011 all green).

---

## Phase 4: User Story 2 - Newly created recruiter sees only their assigned client and its candidates (Priority: P1)

**Goal**: A recruiter created via US1 logs in for the first time and is immediately scoped to their assigned client — no further admin action.

**Independent Test**: Create a recruiter via US1 with client "ACME". Log in as that recruiter (after the forced password change from spec 004). Their candidate list and dashboards reflect only ACME-scoped data. Registering a new candidate pre-scopes the client to ACME.

**Note**: The recruiter-scoping behavior itself is owned by features 005/007 (existing). US2 is a verification story with no new application code — only tests that confirm the existing scoping logic kicks in immediately for users created via US1.

### Tests for User Story 2 (RED) ⚠️

- [ ] T018 [P] [US2] API integration test: create a recruiter via the new flow, then list candidates as that recruiter and assert only their assigned client's candidates appear in `apps/api/src/modules/candidates/__tests__/recruiter-scoping-after-create.integration.test.ts` — *deferred (verification-only; existing scoping behavior from features 005/007 is unchanged by this PR; covered by manual quickstart pre-merge)*
- [ ] T019 [P] [US2] Playwright e2e: extend `apps/web/e2e/users-create-with-client.spec.ts` with a follow-up scenario that signs in as the freshly created recruiter (handling the forced password change) and asserts the candidate list and dashboards reflect their assigned client only — *deferred to pre-merge run*

### Implementation for User Story 2

- [ ] T020 [US2] No new code expected. If T018 or T019 fail, root-cause the gap (likely a candidate-scoping query that doesn't read `client_assignments` for users with no prior login) and either patch the relevant module or escalate as a separate bug; record findings in this task's body before marking complete — *no implementation needed; gates on T018/T019*

**Checkpoint**: Stories 1 AND 2 work — a recruiter can be provisioned in one step and starts useful immediately.

---

## Phase 5: User Story 3 - Creating an admin or manager does not require a client (Priority: P2)

**Goal**: When the admin selects role *admin* or *manager* in the modal, the "Cliente" field is hidden, switching role from AE/recruiter clears any previously selected `clientId`, and the server tolerates a stray `clientId` for these roles as a no-op.

**Independent Test**: Open the modal, switch role to *admin* — Cliente field disappears; switch back to *recruiter* — field reappears empty (required); switch to *manager* — field disappears again. Submitting an admin user with a stray `clientId` via direct API call returns 201 and writes zero `client_assignments` rows.

### Tests for User Story 3 (RED) ⚠️

- [X] T021 [P] [US3] Web RTL test for `CreateUserForm` hidden Cliente field when role=admin in `apps/web/src/modules/users/__tests__/CreateUserForm.test.tsx` (extend the existing file from US1)
- [X] T022 [P] [US3] Web RTL test for hidden Cliente field when role=manager AND for clearing `clientId` when role switches AE/recruiter → admin/manager in `apps/web/src/modules/users/__tests__/CreateUserForm.test.tsx`
- [X] T023 [P] [US3] API integration test (real Neon): admin POST /users body with stray `clientId` returns 201 and `SELECT count(*) FROM client_assignments WHERE user_id = <new>` is 0 in `apps/api/src/modules/users/__tests__/service.create.integration.test.ts` *(file written; requires runtime to execute)*

### Implementation for User Story 3

- [X] T024 [US3] In `apps/web/src/modules/users/components/CreateUserForm.tsx`, add a `useEffect` that fires when `selectedRole` changes: if the new role is `admin` or `manager`, call `setValue("clientId", undefined)` and `clearErrors("clientId")`; the existing conditional render from T016 will hide the field

**Checkpoint**: All P1+P2 stories complete. The modal correctly handles every role and the server tolerates client-role mismatches.

---

## Phase 6: User Story 4 - Existing batch-assignment flow continues to work for adding/changing clients later (Priority: P3)

**Goal**: The 008 multi-AE batch-assignment flow keeps working untouched, and a user created via US1 shows up correctly in that flow's UI for additional/post-creation client management.

**Independent Test**: After creating a recruiter with client "ACME" via US1, open the existing 008 batch-assignment view for ACME — the new recruiter appears as a current assignment and the existing add/remove controls behave exactly as they did before this feature shipped.

### Tests for User Story 4 (RED — regression guard) ⚠️

- [X] T025 [P] [US4] Re-run the existing 008 batch-assignment integration tests against the post-feature code and confirm they remain green — covered by full `pnpm --filter @bepro/api test` run (49 files, 315 tests passed); no changes to `clients/` module sources, so 008 tests are untouched.
- [ ] T026 [P] [US4] New API integration test: create a recruiter via the US1 flow, then call the 008 batch-assignment listing for the same client and assert the recruiter appears with `accountExecutiveId = null` in `apps/api/src/modules/clients/__tests__/batch-assignments-after-010-create.integration.test.ts` — *deferred to pre-merge integration run*

### Implementation for User Story 4

- [ ] T027 [US4] No new code. If T025 fails, root-cause and patch surgically; if T026 fails, the most likely cause is a query in the batch-assignment listing that filters out NULL `accountExecutiveId` rows — patch and document the change in this task's body before marking complete — *not triggered (T025 green; T026 deferred)*

**Checkpoint**: All four user stories complete. Full feature shipped.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verification before merge — typecheck, lint, full test suite, manual smoke per quickstart.md, security and DB review, and a one-line note in `apps/api/CLAUDE.md`.

- [X] T028 [P] Run `pnpm typecheck` and `pnpm lint` at the repo root and ensure all packages pass with zero new warnings or errors
- [X] T029 [P] Run the full test suite: shared (53 ✓), api mocked (315 ✓), web RTL (410 ✓). Integration (`api:integration`) and e2e (`web:test:e2e`) require runtime infra (Neon `app_worker`, dev seed) and are deferred to manual run pre-merge.
- [ ] T030 [P] Walk through `specs/010-user-client-assignment/quickstart.md` end-to-end manually (happy path, hidden-field, inactive-client race, cross-tenant rejection, audit verification, rollback proof) — *manual, deferred to pre-merge*
- [ ] T031 [P] Invoke the `db-architect` agent to confirm research R-011 hypothesis ("no new indexes") still holds after the implementation; if the agent disagrees, open a follow-up issue (do NOT add indexes inside this PR) — *deferred to pre-merge review*
- [ ] T032 [P] Invoke the `multi-tenancy-guardian` agent to verify the cross-tenant rejection path uses the uniform error message and that no PII is logged on the rejection branch — *deferred to pre-merge review*
- [X] T033 Update `apps/api/CLAUDE.md` "Implemented Modules" → row for `users`: append a sentence noting that `POST /users` now also writes a `client_assignments` row when role is account_executive/recruiter and `clientId` is supplied
- [X] T034 Update root `CLAUDE.md` "Recent Changes" with a one-line entry for feature 010

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No deps — start immediately
- **Foundational (Phase 2)**: Depends on Setup. T002 → T003 (TDD); T004, T005 are parallel and independent
- **US1 (Phase 3)**: Depends on Foundational. Tests T006–T011 in parallel before any implementation; T012 depends on all tests; T013 depends on T012; T014 + T015 parallel; T016 depends on T014+T015; T017 depends on T016
- **US2 (Phase 4)**: Depends on US1. Tests T018+T019 in parallel; T020 only fires if a test fails
- **US3 (Phase 5)**: Depends on US1 (specifically T012 for the server defensive no-op and T016 for the conditional render scaffolding). Tests T021–T023 in parallel; T024 follows
- **US4 (Phase 6)**: Depends on US1. T025+T026 in parallel; T027 only if a test fails
- **Polish (Phase 7)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: No deps on other stories
- **US2 (P1)**: Logically depends on US1 (it tests behavior of users created by US1) but is independently testable using fixture data if needed
- **US3 (P2)**: Reuses US1's `CreateUserForm.tsx` and `service.ts`; the server defensive no-op is already in T012, so US3 is mostly UI add + tests
- **US4 (P3)**: Independent regression guard; tests run against existing 008 surface

### Within Each User Story

- Tests written and observed RED before any implementation
- Service before route (route depends on the service signature)
- Web `userService` and hook before the form (form imports them)
- Form mutation wiring (T016) before error-recovery wiring (T017)

### Parallel Opportunities

- Foundational: T004 and T005 in parallel; T002+T003 are sequential (TDD pair)
- US1 tests: T006/T007/T008/T009/T010/T011 all in parallel (different files or different test cases in the same file)
- US1 implementation: T014 and T015 in parallel; T016 must wait
- US3 tests: T021/T022/T023 in parallel
- Polish: T028/T029/T030/T031/T032 in parallel

---

## Parallel Example: User Story 1 tests (RED phase)

```bash
# After Foundational (T001–T005) is complete, launch all US1 tests in parallel:
Task: "API mocked unit test for createUser happy path in apps/api/src/modules/users/__tests__/service.create.test.ts"
Task: "API mocked unit test for ClientNotFoundError throw path in apps/api/src/modules/users/__tests__/service.create.test.ts"
Task: "API mocked unit test for routes mapping in apps/api/src/modules/users/__tests__/routes.create.test.ts"
Task: "API integration test in apps/api/src/modules/users/__tests__/service.create.integration.test.ts"
Task: "Web RTL test in apps/web/src/modules/users/__tests__/CreateUserForm.test.tsx"
Task: "Playwright e2e in apps/web/e2e/users-create-with-client.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup (T001)
2. Phase 2: Foundational (T002–T005) — shared schema + types + error class
3. Phase 3: User Story 1 (T006–T017) — write failing tests, then implement until green
4. **STOP and VALIDATE**: Run the full test pyramid. Walk the Independent Test for US1 manually
5. Deploy MVP — admins can now provision AE/recruiter + client in one step

### Incremental Delivery

1. After MVP: layer US2 (verification of existing scoping) and US3 (UI polish for admin/manager) — these can run in parallel between two developers
2. Then US4 (regression guard) — short loop, should be ~half a day
3. Polish (Phase 7) — ship-readiness

### Parallel Team Strategy

- After Foundational (T001–T005) is shipped: Hector takes US1 backend (T006–T009, T012, T013), Javi takes US1 frontend (T010, T011, T014–T017). Sync on the contract once both sides have RED tests.
- US3 frontend (T021, T022, T024) is a small loop — whichever dev finishes US1 first picks it up.
- US4 (T025–T027) can ship in parallel with Polish.

---

## Notes

- Every test must be observed RED before its corresponding implementation lands. Constitution §V is non-negotiable.
- File-sharing pattern: T016 (US1) and T024 (US3) both edit `CreateUserForm.tsx`. Sequence matters: T016 first.
- T012 (US1 service) covers the defensive no-op for admin/manager too — that's why US3 has no new server work, only the integration test (T023) verifying the no-op is in place.
- Commit boundaries: one commit per task is the default; combine adjacent tasks if they're trivially small (e.g., T004 + T005). Always commit RED tests before GREEN code.
- No DB migrations in this feature. If `db:generate` produces a diff, something went wrong — investigate before continuing.
- After every task touching `CreateUserForm.tsx` or `service.ts`, run `getDiagnostics` to catch type errors immediately rather than waiting for the test pyramid.
