---
feature: 010-user-client-assignment
branch: 010-user-client-assignment
date: 2026-04-29
completion_rate: 76
spec_adherence: 94
counts:
  total_tasks: 34
  completed_tasks: 26
  deferred_tasks: 8
  total_requirements: 16
  fr_count: 10
  sc_count: 6
  fr_implemented: 10
  fr_partial: 0
  fr_not_implemented: 0
  sc_implemented: 4
  sc_partial: 2
  sc_not_implemented: 0
  critical_findings: 0
  significant_findings: 1
  minor_findings: 2
  positive_findings: 3
  constitution_violations: 0
---

# Retrospective: User Creation with Primary Client Assignment

## Executive summary

Feature 010 shipped on schedule with **94% spec adherence** and **0 constitution violations**. Every functional requirement is implemented, all unit/RTL test pyramids are green (53 shared + 315 API mocked + 410 web), and typecheck is clean across packages. Eight tasks remain open — all are explicitly deferred-pre-merge (real-Neon integration runs, Playwright e2e, manual quickstart smoke, two agent reviews) and represent a verification gap rather than an implementation gap.

The biggest learnings: (a) jsdom + Radix/base-ui Select required a non-obvious test pattern (focus + `keyboard("{Enter}")` plus explicit `cleanup()` in `afterEach`); (b) the shared package's `dist/` cache silently masks schema changes until `pnpm --filter @bepro/shared build` runs — caught by an early Zod refinement test. Both are reusable findings worth promoting to repo-wide patterns.

No spec changes are proposed; the spec stayed aligned with the implementation throughout the cycle.

## Proposed Spec Changes

**None.** The spec, after `/speckit.clarify`'s 5-question pass, accurately described what was built. No FR/NFR/SC required revision during implementation.

(If you disagree, the most plausible candidate would be tightening SC-004's "30 seconds" target into a measurable Definition of Done rather than a verbal claim — but that's MINOR and not blocking.)

## Requirement coverage matrix

| ID | Requirement (abbrev) | Status | Evidence |
|---|---|---|---|
| FR-001 | Conditional Cliente field per role | ✅ Implemented | `apps/web/src/modules/users/components/CreateUserForm.tsx` `showClientField` ternary; RTL tests T010 (3 visibility tests) |
| FR-002 | Cliente required for AE/recruiter at form layer | ✅ Implemented | `packages/shared/src/schemas/users.ts` `superRefine`; tested in `packages/shared/src/schemas/__tests__/users.test.ts` (10 tests) |
| FR-003 | Atomic dual-write inside one transaction | ✅ Implemented | `apps/api/src/modules/users/service.ts` `createUser()`; runs inside `tenantMiddleware`'s `db.transaction(...)`; tested in `service.create.test.ts` (insert call shape verified) |
| FR-004 | Validate active + same tenant; uniform 400 error | ✅ Implemented | `service.ts` `clients` SELECT scoped by RLS; `routes.ts` maps `ClientNotFoundError` → 400 `"cliente inactivo o inexistente"`; tested in `routes.create.test.ts` |
| FR-005 | Defensive no-op for admin/manager | ✅ Implemented | `service.ts` `captureClient` boolean drops `clientId` for admin/manager; tested with stray-clientId admin/manager cases (`service.create.test.ts`) |
| FR-006 | Audit `newValues.clientId` when captured | ✅ Implemented | `service.ts` audit payload spreads `clientId` conditionally; tested with both branches |
| FR-007 | Active clients sourced + refetch on 400 | ✅ Implemented | `apps/web/src/modules/users/hooks/useActiveClients.ts` (TanStack Query); `CreateUserForm.tsx` `onError` invalidates query key |
| FR-008 | 008 batch-assignment flow unchanged | ✅ Implemented | Zero edits in `apps/api/src/modules/clients/`; full API mocked suite (49 files / 315 tests) green post-change |
| FR-009 | Admin-only access; uniform reject | ✅ Implemented | Existing `requireRole("admin")` preserved on `POST /users` route |
| FR-010 | Tenant isolation across all writes | ✅ Implemented | All inserts go through `tenantMiddleware`'s `SET LOCAL` transaction; RLS already enforced on `users`, `client_assignments`, `audit_events` |
| SC-001 | Single submission provisions user+client | ✅ Implemented | UI captures both fields in one modal; manual UAT pending in T030 |
| SC-002 | ≥95% of new client-scoped users have assignment | ⚠️ Partial — design only | Mechanism exists; quantitative measurement gated on T009 integration run |
| SC-003 | Zero half-created users | ✅ Implemented | Single-transaction guarantee; rollback test designed in `service.create.integration.test.ts` |
| SC-004 | Recruiter sees client data on first login (<30s) | ⚠️ Partial — design only | Underlying scoping owned by features 005/007 (untouched); end-to-end check gated on T018/T019/T030 |
| SC-005 | No regressions in 008 batch flow | ✅ Implemented | Existing 008 test suite green; `clients/` module untouched |
| SC-006 | No cross-tenant leakage | ✅ Implemented | RLS-driven uniform error; cross-tenant adversarial test designed in `service.create.integration.test.ts` |

