# Implementation Plan: Users Module

**Branch**: `004-users-module` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-users-module/spec.md`

## Summary

Full-stack users module for BePro's multi-tenant recruitment platform. Provides user CRUD (create, list, detail, update, deactivate/reactivate), role assignment, password management (self-service change + admin reset), forced password change on first login, and CSV bulk import for migration from Google Sheets. All operations are tenant-scoped via RLS, audited, and gated by role-based access control. The UI is Spanish-only.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)
**Primary Dependencies**: Hono 4.7.10 (API), Drizzle ORM 0.44.7 (DB), React 19.1 (UI), Zod 4.3.6 (validation), bcryptjs 2.x (password hashing), TanStack Query (server state), Zustand (client state), shadcn/ui + Tailwind CSS 4.x (components)
**Storage**: Neon PostgreSQL (serverless) with Row-Level Security via `drizzle-orm/neon-http`
**Testing**: Vitest (frontend + API), React Testing Library (components)
**Target Platform**: Cloudflare Workers (API) + Cloudflare Pages (Frontend SPA)
**Project Type**: Multi-tenant SaaS web application (monorepo with Turborepo)
**Performance Goals**: <2s user directory load (500 users), <30s bulk import (50 users), <1min user creation
**Constraints**: Edge-first ($0-25/mo target), LFPDPPP compliance (soft-delete only, no PII in logs), Spanish-only UI
**Scale/Scope**: Up to 500 users per tenant, 100 max batch import, 4 roles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Multi-Tenant Isolation | PASS | `tenant_id` on users table, RLS policies exist (0001_rls_policies.sql), `SET LOCAL` in tenantMiddleware, new endpoints use existing middleware chain |
| II. Edge-First | PASS | All code runs on Cloudflare Workers + Pages, Neon serverless DB. No traditional servers needed. |
| III. TypeScript Everywhere | PASS | Strict mode in all packages. Shared Zod schemas in `packages/shared`. Code in English, comments in Spanish. |
| IV. Modular by Domain | PASS | Users module is independent: `apps/api/src/modules/users/` (routes, service, types). Only touch to `index.ts` is adding `app.route()` mount. |
| V. Test-First | PASS | TDD mandatory. Service tests, route tests, integration tests, frontend component tests all planned. |
| VI. Security by Design | PASS | bcrypt >= 12, soft-delete only, PII never logged, forced password change on admin-created/reset accounts, session revocation on deactivation/password change. |
| VII. Best Practices via Agents | PASS | Using db-architect, senior-backend-engineer, senior-frontend-engineer, multi-tenancy-guardian agent patterns. |
| VIII. Spec-Driven Development | PASS | Spec → Plan → Tasks → Implementation flow. 33 FRs, 9 SCs, 8 user stories. |

**Gate result: ALL PASS — no violations.**

## Project Structure

### Documentation (this feature)

```text
specs/004-users-module/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file
├── research.md          # Phase 0 output — technical decisions
├── data-model.md        # Phase 1 output — schema changes
├── quickstart.md        # Phase 1 output — integration scenarios
├── contracts/           # Phase 1 output — API contracts
│   └── api.md           # REST endpoint definitions
├── checklists/
│   └── requirements.md  # Spec quality checklist (complete)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# API — new users module + modifications
apps/api/src/
├── modules/
│   └── users/
│       ├── routes.ts          # NEW — Hono sub-app with all user endpoints
│       ├── service.ts         # NEW — Business logic (CRUD, password, bulk import)
│       └── types.ts           # NEW — Service-level types (params, results)
├── lib/
│   └── audit.ts               # NEW — Lightweight audit event helper
└── index.ts                   # MODIFY — mount users routes

# Database — schema additions + migration
packages/db/
├── src/schema/
│   ├── users.ts               # MODIFY — add lastLoginAt, mustChangePassword columns
│   └── audit-events.ts        # NEW — Lightweight audit_events table schema
├── src/schema/index.ts        # MODIFY — export new schema
└── drizzle/
    └── 0002_*.sql             # NEW — auto-generated migration (add columns + audit table + RLS)

# Shared — validation schemas + types
packages/shared/src/
├── schemas/
│   └── users.ts               # NEW — Zod schemas for user operations
├── types/
│   └── user.ts                # MODIFY — extend DTOs for new fields
└── index.ts                   # MODIFY — export new schemas

