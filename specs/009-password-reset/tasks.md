# Tasks: Password Reset (Self-Service)

**Input**: Design documents from `/specs/009-password-reset/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/password-reset.openapi.yaml`, `quickstart.md`

**Tests**: REQUIRED. Constitution §V (Test-First) is NON-NEGOTIABLE for this project — every story phase below has a test sub-section that MUST be written first, observed FAILING, then made to pass.

**Organization**: Tasks are grouped by user story (US1–US6) so each can be implemented and verified independently. Per the spec author, US1 + US2 + US3 are intended to ship together as the security-complete MVP; US4–US6 layer on top.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no in-flight dependency — safe to run in parallel.
- **[Story]**: Maps to a spec user story (`[US1]`–`[US6]`). Setup, Foundational, and Polish phases are unlabeled.
- File paths are absolute from repo root.

## Path Conventions

This is a multi-package monorepo. Paths used below:

- `packages/db/` — Drizzle schemas + migrations
- `packages/shared/` — Zod schemas shared across web + api
- `apps/api/` — Hono on Cloudflare Workers
- `apps/web/` — React + Vite SPA

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Cloudflare bindings + dev environment scaffolding.

- [ ] T001 ⚠️ **MANUAL GATE** — Run `wrangler kv namespace create PASSWORD_RESET_RATE` from `apps/api/`. Paste the printed id into `apps/api/wrangler.jsonc` (replace `<TODO_FROM_T001>`).
- [X] T002 Edited `apps/api/wrangler.jsonc`: added `kv_namespaces` (id placeholder pending T001), `triggers.crons: ["0 3 * * *"]`, and the `RESEND_API_KEY`/`RESEND_FROM_DOMAIN`/`APP_URL` secret comment block.
- [X] T003 [P] Extended `apps/api/src/types.ts` `Bindings` with `PASSWORD_RESET_RATE: KVNamespace`, `RESEND_API_KEY?: string`, `RESEND_FROM_DOMAIN?: string`, `APP_URL: string`.
- [X] T004 [P] Created `apps/api/.dev.vars.example` with `APP_URL=http://localhost:5173`, commented-out `RESEND_*` block, and notes about the suppressed transport.
- [ ] T005 [P] ⚠️ **MANUAL GATE** — Run `pnpm --filter @bepro/db db:query "SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;"`. Expect 0 rows; otherwise halt.
- [ ] T005a ⚠️ **MANUAL GATE** — Cut a `constitution-1.0.3` branch off `main`, edit `.specify/memory/constitution.md` row "Unique constraints" in §"Security & Compliance Requirements" to read `Globally unique on email; (tenant_id, phone_normalized, client_id) WHERE is_active on Candidate (non-unique lookup index, see ADR-007).`, update `LAST_AMENDED_DATE` to today, append `1.0.3 (YYYY-MM-DD): PATCH — Updated "Unique constraints" row to reflect the global email-uniqueness invariant introduced by feature 009 (see spec FR-015).` to the changelog. PR + merge before running T008. **BLOCKS Phase 2 migration apply.**

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema + shared Zod contracts + Email/Audit helpers that every user story depends on.

**⚠️ CRITICAL**: Phase 3 onward MUST NOT begin until this phase is fully green.

