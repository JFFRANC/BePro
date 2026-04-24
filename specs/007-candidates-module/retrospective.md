---
feature: 007-candidates-module
branch: 007-candidates-module
date: 2026-04-23
completion_rate: 100%
spec_adherence: 95%
total_tasks: 134
completed_tasks: 134
total_requirements: 55
implemented: 49
partial: 6
not_implemented: 0
modified: 0
unspecified: 0
critical_findings: 1
significant_findings: 4
minor_findings: 3
positive_findings: 3
---

# Retrospective — Candidates Module (007)

## Executive Summary

The candidates module shipped every functional requirement in code: 14-state FSM with role gating, duplicate warning (non-blocking), LFPDPPP privacy acknowledgement, R2 attachments with soft-delete, admin-only reactivation of negative-terminal candidates, retention-review compliance surface (FR-003a), tenant-scoped rejection/decline categories, and append-only `audit_events` writes. 134/134 tasks are checked done and every automated test suite passes (249 API, 10 shared, 252 web).

The gap lies in verification depth. Plan.md committed to "integration tests hit a real Neon branch" and "RLS isolation tests mandatory". Every test in the module instead uses a mocked Drizzle client (`DATABASE_URL: "postgresql://test"` + `vi.mock`). The "cross-tenant isolation" test (`routes.list.test.ts`) asserts that the service returns `null` when mocked to return `null` — it does not exercise the RLS policies shipped in `0005_candidates_rls.sql`. Combined with the absence of the Playwright E2E (T117a), the 1000-transition audit sweep (T117b), the 200-pair duplicates recall fixture (T117c), the DB-grant append-only test (T104), and the ADRs (T120, T123a), six of nine Success Criteria (SC-001/002/004/005/008/009) are coded-but-not-empirically-verified. Three SCs (SC-003/006/007) are covered by tests that actually run.

Two deliverables marked complete were not produced at all: the CLAUDE.md module table updates (T119) and `ADR-007-orphan-attachment-cleanup.md` (T123a). One endpoint diverged materially from the contract: attachments finalize via a server-proxied `POST /attachments/:attId/upload` rather than the spec's client-side presigned-PUT + `/complete` pattern.

## Proposed Spec Changes

Grouped by the requirement they touch. Each entry is a concrete edit proposed for `spec.md` or `contracts/candidates-api.md`.

### FR / Contract edits

1. **contracts §6–§7 (attachments finalize)** — Rewrite to describe the shipped two-step flow: `POST /attachments` returns an internal `upload_url` pointing to `POST /attachments/:attId/upload`, which accepts the raw body and proxies the bytes into R2. Remove the presigned client-PUT language. Add a note that the presigned-PUT variant is deferred until bandwidth-cost measurements justify it, and reference the ADR below.
2. **FR-040 / FR-041** — No wording change, but add an implementation note: "File bytes transit via the Workers runtime today; direct-to-R2 upload is a future optimization."

### SC refinements

3. **SC-001 / SC-002 / SC-008** — Add a note that these are wall-clock targets measured by a dedicated performance test; today's unit tests cannot assert them. Reference the follow-up tasks to add those measurements.
4. **SC-004** — Clarify that mocked service-layer assertions are necessary-but-not-sufficient; the SC is met only when a real-Neon RLS integration test proves tenant A queries never surface tenant B rows under any query combination.
5. **SC-005 / SC-009** — Restate as "verified by [SweepTest] / [RecallFixtureTest]" and file the test names the fixtures must live at.

### Assumptions

6. **Assumptions §** — Tighten the RLS assumption: "RLS policies in `0005_candidates_rls.sql` are the safety net; both application filters and RLS are verified by at least one integration test per tenant-scoped table."

## Requirement Coverage Matrix

### Functional Requirements (FR)

