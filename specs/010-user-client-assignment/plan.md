# Implementation Plan: User Creation with Primary Client Assignment

**Branch**: `010-user-client-assignment` | **Date**: 2026-04-29 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-user-client-assignment/spec.md`

## Summary

Extend the existing admin-only user-creation flow so that, when an admin picks role *account_executive* or *recruiter*, the modal renders a required "Cliente" dropdown listing active clients in the tenant. On submit, the API performs a dual-write inside the existing `SET LOCAL app.tenant_id` transaction: it inserts the `users` row AND a single `client_assignments` row (with `accountExecutiveId = NULL`) atomically. Any failure rolls both back. The audit event for `user.created` is enriched with the captured `clientId`. No schema changes, no new endpoints — only the `POST /api/users` body schema, `createUser()` service, and the React `CreateUserForm` are touched. The existing 008 batch-assignment flow remains untouched as the canonical surface for adding/changing assignments later.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode) across web, api, and shared packages
**Primary Dependencies**: Hono 4.7.10 (API), Drizzle ORM 0.44 (DB), Zod 4.x (validation), React 19.1 + React Hook Form + `@hookform/resolvers` (forms), TanStack Query 5.91 (server state), shadcn/ui Select / Dialog (existing in repo), CASL 6.x (UI ability — `createUser` is admin-only via `requireRole("admin")` already; CASL is not extended for this feature)
**Storage**: Neon PostgreSQL — no schema changes. Touches existing `users`, `client_assignments`, `audit_events` tables, all already RLS-enforced (`FORCE ROW LEVEL SECURITY`)
**Testing**: Vitest unit (mocked Drizzle) + Vitest integration with the `app_worker` Neon role to prove RLS + Playwright e2e for the modal happy path and the inactive-client race
**Target Platform**: Cloudflare Workers (API) + Cloudflare Pages (Web) — edge-first, no server changes
**Project Type**: Web application (monorepo: `apps/web`, `apps/api`, `packages/shared`, `packages/db`)
**Performance Goals**: `POST /api/users` p95 ≤ 500 ms in normal conditions (one Neon transaction with two inserts + one audit insert + one client validation `SELECT`); active-clients dropdown fetch piggybacks on existing `GET /api/clients?isActive=true` and uses TanStack Query caching
**Constraints**: $0–25/month edge cost ceiling; one transaction per create with `SET LOCAL app.tenant_id` (already wired by `tenantMiddleware`); no migrations; no new env vars
**Scale/Scope**: ~5 backend touch-points (shared schema, route, service, types, integration test), ~3 frontend touch-points (CreateUserForm, useUsers hook chain, e2e). Active-client dropdown handles single tenant's active clients (assumption: ≤200 in a dropdown is fine; pagination deferred per spec assumption)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|---|---|
| **I. Multi-Tenant Isolation (NON-NEGOTIABLE)** | ✅ Dual-write happens inside the existing `tenantMiddleware` transaction — `SET LOCAL app.tenant_id` is already set when the route handler runs. RLS on `client_assignments` enforces tenant scoping at the row level (per `0002_rls_clients.sql`). Cross-tenant `clientId` will be rejected by RLS itself plus a defensive `WHERE tenant_id = current_tenant AND is_active = true` check in the service. Integration test will assert that an attacker passing another tenant's `clientId` gets the same `"cliente inactivo o inexistente"` 400 (no enumeration leak). |
| **II. Edge-First** | ✅ No new server-side runtime; same Workers + Neon HTTP path. |
| **III. TypeScript Everywhere** | ✅ Shared Zod schema in `packages/shared/src/schemas/users.ts` extended with optional `clientId`; refinement enforces "required when role ∈ {account_executive, recruiter}". Code in English, comments in Spanish, commits Conventional. |
| **IV. Modular by Domain** | ✅ Changes confined to `users/` module on api + web. Read-only access to `clients` happens via the existing `GET /api/clients` (web) and a single direct lookup from `users.service` (api) — acceptable per "modules communicate through exported interfaces" since both modules already share the `client_assignments` schema and `clients` table types via `@bepro/db`. |
| **V. Test-First (NON-NEGOTIABLE)** | ✅ TDD plan (RED→GREEN→REFACTOR): integration tests for dual-write, rollback-on-invalid-client, defensive no-op for admin/manager, and audit-payload enrichment are written **before** service changes. Frontend Vitest tests for conditional field rendering and the role-switch clear-clientId behavior are written **before** the form is touched. Playwright e2e covers the modal happy path and the inactive-client race. |
| **VI. Security by Design** | ✅ Admin-only access preserved via `requireRole("admin")`. Cross-tenant `clientId` returns the same 400 error message as inactive/nonexistent (no enumeration leak — pattern from feature 009). PII (email, name) only logged via the existing audit pipeline. No password handling change. |
| **VII. Best Practices via Agents** | ✅ Skills used: hono, react-hook-form, zod, tanstack-query-best-practices, shadcn-ui, react-vite-best-practices, vitest, superpowers:test-driven-development, superpowers:verification-before-completion. Agents: senior-backend-engineer, senior-frontend-engineer, multi-tenancy-guardian, db-architect. |
| **VIII. Spec-Driven Development** | ✅ Spec → Clarify → Plan flow followed. Tasks artifact will be generated by `/speckit.tasks` next. |

**Result**: All gates pass. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-user-client-assignment/
├── plan.md              # This file
├── spec.md              # Feature specification (post-clarify)
├── research.md          # Phase 0 output (this run)
├── data-model.md        # Phase 1 output (this run)
├── quickstart.md        # Phase 1 output (this run)
├── contracts/           # Phase 1 output (this run)
│   ├── post-users.openapi.yaml
│   └── audit-event.user-created.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/modules/users/
├── routes.ts                       # POST /users — pass-through; map "invalid_client" → 400 "cliente inactivo o inexistente"
├── service.ts                      # createUser() — extended with optional clientId, dual-write, validation, audit enrichment
├── types.ts                        # CreateUserParams gets optional clientId: string
└── __tests__/
    ├── service.create.test.ts      # MOCKED dual-write happy path + admin/manager no-op + invalid-client rejection
    ├── routes.create.test.ts       # MOCKED 400 mapping + 409 duplicate email path remains green
    └── service.create.integration.test.ts   # REAL Neon (app_worker) — RLS + audit + cross-tenant rejection

apps/web/src/modules/users/
├── components/
│   └── CreateUserForm.tsx          # Add conditional Cliente <Select>; clear clientId on role switch to admin/manager
├── hooks/
│   └── useActiveClients.ts         # NEW thin hook — TanStack Query around clientService.listClients({isActive: true, limit: 200})
├── services/
│   └── userService.ts              # Pass clientId in request body when present
└── __tests__/
    └── CreateUserForm.test.tsx     # RTL — field visibility per role + clear-on-switch + 400 error refetches clients

apps/web/e2e/
└── users-create-with-client.spec.ts   # Playwright — happy path + inactive-client race + admin role hides field

packages/shared/src/schemas/
└── users.ts                        # createUserSchema gets optional clientId + refinement enforcing required-when-AE-or-recruiter
```

**Structure Decision**: Web application monorepo (option 2). All paths above are existing locations; only the test files and `useActiveClients.ts` are new. No restructuring required. Modular boundary preserved: `users/` reads `clientService` on the web, and the api `users.service` reads from `clients` table via shared `@bepro/db` schema (existing precedent in the codebase — see `clients.service` reading users for batch assignments).

## Complexity Tracking

> No constitution violations. Section intentionally empty.