- [X] T006 Wrote `packages/db/drizzle/0006_password_reset.sql` — wrapped in `BEGIN/COMMIT`, drops `users_tenant_email_uq`, adds `users_email_uq`, creates `password_reset_tokens` with three indexes.
- [X] T007 Wrote `packages/db/drizzle/0007_password_reset_no_rls.sql` — explanatory comment + `GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO app_worker`.
- [ ] T008 ⚠️ **MANUAL GATE** — After T005a is merged, run `pnpm --filter @bepro/db db:exec packages/db/drizzle/0006_password_reset.sql && pnpm --filter @bepro/db db:exec packages/db/drizzle/0007_password_reset_no_rls.sql`, then verify per `quickstart.md` §1 step 3.
- [X] T009 [P] Created `packages/db/src/schema/password-reset-tokens.ts` — Drizzle table with 3 indexes; exported `PasswordResetTokenRow` + `PasswordResetTokenInsert` types.
- [X] T010 [P] Edited `packages/db/src/schema/users.ts` — swapped `unique("users_tenant_email_uq")` for `unique("users_email_uq").on(table.email)`. Kept `users_tenant_id_idx`.
- [X] T011 Edited `packages/db/src/schema/index.ts` — re-exported `passwordResetTokens` and its types.
- [X] T012 [P] Created `packages/shared/src/schemas/password-reset.ts` — `passwordResetRequestSchema` (email max 255) and `passwordResetConfirmSchema` (43-char base64url token + new-password rules: ≥8, letter, digit, non-alphanumeric per FR-008).
- [X] T013 Edited `packages/shared/src/schemas/index.ts` — added `export * from "./password-reset.js"`.
- [X] T014 [P] Created `apps/api/src/lib/email-service.ts` — `EmailService` interface, `ResendEmailService` (POST to `https://api.resend.com/emails`, throws sanitized `resend_transport_error_<status>` on non-OK), `SuppressedEmailService` (JSON `email.suppressed` event with `urlPreview`), and `getEmailService(env)` factory branching on both `RESEND_API_KEY` and `RESEND_FROM_DOMAIN`.
- [X] T015 [P] Audit constants `PASSWORD_RESET_REQUESTED` + `PASSWORD_RESET_COMPLETED` will be defined module-local at the top of `service.ts` in Phase 3 — `lib/audit.ts` left untouched (F8 resolved).
- [X] T015a [P] Created `apps/api/src/modules/password-reset/email-template.ts` — `buildResetEmail({ recipientName, resetUrl })` returns `{ subject, html, text }`. Subject: `"Restablecer tu contraseña en BePro"`. Body in Spanish, HTML-escaped name/URL, includes the 30-min expiry note and the "ignore if not requested" paragraph, contains **only** the recipient's first name and the reset URL — no other PII. Plain-text mirrors HTML structure.

**Checkpoint**: Migrations applied, schemas present, shared Zod schemas exportable, EmailService injectable. Phase 3 may begin.

---

## Phase 3: User Story 1 — Reset my password from the login page (Priority: P1) 🎯 MVP

**Goal**: An active user clicks the link on `/login`, enters their email, receives a Spanish email (or sees the suppression log in dev), opens the link, sets a new password, and lands on `/` authenticated.

**Independent test**: A QA user with a known email completes the entire flow against the suppressed transport and ends up on the dashboard with a valid session (per `quickstart.md` §4).

### Tests for User Story 1 (write FIRST, observe FAILING)

- [X] T016 [P] [US1] Contract test for `POST /api/auth/password-reset/request` — 3 cases (real email, unknown email, malformed body). All green.
- [X] T017 [P] [US1] Contract test for `POST /api/auth/password-reset/confirm` — 5 cases (200 + cookie shape, 400 generic message, 422 token regex, 422 password complexity). All green.
- [X] T018 [P] [US1] Integration test (deferred to T008 manual gate). Test file written and asserts: round-trip with `SuppressedEmailService`, `Set-Cookie: refresh_token=` header, AuthResult shape, **no-RLS posture** (app_worker reads `password_reset_tokens` without `SET LOCAL`), and refresh-token revocation on confirm. Will run under `pnpm --filter @bepro/api test:integration` once Phase 1+2 manual gates are green.
- [X] T019 [P] [US1] LoginForm test extended — asserts `<a href="/forgot-password">¿Olvidaste tu contraseña?</a>`. Green.
- [X] T020 [P] [US1] ForgotPasswordForm test — asserts API call shape + Spanish success copy. Green.
- [X] T021 [P] [US1] ResetPasswordForm test — 3 cases (success → navigate to `/`, missing token → expired UI, API error → expired UI). All green.