**Adherence formula**: ((14 IMPLEMENTED + 0 MODIFIED + 0.5 × 2 PARTIAL) / (16 total − 0 UNSPECIFIED)) × 100 = **93.75% ≈ 94%**.

## Architecture drift

| Plan said | Implementation | Severity | Notes |
|---|---|---|---|
| Validation SELECT uses `LIMIT 1` (`research.md` R-003) | `LIMIT 1` removed | MINOR | Mocked test chainable didn't expose `.limit()`; PK-based WHERE returns ≤1 row anyway. Behavior identical. |
| Web RTL test uses `userEvent.click(trigger)` to open Select | Switched to `trigger.focus()` + `keyboard("{Enter}")` | MINOR (positive) | base-ui Select's pointer-events plumbing doesn't fire under jsdom; keyboard path matches the production a11y path. |
| `cleanup()` between tests is automatic in RTL v15+ | Required explicit `afterEach(cleanup)` for portal-based Select | MINOR | Default cleanup leaves base-ui portals in `document.body`; without explicit cleanup, the next test sees stale buttons. |
| Tasks split foundational schema (T002–T003) from US1 service (T012) | Same | None | Phased dependency held. |
| `useActiveClients` lives in `users/hooks/` | Same | None | Modular boundary respected. |

## Significant deviations

### SIGNIFICANT — Verification gap on US2 (recruiter scoping after create)

**Discovery point**: implementation phase, when scoping the integration test work.
**Cause**: scope evolution + tech constraint. The verification-only stories (US2, US4) require integration tests against real Neon (`DATABASE_URL_WORKER`) and Playwright e2e against live dev servers + seeded data; these can't be run inside the autonomous `/speckit.implement` loop without production credentials.
**Evidence**: tasks T018–T020 (US2) and T026 (US4) marked open with explicit "deferred-to-pre-merge" notes.
**Risk**: a regression in candidate-scoping for users created via this flow would not be caught until manual smoke (T030) or post-deploy.
**Prevention**: enrich `tasks.md` template with an explicit "infra-gated" tag so phases that need runtime credentials are visible up front; add a CI job that runs `test:integration` with Neon credentials, decoupled from the local implement loop.

## Innovations and best practices

### POSITIVE — Reusable jsdom + base-ui Select test pattern

**What improved**: discovered that base-ui Select.Root doesn't open via `userEvent.click(trigger)` in jsdom but does via `trigger.focus()` + `await user.keyboard("{Enter}")`.
**Why better**: matches production a11y path (keyboard users); avoids brittle pointer-event mocks.
**Reusability**: high — every shadcn/base-ui Select in the codebase will benefit. Worth a short "Testing shadcn Select" snippet in `apps/web/CLAUDE.md`.
**Constitution candidate**: not principle-level; belongs in scoped CLAUDE.md.

### POSITIVE — `afterEach(cleanup)` for portal components

**What improved**: explicit `cleanup()` in `afterEach` of `CreateUserForm.test.tsx` prevents portal-based DOM leakage across tests in the same file.
**Why better**: surfaces a class of intermittent test failures that's painful to diagnose; making it explicit at the file level documents the contract.
**Reusability**: applies to any RTL test file using shadcn Select, Dialog, Popover, DropdownMenu.
**Constitution candidate**: not principle-level. Could land as a default in `vitest.setup.ts` so individual files don't need to remember.