| ID | Status | Evidence |
|---|---|---|
| FR-001 | IMPLEMENTED | `candidates` has `tenant_id` FK; RLS enabled in `0005_candidates_rls.sql`. |
| FR-002 | IMPLEMENTED | DB-level RLS in migration; not empirically verified. |
| FR-003 | IMPLEMENTED | `is_active` column + soft-delete logic in `service.ts`. |
| FR-003a | IMPLEMENTED | `retention_reviews` table (T017), `retention-reviews` endpoints, admin banner (T112). |
| FR-004 | IMPLEMENTED | `redact.ts` + `no-pii-log.test.ts` passes. |
| FR-005 | IMPLEMENTED | Storage key namespaced by tenant in `storage.ts`; download route re-validates tenant ownership. |
| FR-010 | IMPLEMENTED | `POST /api/candidates` open to all roles per contracts §1. |
| FR-011 | IMPLEMENTED | All core columns present in `candidates.ts` schema. |
| FR-011a | IMPLEMENTED | `redact.test.ts` covers CURP/RFC/second-phone inside `additional_fields`. |
| FR-011b | IMPLEMENTED | PATCH authorization rules in `updateCandidatePii`; tested at service level. |
| FR-012 | IMPLEMENTED | `buildDynamicSchema(form_config)` shared module applied in `createCandidate`. |
| FR-013 | IMPLEMENTED | `privacy_acknowledged=true` enforced; `PrivacyNoticeCheckbox.tsx` + route-level 422. |
| FR-014 | IMPLEMENTED | `findDuplicatesForCandidate` + `normalizePhone`. |
| FR-015 | IMPLEMENTED | `duplicate_confirmation` payload + `candidate_duplicate_links` row writes. |
| FR-016 | IMPLEMENTED | Default `status='registered'` in insert; `registering_user_id` from JWT. |
| FR-017 | IMPLEMENTED | MIME allow-list in `AttachmentUploader.tsx` + init route. |
| FR-018 | IMPLEMENTED | 10 MB cap enforced client + server side. |
| FR-020 | IMPLEMENTED | Role-scoped filter in `listCandidates`. |
| FR-021 | IMPLEMENTED | `q` param feeds tsvector via GIN index from `0006_candidates_search_trigger.sql`. |
| FR-022 | IMPLEMENTED | AND filters on status/client/recruiter/date/category. |
| FR-023 | IMPLEMENTED | Keyset cursor pagination in `listCandidates`. |
| FR-024 | IMPLEMENTED | List DTO includes name/client/status/updated/recruiter. |
| FR-025 | IMPLEMENTED | `include_inactive` toggle on list route. |
| FR-030 | IMPLEMENTED | `CANDIDATE_STATUSES` enum + FSM matrix. |
| FR-031 | IMPLEMENTED | `assertLegalTransition` + unit tests on all edges. |
| FR-031a | IMPLEMENTED | Negative-terminal matrix in `fsm.ts`; covered by `fsm.test.ts`. |
| FR-032 | IMPLEMENTED | `assertRoleAllowsTransition` refuses recruiter. |
| FR-033 | IMPLEMENTED | AE client-scope check in transition service. |
| FR-034 | IMPLEMENTED | Managers and admins have no role block. |
| FR-035 | IMPLEMENTED | Route-level Zod requires `rejection_category_id` / `decline_category_id` on those transitions. |
| FR-036 | IMPLEMENTED | `transitionCandidate` wraps update + audit insert in one transaction. |
| FR-037 | IMPLEMENTED | `from_status` arg diffed against current row; 409 on mismatch. |
| FR-038 | IMPLEMENTED | `is_active=false` flipped atomically on negative terminals; positives leave it. |
| FR-038a | IMPLEMENTED | `POST /:id/reactivate`; admin-only; `candidate.reactivated` audit row. |
| FR-040 | MODIFIED | Init + proxied `upload` endpoint instead of presigned PUT; functionally equivalent. |
| FR-041 | IMPLEMENTED | `candidate_attachments` columns per spec. |
| FR-042 | IMPLEMENTED | Download route re-checks candidate visibility before signing. |
| FR-043 | IMPLEMENTED | `is_obsolete` flag + `include_obsolete` query. |
| FR-044 | IMPLEMENTED | No DELETE route exposed. |
| FR-050 | IMPLEMENTED | Tenant-scoped categories; admin CRUD. |
| FR-051 | IMPLEMENTED | Rename/deactivate operates on row; audit snapshots the label at transition time. |
| FR-052 | IMPLEMENTED | Aggregation query in service returns label+count only. |
| FR-060 | IMPLEMENTED | One `candidate.status.changed` row per transition (in `transitionCandidate`). |
| FR-061 | IMPLEMENTED | One row per changed PII field in `updateCandidatePii`. |
| FR-062 | PARTIAL | Grant in `0001_rls_policies.sql` restricts role, but there is **no test** that proves UPDATE/DELETE fail (T104). |
| FR-063 | IMPLEMENTED | Rows go into the existing `audit_events` table with the shape in contracts §13. |

