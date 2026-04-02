# Implementation Plan: JWT Authentication Module

**Branch**: `002-jwt-auth-module` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-jwt-auth-module/spec.md`

## Summary

Implement the JWT authentication module for BePro's multi-tenant recruitment platform. This is the first functional module — it provides login (email + password), token issuance (JWT access + opaque refresh), token rotation with theft detection, per-session logout, role-based middleware, tenant context resolution via `SET LOCAL` for RLS, and per-account brute-force protection. All infrastructure runs on Cloudflare Workers (Hono) with Neon PostgreSQL (Drizzle ORM).

## Technical Context

**Language/Version**: TypeScript 5.8 (strict mode)  
**Primary Dependencies**: Hono 4.7 (`hono/jwt`, `hono/cookie`), bcryptjs 2.x, Drizzle ORM 0.44, Zod 4.x  
**Storage**: Neon PostgreSQL (serverless) via `drizzle-orm/neon-http` with HTTP batch transactions  
**Testing**: Vitest 3.x (node environment for API, jsdom for web)  
**Target Platform**: Cloudflare Workers (edge runtime, no Node.js APIs)  
**Project Type**: Monorepo — API (Workers), Frontend (SPA), Shared packages (types + schemas), DB package (Drizzle)  
**Performance Goals**: Login response < 3s (including bcrypt at cost 12), token refresh < 200ms  
**Constraints**: No native Node.js modules (Workers runtime), stateless (no in-memory sessions), HTTP-only DB driver (no persistent connections)  
**Scale/Scope**: Initial deployment: 1-5 tenants, ~50 users. Architecture supports 100+ tenants.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Implementation |
|-----------|--------|----------------|
| I. Multi-Tenant Isolation | PASS | `tenant_id` on users table. RLS policies enforced at PostgreSQL level. `SET LOCAL app.tenant_id` in every transaction via tenant middleware. Cross-tenant integration tests. Login bypasses RLS (pre-authentication — uses tenant slug lookup). |
| II. Edge-First | PASS | All code on Cloudflare Workers + Hono. Neon serverless PostgreSQL. bcryptjs (pure JS). No traditional servers. Target cost $0-25/mo. |
| III. TypeScript Everywhere | PASS | Strict mode in all packages. Shared Zod schemas in `packages/shared`. Drizzle ORM for type-safe DB. English code, Spanish comments/commits. |
| IV. Modular by Domain | PASS | Auth module in `apps/api/src/modules/auth/` with routes, service, types, middleware. DB schema in `packages/db/src/schema/`. Adding auth does NOT modify existing modules. Middleware exported for other modules to consume. |
| V. Test-First | PASS | TDD: RED → GREEN → REFACTOR. Unit tests for service layer, integration tests for API endpoints, cross-tenant isolation tests, role-based access tests. Vitest runner. |
| VI. Security by Design | PASS | bcrypt cost 12. JWT 15 min + opaque refresh 7 days with rotation. httpOnly SameSite=Strict cookie. Constant-time comparison. No PII in logs. Soft delete only. User enumeration prevention. Per-account brute-force protection. |
| VII. Best Practices via Agents | PASS | Skills used: Cloudflare Workers, Hono, Drizzle, JWT security, Vitest, OWASP. |
| VIII. Spec-Driven Development | PASS | Full workflow: constitution → spec → clarify → plan → tasks → implement. |

**Post-Phase 1 Re-check**: All gates still pass. Key design decisions:
- Login endpoint bypasses RLS (necessary — no tenant context before authentication). Mitigated by looking up tenant by slug first, then user by (tenant_id, email).
- Refresh tokens table has no `tenant_id` (accessed by token_hash, not tenant context). Ownership enforced via `user_id` FK → users → tenants.

## Project Structure

### Documentation (this feature)

```text
specs/002-jwt-auth-module/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: technical research decisions
├── data-model.md        # Phase 1: database schema design
├── quickstart.md        # Phase 1: developer setup guide
├── contracts/
│   └── auth-api.md      # Phase 1: API endpoint contracts
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/db/
├── src/
│   ├── schema/
│   │   ├── tenants.ts           # tenants table (no RLS)
│   │   ├── users.ts             # users table (RLS on tenant_id)
│   │   └── refresh-tokens.ts    # refresh_tokens table (no RLS)
│   ├── client.ts                # DB client factory (createDb helper)
│   └── index.ts                 # Export schemas + client
├── drizzle/                     # Generated migrations
├── drizzle.config.ts
└── CLAUDE.md                    # DB package patterns (new)

packages/shared/src/
├── types/
│   └── auth.ts                  # Updated: IAuthResponse, ILoginRequest (+ tenantSlug)
├── schemas/
│   └── auth.ts                  # Updated: loginSchema (+ tenantSlug), refreshSchema
└── index.ts

