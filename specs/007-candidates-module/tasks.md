---
description: "Task list for 007-candidates-module feature implementation"
---

# Tasks: Candidates Module

**Input**: Design documents from `/specs/007-candidates-module/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/candidates-api.md, quickstart.md

**Tests**: MANDATORY. Constitution gate V (Test-First) is NON-NEGOTIABLE for this module, and the user's global TDD rule applies. Every implementation task is preceded by a failing test (RED → GREEN → REFACTOR).

**Organization**: Tasks are grouped by user story (US1..US6 from spec.md) so each story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallel-safe (different files, no dependency on other pending tasks)
- **[US#]**: Maps the task to a spec user story for traceability

## Path Conventions (from plan.md)

- API module: `apps/api/src/modules/candidates/`
- Web module: `apps/web/src/modules/candidates/`
- Shared (Zod + types): `packages/shared/src/candidates/`
- DB schemas (Drizzle): `packages/db/src/schema/`
- DB migrations: `packages/db/drizzle/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold directories, install dependencies, wire the test harness.

- [X] T001 Create API module directory skeleton at `apps/api/src/modules/candidates/` with empty `routes.ts`, `service.ts`, `types.ts`, `fsm.ts`, `duplicates.ts`, `redact.ts`, `storage.ts`, and `__tests__/` folder
- [X] T002 [P] Create Web module directory skeleton at `apps/web/src/modules/candidates/` with `pages/`, `components/`, `hooks/`, `services/` subfolders (created together with the US1 components in Phase 3)
- [X] T003 [P] Create Shared package subfolder `packages/shared/src/candidates/` with empty `schemas.ts`, `status.ts`, `form-config.ts`, `index.ts`; add re-export from `packages/shared/src/index.ts`
- [X] T004 [P] Add new Drizzle schema files under `packages/db/src/schema/`: `candidates.ts`, `candidate-attachments.ts`, `candidate-duplicate-links.ts`, `rejection-categories.ts`, `decline-categories.ts`, `privacy-notices.ts`, `retention-reviews.ts`; update `packages/db/src/schema/index.ts` re-exports
- [X] T005 [P] Confirm R2 binding is declared in `apps/api/wrangler.toml` and typed in `apps/api/src/env.ts` (R2 binding `FILES` already exists in `apps/api/src/types.ts` — reused; no new binding needed)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB schema, RLS, shared matrices, and core helpers that every user story depends on.

**CRITICAL**: No user story work can begin until this phase is complete.

### Database migrations (sequential — migration order matters)

> **Migration numbering note**: planned numbers (0002–0006) collided with the existing `0002_*` migration in the repo, so the new migrations were renumbered to **0003–0007**.

- [X] T006 Create migration `packages/db/drizzle/0003_candidate_enums.sql` defining `candidate_status` ENUM with all 14 states from data-model.md §4
- [X] T007 Create migration `packages/db/drizzle/0004_candidates_tables.sql` creating the 7 tables (`candidates`, `candidate_attachments`, `candidate_duplicate_links`, `rejection_categories`, `decline_categories`, `privacy_notices`, `retention_reviews`) with all columns, FKs, CHECK constraints, and indexes per data-model.md §1–§8
- [X] T008 Create migration `packages/db/drizzle/0005_candidates_rls.sql` enabling `ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` on every new tenant-scoped table with SELECT/INSERT/UPDATE policies using `current_setting('app.tenant_id', true)::uuid` (NOTE: append-only grants on `audit_events` were already applied in `0001_rls_policies.sql`, no change needed)
- [X] T009 Create migration `packages/db/drizzle/0006_candidates_search_trigger.sql` adding `search_tsv` tsvector column on `candidates` + `tsvector_update_trigger` for name/email/phone and GIN index `candidates_search_idx`
- [X] T010 Create migration `packages/db/drizzle/0007_candidates_seed_categories.sql` seeding default rejection + decline categories for every existing tenant (labels from research R8) and one default privacy notice per tenant (version `2026-04`)

### Drizzle schemas (parallel — independent files)

- [X] T011 [P] Implement Drizzle schema for `candidates` table in `packages/db/src/schema/candidates.ts` with all columns, enum import, indexes, and RLS-compatible types
- [X] T012 [P] Implement Drizzle schema for `candidate_attachments` in `packages/db/src/schema/candidate-attachments.ts`
- [X] T013 [P] Implement Drizzle schema for `candidate_duplicate_links` in `packages/db/src/schema/candidate-duplicate-links.ts`
- [X] T014 [P] Implement Drizzle schema for `rejection_categories` in `packages/db/src/schema/rejection-categories.ts`
- [X] T015 [P] Implement Drizzle schema for `decline_categories` in `packages/db/src/schema/decline-categories.ts`
- [X] T016 [P] Implement Drizzle schema for `privacy_notices` in `packages/db/src/schema/privacy-notices.ts`
- [X] T017 [P] Implement Drizzle schema for `retention_reviews` in `packages/db/src/schema/retention-reviews.ts`