# Frontend — users module
apps/web/src/
├── modules/
│   └── users/
│       ├── hooks/
│       │   └── useUsers.ts    # NEW — TanStack Query hooks + query key factory
│       ├── components/
│       │   ├── UserList.tsx        # NEW — Paginated user table with search/filters
│       │   ├── UserDetail.tsx      # NEW — User profile view/edit
│       │   ├── CreateUserForm.tsx  # NEW — Admin user creation form
│       │   ├── BulkImportForm.tsx  # NEW — CSV upload + results display
│       │   ├── ChangePasswordForm.tsx  # NEW — Self-service password change
│       │   └── ResetPasswordDialog.tsx # NEW — Admin password reset dialog
│       ├── services/
│       │   └── userService.ts # NEW — API calls via apiClient
│       └── pages/
│           ├── UsersPage.tsx      # NEW — User directory page (list + search)
│           └── UserDetailPage.tsx # NEW — Single user detail/edit page
├── components/
│   └── ConfirmDialog.tsx      # NEW — Reusable confirmation dialog (shadcn)
└── App.tsx                    # MODIFY — add /users and /users/:id routes
```

**Structure Decision**: Follows existing monorepo convention. Users module mirrors auth module patterns. No new packages or projects needed — all changes fit within existing `apps/api`, `apps/web`, `packages/db`, and `packages/shared`.

## Complexity Tracking

No constitution violations. No complexity justifications needed.

## Implementation Phases

### Phase A: Database & Shared (Foundation)

1. Add `lastLoginAt` and `mustChangePassword` columns to users schema
2. Create `audit_events` table schema with RLS policies
3. Generate and apply Drizzle migration
4. Create Zod validation schemas in `packages/shared` (createUser, updateUser, changePassword, resetPassword, bulkImport)
5. Extend `IUserDto` and related types with new fields

### Phase B: API Service Layer

1. Create `apps/api/src/lib/audit.ts` — lightweight audit helper (recordAuditEvent function)
2. Create `apps/api/src/modules/users/types.ts` — service-level types
3. Create `apps/api/src/modules/users/service.ts` — business logic:
   - `listUsers()` — paginated, filtered, searchable, role-scoped
   - `getUserById()` — single user with role-based access check
   - `createUser()` — validate, hash password, set mustChangePassword, audit
   - `updateUser()` — diff fields, enforce admin-only for role changes, audit
   - `deactivateUser()` — soft-delete, revoke sessions, prevent self/last-admin, audit
   - `reactivateUser()` — restore access, audit
   - `changePassword()` — verify current, hash new, revoke other sessions, audit
   - `resetPassword()` — admin-only, hash new, set mustChangePassword, revoke sessions, audit
   - `bulkImportUsers()` — parse CSV, validate rows, create valid users, report errors
4. Update auth service `login()` to set `lastLoginAt` on successful login

### Phase C: API Routes

1. Create `apps/api/src/modules/users/routes.ts` — all endpoints with middleware chain
2. Mount routes in `apps/api/src/index.ts`: `app.route("/api/users", usersRoutes)`
3. Middleware chain per endpoint:
   - `authMiddleware` → `tenantMiddleware` on all routes
   - `requireRole("admin")` on create, deactivate, reactivate, reset-password, bulk-import
   - `requireRole("admin", "manager")` on list and detail (with service-level scoping for AE/recruiter)

### Phase D: Frontend Module

1. Create `userService.ts` — API calls via apiClient
2. Create `useUsers.ts` — TanStack Query hooks with query key factory
3. Create user list page (table, search, filters, pagination)
4. Create user detail/edit page
5. Create user creation form (admin)
6. Create password change form (self-service)
7. Create password reset dialog (admin)
8. Create bulk import form (CSV upload + results)
9. Create shared `ConfirmDialog` component
10. Add routes to `App.tsx`
11. Update auth store — sync profile changes when user edits their own data

### Phase E: Integration & Polish

1. Forced password change flow — intercept in auth middleware or frontend RequireAuth
2. Update auth login to set `lastLoginAt`
3. End-to-end testing of full flows
4. Verify tenant isolation (cross-tenant tests)
