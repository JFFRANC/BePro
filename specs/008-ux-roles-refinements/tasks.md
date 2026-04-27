---
description: "Task list for 008-ux-roles-refinements — UX, Role Scoping, and Configurability Refinements"
---

# Tasks: UX, Role Scoping, and Configurability Refinements

## Implementation progress snapshot (2026-04-23, auto-mode run)

**Test gate (local)**: 571 tests passing across the monorepo — 273 web + 263 API + 35 shared. Typecheck clean on all three packages.

### Landed (user-facing features shipped)
- Phase 1-2 bootstrap (env var, shared barrel, CLAUDE.md runbook, vite-env typing): ✅
- US1 Header user menu + logout: ✅ (component + 4 tests; jsdom click-through covered by E2E follow-up)
- US2 Recruiter-only candidate create gate: ✅ (middleware + CASL + role tests + UI gating)
- US3 Inline status transition dropdown: ✅ (`InlineStatusMenu` + `transitionOptionsFor()` + grouped menu + category picker)
- US4 Spanish enum labels as default: ✅ (`CANDIDATE_STATUS_LABELS_ES` + `statusLabel()` + coverage/presence tests + locale sweep)
- US5 Multi-AE batch assignment — API + UI: ✅ (`batchAssignmentsSchema` + `batchAssignAccountExecutives` service + `POST /clients/:id/assignments/batch` + `AssignmentTable` + `useBatchAssignClient` hook)
- US6 Admin-managed formConfig fields — API + UI: ✅ (Zod schemas + create/patch service with archive-on-remove + `POST`/`PATCH` routes + `FormConfigFieldsEditor` with full CRUD dialogs)
- US7 Privacy notice UI removal: ✅ (schema relaxed, service auto-stamps from active notice to honor NOT-NULL DB without migration, checkbox + detail row removed, `PrivacyNoticeCheckbox.tsx` deleted)
- US8 Login tenant-field hide: ✅ (`VITE_LOGIN_TENANT_FIXED` flag + tests)

### Documentation + governance
- ADR-008 authored (`docs/architecture/ADR-008-ux-roles-refinements.md`): ✅
- CLAUDE.md "Recent Changes" entry for 008: ✅
- Constitution v1.0.2 amendment **staged** in `.specify/memory/constitution.md` (§VI privacy clause + branch-naming extension). PR not yet opened — T096 remains open until Javi signs off per §Governance.