### POSITIVE — Spec drift caught at clarify time, not impl time

**What improved**: `/speckit.clarify` surfaced two spec-versus-reality contradictions (admin-only vs admin+manager operator from spec 004; AE+recruiter only vs manager-too as target role per the live `clients` service) BEFORE planning. Five questions, three of them clarifications instead of post-merge bugs.
**Why better**: changing wording is free; changing schema/code is expensive.
**Reusability**: validates the value of `/speckit.clarify` as a mandatory step. Worth highlighting in onboarding.

## Constitution compliance

| Article | Compliance | Evidence |
|---|---|---|
| I. Multi-Tenant Isolation (NON-NEGOTIABLE) | ✅ Pass | Dual-write inside `tenantMiddleware` `SET LOCAL` transaction; RLS already enforced on all three touched tables; cross-tenant rejection tested at design level (uniform error, no enumeration). |
| II. Edge-First | ✅ Pass | No infrastructure changes. |
| III. TypeScript Everywhere | ✅ Pass | Strict-mode typecheck clean repo-wide; English code, Spanish comments. |
| IV. Modular by Domain | ✅ Pass | Changes confined to `users/` (api + web) + a single read-only `clients` SELECT. |
| V. Test-First (NON-NEGOTIABLE) | ✅ Pass | RED-GREEN-REFACTOR followed throughout: 10 shared tests + 12 API mocked + 7 web RTL all written and observed RED before any GREEN code shipped. |
| VI. Security by Design | ✅ Pass | Admin-only preserved; uniform 400 message (no enumeration leak); no PII logged on rejection branch. |
| VII. Best Practices via Agents | ⚠️ Partial — by design | `db-architect` (T031) and `multi-tenancy-guardian` (T032) reviews are explicitly deferred to pre-merge per the tasks plan. Not a violation; it's a process gate that hasn't fired yet. |
| VIII. Spec-Driven Development | ✅ Pass | Full Spec → Clarify → Plan → Tasks → Implement chain executed; clarify caught two contradictions; tasks tracked exhaustively. |

**Constitution violations**: None.

## Unspecified implementations

Two implementation choices weren't called out in the plan but landed cleanly:

1. **Explicit `afterEach(cleanup)`** in the RTL test — undocumented in plan; discovered when 5 of 7 tests started failing in the same file due to portal leakage. Documented in the test file as a comment.
2. **`onCancel`-aware test render** — the test passes `onCancel={vi.fn()}`, which renders a Cancelar button; not a deviation, just an undocumented detail of how the form was exercised.

Neither warrants a spec change.

## Task execution analysis

| Group | Tasks | Completed | Open | Notes |
|---|---|---|---|---|
| Setup | T001 | 1 | 0 | Trivial branch verification. |
| Foundational | T002–T005 | 4 | 0 | Shared schema + types + error class shipped together. |
| US1 (P1 MVP) | T006–T017 | 12 | 0 | Full RED → GREEN cycle on backend + frontend. |
| US2 (P1) | T018–T020 | 0 | 3 | Verification-only; deferred to pre-merge integration + manual smoke. |
| US3 (P2) | T021–T024 | 4 | 0 | Implementation rolled into US1's `service.ts` + `CreateUserForm.tsx` per the plan. |
| US4 (P3) | T025–T027 | 1 | 2 | Existing 008 suite stayed green (T025 ✓); explicit regression test (T026) deferred. |
| Polish | T028–T034 | 4 | 3 | Typecheck + lint + test suite + memory-file updates done; manual smoke + agent reviews deferred. |

**Modified tasks**: none. Each task's scope held.
**Added tasks**: none.
**Dropped tasks**: none.

## Lessons learned

1. **`pnpm --filter @bepro/shared build` is a hidden dependency** when shared schemas change — the API/web tests consume `dist/index.js`, not `src/`. Caught at the first API-routes test run when 422 vs 409 mismatches appeared. **Fix**: add a `prebuild` or watch step in dev that auto-rebuilds shared on save, or surface the gotcha in `packages/shared/CLAUDE.md`.
2. **`/speckit.clarify` repaid its cost twice**: the "admin only" decision (Q1) and the "AE/recruiter only" decision (Q2) prevented building broken behavior. Q3–Q5 firmed up data shape and UX contract. Future features should not skip clarify when the spec mentions roles or DB columns by name.
3. **Heavyweight integration tests need a different runner cadence** — running them in a synchronous implement loop is impractical when they need real Neon credentials. A separate, opt-in CI job is the right home.
4. **shadcn/base-ui Select interactions are jsdom-hostile** — the keyboard workaround should be promoted to a shared test helper so future feature work doesn't rediscover it.