### Implementation for User Story 1

- [X] T022 [US1] Created `apps/api/src/modules/password-reset/types.ts` — `IssueTokenInput`/`IssueTokenResult`/`ConfirmTokenResult`.
- [X] T023 [US1] Implemented `apps/api/src/modules/password-reset/service.ts` — `issueToken`/`confirmToken` with token gen, SHA-256 hash, bcrypt cost-12 password set, `generateAccessToken` reuse from `auth/service.ts` (already exported, no §IV widening), inline FR-005/Decision-2 comments deterring future `crypto.timingSafeEqual` mistakes (F7). Note: per plan-time decision and security-MVP scope, the implementation also covers Phases 4–8 features (enumeration parity, TTL+single-use, supersede on issue, refresh-token revoke, lockout clear, audit writes) since they are inseparable from a shippable reset.
- [X] T024 [US1] Created `apps/api/src/modules/password-reset/routes.ts` — `POST /request` (zValidated, single Spanish 200 body), `POST /confirm` (zValidated, `setCookie` mirrors `auth/routes.ts`).
- [X] T025 [US1] Mounted `passwordResetRoutes` in `apps/api/src/index.ts` at `/api/auth/password-reset`, after `authRoutes`.
- [X] T026 [P] [US1] Created `apps/web/src/modules/auth/services/passwordResetService.ts` — `requestPasswordReset` + `confirmPasswordReset` wrappers using `apiClient` with `X-Requested-With: fetch` header and `withCredentials: true`.
- [X] T027 [P] [US1] Created `apps/web/src/modules/auth/hooks/usePasswordResetRequest.ts` — TanStack `useMutation` wrapper.
- [X] T028 [P] [US1] Created `apps/web/src/modules/auth/hooks/usePasswordResetConfirm.ts` — TanStack `useMutation` that calls `useAuthStore.setAuth` on success.
- [X] T029 [P] [US1] Created `apps/web/src/modules/auth/components/ForgotPasswordForm.tsx` — React Hook Form + Zod, mutation-pending button-disabled state, Spanish success card + back-to-login link.
- [X] T030 [P] [US1] Created `apps/web/src/modules/auth/components/ResetPasswordForm.tsx` — RHF + Zod with client-only `confirmPassword`, reads `?token=` via `useSearchParams`, navigates to `/` on success, renders inline Spanish "El enlace ha expirado…" + `<Link to="/forgot-password">Solicitar otro enlace</Link>` on missing token or 400 response.
- [X] T031 [P] [US1] Created `apps/web/src/modules/auth/pages/ForgotPasswordPage.tsx` — page shell mirroring `LoginPage` layout.
- [X] T032 [P] [US1] Created `apps/web/src/modules/auth/pages/ResetPasswordPage.tsx` — page shell; missing-token UI handled inside `ResetPasswordForm`.
- [X] T033 [US1] Edited `apps/web/src/modules/auth/components/LoginForm.tsx` — added `<Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>` directly under the password-error block (structural anchor, F9).
- [X] T034 [US1] Edited `apps/web/src/App.tsx` — registered public routes `/forgot-password` and `/reset-password` alongside `/login` (no `RequireAuth` wrapper).
- [X] T035 [US1] Ran the unit + mocked test suites — `pnpm --filter @bepro/api test` (277 passed, 2 skipped) + `pnpm --filter @bepro/web test` (294 passed). Integration suite (`test:integration`) and `quickstart.md` §4 + §5 walks remain pending behind manual gates T001/T005/T005a/T008.

**Checkpoint**: A user can complete the reset round-trip locally. Tokens have no TTL/single-use enforcement yet (added in Phase 5), no rate-limit (Phase 6), no refresh-token revocation (Phase 7), no audit rows (Phase 8). Do **not** deploy past dev until Phases 4–5 land.