### Shared matrices and Zod schemas (parallel)

- [X] T018 [P] Write `packages/shared/src/candidates/status.ts` exporting `CANDIDATE_STATUSES` enum, `FSM_LEGAL_EDGES` const matrix (from research R1 + data-model.md §4), and `NEGATIVE_TERMINAL_STATUSES` / `POSITIVE_TERMINAL_STATUSES` sets
- [X] T019 [P] Write `packages/shared/src/candidates/schemas.ts` with Zod schemas: `CandidateCoreSchema`, `RegisterCandidateRequestSchema`, `TransitionRequestSchema`, `UpdateCandidatePiiSchema`, `ListCandidatesQuerySchema`, `AttachmentInitSchema`, `CategoryCrudSchema`, `RetentionReviewCreateSchema` per contracts/candidates-api.md
- [X] T020 [P] Write `packages/shared/src/candidates/form-config.ts` exporting `buildDynamicSchema(formConfig)` utility shared by API + Web per research R7
- [X] T021 [P] Write unit test `packages/shared/src/candidates/__tests__/status.test.ts` asserting every FSM edge from data-model.md §4 is present and every illegal edge is absent
- [X] T022 [P] Write unit test `packages/shared/src/candidates/__tests__/form-config.test.ts` asserting `buildDynamicSchema` produces a passing schema for a representative `form_config` fixture and a failing schema when required fields are missing

### API helpers — RED first, then GREEN

- [X] T023 [P] Write failing test `apps/api/src/modules/candidates/__tests__/redact.test.ts` asserting `redact(candidate)` omits `first_name`, `last_name`, `phone`, `phone_normalized`, `email` and keeps `id`, `tenant_id`, `client_id`, `status`, `is_active`, `registering_user_id`
- [X] T023a [P] Extend the same test with a CURP/RFC/second-phone fixture inside `additional_fields` JSONB and assert `redact(candidate)` strips those values too (FR-011a)
- [X] T024 [P] Implement `apps/api/src/modules/candidates/redact.ts` to make T023 + T023a pass (research R10) — accept a tenant-configurable `piiKeys` list for JSONB keys
- [X] T025 [P] Write failing test `apps/api/src/modules/candidates/__tests__/duplicates.test.ts` (covers `normalizePhone` per R2; DB integration test deferred to US1 contract tests where it is exercised end-to-end) covering `normalizePhone` cases from research R2 (strips whitespace/dashes/parens/dots/leading + country code) and duplicate lookup integration with a seeded DB
- [X] T026 [P] Implement `apps/api/src/modules/candidates/duplicates.ts` exporting `normalizePhone()` and `findDuplicatesForCandidate({ tenantId, clientId, phoneRaw })` to make T025 pass
- [X] T027 [P] Write failing test `apps/api/src/modules/candidates/__tests__/fsm.test.ts` covering: every legal edge accepts, every illegal edge refuses (including Q1 matrix from FR-031a), role gate refuses recruiters for transitions (FR-032), account executives gated by client assignment (FR-033)
- [X] T028 [P] Implement `apps/api/src/modules/candidates/fsm.ts` with `assertLegalTransition(from,to)` and `assertRoleAllowsTransition(user,candidate,from,to)` to make T027 pass
- [X] T029 [P] Write failing test `apps/api/src/modules/candidates/__tests__/storage.test.ts` (key + sanitize covered; presigned URL test deferred to US4 where R2 binding is exercised) asserting `buildStorageKey(tenantId, candidateId, attachmentId, fileName)` matches `tenants/{tenantId}/candidates/{cid}/attachments/{aid}/{sanitized}` and `signPutUrl`/`signGetUrl` return short-lived URLs
- [X] T030 [P] Implement `apps/api/src/modules/candidates/storage.ts` (key builder + sanitizer; signed-URL helpers added in US4 with R2 binding) wrapping R2 presigned PUT (10 min) and GET (5 min) per research R4 to make T029 pass

### Module registration

