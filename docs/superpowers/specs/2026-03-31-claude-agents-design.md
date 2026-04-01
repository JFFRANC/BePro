# BePro Claude Agents — Design Spec

**Created**: 2026-03-31
**Status**: Draft
**Authors**: Hector Franco
**References**: [Platform Redesign Spec](2026-03-27-bepro-platform-redesign-design.md), [Constitution](../../../.specify/memory/constitution.md)

---

## 1. Purpose

Define 5 specialized Claude Code agents for the BePro project. These agents complement the 22 installed skills — skills enforce technology patterns (Hono routing, Drizzle queries, shadcn components), agents enforce domain reasoning, architectural decisions, and business rules.

## 2. Architecture Principles

1. **Agents own domain reasoning; skills own tech patterns.** An agent says "use `SET LOCAL app.tenant_id` in every transaction" — the Drizzle skill shows how to write the code.
2. **Agents reference, not reproduce.** Agents point to CLAUDE.md and the constitution instead of duplicating their content.
3. **Each agent declares its boundaries.** What it handles, what it delegates, and what requires escalation.
4. **All agents enforce the constitution.** Every agent includes a reminder of the non-negotiable principles (RLS, TDD, soft-delete, LFPDPPP).
5. **Model assignment:** All agents use `opus` — these are senior-level reasoning tasks.
6. **Location:** `.claude/agents/` directory in the BePro repo.

## 3. Agent Roster

| # | Agent | Color | Adapted From | Primary Focus |
|---|-------|-------|-------------|---------------|
| 1 | `senior-backend-engineer` | yellow | byEGB backend | Hono API modules, middleware, services, JWT auth |
| 2 | `senior-frontend-engineer` | blue | byEGB frontend | React SPA, modules-by-domain, role-based UI |
| 3 | `db-architect` | green | byEGB db-architect | Drizzle schemas, migrations, indexes, seeds |
| 4 | `multi-tenancy-guardian` | purple | **New** | RLS policies, tenant isolation, connection safety |
| 5 | `candidate-fsm-auditor` | cyan | byEGB accountability-auditor | 14-state candidate FSM, placement guarantees, audit trail |

## 4. Agent Specifications

### 4.1 `senior-backend-engineer`

**Purpose:** Owns all API-layer work — Hono routes, services, middleware, module scaffolding, external integrations.

**Scope:**
- Module creation following `modules/{name}/routes.ts, service.ts, types.ts, schema.ts`
- Hono route handlers (HTTP concerns only — no business logic in routes)
- Service layer (business logic, FSM transition calls, duplicate detection)
- Middleware awareness (auth, tenant resolution, audit)
- Zod validation schemas shared with frontend via `packages/shared`
- API response patterns and error handling
- Workers constraints (edge-safe code, no Node-only APIs)
- Security: JWT validation, role-based access per endpoint, PII protection

**Delegates to:**
- `db-architect` — schema changes, migrations
- `multi-tenancy-guardian` — RLS policy design
- `candidate-fsm-auditor` — FSM transition validation logic
- `senior-frontend-engineer` — frontend integration

**Key differences from byEGB:**
- Simpler module structure (no DDD/Clean Architecture layers)
- Multi-tenancy is first-class (every route goes through tenant middleware)
- No external integrations in MVP (no Stripe, Twilio, Facturama)
- No dual deployment — Cloudflare Workers only (no separate Node.js local server)

### 4.2 `senior-frontend-engineer`

**Purpose:** Owns all React SPA work — components, hooks, pages, state management, API integration, forms.

**Scope:**
- Module structure: components, hooks, services scoped per domain in `modules/{name}/`
- State management rules:
  - TanStack Query for server state
  - Zustand for global state (auth, UI flags)
  - URL params (useSearchParams) for filters/pagination
  - useState for local UI state
- Form patterns: React Hook Form + Zod, dynamic fields driven by client `form_config` JSON
- Role-based rendering and route protection (4 roles + freelancer flag)
- Search, filtering, cursor-based pagination
- Duplicate candidate detection UI (warn before creating)
- Export to Excel/CSV
- Performance: memoization, virtualization for large candidate lists

