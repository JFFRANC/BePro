# BePro Platform Constitution

## Core Principles

### I. Multi-Tenant Isolation (NON-NEGOTIABLE)

Every tenant's data MUST be completely isolated. A cross-tenant data leak is a business-ending event.

- `tenant_id` column MUST exist on every tenant-scoped table
- Row-Level Security (RLS) policies MUST be enforced at the PostgreSQL level
- Tenant context MUST be resolved from the JWT claim at the middleware level
- `SET LOCAL app.tenant_id` MUST be used inside every database transaction (transaction-scoped context) to prevent leakage across pooled connections
- Integration tests MUST verify that concurrent requests from different tenants never see each other's data
- No application-level query filter is sufficient on its own — RLS is the safety net

### II. Edge-First

All infrastructure runs on Cloudflare's edge network and serverless PostgreSQL. No traditional servers. Target cost: $0-25/month.

- **Frontend**: React + Vite SPA deployed to Cloudflare Pages
- **API**: Cloudflare Workers with Hono framework
- **Database**: Neon PostgreSQL (serverless) with RLS
- **Storage**: Cloudflare R2 for file storage
- **Auth**: JWT issued and validated in Workers
- Zero cold starts, auto-scaling, DDoS protection included
- If a service requires a traditional server (e.g., CFDI processing), use Fly.io as an exception — document the reason in an ADR

### III. TypeScript Everywhere

One language for the entire stack. No exceptions.

- TypeScript in strict mode (`"strict": true`) for frontend, API, and shared packages
- Shared types and Zod validation schemas live in a `shared/` package consumed by both frontend and API
- Drizzle ORM for type-safe database access — schema definitions co-located with their module
- Code MUST be written in English (variables, functions, classes)
- Comments and documentation MUST be written in Spanish
- Commit messages MUST be in Spanish following Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)

### IV. Modular by Domain

Each business domain is an independent module with its own routes, services, types, and schema.

- MVP modules: `auth`, `tenants`, `users`, `clients`, `candidates`, `placements`, `audit`
- Adding a new module MUST NOT require modifying existing modules
- Modules communicate through exported interfaces, never internal implementation details
- Each module owns its database tables and migrations
- Module structure in the API: `modules/{name}/routes.ts`, `service.ts`, `types.ts`, `schema.ts`
- Module structure in the frontend: `modules/{name}/` with components, hooks, and services scoped to that domain

### V. Test-First (NON-NEGOTIABLE)

TDD is mandatory. No test, no merge. RED → GREEN → REFACTOR.

- Tests MUST be written before implementation code
- For bugs: the test MUST reproduce the exact bug before the fix is applied
- For features: tests of the public interface MUST exist before implementing
- For refactors: existing tests MUST pass before and after
- Vitest is the test runner for both frontend and API
- Integration tests MUST verify RLS isolation, FSM transitions, and API contracts
- The full test suite MUST pass before any PR can be merged
- CI pipeline enforces: `lint → typecheck → test → deploy` — a failing step blocks the pipeline

### VI. Security by Design