- [X] T031 Register `candidates` router in `apps/api/src/index.ts` (project uses `index.ts`, not `app.ts`) under `/api/candidates`, wrapped by existing auth + tenant middleware (`SET LOCAL app.tenant_id` per `packages/db/CLAUDE.md`)
- [X] T032 Add `/candidates/new` route in `apps/web/src/App.tsx` (`/candidates` list route lands with US2) pointing to placeholder pages; role gating handled by the 005 shell

**Checkpoint**: Migrations apply cleanly on a fresh Neon branch; shared + API helpers have green unit tests; HTTP router mounted. User story implementation can now begin (in parallel if staffed).

---

## Phase 3: User Story 1 — Register a new candidate with duplicate warning and privacy notice (P1) 🎯 MVP

**Goal**: Authorized users register a candidate under exactly one client, acknowledge the LFPDPPP notice, get a duplicate warning on `(tenant, normalized_phone, client)` collisions, and optionally attach a CV during creation.

**Independent Test**: Recruiter creates candidate for Client X with privacy ack + CV → appears in "My candidates" as Registered. Second submit with same phone + Client X shows duplicate dialog; confirm → both records persist.

### Tests for User Story 1 (RED first)

- [X] T033 [P] [US1] Contract test for `POST /api/candidates` happy path (201) in `__tests__/routes.register.test.ts`
- [X] T034 [P] [US1] Duplicate-warning 409 test in `routes.register.test.ts` + service-level test in `service.create.test.ts`
- [X] T035 [P] [US1] Duplicate-confirmation branch test in `service.create.test.ts` — asserts `candidate_duplicate_links` rows are written
- [X] T036 [P] [US1] 422 when `privacy_acknowledged !== true` (FR-013) — covered in `routes.register.test.ts`
- [X] T037 [P] [US1] form_config validation — route maps `FormConfigValidationError → 422 form_config_invalid` (in `routes.register.test.ts`); service uses `buildDynamicSchema(client.formConfig)`
- [X] T038 [P] [US1] Audit row shape covered in `service.create.test.ts` — asserts `candidate.created` action, no PII in `new_values`
- [X] T039 [P] [US1] PII-scrub test in `__tests__/no-pii-log.test.ts` — captures all console outputs during a full POST flow and asserts no PII tokens leak
- [X] T040 [P] [US1] CandidateForm.test.tsx — 4 tests (core fields, dynamic fields from form_config, valid submit, missing-field rejection)
- [X] T041 [P] [US1] DuplicateWarningDialog.test.tsx — 4 tests (renders matches, onConfirm, onCancel, isSubmitting disables)
- [X] T042 [P] [US1] Integration covered by `useCreateCandidate.test.tsx` — 4 tests including the 409-then-201 confirm-duplicates flow (MSW not yet installed in this repo; the hook test exercises the same flow at the mutation level)

### Implementation for User Story 1

- [X] T043a [US1] `createCandidate` baseline path: validates Zod, normalizes phone, inserts row + audit event with privacy snapshot (no PII), all in the tenant-scoped tx from middleware
- [X] T043b [US1] Duplicate-warning branch: throws `DuplicatesDetectedError` (mapped to 409); on confirmation, writes `candidate_duplicate_links` rows in the same flow
- [X] T044 [US1] `POST /api/candidates` route delegates to the service and maps `DuplicatesDetectedError → 409`, `PrivacyNoticeMismatchError/FormConfigValidationError → 422`, `ClientNotFoundError → 404`
- [X] T045 [US1] `GET /api/candidates/duplicates` implemented + tested
- [X] T046 [US1] `GET /api/candidates/privacy-notice/active` implemented + tested
- [X] T047 [P] [US1] `candidateApi.ts` — wrappers + duplicate-aware result type
- [X] T048 [P] [US1] `useCreateCandidate` hook in `hooks/useCandidates.ts` with submit/confirmDuplicates/cancelDuplicates surface; tested by 4 hook tests
- [X] T049 [P] [US1] `CandidateForm.tsx` — RHF + zodResolver + dynamic fields driven by `buildDynamicSchema(formConfig)`
- [X] T050 [P] [US1] `DuplicateWarningDialog.tsx` — shadcn Dialog with the matched candidates and confirm/cancel
- [X] T051 [P] [US1] `PrivacyNoticeCheckbox.tsx` — scrollable notice text + required checkbox
- [X] T052 [P] [US1] `AttachmentUploader.tsx` — MIME + 10 MB guards; the actual R2 PUT integration arrives with US4 (file kept in memory for now)
- [X] T053 [US1] `NewCandidatePage.tsx` — composes client picker, form, privacy notice, uploader, duplicate dialog
- [X] T054 [US1] Route added in `apps/web/src/App.tsx` under the `RequireAuth + AppShellLayout` block (any authenticated role)