**Delegates to:**
- `senior-backend-engineer` — API contracts and endpoints
- `candidate-fsm-auditor` — FSM transition rules
- Shared types in `packages/shared` — collaboration with backend agent

**Key differences from byEGB:**
- Modules-by-domain (`modules/{name}/`) instead of byEGB's `features/` pattern
- Candidate status transitions are backend-driven; frontend shows status and available actions
- Role-based dashboards (4 views) are a central concern
- Dynamic candidate forms (per-client configuration)

### 4.3 `db-architect`

**Purpose:** Owns database schema design, Drizzle ORM definitions, migrations, indexes, triggers, query optimization, and seed data.

**Scope:**
- Drizzle schema definitions following BePro conventions:
  - snake_case tables/columns
  - All tables: `id`, `created_at`, `updated_at`, `is_active`
  - All tenant-scoped tables: `tenant_id`
- Migration workflow: `drizzle-kit generate` → review SQL → `drizzle-kit push`
- Index strategy for common query patterns (status filters, tenant+phone+client uniqueness, date ranges)
- Unique constraints with tenant scope: `(tenant_id, email)` on users, `(tenant_id, phone, client_id)` on candidates
- Seed data for development (tenants, users per role, sample clients/candidates)
- Query optimization, N+1 prevention
- Soft delete with `is_active` flag — never hard delete

**Delegates to:**
- `multi-tenancy-guardian` — RLS policy design and testing
- `candidate-fsm-auditor` — FSM state column design (enum values, transition rules)
- `senior-backend-engineer` — API-layer query logic

**Key differences from byEGB:**
- ~8 MVP tables vs byEGB's 33
- RLS is the defining concern (byEGB had none)
- Schemas live in `packages/db/`, not inside the API app
- Soft delete uses `is_active` flag (not `deleted_at` timestamp)
- Simpler monetary fields — placement fees and freelancer payments only

### 4.4 `multi-tenancy-guardian`

**Purpose:** Dedicated to ensuring tenant isolation is airtight. The constitution calls cross-tenant data leakage a "business-ending event" — this agent is the specialist.

**This agent has no byEGB equivalent.** byEGB is single-tenant.

**Scope:**
- RLS policy design: `CREATE POLICY` statements for every tenant-scoped table
- `SET LOCAL app.tenant_id` transaction wrapping — ensuring the Hono middleware + Drizzle client wrapper injects this in every database call
- Neon serverless connection pooling safety — verifying `SET LOCAL` (transaction-scoped) is used instead of `SET` (session-scoped) to prevent leakage
- Tenant resolution middleware: extracting `tenant_id` from JWT claims, validating tenant exists and is active
- Cross-tenant integration tests: proving concurrent requests from Tenant A and Tenant B never see each other's data
- Reviewing any query or migration for tenant isolation gaps (missing `tenant_id`, missing RLS policy, raw SQL bypassing RLS)
- Tenant provisioning flow: new tenant creation (tables, RLS policies, initial admin user)
- Edge cases: super-admin cross-tenant access, tenant deactivation, suspended tenant data handling

**Delegates to:**
- `db-architect` — schema creation
- `senior-backend-engineer` — middleware implementation
- `senior-frontend-engineer` — frontend tenant context (auth store, token handling)

**Invocation pattern:** This agent should be consulted as a reviewer whenever a new table is created, a migration is written, a raw query is added, or a new endpoint touches tenant-scoped data.

### 4.5 `candidate-fsm-auditor`

**Purpose:** Guardian of the 14-state candidate lifecycle FSM and placement guarantee tracking. Ensures every status transition is valid, auditable, and traceable.

**Scope:**
- FSM transition validation: enforcing all valid paths from the spec:
  ```
  Registered
  ├── InterviewScheduled
  │   ├── Attended
  │   │   ├── Approved → Hired → InGuarantee → GuaranteeMet (final)
  │   │   │                       └── Termination → Replacement (final)
  │   │   ├── Pending → Approved / Rejected / Declined / Discarded
  │   │   ├── Rejected (final, requires category)
  │   │   └── Declined (final, requires category)
  │   ├── NoShow → Discarded (final)
  │   └── Discarded (final)
  ├── NoShow → Discarded (final)
  └── Discarded (final)
  ```
  14 states total: `Registered`, `InterviewScheduled`, `Attended`, `Pending`, `Approved`, `Rejected`, `Declined`, `NoShow`, `Discarded`, `Hired`, `InGuarantee`, `GuaranteeMet`, `Termination`, `Replacement`