apps/api/src/
├── modules/
│   └── auth/
│       ├── routes.ts            # POST /login, /refresh, /logout, GET /me
│       ├── service.ts           # AuthService: login, refresh, logout, validateToken
│       ├── types.ts             # JwtPayload, AuthResult, module types
│       └── middleware.ts        # authMiddleware, tenantMiddleware, requireRole
├── lib/
│   └── db.ts                    # Per-request DB client factory
├── index.ts                     # Mount auth routes
└── types.ts                     # Updated: HonoEnv with Variables + JWT_ACCESS_SECRET

apps/web/src/
├── modules/
│   └── auth/
│       ├── components/
│       │   └── LoginForm.tsx    # Login form component
│       ├── hooks/
│       │   └── useAuth.ts       # Auth state + token management hooks
│       └── index.ts
├── lib/
│   └── api-client.ts            # Fetch wrapper with auto-refresh interceptor
└── store/
    └── auth-store.ts            # Zustand store for auth state
```

**Structure Decision**: Follows the existing monorepo layout defined in CLAUDE.md. Each domain module is independent — the auth module adds new files only. The only modification to existing files is mounting the auth routes in `apps/api/src/index.ts` and extending the `HonoEnv` type in `apps/api/src/types.ts`.

## Key Technical Decisions

### 1. Opaque Refresh Tokens (not JWT)

Refresh tokens are random UUIDs stored as SHA-256 hashes in the database. Not JWTs. See [research.md](./research.md#r-003) for rationale. This simplifies key management (single JWT secret) and aligns with the fact that every refresh operation requires a database lookup anyway (rotation tracking).

### 2. Tenant Resolution at Login

Login requires a `tenantSlug` field because email is unique per-tenant, not globally. The system looks up the tenant by slug, then the user by `(tenant_id, email)`. See [research.md](./research.md#r-005). Forward-compatible with subdomain-based resolution.

### 3. RLS Bypass During Login

The login flow runs before any tenant context exists. The auth service queries the `tenants` table (no RLS) and then the `users` table without RLS using a connection that does NOT call `SET LOCAL app.tenant_id`. This is safe because:
- The tenant slug lookup is a read-only check that the tenant exists and is active.
- The user lookup is constrained to `WHERE tenant_id = $1 AND email = $2` — explicitly scoped.
- No multi-row queries or data browsing occur in the login path.

All post-authentication queries go through the tenant middleware which enforces RLS.

### 4. Per-Request Database Connection

Each request creates a fresh Neon HTTP client (stateless, no connection pool). For tenant-scoped requests, the client wraps all queries in `db.transaction()` with `SET LOCAL app.tenant_id`. This aligns with the Workers stateless model and Neon's HTTP driver design.

### 5. Shared Types Update

`IAuthResponse` in `packages/shared` currently includes `refreshToken` in the response body. This must change to remove `refreshToken` (now delivered as an httpOnly cookie) and add `tenantSlug` to `ILoginRequest`. The `user` object is included in the response for the frontend to use immediately without a separate `/me` call.

### 6. Access Token: 15-Minute Expiry

At the low end of the constitution's 15-60 minute range. See [research.md](./research.md#r-008). The frontend auto-refresh interceptor makes this transparent to users.

## Dependency Map

```
packages/shared (types + schemas)
    ↓ consumed by
packages/db (Drizzle schema — uses shared types for role enum)
    ↓ consumed by
apps/api (Hono routes + services — imports db client and shared schemas)

apps/web (React SPA — imports shared types/schemas, calls API)
```

**Implementation order**:
1. `packages/shared` — Update auth types and schemas
2. `packages/db` — Create database schemas (tenants, users, refresh_tokens), generate migration, apply RLS
3. `apps/api` — Implement auth module (service → middleware → routes → mount)
4. `apps/web` — Implement auth UI (api client → store → login form → auto-refresh)

## Complexity Tracking

No constitution violations to justify.

| Decision | Justification |
|----------|--------------|
| Login bypasses RLS | Required — no tenant context before authentication. Mitigated by explicit WHERE clause scoping. |
| refresh_tokens table has no tenant_id | Accessed by token_hash, not tenant context. Ownership via user_id FK. |
| tenantSlug in login request | Required — email is not globally unique per constitution's (tenant_id, email) constraint. |

### Revision: Implementation Sync 2026-04-02

- **Reason**: Retrospective CRITICAL-1 and CRITICAL-2 identified Constitution Article I violations.
- **Login user lookup**: Must use `and(eq(users.tenantId, tenant.id), eq(users.email, params.email))` — explicit tenant scoping since login runs pre-RLS context. The "Mitigated by explicit WHERE clause scoping" entry above was the intended design but was not implemented; remediation tasks T057–T058 address this.
- **Tenant middleware SET LOCAL**: Must wrap downstream handlers in a `db.transaction()` with `SET LOCAL app.tenant_id` and expose the scoped client via `c.set("db", tx)`. Remediation tasks T059–T061 address this.
- **Audit event wiring**: `recordAuditEvent()` stubs exist but are not called. Remediation task T063 wires them.