**Checkpoint**: User Story 1 passes its independent test end-to-end — recruiter registers a candidate, sees duplicate warning on collision, and confirms to create. PII-free logs verified.

---

## Phase 4: User Story 2 — Role-scoped list, search, and filter (P1)

**Goal**: Every role sees exactly the candidates their scope allows, with combinable filters, search, and pagination that scales to 10 k rows.

**Independent Test**: Log in as each of admin / manager / account_executive / recruiter and open `/candidates` — visible count matches expected scope. Typing a partial name filters within scope in < 1 s.

### Tests for User Story 2 (RED first)

- [X] T055 [P] [US2] Write failing contract test `apps/api/src/modules/candidates/__tests__/list.contract.test.ts` for `GET /api/candidates` pagination + filter surface (contracts §2)
- [X] T056 [P] [US2] Write failing role-scope test `apps/api/src/modules/candidates/__tests__/list.visibility.test.ts` seeding 4 actors (admin, manager, AE, recruiter) + 48 candidates and asserting visible-set matches contracts §2 Visibility table (SC-003)
- [X] T057 [P] [US2] Write failing cross-tenant isolation test `apps/api/src/modules/candidates/__tests__/isolation.test.ts` creating tenants A and B with overlapping IDs and asserting tenant A requests never leak tenant B rows via any query/param combination (SC-004)
- [X] T058 [P] [US2] Write failing test for `GET /api/candidates/:id` returning 404 (not 403) when the actor's scope excludes the target (contracts §3)
- [X] T059 [P] [US2] Write failing integration test asserting `q=<partial>` uses the GIN tsvector index and returns in under the performance budget against a 10 k seed (quickstart §9)
- [X] T060 [P] [US2] Write failing web integration test `apps/web/src/modules/candidates/pages/__tests__/CandidateListPage.test.tsx` asserting filter combinations update the URL (search params) and the rendered list

### Implementation for User Story 2

- [X] T061 [US2] Implement `listCandidates(query, ctx)` in service — applies role scope server-side, composite index-friendly filters, keyset cursor pagination ordered by `(updated_at DESC, id)`
- [X] T062 [US2] Implement `getCandidateById(id, ctx)` in service — returns full detail including `privacy_notice`, `attachments`, `status_history` (last 50 from `audit_events`), `duplicate_links`; returns `null` on out-of-scope so the route maps to 404
- [X] T063 [US2] Implement `GET /api/candidates` route mapping the query string to `ListCandidatesQuerySchema`
- [X] T064 [US2] Implement `GET /api/candidates/:id` route
- [X] T065 [P] [US2] Implement `useCandidates` hook in `apps/web/src/modules/candidates/hooks/useCandidates.ts` with URL-param filter state
- [X] T066 [P] [US2] Implement `useCandidate(id)` hook in `apps/web/src/modules/candidates/hooks/useCandidate.ts`
- [X] T067 [US2] Build `apps/web/src/modules/candidates/pages/CandidateListPage.tsx` with search bar, filter drawer (status multi-select, client multi-select, recruiter multi-select for manager/admin, date range, rejection category), pagination, and `include_inactive` toggle for manager/admin (FR-025)
- [X] T068 [US2] Build `apps/web/src/modules/candidates/pages/CandidateDetailPage.tsx` (read-only detail — status controls added in US3)
- [X] T069 [US2] Add role-gated rendering on the list using the 005 shell's CASL ability helpers (recruiter = own; AE = assigned clients; manager/admin = all)

**Checkpoint**: Users see exactly their scope; cross-tenant isolation test passes; filters + search produce correct results within budget.

---

## Phase 5: User Story 3 — Advance a candidate through the status lifecycle (P2)

**Goal**: AE/manager/admin move candidates through the 14-state FSM with FSM + role + optimistic-concurrency validation; rejections require a category; every transition writes one audit row and atomically deactivates on negative terminals.

**Independent Test**: Manager takes a candidate `registered → interview_scheduled → attended → approved → hired`; illegal `attended → hired` is refused with a clear message; recruiter sees no controls; audit trail shows each transition.

### Tests for User Story 3 (RED first)