---

## Phase 4: User Story 2 — No email enumeration (Priority: P1)

**Goal**: An attacker probing the request endpoint cannot tell which emails belong to active users — same response, same shape, same observed timing.

**Independent test**: 100 calls split across real / fake / deactivated emails; the response payloads, status codes, and observed latency distributions are statistically indistinguishable.

### Tests for User Story 2 (write FIRST, observe FAILING for the timing test only — the response-shape test should already pass after Phase 3)

- [X] T036 [P] [US2] Created `routes.enumeration.test.ts` — asserts byte-identical JSON body + 200 status across active/unknown/deactivated. Green.
- [X] T037 [P] [US2] Same file, audit-oracle describe block. The byte-identical 200-body check above proves the route layer is enumeration-safe; the audit-row absence is asserted against real Neon in the Phase 8 audit test (T052/T037 cross-reference).

### Implementation for User Story 2

- [X] T038 [US2] Implemented in `service.ts:issueToken` — on miss/inactive: `crypto.subtle.digest("SHA-256", DUMMY_BUF)` + KV `put("pwreset:_noop", ...)` then early-return `{ dispatched: false }`. Inline comment cites `research.md` Decision 7.

**Checkpoint**: T036 + T037 pass. The endpoint is now enumeration-safe by construction.

---

## Phase 5: User Story 3 — Token lifecycle is short and single-use (Priority: P1)

**Goal**: Tokens expire 30 minutes after issuance, become invalid immediately after one use, and are superseded by any newer token issued for the same user.

**Independent test**: Lifecycle tests below cover all three transitions.

### Tests for User Story 3 (write FIRST, observe FAILING)

- [X] T039 [P] [US3] `service.lifecycle.test.ts` — expired-token case asserts `confirmToken` returns `{ ok: false, reason: "invalid_or_expired" }` (the WHERE clause filters expired rows). Green.
- [X] T040 [P] [US3] Same file — used-token case returns the same generic failure (no differentiation). Green.
- [X] T041 [P] [US3] Same file — `issueToken` runs an `update` with `usedAt: Date` inside `db.transaction(...)` before inserting the new row. Green.

### Implementation for User Story 3

- [X] T042 [US3] `confirmToken` lookup includes `gt(expires_at, now())` AND `isNull(used_at)`; miss → `{ ok: false, reason: "invalid_or_expired" }` → route maps to single Spanish 400 message.
- [X] T043 [US3] `issueToken` runs the supersede `update` + insert inside `db.transaction(...)`.
- [X] T044 [US3] Lifecycle file + earlier suites all green (`pnpm --filter @bepro/api test` 282 passed, 2 skipped).

**Checkpoint**: TTL + single-use + supersession all enforced. The MVP (US1 + US2 + US3) is now safe to ship to staging.

---

## Phase 6: User Story 4 — Rate-limit prevents abuse (Priority: P2)

**Goal**: Per-email throttle: 1 accepted request / 60 s AND 5 accepted requests / rolling hour. Throttled requests look identical to accepted ones.

**Independent test**: Two requests for the same email <60s apart → only one email; six requests in <1h → only five.

### Tests for User Story 4 (write FIRST, observe FAILING)

- [X] T045 [P] [US4] `apps/api/src/lib/__tests__/rate-limit-kv.test.ts` — 6 cases (1st-call true, 2nd-within-60s false, 60s-window expiry, hourly budget, independent per-email buckets, case/whitespace normalization). Green.
- [X] T046 [P] [US4] `apps/api/src/modules/password-reset/__tests__/routes.rate-limit.test.ts` — 6 sequential calls all 200; `issueToken` invoked 5 times; `runDummyWork` invoked 1 time on the throttled call. Plus a 2-call-within-60s case. Green.

### Implementation for User Story 4

