# Phase 0 — Research: User Creation with Primary Client Assignment

**Feature**: 010-user-client-assignment
**Date**: 2026-04-29
**Purpose**: Resolve every NEEDS CLARIFICATION from Technical Context and capture the rationale for each decision.

---

## R-001 — Where does the dual-write transaction live?

**Decision**: Use the existing `tenantMiddleware` transaction. The route handler's `c.get("db")` is already the `tx` handle for a transaction with `SET LOCAL app.tenant_id = '<tenant>'`. Both the `users` insert and the `client_assignments` insert run on that same `tx`, so atomicity is automatic.

**Rationale**: `apps/api/src/modules/auth/middleware.ts:61–67` wraps every downstream handler in `db.transaction(async tx => { SET LOCAL …; c.set("db", tx); await next(); })`. Adding a second insert in the service simply chains it onto the same `tx` — Drizzle's neon-http batch transaction commits when `next()` returns and rolls back on any thrown error. No new infrastructure needed.

**Alternatives considered**:
- Open a fresh `db.transaction(...)` inside `createUser()`. **Rejected** — would nest transactions (Neon HTTP doesn't support nesting; would lose `SET LOCAL` context).
- Two separate transactions (user first, then assignment). **Rejected** — violates FR-003 atomicity; produces orphan users on assignment failure.

---

## R-002 — How should `createUser()` signal "invalid client"?

**Decision**: Throw a typed error `ClientNotFoundError extends Error` from `service.ts`. The route handler catches it and returns `400 { error: "cliente inactivo o inexistente" }`. Keep the existing `null`-return for duplicate email (preserves the 409 path).

**Rationale**: Current convention in `clients/service.ts:521–522` already throws `Error("CLIENT_NOT_FOUND")` for similar cases. Typed errors are the most surgical way to add a new failure mode without refactoring the existing return shape. `HTTPException` from `hono/http-exception` is reserved for cross-cutting auth/forbidden cases; service layer should throw plain typed errors and let the route translate.

**Alternatives considered**:
- Discriminated union `{ ok: true, user } | { ok: false, code }`. **Rejected** — would force a refactor of all call sites of `createUser()` (bulk import path included) and is out of scope.
- `HTTPException` directly from service. **Rejected** — couples service to HTTP framework; violates module separation.

---

## R-003 — How does the service validate the client?

**Decision**: Single `SELECT id FROM clients WHERE id = $1 AND is_active = true LIMIT 1` inside the same transaction. RLS already filters by `tenant_id` (the `clients` table has `FORCE ROW LEVEL SECURITY` per `0002_rls_clients.sql`). Cross-tenant `clientId` returns zero rows → throw `ClientNotFoundError` → 400 with the uniform message. No separate tenant-mismatch path is needed at the application layer.

**Rationale**: Trusting RLS at the database boundary is the constitution's "double enforcement" principle (§I + §VI). The application code is the second layer; the actual filter is the policy. Using the same query for both "inactive in my tenant" and "exists in another tenant" gives us the no-enumeration property for free.

**Alternatives considered**:
- Application-level `tenantId` filter only. **Rejected** — RLS is the constitutional safety net; relying solely on app-layer filters violates §I.
- Separate code paths for inactive vs cross-tenant. **Rejected** by Clarification Q4 (uniform 400 message).

---

## R-004 — How is `is_active` represented on `clients`?

**Decision**: Read `clients.is_active` boolean. Confirmed by inspecting `packages/db/src/schema/clients.ts` (column exists, default `true`).

**Rationale**: Direct schema check — `is_active` is the canonical soft-delete flag per CLAUDE.md and was introduced with feature 005-clients-module.

**Alternatives considered**: None — schema is the source of truth.

---

## R-005 — Does `client_assignments` have an `is_active` column?

**Decision**: **No**. The original spec wording (`is_active=true`) was incorrect; the schema only has `(id, tenant_id, client_id, user_id, account_executive_id, created_at)`. Spec was already corrected during clarify. Plan and tasks treat the row as "exists or not", no soft-delete.

**Rationale**: Schema inspection at `packages/db/src/schema/client-assignments.ts`. The 008 batch flow deletes-then-inserts to "deactivate" assignments rather than flipping a flag.

**Alternatives considered**:
- Add an `is_active` column. **Rejected** — out of scope per Assumption #3 ("no schema changes").

---

## R-006 — Where does the audit `clientId` go?

**Decision**: Append `clientId: <uuid>` to the existing `newValues` JSONB on the `user.created` audit event. Field is omitted when no client was captured.

**Rationale**: `audit_events.new_values` is already a JSONB column (`packages/db/src/schema/audit-events.ts:23`). The current `user.created` payload includes `email, firstName, lastName, role, isFreelancer` — extending it with one more optional field preserves the existing query/projection patterns without a migration.

**Alternatives considered**:
- New top-level column `client_id` on `audit_events`. **Rejected** — schema change for one feature; not justified.
- New audit action `user.assigned_to_client`. **Rejected** — would split a single logical event into two records, breaking the "atomic create" narrative.

---

## R-007 — Frontend: how does the `Cliente` dropdown fetch options?

**Decision**: New thin hook `useActiveClients()` in `apps/web/src/modules/users/hooks/` that wraps `clientService.listClients({ isActive: true, limit: 200, page: 1 })` via TanStack Query. Query key: `["clients", "activeList"]`. Stale time: 60s (clients don't churn often). Refetched on demand when the server returns the inactive-client error.

**Rationale**: Per Assumption #4, a single dropdown without pagination is fine for v1. The 200-row cap is generous; if a tenant exceeds it, we'll switch to a typeahead (out of scope). The hook lives in `users/hooks/` rather than `clients/hooks/` to keep this feature additive without touching the `clients/` module's hook surface — modular boundary intact.

**Alternatives considered**:
- Inline the `useQuery` call inside `CreateUserForm.tsx`. **Rejected** — duplication risk if other places adopt the same dropdown later.
- Reuse a (hypothetical) `useClientsList` from `clients/hooks/`. **Rejected** — that hook (if it exists) likely takes filters and pagination state; this dropdown's needs are narrower and dedicated.

---

## R-008 — Frontend: how does the form react when role switches between client-required and client-hidden?

**Decision**: A `useEffect` watching `selectedRole`. When role becomes *admin* or *manager*, call `setValue("clientId", undefined)` and `clearErrors("clientId")`. When role becomes *account_executive* or *recruiter*, the field re-appears empty and Zod re-validation will require it on submit.

**Rationale**: React Hook Form's `setValue` paired with `useEffect` is the canonical RHF pattern for cross-field reactivity. Using `clearErrors` prevents a stale "Cliente requerida" message from a prior session.

**Alternatives considered**:
- Conditional Zod schema swap. **Rejected** — adds complexity; refinement on a single schema is simpler.
- Server-side fallback only (front-end leaves stale value). **Rejected** — server tolerates it (FR-005), but UX is worse and the form would briefly look wrong.

---

## R-009 — Frontend: how does the form recover from the inactive-client 400?

**Decision**: On `400 { error: "cliente inactivo o inexistente" }`, the mutation's `onError` invalidates the `["clients", "activeList"]` query (forces refetch via TanStack Query) and sets a field-level error on `clientId`. All other field values stay intact (RHF default). User picks a fresh option and resubmits.

**Rationale**: Per Clarification Q5 (option A). TanStack Query's `queryClient.invalidateQueries` is the idiomatic refetch trigger; combined with RHF's untouched form state, the user keeps typing where they were.

**Alternatives considered**:
- Reset the entire form. **Rejected** — destroys other field values, frustrates the operator.
- Refetch via `queryClient.refetchQueries` (eager). Marginal difference vs `invalidateQueries`; **chose invalidate** because it cooperates with active observers (other components watching the same key get refreshed too).

---

## R-010 — TDD ordering and test boundaries

**Decision**: Write tests in this order, all RED before any GREEN code:

1. **`packages/shared`** unit test on `createUserSchema` — refine() enforces `clientId` required for AE/recruiter, optional for admin/manager.
2. **API mocked unit** (`service.create.test.ts`) — happy path dual-write call shape, admin/manager no-op (no assignment row inserted), `ClientNotFoundError` thrown for invalid client, audit `newValues.clientId` populated.
3. **API mocked unit** (`routes.create.test.ts`) — `ClientNotFoundError` mapped to 400 with the correct Spanish message; existing 409 duplicate-email path stays green.
4. **API integration** (`service.create.integration.test.ts`) — real Neon `app_worker` connection, asserts: assignment row exists; rollback when client invalid (no orphan user); cross-tenant `clientId` returns 400 (RLS-driven); audit row contains `clientId`.
5. **Web RTL** (`CreateUserForm.test.tsx`) — field visibility per role, clear-on-switch, 400 triggers refetch.
6. **Web Playwright e2e** — happy path; inactive-client race produces refreshed dropdown; admin role hides field.

**Rationale**: Constitution §V is non-negotiable. The order goes outside-in (shared schema → service → route → integration → UI → e2e), each layer's test pinning the contract for the layer below. Each test is independently runnable (`pnpm test --filter <pattern>`).

**Alternatives considered**:
- Skip mocked unit tests, go straight to integration. **Rejected** — integration runs against Neon and is slower; mocked units catch wiring errors in seconds.
- Skip Playwright. **Rejected** — the inactive-client race is a UX-level concern that only e2e can demonstrate (mocked frontend tests can't faithfully drive the network 400 flow + dropdown refetch).

---

## R-011 — Are new database indexes needed?

**Decision**: **No new indexes**. The dual-write inserts hit primary keys + the existing `client_assignments_tenant_id_idx`, `client_assignments_client_id_idx`, `client_assignments_user_id_idx` and the unique constraint `(tenant_id, client_id, user_id)`. The validation `SELECT` on `clients` uses the primary key `id` column. All paths are O(1) lookups.

**Rationale**: Inspected `packages/db/src/schema/client-assignments.ts:32–40` — three single-column indexes plus one tenant-scoped composite unique constraint already cover every query this feature issues.

**Alternatives considered**: db-architect agent confirmation pending in Phase 2 task validation; if the agent disagrees, this decision will be revisited before implementation.

---

## R-012 — Does anything else depend on `createUser()`?

**Decision**: Yes — the bulk-import path (`bulkImportUsers`) calls `createUser()` indirectly (see `users/service.ts:370` audit emission inside the loop). The bulk path does NOT capture a client per row (per spec assumption "bulk user import is out of scope"). So the new `clientId` parameter to `createUser()` MUST default to `undefined`, and bulk import calls MUST omit it. Behavior unchanged for bulk import.

**Rationale**: Verified by grepping `recordAuditEvent.*user.created` — two emission sites in `users/service.ts`. Both must remain green; the bulk one keeps `clientId` absent.

**Alternatives considered**: Add `clientId` capture to the CSV row schema. **Rejected** — explicit out-of-scope per spec.

---

## Summary

All twelve research items are resolved. Zero outstanding `NEEDS CLARIFICATION` markers. Phase 1 design proceeds with these decisions baked in.