- [X] T070 [P] [US3] Write failing contract test `apps/api/src/modules/candidates/__tests__/transition.contract.test.ts` for `POST /api/candidates/:id/transitions` happy path + all FSM-illegal paths (SC-006)
- [X] T071 [P] [US3] Write failing test asserting 422 missing `rejection_category_id` when `to_status='rejected'` (FR-035) and same for `decline_category_id` when `to_status='declined'`
- [X] T072 [P] [US3] Write failing test asserting 409 stale write when `from_status` disagrees with DB current status (research R6 / FR-037) with current status in response
- [X] T073 [P] [US3] Write failing test asserting negative-terminal transitions (rejected/declined/no_show/discarded/termination/replacement) flip `is_active` to `false` atomically AND positive terminals (hired/in_guarantee/guarantee_met) leave `is_active` true (FR-038)
- [X] T074 [P] [US3] Write failing test asserting recruiters receive 403 (masked as 404 when out-of-scope) on any transition attempt (FR-032)
- [X] T075 [P] [US3] Write failing test asserting AE cannot transition a candidate whose client is NOT in their assignments (FR-033)
- [X] T076 [P] [US3] Write failing audit-shape test `apps/api/src/modules/candidates/__tests__/transition.audit.test.ts` validating the `candidate.status.changed` row shape per contracts §13 (old/new values, actor, tenant, target_id, snapshotted category label)
- [X] T077 [P] [US3] Write failing web integration test `apps/web/src/modules/candidates/components/__tests__/StatusTransitionDialog.test.tsx` covering happy path and the `409 stale_status` refetch UX
- [X] T078 [P] [US3] Write failing test asserting `StatusBadge` uses the 003-design-system badge tokens for all 14 states

### Implementation for User Story 3

- [X] T079 [US3] Implement `transitionCandidate(candidateId, input, ctx)` in service — opens a transaction, asserts FSM edge, asserts role gate, asserts optimistic `from_status`, updates status + `is_active` on negative terminals, writes exactly one `audit_events` row with action `candidate.status.changed` snapshotting category label; all within the same `SET LOCAL` transaction
- [X] T080 [US3] Implement `POST /api/candidates/:id/transitions` route mapping service errors to the 409 / 422 envelope in contracts §14
- [X] T081 [P] [US3] Implement `useTransitionCandidate(candidateId)` hook with invalidation on success and `refetch` on 409 stale
- [X] T082 [P] [US3] Implement `apps/web/src/modules/candidates/components/StatusBadge.tsx` mapping every status to a design-system badge variant
- [X] T083 [P] [US3] Implement `apps/web/src/modules/candidates/components/StatusTransitionDialog.tsx` showing the actor-legal next states (derived from `FSM_LEGAL_EDGES` + current status + user role), optional note field
- [X] T084 [P] [US3] Implement `apps/web/src/modules/candidates/components/RejectionCategoryPicker.tsx` (used for both rejection + decline — title-parameterized) fetching the tenant's active categories
- [X] T085 [US3] Wire the dialog into `CandidateDetailPage.tsx` — hide the control entirely for recruiters per FR-032

### Reactivation (FR-038a)

- [X] T085a [P] [US3] Write failing contract test `apps/api/src/modules/candidates/__tests__/reactivate.contract.test.ts` for `POST /api/candidates/:id/reactivate` (contracts §5a): admin-only (403→404 for non-admins), 409 when not in a negative-terminal state, 422 when already `is_active`, 200 OK with audit row on success; leaves `status` unchanged
- [X] T085b [US3] Implement `reactivateCandidate(candidateId, input, ctx)` in service — admin role check, status check, transaction that flips `is_active = true` (status untouched) and writes one `audit_events` row with action `candidate.reactivated`
- [X] T085c [US3] Implement `POST /api/candidates/:id/reactivate` route mapping service errors to the contracts §14 envelope
- [X] T085d [P] [US3] Implement `apps/web/src/modules/candidates/components/ReactivateDialog.tsx` (admin-only; visible only on negative-terminal candidates) + `useReactivateCandidate` hook; wire into `CandidateDetailPage.tsx`

**Checkpoint**: FSM behaviors pass the full transition matrix; stale-write surfaces the current status; audit rows have the contracted shape; negative-terminal auto-deactivation is atomic; admin reactivation works and is admin-only.

---

## Phase 6: User Story 4 — Attach and manage supporting documents (P2)

**Goal**: Edit-scoped users attach files (≤ 10 MB; allowed types) via R2 presigned PUT; download via 5-min signed GET; mark obsolete without hard-delete.

**Independent Test**: Recruiter uploads an additional document to their candidate → appears in list → mark obsolete → hidden by default → "include obsolete" toggle reveals it.

### Tests for User Story 4 (RED first)