Security is built into every layer, not bolted on. LFPDPPP (Mexico's data protection law) compliance is mandatory.

- Passwords: bcrypt with cost factor >= 12
- Authentication: JWT (15-60 min expiry) + refresh tokens (7 days) with rotation
- Data deletion: soft delete only (`is_active` flag) — never hard delete PII
- PII MUST NOT be logged in plain text
- Privacy-notice evidence MUST be captured per LFPDPPP for every registered candidate. For recruiter-driven registrations, evidence is collected offline by the recruiter and retained outside the candidate-create API flow; historical database rows for prior in-product acknowledgements MUST be preserved read-only at rest. A future feature MAY re-introduce an in-product surface for attaching a signed offline notice.
- API protection: rate limiting (Cloudflare built-in), CORS restricted to known origins
- CSD certificates (future invoicing): encrypted at rest in R2
- Rejection categories on candidates MUST be captured for business intelligence without exposing PII in logs

### VII. Best Practices via Agents

22 specialized AI skills enforce technology-specific best practices. The constitution defines principles — the agents enforce implementation patterns.

- Skills cover: Cloudflare Workers, Hono, Drizzle, Neon, JWT, shadcn/ui, Tailwind, TanStack Query, Zustand, React Hook Form + Zod, React + Vite, TypeScript, Turborepo, OWASP, Vitest, and more
- Per-domain CLAUDE.md files provide scoped instructions: root (project-wide), frontend (React patterns), API (Hono patterns), database (Drizzle/RLS)
- When a skill and the constitution conflict, the constitution wins
- Skills MUST NOT be overridden or disabled without documenting the reason

### VIII. Spec-Driven Development

GitHub Spec Kit governs the development workflow. Specifications are the source of truth. No code without an approved spec.

- Workflow: `Constitution → Spec → Plan → Tasks → Implementation`
- Each module follows: `spec.md → plan.md → tasks.md → implement → review`
- Specs define user stories with priorities, acceptance criteria, functional requirements, and edge cases
- Plans define technical design, data model, and dependencies — referencing the constitution
- Tasks are atomic, with dependency tracking and parallelism markers (`[P]`)
- Implementation validates against the spec at every step
- `/speckit.check` MUST pass before a module is considered complete

## Security & Compliance Requirements

| Concern | Requirement |
|---------|-------------|
| PII protection (LFPDPPP) | Soft delete only, never log PII in plain text, privacy notice in registration |
| Tenant isolation | RLS at database level + middleware validation — double enforcement |
| Authentication | JWT (15-60 min) + refresh tokens (7 days) with rotation |
| Passwords | bcrypt, cost factor >= 12 |
| API protection | Rate limiting (Cloudflare built-in), CORS restricted to known origins |
| CSD certificates (future) | Encrypted at rest in R2 |
| Data residency | Neon US-East (legal under LFPDPPP with adequate protections) |
| Audit trail | Append-only `AuditEvent` table captures who/what/when/old/new for every state change |
| Unique constraints | `(tenant_id, email)` on User. Candidate duplicate detection uses a **non-unique** lookup index on `(tenant_id, phone_normalized, client_id) WHERE is_active` — duplicates raise a confirmable warning (spec 007 FR-014/FR-015), so a DB-level UNIQUE would block the legitimate flow and is intentionally NOT applied. |

## Development Workflow & Quality Gates

### Team Structure

Two developers: Hector + Javi. Both review and approve specs. Tasks can be parallelized (frontend/backend split or module split).

### Branch Strategy

- Branch flow: `feature/* → development → testing → main` (also accepted: spec-kit numbered branches like `008-ux-roles-refinements` created by `/speckit.specify`)
- PRs required for merge to main
- Direct commits to `main`, `testing`, or `development` are prohibited
- Feature branches: `feature/descriptive-name` or `NNN-kebab-slug` (spec-kit), fix branches: `fix/descriptive-name`

### CI/CD Pipeline

| Stage | Tool | Trigger |
|-------|------|---------|
| Lint + Type-check | ESLint + `tsc --noEmit` | Every PR |
| Unit + Integration tests | Vitest | Every PR |
| Preview deploy (frontend) | Cloudflare Pages | Every PR (automatic) |
| Production deploy (frontend) | Cloudflare Pages | Merge to `main` |
| Production deploy (API) | Wrangler (`wrangler deploy`) | Merge to `main` |
| Database migrations | Drizzle Kit (`drizzle-kit push`) | Manual or merge to `main` |

A failing stage MUST block the pipeline. No exceptions.

### Roles (4 + Freelancer Flag)

| Role | Access Level |
|------|-------------|
| `admin` | Full system access within tenant |
| `manager` | Supervises all teams and clients, cannot create users/clients |
| `account_executive` | Manages assigned clients only, sees only their recruiters' candidates |
| `recruiter` | Registers candidates, views only own candidates, cannot change status |
| `recruiter` + `is_freelancer: true` | Same as recruiter, flagged for payment tracking |

## Governance

This constitution supersedes all other development practices and guidelines for the BePro platform. All PRs and code reviews MUST verify compliance with these principles.

**Amendment process:**
1. Propose the change with rationale in a PR modifying this file
2. Both developers (Hector and Javi) MUST review and approve
3. Update the version number following semver (MAJOR: principle removal/redefinition, MINOR: new principle/section, PATCH: clarifications)
4. Update `LAST_AMENDED_DATE`
5. Run `/speckit.check` to verify consistency across all specs, plans, and tasks

**Conflict resolution:**
- Constitution > CLAUDE.md files > individual spec requirements
- If a specialized skill/agent contradicts a constitution principle, the constitution wins
- Unresolved conflicts are escalated to both developers for a governance decision

**Version**: 1.0.2 | **Ratified**: 2026-03-27 | **Last Amended**: 2026-04-23

**Changelog**

- **1.0.2 (2026-04-23)**: PATCH — §VI privacy-notice clause clarified for recruiter-driven registrations (evidence is collected offline; historical rows preserved read-only at rest). Branch Strategy extended to accept spec-kit numbered branches alongside `feature/descriptive-name`. No principle added or removed.
- **1.0.1 (2026-04-21)**: PATCH — Clarified "Unique constraints" row in Security & Compliance: candidate duplicate detection uses a non-unique lookup index, not a UNIQUE constraint, because FR-014/FR-015 require a confirmable warning (not a hard block). No principle was added or removed.