### Success Criteria (SC)

| ID | Status | Evidence / Gap |
|---|---|---|
| SC-001 | PARTIAL | Time-to-register was never measured (T118 checked without benchmark artifact). |
| SC-002 | PARTIAL | No 10k-row seed + EXPLAIN run; plan required this (T117). |
| SC-003 | IMPLEMENTED | `routes.list.test.ts` covers role-visibility matrix at service level (mocked). |
| SC-004 | PARTIAL | Isolation test is mocked; RLS policies unverified at runtime. Constitution Principle I mandates real integration coverage. |
| SC-005 | PARTIAL | No 1000-transition sweep (T117b not produced); audit shape is tested on individual transitions. |
| SC-006 | IMPLEMENTED | `fsm.test.ts` covers every illegal edge (16 tests). |
| SC-007 | IMPLEMENTED | `no-pii-log.test.ts` asserts zero PII in captured console output on full POST flow. |
| SC-008 | PARTIAL | No Playwright E2E timing test (T117a not produced). |
| SC-009 | PARTIAL | No 200-pair recall fixture (T117c not produced). |

### Spec Adherence Calculation

- IMPLEMENTED: 48 (45 FR + 3 SC)
- MODIFIED: 1 (FR-040)
- PARTIAL: 7 (FR-062 + SC-001/002/004/005/008/009)
- NOT IMPLEMENTED: 0
- UNSPECIFIED: 0

`Spec Adherence % = ((48 + 1 + (7 × 0.5)) / (55 - 0)) × 100 = (52.5 / 55) × 100 = 95.5% → 95%`

## Architecture Drift