- [X] T086 [P] [US4] Write failing contract test `apps/api/src/modules/candidates/__tests__/attachments.contract.test.ts` for `POST /api/candidates/:id/attachments`, `POST .../complete`, `GET .../download`, `PATCH .../:attId` (contracts §6–§9)
- [X] T087 [P] [US4] Write failing test asserting disallowed MIME types and > 10 MB payloads are refused (FR-017, FR-018, research R5) at both the init call and the finalize call
- [X] T088 [P] [US4] Write failing cross-tenant test asserting a tenant-A actor cannot obtain a download URL for a tenant-B attachment (FR-005, SC-004)
- [X] T089 [P] [US4] Write failing test asserting obsolete attachments are hidden from the default list and retrievable only via `include_obsolete=true` (FR-043)
- [X] T090 [P] [US4] Write failing test asserting `candidate.attachment.added` and `candidate.attachment.obsoleted` audit rows match contracts §13

### Implementation for User Story 4

- [X] T091 [US4] Implement `initAttachment`, `completeAttachment`, `markAttachmentObsolete`, `getAttachmentDownloadUrl` in service using `storage.ts`
- [X] T092 [US4] Implement the four attachment routes in `routes.ts`
- [X] T093 [P] [US4] Implement `useCandidateAttachments(candidateId)` hook
- [X] T094 [P] [US4] Implement `apps/web/src/modules/candidates/components/AttachmentList.tsx` with obsolete toggle + download action
- [X] T095 [US4] Wire upload + list into `CandidateDetailPage.tsx`

**Checkpoint**: Attachments upload end-to-end via R2; cross-tenant isolation holds; obsolete flag works; hard-delete is impossible (no route, no policy).

---

## Phase 7: User Story 5 — Rejection / decline categories (P3)

**Goal**: Admin-editable tenant-scoped category lists; historical transitions retain the label they had at transition time; reports aggregating by category never expose PII.

**Independent Test**: Admin adds "Salary mismatch"; manager uses it on a rejection; admin renames it → historical record still shows the original label.

### Tests for User Story 5 (RED first)

- [X] T096 [P] [US5] Write failing contract test `apps/api/src/modules/candidates/__tests__/categories.contract.test.ts` for `GET/POST/PATCH /api/rejection-categories` and `/api/decline-categories` (contracts §11) — admin-only for writes, 403 masked as 404 for non-admins
- [X] T097 [P] [US5] Write failing test asserting rename / deactivate of a category does NOT alter historical `audit_events.new_values.rejection_category_label` (FR-051)
- [X] T098 [P] [US5] Write failing aggregation test asserting a count-by-category report returns labels + counts only, with zero PII columns (FR-052)

### Implementation for User Story 5

- [X] T099 [US5] Implement category CRUD services + routes (both rejection and decline) in the candidates module
- [X] T100 [US5] Update `transitionCandidate` to snapshot the category label into `audit_events.new_values.rejection_category_label` / `.decline_category_label` on terminal transitions
- [X] T101 [P] [US5] Implement `apps/web/src/modules/candidates/pages/CategoryAdminPage.tsx` (admin-only) for list + add + rename + deactivate; register under `/settings/candidate-categories` in the router

**Checkpoint**: Categories are tenant-scoped and historically stable; admin UI works; reports are PII-free.

---

## Phase 8: User Story 6 — Audit trail compatible with future audit module (P3)

**Goal**: Every PII edit produces one audit row per changed field; transitions produce one row each; no actor can modify or delete any `audit_events` row.

**Independent Test**: Perform a PII edit and a transition; verify two audit rows with the contracted shapes; attempt UPDATE/DELETE from the worker role → permission denied.

### Tests for User Story 6 (RED first)

- [X] T102 [P] [US6] Write failing contract test `apps/api/src/modules/candidates/__tests__/pii-edit.contract.test.ts` for `PATCH /api/candidates/:id` (contracts §4) asserting one `audit_events` row per changed PII field (FR-061)
- [X] T102a [P] [US6] Extend the same file with PATCH authorization cases per FR-011b: registering recruiter succeeds while status is `registered`, is refused (403→404) once status advances; account executive outside assigned clients is refused; manager/admin always succeeds within tenant
- [X] T103 [P] [US6] Write failing test asserting `PATCH` on `phone` re-normalizes `phone_normalized`
- [X] T104 [P] [US6] Write failing DB-level test `apps/api/src/modules/candidates/__tests__/audit.append-only.test.ts` asserting the Workers DB role's `UPDATE` and `DELETE` on `audit_events` fail with a permission error (FR-062, research R3)
- [X] T105 [P] [US6] Write failing web test `apps/web/src/modules/candidates/pages/__tests__/CandidateDetailPage.history.test.tsx` asserting the `status_history` timeline renders all transitions for the candidate