- Terminal state enforcement: `GuaranteeMet`, `Replacement`, `Rejected`, `Declined`, `Discarded` are final — no transitions out. `NoShow` and `Termination` are non-terminal (they always lead to `Discarded` and `Replacement` respectively).
- Transition rules by role: only admin, manager, account_executive can change status; recruiter is read-only
- Rejection/decline auditing: every terminal-negative transition requires a rejection category (10 categories) and optional details
- Placement creation trigger: `Approved → Hired` must create a Placement record
- Guarantee period tracking: `guarantee_days`, `guarantee_end_date` calculation, `InGuarantee → GuaranteeMet` vs `InGuarantee → Termination`
- Freelancer payment auditing: `freelancer_payment_status` (pending/paid/cancelled) on placements, payment only after `GuaranteeMet`
- Audit event integrity: every status change produces an `AuditEvent` with who/what/when/old_value/new_value
- Duplicate candidate accountability: when duplicate detected, trace which recruiter registered first

**Delegates to:**
- `db-architect` — audit_events schema
- `senior-backend-engineer` — API endpoint implementation for transitions
- `senior-frontend-engineer` — UI for status display and transition actions
- `multi-tenancy-guardian` — tenant scoping of audit queries

**Key differences from byEGB:**
- 14 states in a clean tree (vs byEGB's 6 main + 17 sub-states + commission + SAT status)
- No invoice chain tracking (no CFDI in MVP)
- No billing cut auditing
- Focused on recruitment lifecycle: registration → interview → hire → guarantee → payment

## 5. Agent Interaction Model

```
                    ┌──────────────────────┐
                    │ multi-tenancy-guardian│
                    │   (reviews all DB     │
                    │    and API changes)   │
                    └──────────┬───────────┘
                               │ reviews
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
    ┌─────────────┐  ┌──────────────┐  ┌────────────────┐
    │  db-architect│  │senior-backend│  │senior-frontend │
    │  (schemas,   │  │  (API layer) │  │  (React SPA)   │
    │   migrations)│  └──────┬───────┘  └────────────────┘
    └─────────────┘          │
                             │ validates transitions
                    ┌────────▼──────────┐
                    │candidate-fsm-     │
                    │auditor            │
                    │(FSM + audit trail)│
                    └───────────────────┘
```

**Typical workflow for a new module:**
1. `db-architect` designs the schema
2. `multi-tenancy-guardian` reviews for RLS compliance
3. `senior-backend-engineer` implements routes + services
4. `candidate-fsm-auditor` validates any status-transition logic
5. `senior-frontend-engineer` builds the UI

## 6. What Agents Do NOT Cover

These are handled by the 22 installed skills:
- Hono routing patterns and middleware syntax → `hono` + `hono-cloudflare` skills
- Drizzle ORM query syntax → `drizzle-orm` skill
- Workers deployment and `wrangler.jsonc` → `cloudflare` + `workers-best-practices` skills
- shadcn/ui component usage → `shadcn-ui` skill
- Tailwind CSS patterns → `tailwindcss-advanced-layouts` skill
- TanStack Query hooks → `tanstack-query-best-practices` skill
- Zod schema syntax → `zod-schema-validation` skill
- React + Vite optimization → `react-vite-best-practices` skill
- Vitest test patterns → `vitest` skill
- JWT token mechanics → `jwt-security` skill
- OWASP security patterns → `owasp-security` skill
- TypeScript type patterns → `typescript-advanced-types` skill

## 7. Dropped from byEGB

| byEGB Agent | Reason Dropped |
|-------------|---------------|
| `cfdi-sealing-engineer` | BePro has no invoicing in MVP. If a future invoicing module is added, this agent can be created from the byEGB version. |

---

*BePro Claude Agents — Design Spec v1.0*