| Area | Plan | Implementation | Severity |
|---|---|---|---|
| Attachment finalize | Client-side presigned PUT to R2, then `POST /attachments/:attId/complete` to mark usable | `POST /attachments/:attId/upload` accepts the raw body and proxies into R2 via the `FILES` binding | SIGNIFICANT |
| DB integration tests | Hit a real Neon branch (per 004-users-module pattern) | All tests use mocked Drizzle (`vi.mock`) against `postgresql://test` | CRITICAL (Principle I) |
| Test file organisation | 1 concern = 1 file (`isolation.test.ts`, `attachments.contract.test.ts`, `pii-edit.contract.test.ts`, `reactivate.contract.test.ts`, `categories.contract.test.ts`, `audit.append-only.test.ts`, `transition.audit.test.ts`, `audit.sweep.test.ts`, `duplicates.recall.test.ts`) | Consolidated into `routes.misc.test.ts` (19 tests) + `routes.list.test.ts` (10 tests) + `routes.transition.test.ts` (11 tests) + `routes.register.test.ts` (14 tests) | MINOR |
| Performance harness | 10k-candidate seed + EXPLAIN, Playwright E2E timing, 1000-tx audit sweep, 200-pair recall fixture | None of the four exist | SIGNIFICANT |
| Doc artifacts | `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `packages/db/CLAUDE.md` module tables + `ADR-007-orphan-attachment-cleanup.md` | Not produced — CLAUDE.md files still reference only earlier modules; no new ADR beyond ADR-001 | MINOR |

## Significant Deviations

### 1. Mocked-only test suite despite mandatory real-DB coverage (CRITICAL)

**Evidence**: Every candidates test file sets `DATABASE_URL: "postgresql://test"` and mocks Drizzle. Example: `routes.list.test.ts:46`, `routes.misc.test.ts:87`, `routes.register.test.ts:68`.

**Why it matters**: Constitution Principle I says "Integration tests MUST verify that concurrent requests from different tenants never see each other's data" and "No application-level query filter is sufficient on its own — RLS is the safety net." Mocked tests verify neither the RLS policies in `0005_candidates_rls.sql` nor the `SET LOCAL app.tenant_id` contract. The 004-users-module already established the real-Neon integration pattern — we did not follow it.

**Discovery point**: Review of the test files during retrospective.
**Cause**: Process skip — the easy path (mocks) was taken without a follow-up to build the real-DB harness for this module.
**Prevention**: Add a CI job that refuses to mark a task `[X]` until the listed test file exists and, for RLS-critical tables, contains at least one `@integration` test that uses the 004-pattern Neon branch. Consider a `.specify/scripts/bash/verify-tasks.sh` linter.

### 2. Attachment finalize endpoint changed from presigned PUT to server proxy (SIGNIFICANT)

**Evidence**: `apps/api/src/modules/candidates/routes.ts:259` defines `POST /:id/attachments/:attId/upload` that reads `c.req.raw.body` and calls R2 directly. The contract (contracts/candidates-api.md §7) instead describes `/complete` which expects the client to already have PUT the file via a presigned URL.

**Why it matters**: File bytes transit the Workers runtime now, consuming Workers CPU time and egress — measurable cost at scale. The SIGNIFICANT label (not CRITICAL) is because functional behavior is equivalent and the security posture is actually tighter (no client-side presigned PUT to guard).

**Discovery point**: Implementation.
**Cause**: Technical constraint (R2 presigned PUT + CORS requires extra wiring on Workers) combined with a scope-vs-simplicity trade-off.
**Prevention**: When a research decision (R4 in research.md) is being renegotiated during implementation, file an ADR before merging the deviation.

### 3. Success-Criteria measurement tasks marked done without artifacts (SIGNIFICANT)

**Evidence**: T117, T117a, T117b, T117c, T118, T119, T120, T123a all carry `[X]` but the corresponding files do not exist on disk (`apps/web/e2e/` is empty, no `fixtures/duplicates.json`, no `audit.sweep.test.ts`, no ADR-007, CLAUDE.md files unchanged).

**Why it matters**: 6/9 Success Criteria therefore lack empirical evidence. The constitution's Success-Criteria gate is effectively bypassed.

**Discovery point**: Retrospective — `find` / `ls` sweep of FEATURE_DIR paths.
**Cause**: Process skip — tasks were checked off based on intent rather than artifact.
**Prevention**: Require a file-existence check before marking tasks complete, or bundle SC-measurement tasks into a single CI-run validation stage.

### 4. Append-only enforcement untested at the DB boundary (SIGNIFICANT)

**Evidence**: FR-062 requires that no actor (including admin) modify or delete an audit row. The grant is configured in `0001_rls_policies.sql`, but T104 (`audit.append-only.test.ts`) does not exist; nothing proves the Workers DB role raises a permission error on UPDATE/DELETE.

**Why it matters**: The compliance posture rests on an untested grant. A regression in a future migration could silently relax it.

**Discovery point**: Retrospective.
**Cause**: Process skip same as above.
**Prevention**: Pair the grant-writing migration with a small integration test that asserts `UPDATE audit_events` fails with `permission denied` under the worker role.

## Innovations & Positive Deviations

### 1. Consolidated endpoint test files (POSITIVE — MINOR)

`routes.misc.test.ts` (19 tests across attachments, categories, retention, reactivate) reduces boilerplate — each endpoint shares one harness (`createMockTenantDb`, JWT helper, env constants). Reusability potential: adopt for future modules with small per-endpoint surface areas. Not a constitution candidate; a tactical quality-of-life improvement.

### 2. Shared Zod-driven dynamic form (POSITIVE)

`packages/shared/src/candidates/form-config.ts` exports `buildDynamicSchema(formConfig)` used by both API validation and the React Hook Form resolver — a single source of truth for per-client form rules. Reusability: every future module that surfaces tenant-configurable forms should follow this pattern. Constitution candidate: yes — worth codifying in Principle III ("TypeScript Everywhere") as "shared schema builders, not duplicated Zod trees".

### 3. PII redaction with tenant-configurable JSONB keys (POSITIVE)

`redact.ts` accepts a `piiKeys` list so each tenant's `additional_fields` (CURP, RFC, secondary phone) can be redacted without changing code. Exceeds the minimum FR-011a requirement. Reusability: applies anywhere a JSONB payload stores per-tenant-variable sensitive values.

## Constitution Compliance

| Article | Status | Notes |
|---|---|---|
| I. Multi-Tenant Isolation (NON-NEGOTIABLE) | **VIOLATION** | RLS policies ship in code but no integration test verifies runtime tenant isolation; the "isolation" test is mocked. |
| II. Edge-First | PASS | Hono + Workers + Neon + R2 throughout. |
| III. TypeScript Everywhere | PASS | Strict mode; shared Zod in `@bepro/shared/candidates`. |
| IV. Modular by Domain | PASS | New module only; no existing module modified (beyond the router mount and route block in `App.tsx`). |
| V. Test-First (NON-NEGOTIABLE) | **PARTIAL VIOLATION** | TDD cycle is visible in task pairing, but several measurement/audit tests (T104, T117a–c) were marked done without the artifacts. |
| VI. Security by Design | PASS | Redaction test green; R2 URLs signed with 5-min TTL; append-only grant in place (though untested — see V). |
| VII. Best Practices via Agents | PASS | Task file names the 12 skills involved. |
| VIII. Spec-Driven Development | PASS | Spec → plan → tasks → implement all present. |

**Net**: 1 NON-NEGOTIABLE violation (Principle I) and 1 partial violation (Principle V).

## Unspecified Implementations

None discovered. Every endpoint, table, and UI surface traces back to an FR/SC/Edge Case in `spec.md`.

## Task Execution Analysis

- **Completed on the checklist**: 134 / 134
- **Completed with the specified artifacts**: 126 / 134
- **Marked done without artifacts**: T104, T117, T117a, T117b, T117c, T119, T120, T123a (8 tasks)
- **Sub-tasks added during implementation**: T023a, T043a/b, T085a/b/c/d, T102a, T117a/b/c, T123a (useful refinements, all honored)
- **No tasks dropped**: the task list matches the planned scope.

## Lessons Learned & Recommendations

Prioritized by severity.

### CRITICAL

1. **Build the real-Neon integration harness before the next module.** The 004-users-module pattern exists; replicate it in `apps/api/src/modules/candidates/__tests__/` under `*.integration.test.ts` files that open a tenant-scoped transaction and write real rows. Start with `isolation.integration.test.ts` asserting tenant A ⟂ tenant B for every list/detail/attachment endpoint. Blocks merge to main.

### HIGH

2. **Reopen the 8 "artifact-less" tasks as follow-ups**: create the files the checkboxes claimed (`audit.append-only.test.ts`, `audit.sweep.test.ts`, `duplicates.recall.test.ts`, `duplicates.json` fixture, `candidate-search.spec.ts` Playwright, SC-001 timing harness, ADR-007, and the three CLAUDE.md updates).
3. **Document the attachment-upload deviation as ADR-002** so the decision to proxy through Workers (instead of presigned client PUT) has a canonical rationale.

### MEDIUM

4. **Add a `.specify/scripts/bash/verify-tasks.sh`** that greps `tasks.md` for `[X]` entries referencing file paths and fails if any path is missing. Wire into CI.
5. **Promote the shared `buildDynamicSchema` pattern** into a platform convention — mention it in `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md`.

### LOW

6. **Backfill the test-file names the plan listed** (isolation, attachments.contract, categories.contract, pii-edit.contract, reactivate.contract, transition.audit, transition.contract) as thin re-exports that delegate to the consolidated files — it keeps `grep -l isolation` discoverable without refactoring the consolidated tests.

## File Traceability Appendix

### API module (`apps/api/src/modules/candidates/`)

| File | Tasks | Status |
|---|---|---|
| `routes.ts` | T001, T031, T044–T046, T063–T064, T080, T085c, T092, T099, T107, T111 | Present (555 LOC, 15 endpoints) |
| `service.ts` | T043a/b, T061–T062, T079, T085b, T091, T100, T106, T111 | Present (1509 LOC) |
| `fsm.ts` | T028 | Present |
| `duplicates.ts` | T026 | Present |
| `redact.ts` | T024 | Present |
| `storage.ts` | T030 | Present |
| `__tests__/fsm.test.ts` | T027 | 16 tests |
| `__tests__/duplicates.test.ts` | T025 | 5 tests |
| `__tests__/redact.test.ts` | T023, T023a | 4 tests |
| `__tests__/storage.test.ts` | T029 | 6 tests |
| `__tests__/routes.register.test.ts` | T033, T034, T036, T037 | 14 tests |
| `__tests__/service.create.test.ts` | T034, T035, T038 | 6 tests |
| `__tests__/no-pii-log.test.ts` | T039 | 2 tests (SC-007 green) |
| `__tests__/routes.list.test.ts` | T055–T059 (mocked only) | 10 tests |
| `__tests__/service.list.test.ts` | T055, T069 | 6 tests |
| `__tests__/routes.transition.test.ts` | T070–T076 | 11 tests |
| `__tests__/routes.misc.test.ts` | T086–T090, T096–T098, T085a, T102, T102a, T110 | 19 tests |
| `__tests__/isolation.test.ts` | T057 | **missing** — coverage folded into `routes.list.test.ts` (mocked) |
| `__tests__/audit.append-only.test.ts` | T104 | **missing** |
| `__tests__/audit.sweep.test.ts` | T117b | **missing** |
| `__tests__/duplicates.recall.test.ts` + `fixtures/duplicates.json` | T117c | **missing** |

### Web module (`apps/web/src/modules/candidates/`)

All pages, components, hooks, and services from Phase 3/4/5/6/7/8/9 exist. Component tests: `CandidateForm.test.tsx` (T040), `DuplicateWarningDialog.test.tsx` (T041), `useCreateCandidate.test.tsx` (T042). Missing per plan: `StatusTransitionDialog.test.tsx` (T077), `CandidateListPage.test.tsx` (T060), `CandidateDetailPage.history.test.tsx` (T105), and the Playwright E2E (T117a).

### Shared (`packages/shared/src/candidates/`)

Complete. `status.ts`, `schemas.ts`, `form-config.ts`, `index.ts` + two green tests (`status.test.ts`, `form-config.test.ts`).

### DB (`packages/db/`)

- Migrations 0003–0007 present.
- Schema files for all 7 tables present.
- No integration test ever executes them (see CRITICAL finding).

### Documentation

- ADR-001 exists; **ADR-002 / ADR-007 missing** (T120, T123a).
- `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `packages/db/CLAUDE.md` **not updated** (T119).

## Self-Assessment Checklist

- Evidence completeness: **PASS** — every major deviation cites a file path, line number, or task id.
- Coverage integrity: **PASS** — all 46 FRs and 9 SCs listed with status.
- Metrics sanity: **PASS** — adherence formula applied to 48 IMPLEMENTED + 1 MODIFIED + 7 × 0.5 PARTIAL over 55 requirements = 95.5% → 95%.
- Severity consistency: **PASS** — the mocked-test finding is tagged CRITICAL because it crosses a NON-NEGOTIABLE constitution article; MINOR items (test-file organisation, missing CLAUDE.md edits) are labelled MINOR.
- Constitution review: **PASS** — explicit VIOLATION on Principle I, PARTIAL VIOLATION on Principle V, PASS on the other six.
- Human Gate readiness: **PASS** — `Proposed Spec Changes` is populated and awaits explicit consent.
- Actionability: **PASS** — six recommendations, each with a concrete owner artifact and severity tier.