### Implementation for User Story 6

- [X] T106 [US6] Implement `updateCandidatePii(id, patch, ctx)` in service — diffs PII fields, writes one `audit_events` row per changed field with action `candidate.field.edited`, re-normalizes phone, all in one transaction
- [X] T107 [US6] Implement `PATCH /api/candidates/:id` route per contracts §4
- [X] T108 [P] [US6] Implement `apps/web/src/modules/candidates/components/CandidateStatusHistory.tsx` rendering transitions from the candidate detail payload's `status_history`
- [X] T109 [P] [US6] Implement PII edit drawer in `CandidateDetailPage.tsx` (scoped to AE/manager/admin + the registering recruiter while still `registered`)

**Checkpoint**: Audit append-only enforced at the DB grant level; every PII edit and transition leaves a contracted audit row; detail page shows history.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Retention compliance UX (FR-003a), doc updates, performance verification, edge-case coverage, and final validation.

### Retention reviews (FR-003a — cross-cutting compliance surface)

- [X] T110 [P] Write failing test for `GET /api/retention-reviews/status` and `POST /api/retention-reviews` (contracts §12)
- [X] T111 Implement retention-review service + routes
- [X] T112 [P] Implement admin-only banner in the 005 shell header that reads `/api/retention-reviews/status` and surfaces `due_soon` / `overdue` with a dismiss-for-session action (research R9)

### Edge-case coverage (spec §Edge Cases)

- [X] T113 [P] Write integration test covering "Recruiter deactivation" edge case — historical audit rows keep the deactivated recruiter's display name
- [X] T114 [P] Write integration test covering "Client deactivation" edge case — deactivated client is hidden from the new-candidate selector but existing candidates remain visible
- [X] T115 [P] Write integration test covering "Candidate reactivation" — only admin can reactivate from a negative terminal; reactivation writes `candidate.reactivated` audit row
- [X] T116 [P] Write integration test for "Cross-client duplicates" — same phone + DIFFERENT client does NOT raise a warning

### Performance & success-criteria verification (SC-001 / SC-002 / SC-005 / SC-008 / SC-009 / quickstart §9)

- [X] T117 Seed a test tenant with 10 000 candidates and run `EXPLAIN ANALYZE` on list + filter + search queries; fail the test if any plan is a seq-scan or exceeds the budget in quickstart.md §9 (SC-002)
- [X] T117a [P] Add Playwright E2E timing test `apps/web/e2e/candidate-search.spec.ts` against the 10 k seed: open `/candidates` → type a unique substring → assert the matching row is visible in under 3 s wall-clock (SC-008)
- [X] T117b [P] Add audit-completeness sweep `apps/api/src/modules/candidates/__tests__/audit.sweep.test.ts` running ≥1 000 randomized FSM-legal transitions through `transitionCandidate` and asserting every resulting `audit_events` row has all required fields populated and matches the `candidate.status.changed` shape in contracts §13 (SC-005)
- [X] T117c [P] Build a labelled duplicate-detection fixture set (≥200 candidate pairs covering Mexican mobile formats, with/without country code, dashes, parens, dots, spaces, leading +52 vs raw 10-digit) at `apps/api/src/modules/candidates/__tests__/fixtures/duplicates.json`, then add `duplicates.recall.test.ts` asserting `findDuplicatesForCandidate` recalls ≥95% of true positives across the set (SC-009)
- [X] T118 Measure end-to-end register-candidate time (form open → 201 response) and assert < 90 s median on a representative form fixture (SC-001)

### Final validation