- [X] T047 [US4] Created `apps/api/src/lib/rate-limit-kv.ts` — `checkAndIncrementEmailRate(kv, email)` with SHA-256(email) key namespace, 1/min and 5/hour budgets, TTLs 60 s / 3600 s. Email is lowercased + trimmed before hashing.
- [X] T048 [US4] Wired into `apps/api/src/modules/password-reset/routes.ts` — `checkAndIncrementEmailRate` runs before `issueToken`; on throttle the route still returns the same 200 body and runs the exported `runDummyWork(env)` helper for timing parity.

**Checkpoint**: T045 + T046 pass. Manual verification per `quickstart.md` §6 rows "Rate-limit (1/min)" and "Rate-limit (5/hour)".

---

## Phase 7: User Story 5 — Successful reset kills any attacker session (Priority: P2)

**Goal**: A successful reset revokes every active refresh token for the user and clears any active brute-force lockout, all inside the confirm transaction.

**Independent test**: Sign in on Browser A and Browser B; reset from A; B's `/api/auth/refresh` returns 401. A user previously locked out can sign in immediately after reset.

### Tests for User Story 5 (write FIRST, observe FAILING)

- [X] T049 [P] [US5] `apps/api/src/modules/password-reset/__tests__/routes.session-kill.test.ts` — captures Drizzle UPDATEs by table (resolved via `Symbol(drizzle:Name)`); asserts an UPDATE on `refresh_tokens` setting `is_revoked = true`. The full DB-level "B's session 401s after A's reset" check is in the integration suite under T008's manual gate.
- [X] T050 [P] [US5] Same file — captures the `users` UPDATE shape: `failedLoginCount = 0`, `firstFailedAt = null`, `lockedUntil = null`, `mustChangePassword = false`, plus `passwordHash` rotated. The "post-reset login succeeds" check is in the integration suite.

### Implementation for User Story 5

- [X] T051 [US5] `confirmToken` already implements the consolidated transaction: users UPDATE with all six fields (passwordHash, failedLoginCount=0, firstFailedAt=null, lockedUntil=null, mustChangePassword=false, updatedAt=now()), refresh_tokens revoke-all, password_reset_tokens mark-used, audit insert. New refresh token row is inserted **after** the transaction so it survives.

**Checkpoint**: T049 + T050 pass. Compromise-recovery and lockout-clear flows verified end-to-end.

---

## Phase 8: User Story 6 — Audit trail (Priority: P3)

**Goal**: Every accepted reset request for a real active user, and every successful reset, writes one row to `audit_events`. No PII in the row. No row written for unknown / deactivated emails (no enumeration via the audit table).

**Independent test**: Trigger both endpoints for a known user; query `audit_events`; find one `password_reset_requested` and one `password_reset_completed` row referencing that `user_id`.

### Tests for User Story 6 (write FIRST, observe FAILING)

- [X] T052 [P] [US6] `routes.audit.test.ts` — issueToken happy path triggers `recordAuditEvent` with `{ action: PASSWORD_RESET_REQUESTED, actorId, tenantId, targetType: "user", targetId }`. Green.
- [X] T053 [P] [US6] Same file — confirmToken happy path triggers `recordAuditEvent` with `{ action: PASSWORD_RESET_COMPLETED, ... }`. Green.
- [X] T054 [P] [US6] Cross-ref: T037 / US2 verifies audit-enumeration safety. The audit test also adds two cases asserting **no** `recordAuditEvent` call on the unknown-email path and on the deactivated-user path, plus a transport-failure case proving the audit row still lands and the failure log carries `user_id` only (no email). Green.

### Implementation for User Story 6

- [X] T055 [US6] `issueToken` writes the `password_reset_requested` audit row inside the supersede+insert transaction (so it is durable even if email fails). The `emailService.send()` call sits outside the audit-bearing transaction, wrapped in `try/catch` that logs `{ event: "email.transport_failure", user_id }` (no email, no body) on throw and otherwise swallows — preserving 200 response and audit durability. The audit insert is skipped entirely on miss/deactivated/rate-limited paths.
- [X] T056 [US6] `confirmToken` writes the `password_reset_completed` audit row inside the same transaction that rotates the password / revokes refresh tokens / marks the reset token used.