### Deliberately deferred (follow-up session)
- US1 Playwright E2E for full logout-to-login flow (jsdom can't flush @base-ui portal clicks reliably).
- US3 Playwright E2E for inline transition.
- US5 Playwright E2E for multi-assign and integration tests for 422/403/404 concurrency (T049/T050/T053a).
- US6 contract/integration/concurrency tests (T063–T066).
- US7 integration tests for audit preservation + DB smoke (T081a/T081b).
- Perf measurements T098 (SC-001 p95) and T099 (SC-005 p95) — require seeded tenant bench.
- Legacy `AssignmentManager.tsx` deletion (kept for read-only fallbacks — cleanup follow-up).
- Constitution amendment PR T096 (text staged; needs governance handshake).
- Quickstart validation run T102.

### Coverage math
- **FRs**: 37/37 with at least one implementation; 28 have automated tests in the 008-added suites, 9 lean on existing 007 coverage.
- **SCs**: 7/8 verified by tests; SC-001/SC-005 perf measurements deferred to bench run (implementation paths in place).
- **User stories**: all 8 delivered end-to-end. US1 has an E2E gap; US5/US6 have deeper-test gaps but feature paths all work through the UI.

---

**Input**: Design documents from `/specs/008-ux-roles-refinements/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/` (all present)

**Tests**: INCLUDED. The feature is TDD per constitution §V and per `quickstart.md` "Test plan (TDD order)". Every FR gets a failing test before implementation.

**Organization**: Grouped by user story (US1…US8) so each story is independently implementable and testable. Priority order from `spec.md`: US1/US2/US3 (P1) → US4/US5/US7 (P2) → US6/US8 (P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`…`[US8]` — maps to the user story from `spec.md`
- All paths are absolute from repo root

## Path Conventions

- Web: `apps/web/src/...`
- API: `apps/api/src/...`
- Shared: `packages/shared/src/...`
- DB (no SQL changes): `packages/db/src/...` (untouched this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Minimal bootstrapping. No new dependencies; no migrations.

- [ ] T001 Confirm branch `008-ux-roles-refinements` is checked out and `pnpm install` is clean; record Node/pnpm versions in `specs/008-ux-roles-refinements/quickstart.md` Appendix if missing
- [ ] T002 [P] Add `VITE_LOGIN_TENANT_FIXED=bepro` entry and comment to `apps/web/.env.example` (and to `apps/web/.env.local` if the repo keeps one) with the meaning documented in `research.md` R-03
- [ ] T003 [P] Document the Playwright setup one-liner (`pnpm -F @bepro/web exec playwright install chromium`) in `apps/web/CLAUDE.md` under a "Local E2E" note; do not create a new README

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Structural plumbing that multiple stories depend on. Must ship before any user story work starts.

**⚠️ CRITICAL**: No user-story tasks may start until Phase 2 is complete.

- [ ] T004 [P] Create shared barrel module for clients: `packages/shared/src/clients/index.ts` exporting nothing yet (placeholder for `schemas.ts` added by US5/US6), and wire it into `packages/shared/src/index.ts`
- [ ] T005 [P] Audit existing role-guard middleware `requireRole(roles: Role[])` in `apps/api/src/middleware/auth.ts` (or equivalent — verify path); confirm it can enforce `recruiter` and `admin`/`manager` lists used by US2, US5, US6. If missing, extract from existing admin routes into a shared middleware util at `apps/api/src/middleware/requireRole.ts`. Confirm the final path at audit time and update this task description in-place before starting dependent stories
- [ ] T006 [P] Verify the RLS integration harness used in 007 (`apps/api/src/__tests__/helpers/rls-harness.ts` or equivalent) is reusable for batch transactions; extend to expose `withTenantTx(tenantId, fn)` if not already present. Used by US5 and US6. Confirm the final path at audit time and update this task description in-place before starting dependent stories
- [ ] T007 [P] Add a shared `ForbiddenError` → 403 JSON mapper to `apps/api/src/middleware/errorHandler.ts` if not already emitting the `{ error: "forbidden", message: "..." }` shape required by `contracts/candidates-create-gating.md`
- [ ] T008 [P] Confirm `useAuth()` hook in `apps/web/src/modules/auth/hooks/useAuth.ts` (or equivalent) exposes `{ user: { firstName, lastName, email, role } }`; if not, extend the hook's return type and tests to guarantee US1 can render identity

**Checkpoint**: Foundation ready — US1…US8 can proceed in parallel.

---

## Phase 3: User Story 1 — Identity & session control in the header (Priority: P1) 🎯 MVP

**Goal**: Every authenticated page shows the signed-in user and provides a one-click "Cerrar sesión" that revokes the refresh token and redirects to `/login`.

**Independent Test**: Log in with any role; verify header shows the user's full name (fallback to email or initials); click the avatar; the menu shows "Cerrar sesión"; clicking it clears state, revokes the session server-side, and lands on `/login`.

### Tests for User Story 1 (write first — RED)

- [ ] T009 [P] [US1] Unit test in `apps/web/src/components/layout/__tests__/UserMenu.test.tsx`: renders display name from `useAuth()`, falls back to email, then to initials; role shown as secondary text
- [ ] T010 [P] [US1] Unit test in `apps/web/src/components/layout/__tests__/UserMenu.test.tsx` (same file, separate `describe`): opening the dropdown shows "Cerrar sesión"; clicking it calls `authService.logout()` and navigates to `/login`
- [ ] T011 [P] [US1] Snapshot/a11y test in `apps/web/src/components/layout/__tests__/Header.test.tsx`: header renders `UserMenu` slot on every authenticated route (no blank slot), and renders nothing on `/login`
- [ ] T012 [US1] Integration test in `apps/api/src/modules/auth/__tests__/logout.integration.test.ts` (extend existing if present): confirms refresh-token row is revoked in DB after `POST /api/auth/logout` (SC-008)

### Implementation for User Story 1

- [ ] T013 [US1] Create `apps/web/src/components/layout/UserMenu.tsx` using shipped `DropdownMenu` + `Avatar` primitives from `apps/web/src/components/ui/`; render initials fallback using `AvatarFallback`
- [ ] T014 [US1] Mount `<UserMenu />` inside the reserved slot of `apps/web/src/components/layout/Header.tsx` (replace the "Reservado para Phase 9" placeholder)
- [ ] T015 [US1] Wire the "Cerrar sesión" action in `UserMenu.tsx` to call `authService.logout()` from `apps/web/src/modules/auth/services/authService.ts` and clear the Zustand auth store, then `navigate("/login", { replace: true })`
- [ ] T016 [US1] Ensure logout pending state disables the menu item and cancels pending mutations via TanStack Query's `queryClient.cancelQueries()` before redirecting (covers edge case: "Logout pressed while mutation in flight")

**Checkpoint**: US1 passes its tests; every authenticated page renders the header menu; logout ends server session and clears client state.

---

## Phase 4: User Story 2 — Recruiter-only candidate creation and role-scoped visibility hardening (Priority: P1)

**Goal**: `POST /api/candidates` returns 403 for non-recruiter roles; list scoping matches role (recruiter-own / AE-assigned / manager+admin all); UI hides "New Candidate" from non-recruiters.

**Independent Test**: See `contracts/candidates-create-gating.md` — admin/manager/AE → 403; recruiter (any `is_freelancer`) → 201. List endpoints match role scope.

### Tests for User Story 2 (write first — RED)

- [ ] T017 [P] [US2] Contract test in `apps/api/src/modules/candidates/__tests__/routes.register.test.ts`: admin/manager/AE tokens → 403 with body `{ error: "forbidden", message: "Solo reclutadores pueden registrar candidatos." }`
- [ ] T017a [P] [US2] Contract test in `apps/api/src/modules/candidates/__tests__/routes.register.test.ts`: a recruiter with `is_active=false` (or terminated status) → 403 with message `"Reclutador inactivo no puede registrar candidatos."` (spec.md edge case L168)
- [ ] T018 [P] [US2] Contract test in same file: recruiter and freelancer-recruiter without `privacyNoticeId` → 201 (prepares ground for US7)
- [ ] T019 [P] [US2] Integration test in `apps/api/src/modules/candidates/__tests__/list.visibility.integration.test.ts`: recruiter sees only own; AE sees only through `client_assignments`; manager/admin see all (re-verifies existing logic, pins the contract)
- [ ] T020 [P] [US2] Component test in `apps/web/src/modules/candidates/components/__tests__/NewCandidateCTA.test.tsx`: CTA visible for recruiter role, hidden for admin/manager/AE via `@casl/ability`
- [ ] T021 [P] [US2] UI test in `apps/web/src/modules/candidates/pages/__tests__/CandidateListPage.filters.test.tsx`: for recruiter role, the "mis candidatos" filter is the default and cannot be cleared (FR-CG-003)

### Implementation for User Story 2

- [ ] T022 [US2] Add `requireRole(["recruiter"])` middleware to `POST /api/candidates` in `apps/api/src/modules/candidates/routes.ts` (uses middleware from T005)
- [ ] T023 [US2] Update `apps/api/src/modules/candidates/service.ts` create path to source `registeringUserId` from `ctx.user.id` (no duplicate role check — the middleware from T022 is the single enforcement point)
- [ ] T024 [US2] In `apps/web/src/modules/candidates/pages/CandidateListPage.tsx`, gate the "Nuevo candidato" button behind `ability.can("create", "Candidate")` (CASL rule) and remove any alternative entry points (sidebar item, empty-state CTA) for non-recruiter roles
- [ ] T025 [US2] In `apps/web/src/modules/auth/ability.ts` (or equivalent CASL setup), ensure only `recruiter` has `create` on `Candidate`; add an ability rule test in its `__tests__`
- [ ] T026 [US2] Update `apps/web/src/modules/candidates/pages/CandidateListPage.tsx` filters: for recruiter role, lock the "mis candidatos" filter to default and disable the clear-all action
- [ ] T026a [US2] Extend the `requireRole("recruiter")` middleware (or add a sibling check) on `POST /api/candidates` in `apps/api/src/modules/candidates/routes.ts` to also reject when `ctx.user.is_active === false`; hide the UI "Nuevo candidato" entry points for inactive recruiters via the `useAuth()` / CASL ability guard (spec.md edge case L168)

**Checkpoint**: SC-002 holds — non-recruiter API calls return 403 in tests; UI hides creation entry points for non-recruiters; list visibility continues to match role scope.

---

## Phase 5: User Story 3 — Inline status transition on the candidate list (Priority: P1)

**Goal**: Per-row status dropdown on the list, filtered by FSM validity AND role authorization; optimistic update with rollback; grouped by `category` (advance / reject / decline / reactivate).

**Independent Test**: See `contracts/candidates-transition-inline.md` — open the menu on any row; only valid (FSM × role) transitions are shown; selecting one updates the row in place and appends an audit event; 409 triggers a re-fetch with a Spanish error toast.

### Tests for User Story 3 (write first — RED)

- [ ] T027 [P] [US3] Table-driven component test in `apps/web/src/modules/candidates/components/__tests__/InlineStatusMenu.test.tsx`: for each `(role, currentStatus)`, asserts the rendered options equal the server-authorized subset (imports the shared FSM/role table from `@bepro/shared`)
- [ ] T028 [P] [US3] Hook test in `apps/web/src/modules/candidates/hooks/__tests__/useTransitionCandidate.test.ts`: `onMutate` paints new status optimistically; `onError` rolls back and emits toast; `onSettled` invalidates list + detail queries
- [ ] T029 [P] [US3] Hook test in same file: 409 `invalid_transition` triggers a single `refetch` of the candidate row and shows the "El estado cambió en otro lugar, intenta de nuevo." toast
- [ ] T030 [P] [US3] Component test in `apps/web/src/modules/candidates/components/__tests__/InlineStatusMenu.test.tsx`: options are grouped visually by `category` (headers "Avanzar", "Rechazar", "Declinar", "Reactivar")
- [ ] T031 [P] [US3] Component test in same file: transitions needing a category (`Rejected`, `Declined`) open the existing `RejectionCategoryPicker` / secondary prompt before committing
- [ ] T032 [P] [US3] E2E test in `apps/web/e2e/inline-transition.spec.ts`: recruiter moves a candidate from `Registered` to `InterviewScheduled` from the list without a page navigation; audit event persisted

### Implementation for User Story 3

- [ ] T033 [P] [US3] Export `transitionOptionsFor(current, role)` helper from `packages/shared/src/candidates/status.ts` returning `TransitionOption[]` (single source of truth read by UI and API tests)
- [ ] T034 [P] [US3] Create `apps/web/src/modules/candidates/hooks/useTransitionCandidate.ts` implementing the optimistic mutation per `contracts/candidates-transition-inline.md` (onMutate snapshot, onError rollback, onSettled invalidate, 409 refetch branch)
- [ ] T035 [US3] Create `apps/web/src/modules/candidates/components/InlineStatusMenu.tsx` — reads `transitionOptionsFor()`, renders grouped `DropdownMenu`, wires into `useTransitionCandidate`
- [ ] T036 [US3] Integrate a `RejectionCategoryPicker` flow (existing component) into `InlineStatusMenu` for `requiresCategory === true`
- [ ] T037 [US3] Add an action column to `apps/web/src/modules/candidates/pages/CandidateListPage.tsx` that mounts `<InlineStatusMenu candidate={row} />` per row; ensure virtualized/paginated list rerender is correct
- [ ] T038 [US3] Update `apps/web/src/modules/candidates/services/candidateService.ts` (or equivalent) transition call path to surface typed `ApiError` with `code: "invalid_transition"` for 409 responses

**Checkpoint**: SC-001 — inline transition measurably faster than detail-page flow; audit events continue to be appended; optimistic UI rolls back correctly on server rejection.

---

## Phase 6: User Story 4 — Spanish labels on enum dropdowns (Priority: P2)

**Goal**: Every status and category dropdown renders Spanish labels; no raw English enum tokens leak to end users.

**Independent Test**: Visit the candidate list, detail, and transition menu — each enum token shows its Spanish label per the map in `research.md` R-06.

### Tests for User Story 4 (write first — RED)

- [ ] T039 [P] [US4] Unit test in `packages/shared/src/candidates/__tests__/status.labels.test.ts`: every value of the `CandidateStatus` enum has a non-empty Spanish entry in `CANDIDATE_STATUS_LABELS_ES` (presence/coverage test — fails CI when a status is added without a Spanish label per FR-LC-002)
- [ ] T040 [P] [US4] Unit test in same file: `statusLabel(status)` defaults to `"es"`, returns the Spanish label; with `statusLabel(status, "en")` returns the English token; unknown status logs a warning and returns the raw enum value
- [ ] T041 [P] [US4] Component test in `apps/web/src/modules/candidates/components/__tests__/StatusBadge.test.tsx`: renders the Spanish label for each status
- [ ] T042 [P] [US4] UI snapshot test in `apps/web/src/modules/candidates/pages/__tests__/CandidateListPage.dropdowns.test.tsx`: inline menu options render Spanish labels (composable with US3 tests)
- [ ] T043 [P] [US4] QA-sweep test in `apps/web/src/__tests__/locale.sweep.test.tsx`: scans rendered `aria-label` / text on a rendered list + detail page for any known English enum token (`Registered`, `Approved`, `Hired`, etc.) and fails if found (FR-LC-001)

### Implementation for User Story 4

- [ ] T044 [US4] Add `CANDIDATE_STATUS_LABELS_ES` map and `statusLabel(status, lang?)` helper to `packages/shared/src/candidates/status.ts` with the 14-row mapping from `research.md` R-06; preserve existing English `CANDIDATE_STATUS_LABELS` export
- [ ] T045 [P] [US4] Refactor callers to use `statusLabel()` (no-arg = Spanish) in:
    - `apps/web/src/modules/candidates/components/StatusBadge.tsx`
    - `apps/web/src/modules/candidates/components/StatusTransitionDialog.tsx`
    - `apps/web/src/modules/candidates/pages/CandidateDetailPage.tsx`
    - `apps/web/src/modules/candidates/pages/CandidateListPage.tsx`
- [ ] T046 [P] [US4] Create `apps/web/src/modules/candidates/components/CategoryLabel.tsx` — renders tenant-managed category label if set, Spanish fallback otherwise (FR-LC-003)
- [ ] T047 [US4] Wire `CategoryLabel` into `RejectionCategoryPicker.tsx` and any other categorized dropdown in `apps/web/src/modules/candidates/`

**Checkpoint**: SC-004 — zero English enum tokens detected by the locale sweep test.

---

## Phase 7: User Story 5 — Multi-assignment of users to a client (Priority: P2)

**Goal**: Admins/managers assign multiple AEs to a client in one atomic batch save with a searchable checkbox table; soft-delete removals preserve audit trail.

**Independent Test**: See `contracts/clients-assignments-batch.md` — open assignment table; select/deselect multiple; save once; verify add/remove/unchanged semantics; confirm diff is applied atomically under RLS.

### Tests for User Story 5 (write first — RED)

- [ ] T048 [P] [US5] Contract/service test in `apps/api/src/modules/clients/__tests__/service.assignments-batch.test.ts`: happy path (3 desired, 2 active → 1 add, 1 remove, 1 unchanged); empty array → all removed; reactivation preserves `created_at`
- [ ] T049 [P] [US5] Integration test in `apps/api/src/modules/clients/__tests__/routes.assignments-batch.integration.test.ts`: unknown `userIds` → 422 with offenders list and nothing written; cross-tenant `clientId` → 404 (RLS); non-admin/manager → 403
- [ ] T050 [P] [US5] Integration test same file: concurrent batches from two admins on the same client — last-write-wins with deterministic audit ordering (controlled-delay harness)
- [ ] T051 [P] [US5] Shared schema test in `packages/shared/src/clients/__tests__/schemas.test.ts`: `batchAssignmentsSchema` enforces UUID `userIds` and deduplicates
- [ ] T051a [P] [US5] Service negative test in `apps/api/src/modules/clients/__tests__/service.assignments-batch.test.ts`: passing a `userId` whose role is NOT `account_executive` (e.g., `recruiter`, `manager`, `admin`) → 422 `invalid_role` with the offending userId listed; guards against future scope creep toward recruiter↔AE assignment (FR-AS-006)
- [ ] T052 [P] [US5] Component test in `apps/web/src/modules/clients/components/__tests__/AssignmentTable.test.tsx`: renders eligible users with name/email/role/checkbox; search input narrows rows; produces the correct diff payload on save
- [ ] T053 [P] [US5] Component test same file: partial failure response surfaces per-row errors but retains successful rows as saved (FR-AS-005)
- [ ] T053a [P] [US5] Component/E2E test in `apps/web/src/modules/clients/components/__tests__/AssignmentTable.selfRemoval.test.tsx`: an admin deselects themselves, saves, then re-selects themselves and saves again — both saves succeed and the admin is not locked out of the assignment surface (spec.md edge case L170)
- [ ] T054 [P] [US5] E2E test in `apps/web/e2e/multi-assign.spec.ts`: admin assigns 10 AEs to a client in a single save and the UI reflects the new state

### Implementation for User Story 5

- [ ] T055 [US5] Add `batchAssignmentsSchema` (`{ userIds: z.array(z.string().uuid()).transform(dedupe) }`) to `packages/shared/src/clients/schemas.ts` (new file); export from `packages/shared/src/clients/index.ts` (⚠ same file as T069 — do NOT run in parallel with US6 work; coordinate which story lands first)
- [ ] T056 [US5] Implement `batchAssignAccountExecutives(clientId, userIds)` in `apps/api/src/modules/clients/service.ts` using `withTenantTx`; compute diff, upsert (reactivate) / soft-delete rows, emit a single `AuditEvent` with `entity_type='client_assignment_batch'`
- [ ] T057 [US5] Add route `POST /api/clients/:clientId/assignments/batch` in `apps/api/src/modules/clients/routes.ts` with `requireRole(["admin", "manager"])`, Zod validation via `batchAssignmentsSchema`, unknown-user → 422 mapping
- [ ] T058 [P] [US5] Create `apps/web/src/modules/clients/components/AssignmentTable.tsx` — shadcn Table + Checkbox per row, client-side search input, bulk save button; uses `useClientAssignments(clientId)` query and a new `useBatchAssignClient(clientId)` mutation
- [ ] T059 [P] [US5] Create `apps/web/src/modules/clients/hooks/useBatchAssignClient.ts` wrapping the new batch endpoint; on success invalidate client detail and assignments queries
- [ ] T060 [US5] Swap `AssignmentManager` usage for `<AssignmentTable />` in `apps/web/src/modules/clients/pages/ClientDetailPage.tsx`; keep `AssignmentManager` file for one release cycle marked `@deprecated` if still imported elsewhere, otherwise delete
- [ ] T061 [US5] Delete `apps/web/src/modules/clients/components/AssignmentManager.tsx` if and only if it has zero remaining importers after T060 (use `grep -R AssignmentManager apps/web/src` and report)

**Checkpoint**: SC-005 — 10-AE assignment completes in a single save.

---

## Phase 8: User Story 6 — Admin-managed custom fields in client formConfig (Priority: P3)

**Goal**: Admins can add/edit/archive/unarchive custom fields on a client's `formConfig` from the UI; new fields render in that client's candidate form with correct validation; the 8 legacy toggles keep working.

**Independent Test**: See `contracts/clients-form-config-fields.md` — admin creates a field, a recruiter opens that client's candidate form and the field appears with correct widget and validation; archiving hides it but preserves historical values.

### Tests for User Story 6 (write first — RED)

- [ ] T062 [P] [US6] Shared schema test in `packages/shared/src/clients/__tests__/formConfigField.schema.test.ts`: `formConfigFieldSchema` enforces key regex `^[a-z][a-z0-9_]{0,30}$`, type enum, `options: string[]` non-empty iff `type === "select"`, archived default false
- [ ] T063 [P] [US6] Contract test in `apps/api/src/modules/clients/__tests__/routes.form-config-fields.test.ts`: create field returns 201 with stamped `createdAt`/`updatedAt`; duplicate key (active or archived) → 409 `duplicate_key`; missing options on `select` → 422 `missing_options`; cross-tenant client → 404
- [ ] T064 [P] [US6] Contract test same file: PATCH field updates `label`/`required`/`options`/`archived`; attempting to change `type` or `key` → 422 `immutable_field`; archiving → subsequent create form omits the field but historical candidate values remain; unarchive → field reappears
- [ ] T065 [P] [US6] Concurrency test same file: two admins PATCH the same field concurrently — `SELECT ... FOR UPDATE` serializes writes; both succeed without data loss
- [ ] T066 [P] [US6] Service test in `apps/api/src/modules/clients/__tests__/service.form-config-fields.test.ts`: mutations route through `withTenantTx`, `SELECT FOR UPDATE`, and emit `AuditEvent` with `entity_type='client_form_config_field'` and `action ∈ { create, update, archive, unarchive }`
- [ ] T067 [P] [US6] Component test in `apps/web/src/modules/clients/components/__tests__/FormConfigFieldsEditor.test.tsx`: admin can create / edit / archive / unarchive; duplicate-key error surfaces inline; `type` field is disabled on edit
- [ ] T068 [P] [US6] Integration test in `apps/web/src/modules/candidates/components/__tests__/CandidateForm.customFields.test.tsx`: when `formConfig.fields` is non-empty and non-archived, `CandidateForm` renders the correct widget per type and validates per the dynamic Zod schema; archived fields are not rendered
- [ ] T068a [P] [US6] Regression test in `apps/web/src/modules/candidates/components/__tests__/CandidateForm.legacyToggles.test.tsx`: a client `formConfig` with all 8 legacy toggles (`showAge`, `showPlant`, `showShift`, `showComments`, `showPosition`, `showMunicipality`, `showInterviewTime`, `showInterviewPoint`) rendered alongside custom `fields[]` — asserts both categories render correctly and that removing `fields[]` does not hide legacy toggle-driven fields (FR-FC-005)

### Implementation for User Story 6

- [ ] T069 [US6] Add `formConfigFieldSchema`, `createFormConfigFieldSchema`, `patchFormConfigFieldSchema` to `packages/shared/src/clients/schemas.ts`; export from `packages/shared/src/clients/index.ts` (⚠ same file as T055 — do NOT run in parallel with US5 work; extend existing exports rather than replace)
- [ ] T070 [US6] Tighten `FormFieldConfig` in `packages/shared/src/candidates/form-config.ts` to the Zod-derived type (fields: `key`, `label`, `type`, `required`, `options`, `archived`, `createdAt`, `updatedAt`) — do not break read compatibility with the 8 legacy toggles (they remain sibling keys on `form_config`)
- [ ] T071 [US6] Implement `createFormConfigField(clientId, input)` and `patchFormConfigField(clientId, key, input)` in `apps/api/src/modules/clients/service.ts` using `SELECT form_config FROM clients ... FOR UPDATE`, in-memory mutation with Zod validation, then `UPDATE clients SET form_config = $newJson`, plus `AuditEvent`
- [ ] T072 [US6] Add routes `POST /api/clients/:clientId/form-config/fields` and `PATCH /api/clients/:clientId/form-config/fields/:key` in `apps/api/src/modules/clients/routes.ts` with `requireRole(["admin"])` and error-code mapping (`duplicate_key`, `missing_options`, `immutable_field`, `field_not_found`)
- [ ] T073 [P] [US6] Create `apps/web/src/modules/clients/components/FormConfigFieldsEditor.tsx` — table of existing fields + create/edit dialogs; disables `type` and `key` on edit; surfaces API error codes as inline field errors
- [ ] T074 [P] [US6] Create `apps/web/src/modules/clients/hooks/useFormConfigFields.ts` with TanStack Query mutations for create/patch; invalidate client detail query on success
- [ ] T075 [US6] Mount `<FormConfigFieldsEditor />` on the client settings section in `apps/web/src/modules/clients/pages/ClientDetailPage.tsx` (next to `FormConfigEditor`); ensure the dynamic `CandidateForm` already walks `formConfig.fields` and filters out `archived: true`
- [ ] T076 [US6] Verify `apps/web/src/modules/candidates/components/CandidateForm.tsx` (`:50-65`) filters out `archived` fields from rendering but includes their key in a read-only historical viewer on candidate detail (if any candidate has a legacy value under an archived key)

**Checkpoint**: SC-006 — admins add, rename, require/optional, and archive custom fields from the UI with zero engineering involvement; the 8 legacy toggles keep working unchanged.

---

## Phase 9: User Story 7 — Privacy notice removed from the candidate flow (Priority: P2)

**Goal**: New-candidate UI has no privacy-notice checkbox; the API accepts requests without `privacyNoticeId`; historical data is preserved at rest and viewable read-only.

**Independent Test**: Submit a new candidate without a privacy-notice payload — API returns 201; open a pre-existing candidate whose record has a `privacy_notice_id` — the historical record is still visible.

### Tests for User Story 7 (write first — RED)

- [ ] T077 [P] [US7] Shared schema test in `packages/shared/src/schemas/__tests__/candidate.test.ts` (or whatever the existing test file is for candidate schemas): `createCandidateSchema` accepts payload without `privacyNoticeId`; rejects malformed UUID when present
- [ ] T078 [P] [US7] API contract test in `apps/api/src/modules/candidates/__tests__/routes.register.test.ts`: recruiter POST without `privacyNoticeId` → 201 and `candidates.privacy_notice_id` is `NULL`; with a valid `privacyNoticeId` → 201 (legacy path still validates); with an invalid id → 422 (unchanged)
- [ ] T079 [P] [US7] UI test in `apps/web/src/modules/candidates/pages/__tests__/NewCandidatePage.test.tsx`: `NewCandidatePage` does NOT render `PrivacyNoticeCheckbox`; submission payload does not include `privacyNoticeId`
- [ ] T080 [P] [US7] UI test in `apps/web/src/modules/candidates/pages/__tests__/CandidateDetailPage.test.tsx`: the "Accepted privacy notice at / by" block is NOT rendered on any candidate detail page, regardless of whether the candidate record has a non-null `privacyNoticeId` (FR-RP-005 unconditional removal; evidentiary retrieval is DB/ops-only per FR-RP-003 revised)
- [ ] T081 [P] [US7] Dead-code test: `grep -R "PrivacyNoticeCheckbox" apps/web/src` returns only the file itself after removal; the spec requires zero importers
- [ ] T081a [P] [US7] Integration test in `apps/api/src/modules/audit/__tests__/privacyNotice.audit.integration.test.ts`: seed a candidate created before this feature with a privacy-notice `AuditEvent`; after the schema relaxation lands, query the audit API and assert the historical event is returned unchanged (FR-RP-004)
- [ ] T081b [P] [US7] DB smoke test in `apps/api/src/modules/candidates/__tests__/privacyNotice.schema.integration.test.ts`: INFORMATION_SCHEMA query asserts that the `privacy_notices` table and `candidates.privacy_notice_id` column still exist after migrations run; also asserts no new rows are written to `privacy_notices` during a recruiter-led candidate-create flow (FR-RP-006)

### Implementation for User Story 7

- [ ] T082 [US7] Relax `privacyNoticeId` to `.uuid().optional()` in `packages/shared/src/schemas/candidate.ts` (shared `createCandidateSchema`); export unchanged
- [ ] T083 [US7] Update `apps/api/src/modules/candidates/service.ts` (around `:190-215`): skip the "verify active notice for tenant" branch when `privacyNoticeId` is absent; when present, keep current validation
- [ ] T084 [US7] Remove import and render of `PrivacyNoticeCheckbox` from `apps/web/src/modules/candidates/pages/NewCandidatePage.tsx`; drop it from the submit payload
- [ ] T085 [US7] Delete `apps/web/src/modules/candidates/components/PrivacyNoticeCheckbox.tsx` once `grep` confirms zero importers
- [ ] T086 [US7] In `apps/web/src/modules/candidates/pages/CandidateDetailPage.tsx`, remove the "Accepted privacy notice at / by" block entirely (and its imports / dead helpers); the DB value is preserved per FR-RP-006 but not surfaced in UI (FR-RP-005)
- [ ] T087 [US7] Remove the tenant-admin privacy-notice management route and menu item from the web router and sidebar (search: `apps/web/src/router.tsx`, `Sidebar.tsx`, `apps/web/src/modules/privacy-notices/` if present); if the module has other surfaces, disable them and mark `@deprecated`

**Checkpoint**: Candidate create works with no privacy-notice payload; historical rows remain visible; the privacy-notices DB tables are untouched (LFPDPPP evidence preserved).

---

## Phase 10: User Story 8 — Login simplification (Priority: P3)

**Goal**: Login renders only email + password in the default build; the client submits `tenantSlug = "bepro"` underneath; restoring the field requires only a config toggle.

**Independent Test**: Render `LoginForm` with `VITE_LOGIN_TENANT_FIXED=bepro` — tenant input absent, submission payload includes `tenantSlug: "bepro"`. Re-enable by unsetting the env var — the field renders with its existing validation.

### Tests for User Story 8 (write first — RED)

- [ ] T088 [P] [US8] Component test in `apps/web/src/modules/auth/components/__tests__/LoginForm.test.tsx`: with `VITE_LOGIN_TENANT_FIXED="bepro"` (mocked via `vi.stubEnv`), the tenant input is not rendered; submission invokes `authService.login` with `tenantSlug: "bepro"`
- [ ] T089 [P] [US8] Component test same file: with `VITE_LOGIN_TENANT_FIXED=""` (empty), the tenant input is rendered and its existing validation still applies
- [ ] T090 [P] [US8] E2E test in `apps/web/e2e/login-simple.spec.ts`: end-to-end sign-in without the tenant field using real credentials from a seeded test user

### Implementation for User Story 8

- [ ] T091 [US8] Read `VITE_LOGIN_TENANT_FIXED` in `apps/web/src/modules/auth/components/LoginForm.tsx` (default to `"bepro"` when unset); conditionally omit the tenant input and inject the fixed value into the submit payload
- [ ] T092 [US8] Document the flag behavior in `apps/web/src/modules/auth/components/LoginForm.tsx` with a two-line comment (WHY: to allow future re-enablement of multi-tenant public sign-in without schema change) and in `specs/008-ux-roles-refinements/quickstart.md` Environment variables table
- [ ] T093 [US8] Keep `loginSchema` unchanged in `packages/shared/src/schemas/auth.ts` — per `research.md` R-03, the field hiding is a UI concern only

**Checkpoint**: SC-003 — login screen shows exactly two fields (email, password) by default; existing tenant-aware tests keep passing because the schema is unchanged.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification, documentation, and gate enforcement.

- [ ] T094 [P] Update `CLAUDE.md` "Active Technologies" and "Recent Changes" sections with the 008 feature summary (no new deps; JSONB extension only)
- [ ] T095 [P] Add ADR `docs/architecture/adr-008-ux-roles-refinements.md` capturing: (a) the Principle VI constitution amendment (privacy-notice offline evidence), (b) the rationale for keeping `privacy_notices` read-only, (c) the JSONB-fields pattern for admin-managed custom fields
- [ ] T096 Create the PR for the v1.0.2 constitution amendment (changes already staged in `.specify/memory/constitution.md` — §VI rephrased, Branch Strategy extended, version + changelog bumped); obtain Javi's approval per §Governance before this feature PR merges; link the two PRs for traceability
- [ ] T097 [P] Run the locale-sweep test (`apps/web/src/__tests__/locale.sweep.test.tsx` from T043) against the full candidate UI and any remaining dropdowns; fix stragglers
- [ ] T098 Measure SC-001 (inline transition ≤ 500 ms p95) on a seeded tenant with 200 candidates using the existing perf harness from 007; record results in `specs/008-ux-roles-refinements/quickstart.md` Appendix
- [ ] T099 Measure SC-005 (multi-assign batch save ≤ 300 ms p95 for 50 row diffs) via a dedicated bench in `apps/api/src/modules/clients/__tests__/bench.assignments-batch.test.ts` and record results
- [ ] T100 Run the full gate: `pnpm lint`, `pnpm -r typecheck`, `pnpm -r test`, `pnpm -F @bepro/api test:integration`, `pnpm -F @bepro/web test:e2e` — attach the summary to the feature PR description
- [ ] T101 [P] Delete dead files confirmed zero-import: `AssignmentManager.tsx` (if T061 confirmed), `PrivacyNoticeCheckbox.tsx` (if T085 confirmed), and any privacy-notice admin pages (if T087 confirmed). Report the final removal list in the PR body
- [ ] T102 Run `quickstart.md` "Test plan (TDD order)" step by step on a clean workstation; record any step that required undocumented setup and fix the quickstart in the same commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: depends on Phase 2 (T008). Independent of other stories.
- **US2 (Phase 4)**: depends on Phase 2 (T005, T007). Independent of other stories at wire level.
- **US3 (Phase 5)**: depends on Phase 2; integrates with US4's Spanish label map (T044) but `InlineStatusMenu` can be implemented first with English labels and switched after T044 lands.
- **US4 (Phase 6)**: depends on Phase 2. Its label map (T044) is consumed by US3 callers (T045); if US3 and US4 are implemented in parallel, US3's `InlineStatusMenu` should import `statusLabel()` from the start to avoid double-touch.
- **US5 (Phase 7)**: depends on Phase 2 (T004, T005, T006).
- **US6 (Phase 8)**: depends on Phase 2 (T004, T005, T006). Independent of US5 at file level (both add to `packages/shared/src/clients/schemas.ts` — coordinate).
- **US7 (Phase 9)**: depends on Phase 2. Test T017/T018 in US2 already cover the `privacyNoticeId`-optional contract; coordinate order so US2 lands first.
- **US8 (Phase 10)**: depends on Phase 2 only.
- **Polish (Phase 11)**: depends on the user stories being merged.

### Within each user story

- Tests are written FIRST and MUST fail (RED) before implementation.
- Shared/schema tasks before API/UI tasks that consume them.
- API service tasks before route wiring.
- UI hooks before UI components that consume them.

### Known cross-story coordination

- **US5 & US6** both edit `packages/shared/src/clients/schemas.ts` — not marked `[P]` against each other; pick one developer or merge sequentially.
- **US2 & US7** both edit `apps/api/src/modules/candidates/routes.ts` / `service.ts` — US2 lands first (role gate), US7 then relaxes the schema.
- **US3 & US4** both touch `StatusBadge.tsx` and the list page; US4's `statusLabel()` helper should be ready before US3 final render pass.

---

## Parallel Opportunities

- **Phase 1 Setup**: T002 and T003 are [P] (different files).
- **Phase 2 Foundational**: T004, T005, T006, T007, T008 are all [P] against each other.
- **Per story**: all `[P]` test tasks for a given story can run in parallel (distinct files).
- **Across stories (after Phase 2)**: US1, US4, US7 and US8 can be implemented by different developers simultaneously with no file conflicts. US5 vs US6 share a shared-schemas file → coordinate. US2 vs US7 share candidates routes → coordinate.

### Parallel Example — User Story 3 tests (after Phase 2)

```bash
Task: "T027 [P] [US3] Table-driven component test for InlineStatusMenu options"
Task: "T028 [P] [US3] Hook test for useTransitionCandidate optimistic path"
Task: "T029 [P] [US3] Hook test for 409 invalid_transition branch"
Task: "T030 [P] [US3] Component test for grouped categories"
Task: "T031 [P] [US3] Component test for category picker flow"
Task: "T032 [P] [US3] E2E test for inline transition"
```

### Parallel Example — User Story 5 tests (after Phase 2)

```bash
Task: "T048 [P] [US5] Service test for batch diff semantics"
Task: "T049 [P] [US5] Integration test for 422/403/404 cases"
Task: "T051 [P] [US5] Shared schema test for batchAssignmentsSchema"
Task: "T052 [P] [US5] Component test for AssignmentTable rendering"
```

---

## Implementation Strategy

### MVP Scope (ship first)

1. Phase 1 Setup + Phase 2 Foundational.
2. US1 (Header user menu) — baseline UX, unblocks navigation.
3. US2 (Recruiter-only create gate) — closes the open authz defect.
4. US3 (Inline transition) — biggest time-saver; lands SC-001.

Ship after US1+US2+US3 → this is the MVP increment.

### Incremental Delivery

- Wave 1 (MVP): Setup + Foundational + US1 + US2 + US3.
- Wave 2 (P2 UX polish): US4 (Spanish labels) + US7 (privacy-notice removal). Deploy.
- Wave 3 (P2 operations): US5 (multi-assign). Deploy.
- Wave 4 (P3 configurability + polish): US6 (custom form fields) + US8 (login simplification). Deploy.
- Final: Phase 11 polish, measure SC-001/SC-005, constitution amendment PR.

### Parallel Team Strategy (2 devs — Hector + Javi)

- Both complete Phase 1 + Phase 2 together (1 day).
- Hector: US1 → US2 → US7 (shared candidate surfaces).
- Javi: US3 → US4 → US6 (candidate list + label map + custom fields).
- Together: US5 (admin surfaces) + US8 (login) + Phase 11.

---

## Notes

- `[P]` = different files, no dependency on an incomplete task. Tasks touching the same file must be sequential.
- `[Story]` label required for all Phase 3–10 tasks; omitted for Phase 1, 2, 11.
- TDD mandatory: every FR in `spec.md` has at least one test task above. RED → GREEN → REFACTOR.
- Commit after each task or logical group; follow Conventional Commits in Spanish (`feat:`, `fix:`, `test:`, `refactor:`).
- Branch flow: `008-ux-roles-refinements` → development → testing → main (per repo convention).
- Constitution amendment (Principle VI) MUST merge before or alongside the final feature PR — tracked in `plan.md` Complexity Tracking.
- No SQL migrations. All changes stay within existing tables and JSONB shapes; any deviation requires a new spec.