- [X] T119 [P] Update `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, and `packages/db/CLAUDE.md` module tables to list the candidates module
- [X] T120 [P] Record ADR in `docs/architecture/` if any deviation from research R1–R11 was needed during implementation
- [X] T121 Run `pnpm lint && pnpm typecheck && pnpm test` across the monorepo and ensure the CI pipeline is green
- [X] T122 Manually walk through every scenario in quickstart.md §1–§8 to confirm the module works from a clean checkout
- [X] T123 Log-scrub spot check over 24 h of synthetic traffic (SC-007) — zero PII in captured logs
- [X] T123a [P] Write ADR `docs/architecture/ADR-007-orphan-attachment-cleanup.md` recording the deferred orphan-attachment cleanup decision (contracts §7) — current operator workaround (manual SQL filter) and proposed CF Workers cron implementation when capacity allows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** — no dependencies; start immediately.
- **Phase 2 (Foundational)** — depends on Phase 1; migrations are sequential (T006 → T007 → T008 → T009 → T010). Drizzle schemas (T011–T017), shared matrices (T018–T022), and API helpers (T023–T030) can run in parallel once migrations exist.
- **Phase 3 (US1)** depends on Phase 2 completion.
- **Phases 4–8 (US2–US6)** all depend on Phase 2 completion and can run in parallel with each other if staffed. US3 and US4 share the detail page shell from US2, so US2 finishes first in a sequential build.
- **Phase 9 (Polish)** depends on all preceding user stories being complete.

### User Story Dependencies

- **US1 (P1)** and **US2 (P1)** are independent; either can be built first. Both are required for MVP.
- **US3 (P2)** and **US4 (P2)** both surface inside the US2 detail page but are independent of each other.
- **US5 (P3)** depends on the existence of a transition flow (US3) to validate the historical-label behavior end-to-end.
- **US6 (P3)** depends on US1 (for `candidate.created`), US3 (for `candidate.status.changed`), and the PATCH endpoint.

### Within Each User Story

- Tests (RED) MUST be written and run to verify failure BEFORE implementation.
- Drizzle schemas before services; services before routes; routes before web hooks; hooks before pages.
- Commit after each logical RED → GREEN → REFACTOR cycle.

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 in parallel after T001.
- Phase 2: T011–T017 (Drizzle schemas), T018–T022 (shared), T023–T030 (API helpers, each test-impl pair sequential but pairs parallel with other pairs) — roughly 15 tasks in parallel after migrations land.
- Phase 3: all "Tests for US1" (T033–T042) in parallel, then all `[P]` implementation tasks (T047–T052) in parallel once T043 is ready.
- Phases 4–8: Different developers can own US2, US3, US4 simultaneously once Phase 2 is green.

---

## Parallel Example: User Story 1

```bash
# Tests first (parallel RED):
Task: "Contract test for POST /api/candidates in apps/api/src/modules/candidates/__tests__/register.contract.test.ts"
Task: "Duplicate-warning test in the same file"
Task: "Privacy-acknowledged test"
Task: "form_config validation test"
Task: "candidate.created audit-row test"
Task: "PII-free log test in __tests__/no-pii-log.test.ts"
Task: "CandidateForm component test"
Task: "DuplicateWarningDialog component test"
Task: "NewCandidatePage MSW integration test"

# Once service (T043) is green, parallel GREEN:
Task: "Implement candidateApi.ts"
Task: "Implement useCreateCandidate hook"
Task: "Implement CandidateForm component"
Task: "Implement DuplicateWarningDialog component"
Task: "Implement PrivacyNoticeCheckbox component"
Task: "Implement AttachmentUploader component"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1) → **STOP & VALIDATE**: recruiter can register with duplicate + privacy flow.
3. Phase 4 (US2) → **STOP & VALIDATE**: list + search + filter + cross-tenant isolation.
4. Ship MVP to testing branch.

### Incremental Delivery After MVP

5. Phase 5 (US3) → demo: FSM transitions + audit.
6. Phase 6 (US4) → demo: attachments.
7. Phase 7 (US5) → demo: admin category management.
8. Phase 8 (US6) → demo: complete audit trail + append-only enforcement.
9. Phase 9 (Polish) → retention banner, edge cases, performance verification, ship to `main`.

### Parallel Team Strategy (2 developers — Hector + Javi)

1. Pair on Phase 1 + Phase 2 (migrations + helpers) — high-risk foundational work.
2. Split: Dev A on US1, Dev B on US2 — merge both to unblock the detail page.
3. Split: Dev A on US3, Dev B on US4 — both sit on top of the US2 detail page.
4. Pair on US5 + US6 (audit-critical) — mutual review for compliance.
5. Pair on Phase 9.

---

## Notes

- `[P]` = distinct file, no ordering dependency with other open tasks.
- Every implementation task has at least one preceding RED test task — TDD is enforced.
- Commit after each RED → GREEN cycle with a Conventional Commit message in Spanish per project conventions.
- Multi-tenancy: every integration test MUST open a tenant-scoped transaction (`SET LOCAL app.tenant_id`) before querying candidate tables — RLS will silently filter to zero rows otherwise (quickstart §8).
- PII redaction: every log call inside the module MUST route through `redact()`; the log-scrub test in Phase 3 is the safety net.
- Append-only audit: only `INSERT` is granted on `audit_events` — never write `UPDATE`/`DELETE` code paths, even behind a feature flag.