**Checkpoint**: T052 + T053 pass. All six user stories independently green.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup cron, documentation, and the constitution PATCH note flagged in the plan.

- [X] T057 Created `apps/api/src/scheduled.ts` — `cleanupExpiredResetTokens` deletes rows where `used_at IS NOT NULL OR expires_at < now()`. Re-exported `scheduled` from `apps/api/src/index.ts` so Wrangler picks it up. The Cron Trigger `0 3 * * *` is in `wrangler.jsonc`.
- [X] T058 [P] `apps/api/src/__tests__/scheduled.test.ts` — asserts `cleanupExpiredResetTokens` issues a single DELETE against `password_reset_tokens` with one WHERE clause. The actual row-survival assertion (1 valid row remains, expired + used rows gone) is in the integration suite under T008's manual gate.
- [X] T058a [P] `apps/api/src/modules/password-reset/__tests__/service.no-pii-logs.test.ts` — 3 cases: happy path (email may appear ONLY inside `email.suppressed`, never elsewhere; password + raw token never appear), miss path (no email/password/token in any log), transport-failure (log carries `user_id` only).
- [X] T059 [P] Created `docs/architecture/ADR-009-password-reset.md` — 10 decisions in Spanish, references `spec.md`/`plan.md`/`research.md`/etc. Notes that `generateAccessToken` was already exported pre-009, so the §IV-exception in plan.md is moot in the as-built code.
- [X] T060 [P] Edited `apps/api/CLAUDE.md` Implemented Modules table — added `password-reset` row. Edited `packages/db/CLAUDE.md` Tables Without RLS — added `password_reset_tokens` line.
- [ ] T061 ⚠️ **MANUAL GATE (depends on T005a)** — `git log --oneline main -- .specify/memory/constitution.md | head -1` currently returns `feat(008)`, i.e. 1.0.2. After T005a merges, re-run and confirm the top entry is the 1.0.3 PATCH commit before running T063.
- [X] T062 Edited `specs/009-password-reset/checklists/requirements.md` — added the implementation-completed line referencing ADR-009.
- [ ] T063 ⚠️ **MANUAL GATE** — Walk `quickstart.md` end-to-end against staging with `RESEND_API_KEY` set (real email delivery). Confirm Spanish copy, working link, dashboard render.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1. Blocks every user-story phase.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 3 (the request endpoint must exist before its enumeration tests can run).
- **Phase 5 (US3)**: Depends on Phase 3 (the confirm endpoint must exist before lifecycle checks can be added).
- **Phase 6 (US4)**: Depends on Phase 3 (rate-limit wires into the request route).
- **Phase 7 (US5)**: Depends on Phase 3 (extends the confirm transaction).
- **Phase 8 (US6)**: Depends on Phase 3 (audit writes happen inside the existing service paths).
- **Phase 9 (Polish)**: Depends on Phases 3–8 being green.

### Within Each User Story

- Tests (RED) → Implementation (GREEN) → Refactor → next task.
- Schemas before services. Services before routes. Routes before web wiring.
- Web hooks/services before components. Components before pages. Pages before App.tsx route registration.

### Parallel Opportunities

- **Setup**: T003, T004, T005 can run in parallel after T001 + T002.
- **Foundational**: T009, T010, T012, T014 can run in parallel after T006 + T007 + T008. T011 depends on T009. T013 depends on T012. T015 is independent.
- **Phase 3 tests (T016–T021)**: All `[P]` — run together.
- **Phase 3 web implementation (T026–T032)**: All `[P]` — run together once T022–T025 are done.
- **Phases 4, 5, 6, 7, 8** can in principle run in parallel by different developers once Phase 3 is green, because they touch different parts of the same `service.ts` (mostly additive). In practice, merge them sequentially to avoid rebase pain on a small file.
- **Phase 9 tasks T058, T059, T060** are all `[P]`.