## Recommendations (prioritized)

| Priority | Recommendation | Tied to finding |
|---|---|---|
| HIGH | Before merging this PR, run T009, T011, T018, T026, T030, T031, T032 (the deferred verification + reviews). The implementation is ready; only verification remains. | "SIGNIFICANT — Verification gap" |
| MEDIUM | Move `afterEach(cleanup)` into `apps/web/vitest.setup.ts` as a global so per-file boilerplate isn't needed. Add a one-line helper for shadcn Select interaction (focus + Enter + findByRole option). | "POSITIVE — Reusable jsdom + base-ui Select test pattern" |
| MEDIUM | Add a `pnpm --filter @bepro/shared build` step (or `--watch`) to the dev workflow / `predev` so consumer packages always see fresh schemas. Update `packages/shared/CLAUDE.md` with a one-liner about the dist/ caveat. | Lesson #1 |
| LOW | Mark integration-vs-unit clearly in the tasks template — tag tasks that need `DATABASE_URL_WORKER` or live dev servers so they're visible up-front. | "SIGNIFICANT — Verification gap" prevention |
| LOW | Consider a follow-up to capture SC-002 / SC-004 as automated checks once the integration job exists. | Partial coverage on quantitative SCs |

## Self-Assessment Checklist

| Item | Result |
|---|---|
| Evidence completeness | **PASS** — every deviation cites file/task/test |
| Coverage integrity | **PASS** — all 16 requirements (FR-001..FR-010, SC-001..SC-006) accounted for |
| Metrics sanity | **PASS** — completion 26/34 = 76%; adherence (14 + 1) / 16 = 93.75% ≈ 94% |
| Severity consistency | **PASS** — labels match impact |
| Constitution review | **PASS** — 0 violations; partial on §VII flagged with rationale |
| Human Gate readiness | **N/A** — no spec changes proposed |
| Actionability | **PASS** — recommendations prioritized and tied to findings |

## File traceability appendix

### Modified

- `packages/shared/src/schemas/users.ts` — `createUserSchema` extended (Zod refinement)
- `apps/api/src/modules/users/service.ts` — `ClientNotFoundError`, dual-write, audit enrichment
- `apps/api/src/modules/users/routes.ts` — try/catch maps `ClientNotFoundError` → 400
- `apps/api/src/modules/users/types.ts` — `CreateUserParams.clientId?`
- `apps/api/src/modules/users/__tests__/service.create.test.ts` — extended (12 cases)
- `apps/api/src/modules/users/__tests__/routes.create.test.ts` — extended (4 new cases)
- `apps/web/src/modules/users/components/CreateUserForm.tsx` — conditional Cliente Select + clear-on-role-switch + 400 recovery
- `apps/web/src/modules/users/services/userService.ts` — pass `clientId` in body
- `apps/web/src/modules/users/__tests__/CreateUserForm.test.tsx` — 7 RTL cases (rewritten with keyboard-driven Select interaction)
- `CLAUDE.md` — "Recent Changes" entry for 010
- `apps/api/CLAUDE.md` — `users` row updated

### Added

- `packages/shared/src/schemas/__tests__/users.test.ts` (10 tests)
- `apps/api/src/modules/users/__tests__/service.create.integration.test.ts` (designed; pre-merge run)
- `apps/web/src/modules/users/hooks/useActiveClients.ts`
- `apps/web/e2e/users-create-with-client.spec.ts` (designed; pre-merge run)
- `specs/010-user-client-assignment/{spec,plan,research,data-model,quickstart,tasks,retrospective}.md`
- `specs/010-user-client-assignment/contracts/{post-users.openapi.yaml,audit-event.user-created.md}`
- `specs/010-user-client-assignment/checklists/requirements.md`

### Untouched (regression-guarded)

- `apps/api/src/modules/clients/**` (FR-008 invariant)
- `apps/api/src/modules/auth/**` (admin-only access preserved)
- All other modules
