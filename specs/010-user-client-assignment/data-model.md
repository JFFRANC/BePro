# Phase 1 — Data Model: User Creation with Primary Client Assignment

**Feature**: 010-user-client-assignment
**Date**: 2026-04-29
**Migrations**: **None**. This feature is purely additive at the API boundary.

---

## Tables Touched

### `users` (existing — no changes)

Read columns: `id`, `tenant_id`, `email` (uniqueness check), `role`.
Write columns: `tenant_id`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `is_freelancer`, `must_change_password=true`.

No structural change. The new `clientId` request field does NOT land in the `users` row — it's used to drive the `client_assignments` insert and the audit payload only.

### `client_assignments` (existing — new INSERT)

```text
client_assignments
├── id                    uuid PK (defaultRandom)
├── tenant_id             uuid FK → tenants.id    [from c.get("tenantId")]
├── client_id             uuid FK → clients.id    [from request body]
├── user_id               uuid FK → users.id      [from the just-inserted user]
├── account_executive_id  uuid FK → users.id NULL [ALWAYS NULL on this flow per Clarification Q3]
└── created_at            timestamptz NOT NULL DEFAULT now()
```

Existing constraints honored:

- `unique(tenant_id, client_id, user_id)` — guarantees idempotency for retries; never violated on first insert because the user is brand-new (its `id` did not exist before).
- RLS: `FORCE ROW LEVEL SECURITY` with policy `tenant_id = current_setting('app.tenant_id', true)::uuid` for SELECT/INSERT/UPDATE.

Writes only happen when **role ∈ {account_executive, recruiter}** AND `clientId` is present. Otherwise no row is inserted (defensive no-op).

### `clients` (existing — read only)

Read columns: `id`, `is_active`, `tenant_id` (implicit via RLS).
Query: `SELECT id FROM clients WHERE id = $1 AND is_active = true LIMIT 1` — runs inside the transaction so RLS enforces tenant scope.

### `audit_events` (existing — payload enriched, no schema change)

Existing JSONB column `new_values` gets an additional optional key:

```jsonc
{
  "email": "...",
  "firstName": "...",
  "lastName": "...",
  "role": "recruiter",
  "isFreelancer": false,
  "clientId": "<uuid>"   // NEW — present only when captured (AE/recruiter creation)
}
```

Action remains `"user.created"`. `targetType` remains `"user"`. `targetId` remains the new user's id. No new audit action introduced.

---

## Entity-Level Rules (post-feature)

### CreateUserParams (api `users/types.ts`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | unchanged |
| `password` | string | yes | unchanged (admin-set per spec 004) |
| `firstName` | string | yes | unchanged |
| `lastName` | string | yes | unchanged |
| `role` | UserRole | yes | unchanged |
| `isFreelancer` | boolean | yes | unchanged |
| `clientId` | string (uuid) | conditionally | **NEW** — required when role ∈ {account_executive, recruiter}, optional otherwise; when present on admin/manager the service ignores it (defensive no-op per FR-005) |

### Refinement (shared Zod schema)

```text
createUserSchema
  base: z.object({ ..., clientId: z.string().uuid().optional() })
  refine: when role ∈ {account_executive, recruiter} and clientId is missing, error on path ["clientId"] with message "Cliente es requerido para este rol"
```

The refinement runs both on the frontend (RHF resolver) and on the API (zValidator), which means the API gets the same rejection at the validator layer for missing-clientId-on-AE/recruiter (Zod 400, *not* "cliente inactivo o inexistente" — that latter message is reserved for "client doesn't exist or isn't active").

### State Transitions

This feature creates rows only — no state machine, no updates, no deletes.

| Trigger | Effect |
|---|---|
| `POST /api/users` with `role=admin\|manager` | INSERT users row only. No assignment. Audit `newValues.clientId` absent. |
| `POST /api/users` with `role=account_executive\|recruiter` and valid `clientId` | INSERT users row + INSERT client_assignments row + INSERT audit_events row, all in one transaction. Audit `newValues.clientId` present. |
| `POST /api/users` with `role=account_executive\|recruiter` and invalid `clientId` (inactive, missing, or cross-tenant) | No INSERTs. Service throws `ClientNotFoundError`; route returns 400 `{ error: "cliente inactivo o inexistente" }`. Transaction rolls back; users row is NOT persisted. |
| `POST /api/users` with `role=admin\|manager` and any `clientId` (including bogus) | INSERT users row only. The submitted `clientId` is silently dropped. No assignment row. |

---

## Validation Rules Mapped to Functional Requirements

| FR | Where enforced |
|---|---|
| FR-001 (field visibility per role) | `CreateUserForm.tsx` conditional rendering |
| FR-002 (field required for AE/recruiter) | Zod `refine()` in `createUserSchema` (shared) |
| FR-003 (atomic dual-write) | Single Drizzle transaction (already wired by `tenantMiddleware`) |
| FR-004 (validate active + same tenant) | Service `SELECT` against `clients` with `is_active=true`, scoped by RLS — uniform `"cliente inactivo o inexistente"` 400 |
| FR-005 (defensive no-op for admin/manager) | Service drops `clientId` early in the function for those roles |
| FR-006 (audit includes clientId when captured) | `recordAuditEvent` called with `newValues.clientId` set when captured |
| FR-007 (dropdown sourced from active clients + refetch on error) | `useActiveClients()` hook + `queryClient.invalidateQueries` on 400 |
| FR-008 (008 batch flow unchanged) | No code touched in `clients/routes.ts`, `clients/service.ts:batchAssignClient` |
| FR-009 (admin-only access) | Existing `requireRole("admin")` guard on POST /users |
| FR-010 (tenant isolation across all writes) | `tenantMiddleware` wraps the transaction; RLS on all three tables (users, client_assignments, audit_events) |

---

## Indexes & Performance

No new indexes. Existing index coverage on the touched tables:

- `clients(id)` — primary key, used by validation SELECT
- `client_assignments(tenant_id, client_id, user_id)` — unique constraint, doubles as covering index for the rare retry case
- `client_assignments(tenant_id)`, `client_assignments(client_id)`, `client_assignments(user_id)` — single-column secondaries for downstream reads
- `audit_events(tenant_id, target_type, target_id)` — used by audit queries; INSERTs are append-only and don't depend on this for write speed

Expected create-user latency (p95): **≤ 500 ms** end-to-end at the Worker, dominated by:
- 1 SELECT users (uniqueness check) — ~30 ms
- 1 SELECT clients (validation) — ~30 ms
- 1 INSERT users — ~40 ms
- 1 INSERT client_assignments — ~40 ms
- 1 INSERT audit_events — ~30 ms
- bcrypt hash @ cost 12 — ~250 ms

bcrypt dominates, as it does today; the new SELECT + INSERT add ~70 ms to the budget.

---

## Out of Schema Scope

Intentionally not changed:

- No new column on `client_assignments` (e.g., a `created_via` enum). Out of scope.
- No new table for "primary client" — assignments stay flat (Assumption #1).
- No migration to add `is_active` to `client_assignments` (Spec correction during clarify).
- No change to `users.role` enum.
- No change to RLS policies.