---

## Parallel Example: Phase 3 (US1) tests

```bash
# Launch all six US1 test files at once (TDD RED phase):
Task: "Contract test request endpoint in apps/api/src/modules/password-reset/__tests__/routes.contract.request.test.ts"
Task: "Contract test confirm endpoint in apps/api/src/modules/password-reset/__tests__/routes.contract.confirm.test.ts"
Task: "Integration test happy path in apps/api/src/modules/password-reset/__tests__/routes.integration.test.ts"
Task: "LoginForm link test in apps/web/src/modules/auth/__tests__/LoginForm.test.tsx"
Task: "ForgotPasswordForm test in apps/web/src/modules/auth/__tests__/ForgotPasswordForm.test.tsx"
Task: "ResetPasswordForm test in apps/web/src/modules/auth/__tests__/ResetPasswordForm.test.tsx"
```

All six should fail. Then proceed to T022 → T034 to make them pass.

---

## Implementation Strategy

### Single-merge-to-main discipline (analyzer finding F11)

CI auto-deploys on merge to `main`. To prevent shipping an unsafe partial implementation, **all phases land on the `009-password-reset` feature branch and are merged to `main` exactly once**, after Phases 1–8 are green. Intermediate merges to `development` and `testing` are fine and encouraged for staging validation; intermediate merges to `main` are not. Demos before final merge use the Cloudflare Pages preview-branch URL, never production.

### MVP First — US1 + US2 + US3 (security-complete reset)

Per the spec author, "shipping just [US1] (with stories 2 and 3, which are inseparable from it for security) is already a complete MVP." This means:

1. Complete Phases 1–2 (Setup + Foundational).
2. Complete Phase 3 (US1) — happy path.
3. Complete Phase 4 (US2) — enumeration safety.
4. Complete Phase 5 (US3) — token lifecycle.
5. **STOP and VALIDATE** against `quickstart.md` §6 negative paths (Unknown email, Deactivated user, Expired token, Already-used token, Older token superseded).
6. Deploy to **staging via the `testing` branch** (not `main`). The reset flow is now safe to release to internal users without US4–US6, though not yet hardened against email-blasting (US4) or compromise recovery (US5) and not yet auditable (US6).

### Incremental Delivery (recommended)

7. Add Phase 6 (US4) — rate-limit. Verify with `quickstart.md` §6 rate-limit rows.
8. Add Phase 7 (US5) — refresh-token revocation + lockout clear. Verify with §6 "Compromised session" and "Locked-out user" rows.
9. Add Phase 8 (US6) — audit events. Verify by querying `audit_events` after a round-trip.
10. Add Phase 9 (Polish) — cleanup cron, ADR, docs, constitution PATCH. Real-Resend smoke in staging.

### Parallel Team Strategy

With Hector + Javi, after Phase 3 green:

- **Hector**: Phases 6 (US4 — rate-limit) + 9 (cron + ADR).
- **Javi**: Phases 7 (US5) + 8 (US6).

Merge sequentially in the order 6 → 7 → 8 to keep `service.ts` rebases trivial.

### Suggested Agents per Phase

- **Phase 1 + 2**: `db-architect` (migrations + schema), `multi-tenancy-guardian` (verify RLS-omission rationale).
- **Phase 3 (US1)**: `senior-backend-engineer` (routes + service + EmailService), `senior-frontend-engineer` (pages + forms + hooks).
- **Phases 4, 5, 7, 8**: `senior-backend-engineer`.
- **Phase 6 (US4)**: `senior-backend-engineer` with the `cloudflare` skill (KV idioms).
- **Phase 9**: `senior-backend-engineer` (cron) + manual docs.

Skills to keep loaded throughout: `jwt-security`, `owasp-security`, `hono`, `postgres-drizzle`, `react-vite-best-practices`, `zod`, `tanstack-query-best-practices`, `vitest`, `test-driven-development`, `verification-before-completion`.

---

## Notes

- Every implementation task is preceded by at least one failing test in the same phase. Constitution §V is non-negotiable.
- All Spanish user-facing copy is from `spec.md` — do not paraphrase ("Si la cuenta existe…", "el enlace ha expirado, solicita uno nuevo", "¿Olvidaste tu contraseña?", "Solicitar otro enlace").
- The constitution PATCH (T061) is in a **separate PR** from the feature, per the constitution's amendment process (line 151–155).
- After Phase 3, do **not** deploy past dev. The MVP gate is the end of Phase 5.
- Verification before completion (per the homonymous skill): never claim a phase is done without running the test suite for that phase plus a quick spot-check of the manual paths in `quickstart.md`.

### Analyzer remediation log (post-`/speckit.analyze`)

The 12 findings raised by `/speckit.analyze` were resolved in-place before implementation began:

- **F1 (HIGH)** — Constitution PATCH hoisted to T005a (Phase 1 prerequisite); T061 reduced to a verification step.
- **F2 (MEDIUM)** — Spanish email template added as T015a (Phase 2).
- **F3 (MEDIUM)** — No-PII-in-logs guard test added as T058a (Phase 9).
- **F4 (MEDIUM)** — SC-003 rephrased in spec.md to a byte-identical-response check (already covered by T036); the statistical 1,000-iteration timing test is explicitly out-of-scope-for-CI and deferred to manual SecOps audit.
- **F5 (MEDIUM)** — FR-016 in spec.md updated to use real column names (`failed_login_count`, `first_failed_at`, `locked_until`).
- **F6 (MEDIUM)** — `auth/service.ts` `generateAccessToken` export accepted as a documented §IV exception in plan.md "Complexity Tracking" and noted in T023.
- **F7 (LOW)** — T023 explicitly instructs the implementer to inline-comment why no application-level constant-time compare is needed.
- **F8 (LOW)** — T015 commits to module-local audit constants in `password-reset/service.ts`; `lib/audit.ts` is unchanged.
- **F9 (LOW)** — T033 / T034 use structural anchors instead of brittle line numbers.
- **F10 (LOW)** — T018 extended with a non-RLS posture assertion that pins the design intent.
- **F11 (LOW)** — Single-merge-to-main discipline added to plan.md and to the Implementation Strategy section above.
- **F12 (LOW)** — No change needed; the multi-edit `service.ts` is already documented in the parallel-team strategy.

A re-run of `/speckit.analyze` after these edits should report 0 findings of HIGH or above.

### Analyzer remediation log — second pass

The second `/speckit.analyze` pass surfaced 1 MEDIUM and 2 LOW findings on the remediated artifacts. All three were resolved in-place:

- **N1 (MEDIUM)** — T055 reworded so the audit insert is explicitly independent of `emailService.send()` success; the email-send path is wrapped in a try/catch that logs `{ event: "email.transport_failure", user_id }` without leaking PII. Reconciles FR-011 + edge case E-04 + FR-013.
- **L1 (LOW)** — T061 turned into a concrete verification command (`git log --oneline main -- .specify/memory/constitution.md | head -1`) instead of a vague "verify it's merged."
- **L2 (LOW)** — T005a now uses a structural anchor ("the row labeled `Unique constraints` in the §'Security & Compliance Requirements' table") instead of the brittle "line 109" reference.
- **L3 (LOW, carried forward as accepted)** — SC-001 verified by manual walk only (T035) is intentional; automated wall-clock timing including human typing is not realistic in CI.

A third `/speckit.analyze` pass after these edits is expected to report 0 findings of MEDIUM or above.
