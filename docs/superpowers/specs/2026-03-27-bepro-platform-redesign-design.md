# BePro Platform Redesign — Design Spec

**Created**: 2026-03-27
**Status**: Draft
**Authors**: Hector Franco
**Stakeholders**: Javi (original developer), BePro owner

---

## 1. Business Context

### What is BePro

BePro is a recruitment and staffing agency based in Mexico. Their core business is finding candidates for client companies, placing them, and charging a fee upon successful placement after a guarantee period.

### Current Process (What We're Replacing)

Everything runs on Google Sheets and Google Forms. 250 recruiters (200 freelancers + 50 internal) manually register candidates, track interview status, and coordinate with their leaders — all through spreadsheets.

### Pain Points

| Pain | Impact | Who suffers |
|------|--------|-------------|
| Duplicate candidates registered by different recruiters | Commission disputes, wasted effort | Recruiters, Admin |
| No real-time visibility of candidate status | Leaders don't know what's happening in their pipeline | Account Executives, Managers |
| Cannot measure recruiter performance | No data to manage 250 people effectively | Admin, Managers |
| Invoicing is chaos | Don't know who to bill, how much, or if they already billed | Admin |
| Freelancers have no visibility of their payments | Constant inquiries, distrust | Freelancers |
| Data duplication and inconsistency across sheets | Unreliable reports, lost candidates | Everyone |

### Revenue Model

Standard Mexican recruitment agency model:
- BePro presents candidates to client companies
- Client hires the candidate
- A guarantee period begins (7-90 days depending on role level)
- If the candidate survives the guarantee, BePro invoices a percentage of the annual salary (8.3%-25% depending on role level)
- If the candidate doesn't survive, BePro replaces at no cost

### Scale

| Metric | Current | Potential |
|--------|---------|-----------|
| Internal recruiters | 50 | Growing |
| Freelancer recruiters | 200 | Growing |
| Active clients | 15 | 200+ |
| Candidates per recruiter | ~5,000 (lifetime) | Growing |
| Total candidate records | Tens of thousands → millions over time | — |

---

## 2. System Roles

Four roles per tenant, with a freelancer flag on Recruiter.

### Role Migration from PoC

The PoC used 5 roles. The redesign consolidates to 4 + flag. The PoC has never been deployed and has zero production data — no data migration is needed. This is a clean start.

| PoC Role (old) | New Role | Notes |
|----------------|----------|-------|
| `admin` | `admin` | No change |
| `leader_manager` | `manager` | Renamed for clarity |
| `leader` | `account_executive` | Renamed to match business terminology |
| `recruiter` | `recruiter` | No change |
| `freelancer` | `recruiter` + `is_freelancer: true` | Was a separate role, now a flag on recruiter |

**Impact:** ADR-001 and the root CLAUDE.md reference the old role model. Both must be updated when this spec is approved (see Phase 0, Step 0.7).

### Administrator
- Full system access within their tenant
- Creates users, clients, configures the system
- Manages client assignments (who works where)
- Configures per-client candidate forms
- Views all data, all modules

### Manager (Gerente)
- Supervises all teams and all clients
- Can assign/unassign users to clients
- Can change candidate status
- Can manage placements
- Views invoices
- Cannot create clients or users, cannot configure system

### Account Executive (Ejecutivo de Cuenta)
- Manages only their assigned clients
- Sees only candidates from their recruiters (filtered by `account_executive_id` — renamed from PoC's `leader_id` for clarity)
- Can change candidate status
- Can register candidates
- Can manage placements
- Cannot view unassigned clients, cannot view invoices

### Recruiter (Reclutador)
- Registers candidates for assigned clients
- Views ONLY their own candidates (filtered by `recruiter_id`)
- Can see candidate status updates (read-only) but cannot change status
- Has a personalized dashboard showing their own metrics
- **Freelancer variant**: identical permissions, flagged with `is_freelancer` for payment tracking

---

## 3. Candidate Status FSM

The heart of the business. 14 states governing the candidate lifecycle:

```
Registered
├── InterviewScheduled
│   ├── Attended
│   │   ├── Approved ───► [Create Placement] → Hired → InGuarantee
│   │   │                                        ├── GuaranteeMet (final ✓)
│   │   │                                        └── Termination → Replacement (final)
│   │   ├── Rejected (final ✗, requires reason + category)
│   │   ├── Declined (final ✗, requires reason + category)
│   │   └── Pending
│   │       ├── Approved
│   │       ├── Rejected (final ✗)
│   │       ├── Declined (final ✗)
│   │       └── Discarded (final ⛔)
│   ├── NoShow → Discarded (final ⛔)
│   └── Discarded (final ⛔)
├── NoShow → Discarded (final ⛔)
└── Discarded (final ⛔)
```

**Rejection categories** (captured for business intelligence):
Interview performance, Salary expectations, Schedule incompatibility, Location/distance, Personal decision, Age requirements, Experience level, Documentation issues, Health requirements, Other.

**Transition rules:**
- Only Admin, Manager, and Account Executive can change status
- Recruiter can see status but not change it
- Transitions to Rejected/Declined require a rejection category and optional details
- Transition to Approved triggers the placement creation flow
- Transition to Hired happens automatically when a placement is created

### Note on Vacancies (Job Positions)

The PoC documentation mentions "Gestión de Vacantes" as a core process. In practice, BePro's current workflow (Google Sheets) tracks candidates per client, not per vacancy. The `Position` field on a candidate already captures what role they're applying for, and the `Client` entity represents who needs them.

**MVP decision:** Vacancies are NOT a separate entity in the MVP. A candidate is linked to a client and has an optional `position` text field. This matches the current workflow that 250 recruiters already follow.

**Future consideration:** If BePro needs to track "Client X needs 5 Java developers and 2 of 5 are filled," a `Vacancy` entity (with capacity, status, and candidate count) can be added as a module without breaking existing data. This would be a post-MVP spec.

---

## 3.5. Conceptual Data Model

Entities, relationships, and key fields. Full Drizzle schemas will be defined in per-module specs.

```
┌──────────┐       ┌──────────┐
│  Tenant   │──1:N──│   User   │
│           │       │          │
│ id (PK)   │       │ id (PK)  │
│ name      │       │ tenant_id│
│ slug      │       │ email    │
│ config    │       │ password │
│ is_active │       │ role     │
└──────────┘       │is_freelancer│
                    └─────┬────┘
                          │
               ┌──────────┴──────────┐
               │                     │
        ┌──────┴──────┐       ┌──────┴──────┐
        │ClientAssign.│       │  Candidate  │
        │             │       │             │
        │ user_id(FK) │       │ id (PK)     │
        │ client_id(FK│       │ tenant_id   │
        │ leader_id(FK│       │ client_id   │
        └──────┬──────┘       │ recruiter_id│
               │              │ acct_exec_id│
        ┌──────┴──────┐       │ full_name   │
        │   Client    │       │ phone       │
        │             │──1:N──│ status (enum│
        │ id (PK)     │       │ position    │
        │ tenant_id   │       │ interview_dt│
        │ name        │       │ rejection_* │
        │ contact_*   │       │ ...dynamic  │
        │ form_config │       └──────┬──────┘
        └─────────────┘              │
              (JSON)           ┌─────┴──────┐
                               │ Placement  │
                               │            │
                               │ id (PK)    │
                               │ tenant_id  │
                               │candidate_id│
                               │ client_id  │
                               │ hire_date  │
                               │guarantee_days│
                               │guarantee_end│
                               │termination_dt│
                               │freelancer_payment_status│
                               │freelancer_payment_date  │
                               └─────┬──────┘
                                     │
                               ┌─────┴──────┐
                               │ AuditEvent │
                               │            │
                               │ id (PK)    │
                               │ tenant_id  │
                               │ entity_type│
                               │ entity_id  │
                               │ action     │
                               │ user_id    │
                               │ old_value  │
                               │ new_value  │
                               │ created_at │
                               └────────────┘
```

**Key decisions:**

- **`tenant_id`** on every table — enforced by RLS policies at the database level
- **`form_config`** stored as JSON on Client (boolean toggles for dynamic form fields) — same approach as PoC but in a single JSON column instead of a separate table
- **`freelancer_payment_status`** is an enum (`pending`, `paid`, `cancelled`) with an optional `payment_date` — tracks whether BePro paid the freelancer for the placement, not the invoice to the client
- **`AuditEvent`** is a single append-only table for all entity changes — captures who/what/when/old/new for any state change
- **Candidate dynamic fields** (municipality, age, shift, plant, interview_point, comments) are nullable columns, not a separate table — simple and query-friendly
- **No `Invoice` entity in MVP** — deferred to invoicing module
- **No `Vacancy` entity in MVP** — `position` is a text field on Candidate

**Unique constraints:**
- `(tenant_id, email)` on User — email unique per tenant
- `(tenant_id, phone, client_id)` on Candidate — same phone at same client is flagged as duplicate

---

## 4. Architecture Decisions

### Stack Chosen: Cloudflare-First (Edge/Serverless)

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | React + Vite (SPA) on Cloudflare Pages | Free |
| API | Cloudflare Workers with Hono | Free tier |
| Database | Neon PostgreSQL (serverless) with RLS | Free → ~$19/mo |
| Storage | Cloudflare R2 | Free up to 10GB |
| Auth | JWT issued/validated in Workers | — |
| Invoicing (future) | PAC API (Facturapi or similar) from Workers | ~$0.50-2 MXN/invoice |

### Why This Stack (Alternatives Evaluated)

**Discarded: .NET 10 + Next.js (current PoC)**
- Two languages (C# + TypeScript) for a 2-person team
- Next.js unnecessary for a private app behind auth (no SEO, no SSR needed)
- Render free tier sleeps services (30+ second cold starts)
- The PoC has no multi-tenancy, no tests — would need significant rewrite anyway
- Higher hosting costs for equivalent functionality

**Discarded: Node.js on Fly.io/Railway**
- More expensive than Workers at scale
- Traditional server to monitor
- Not edge-optimized
- Fly.io reserved for future CFDI processing if PAC API proves insufficient

**Chosen: Cloudflare Workers + Neon**
- Cost: $0-25/month for current scale
- Team has proven production experience with this stack
- Single language (TypeScript) everywhere
- Auto-scaling with zero cold starts
- Edge = fast response from anywhere in Mexico
- DDoS protection included
- Generous free tiers across all services

### Multi-Tenancy Strategy

**Row-Level Security (RLS)** with `tenant_id` column on every tenant-scoped table.

- Tenant resolved from JWT claim at the middleware level (every request)
- RLS policies enforced at PostgreSQL level — even a code bug cannot leak cross-tenant data
- Simpler and more cost-effective than schema-per-tenant for the current scale
- Can migrate to schema-per-tenant later if a large enterprise client demands it

**RLS + Serverless Connection Pooling (critical implementation detail):**

Cloudflare Workers are stateless and Neon uses connection pooling via its serverless driver (`@neondatabase/serverless`). Setting RLS context (`SET app.tenant_id = X`) through a shared pool risks tenant leakage if not handled correctly. The solution:

- Use Neon's **transaction-scoped context**: every database operation wraps `SET LOCAL app.tenant_id = $1` inside the same transaction as the query. `SET LOCAL` only applies within the current transaction and is automatically cleared when the transaction ends — no leakage across pooled connections.
- The Hono middleware resolves `tenant_id` from the JWT, and the database client wrapper automatically injects the `SET LOCAL` before every query.
- Integration tests MUST verify that concurrent requests from different tenants never see each other's data, even under load.

### Modular Architecture

Each business domain is a module with its own routes, services, types, and schema:

```
MVP Modules:
├── auth        — JWT, refresh tokens, sessions
├── tenants     — Tenant provisioning, configuration
├── users       — CRUD, roles, permissions
├── clients     — Client companies, form config, assignments
├── candidates  — Registration, FSM, duplicates, search
├── placements  — Hire tracking, guarantee, freelancer payments
└── audit       — Event log of all state changes

Future Modules:
├── invoicing   — CFDI via PAC API
├── training    — Employee training management
├── sales       — Sales pipeline
└── reports     — Dashboards, analytics, BI
```

Rules:
- Adding a new module does not require modifying existing modules
- Modules communicate through exported interfaces, never internal implementation
- Each module owns its database tables and migrations

### Security Considerations

| Concern | Approach |
|---------|----------|
| PII protection (LFPDPPP) | Soft delete only, never log PII in plain text, privacy notice in registration |
| Tenant isolation | RLS at database level + middleware validation |
| Authentication | JWT (15-60 min) + refresh tokens (7 days) with rotation |
| Passwords | bcrypt, cost factor >= 12 |
| API protection | Rate limiting (Cloudflare built-in), CORS restricted |
| CSD certificates (future) | Encrypted at rest in R2 |
| Data residency | Neon US-East (legal under LFPDPPP with adequate protections). Azure Mexico Central available as future option for enterprise clients |

### CI/CD Pipeline

| Stage | Tool | Trigger |
|-------|------|---------|
| Lint + Type-check | ESLint + `tsc --noEmit` | Every PR |
| Unit + Integration tests | Vitest | Every PR |
| Preview deploy (frontend) | Cloudflare Pages | Every PR (automatic) |
| Production deploy (frontend) | Cloudflare Pages | Merge to `main` |
| Production deploy (API) | Wrangler (`wrangler deploy`) | Merge to `main` |
| Database migrations | Drizzle Kit (`drizzle-kit push`) | Manual or merge to `main` |

GitHub Actions pipeline: `lint → typecheck → test → deploy`. A failing step blocks the pipeline.

---

## 5. MVP Scope

### What's IN the MVP

Everything the PoC demonstrates, PLUS four critical additions:

**From the PoC (validated concepts):**
- User authentication with JWT + refresh tokens
- User management (CRUD) with role-based access
- Client management with per-client form configuration
- Client-user assignments (recruiter ↔ client with optional leader)
- Candidate registration with dynamic form fields
- Candidate status FSM (14 states with transition rules)
- Placement tracking with guarantee periods and freelancer payment status
- Role-based access control (4 roles + freelancer flag)

**New — critical for production with 250 users:**

1. **Duplicate candidate detection**
   - At registration time: match by phone, CURP (if available), or name+client combination
   - Warn the recruiter before creating a duplicate
   - Critical for commission dispute prevention

2. **Search and filtering**
   - Full-text search across candidate data (name, phone, position)
   - Filter by status, client, date range, recruiter
   - Pagination for large result sets (cursor-based)

3. **Export to Excel/CSV**
   - Export candidate lists, placement lists
   - Bridge feature for Excel-dependent users
   - Reduces adoption resistance

4. **Audit log**
   - Who changed what status, when, and why
   - Accountability for 250 users
   - Simple event log, not full event sourcing

5. **Dashboard per role**
   - Recruiter: own numbers (registered, placed, pending payment)
   - Account Executive: pipeline per client, team performance
   - Manager: all teams overview
   - Admin: system-wide metrics

### What's NOT in the MVP

- Invoicing / CFDI (future module)
- Training module (future)
- Sales module (future)
- Email/WhatsApp notifications
- Document uploads (CVs, IDs)
- Advanced reporting / BI dashboards
- Bulk operations (mass status changes, mass assignments)

---

## 6. Development Methodology

### GitHub Spec Kit (Spec-Driven Development)

**Workflow per feature/module:**

```
Constitution → Spec → Plan → Tasks → Implementation
```

1. **Constitution** — High-level business principles and architectural decisions (what we're defining now). Installed once, amended through governance process.

2. **Spec** (per module) — User stories with priorities, acceptance criteria, functional requirements, edge cases. Written before any code.

3. **Plan** (per module) — Technical design, data model, project structure, dependencies. References the constitution.

4. **Tasks** (per module) — Atomic tasks with dependency tracking, parallelism markers, and traceability to spec requirements.

5. **Implementation** — One task at a time. Validated against spec. TDD enforced.

### Spec Kit Installation

After this design spec is approved:
1. Install GitHub Spec Kit in the repository
2. Create the constitution file from the approved principles
3. Write the first spec: Auth module
4. Continue module by module

### AI-Assisted Development Strategy

**Specialized CLAUDE.md files per domain:**

| CLAUDE.md | Scope | What it governs |
|-----------|-------|-----------------|
| Root `CLAUDE.md` | Project-wide | Business context, methodology, cross-cutting rules |
| `src/frontend/CLAUDE.md` | Frontend | React patterns, component conventions, state management, UI/UX rules |
| `src/api/CLAUDE.md` | Backend API | Hono patterns, middleware, route conventions, service layer rules |
| `src/api/CLAUDE-database.md` | Database | Drizzle schema, migrations, RLS policies, naming conventions (lives in api/ since schemas are co-located with modules) |
| `specs/CLAUDE.md` | Specs | How to write specs, templates, review process |

**Installed skills (21 total):**

#### Backend / API (6 skills)

| # | Skill | Package | Installs |
|---|-------|---------|----------|
| 1 | Cloudflare Workers | `cloudflare/skills@workers-best-practices` | 3.3K |
| 2 | Hono Framework (by Yusuke, creator) | `yusukebe/hono-skill@hono` | 2.9K |
| 3 | Hono + Cloudflare (combined) | `bobmatnyc/claude-mpm-skills@hono-cloudflare` | 271 |
| 4 | Drizzle ORM | `bobmatnyc/claude-mpm-skills@drizzle-orm` | 2.5K |
| 5 | Neon PostgreSQL | `sickn33/antigravity-awesome-skills@neon-postgres` | 377 |
| 6 | JWT Security | `mindrally/skills@jwt-security` | 305 |

#### Frontend (6 skills)

| # | Skill | Package | Installs |
|---|-------|---------|----------|
| 7 | shadcn/ui (Google Labs) | `google-labs-code/stitch-skills@shadcn-ui` | 19.1K |
| 8 | Tailwind CSS Layouts | `josiahsiegel/claude-plugin-marketplace@tailwindcss-advanced-layouts` | 4.4K |
| 9 | TanStack Query | `jezweb/claude-skills@tanstack-query` | 2.5K |
| 10 | Zustand State Management | `jezweb/claude-skills@zustand-state-management` | 1.2K |
| 11 | React Hook Form + Zod | `jezweb/claude-skills@react-hook-form-zod` | 1.2K |
| 12 | React + Vite Best Practices | `asyrafhussin/agent-skills@react-vite-best-practices` | 720 |

#### Design / UI/UX (3 skills)

| # | Skill | Package | Installs |
|---|-------|---------|----------|
| 13 | UI/UX Pro Max | `nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max` | 86K |
| 14 | Web Accessibility | `supercent-io/skills-template@web-accessibility` | 12.7K |
| 15 | Design System (Anthropic official) | `anthropics/knowledge-work-plugins@design-system` | 330 |

#### Cross-cutting (6 skills)

| # | Skill | Package | Installs |
|---|-------|---------|----------|
| 16 | TypeScript Advanced Types | `wshobson/agents@typescript-advanced-types` | 18.6K |
| 17 | Turborepo (official Vercel) | `vercel/turborepo@turborepo` | 13.6K |
| 18 | OWASP Security | `hoodini/ai-agents-skills@owasp-security` | 780 |
| 19 | Vitest Testing | `pproenca/dot-skills@vitest` | 456 |
| 20 | Zod Schema Validation | `mindrally/skills@zod-schema-validation` | 207 |
| 21 | TDD: Test-Driven Development | `neolabhq/context-engineering-kit@tdd:test-driven-development` | 288 |

#### Methodology (1 skill)

| # | Skill | Package | Installs |
|---|-------|---------|----------|
| 22 | GitHub Spec Kit | `feiskyer/claude-code-settings@spec-kit-skill` | 269 |

#### Install all skills (one-time setup)

**Auto-installable (use `-g -y` flags):**

```bash
# Backend / API
npx skills add cloudflare/skills@workers-best-practices -g -y
npx skills add yusukebe/hono-skill@hono -g -y
npx skills add bobmatnyc/claude-mpm-skills@hono-cloudflare -g -y
npx skills add bobmatnyc/claude-mpm-skills@drizzle-orm -g -y
npx skills add mindrally/skills@jwt-security -g -y

# Frontend
npx skills add google-labs-code/stitch-skills@shadcn-ui -g -y
npx skills add josiahsiegel/claude-plugin-marketplace@tailwindcss-advanced-layouts -g -y
npx skills add asyrafhussin/agent-skills@react-vite-best-practices -g -y

# Design / UI/UX
npx skills add nextlevelbuilder/ui-ux-pro-max-skill@ui-ux-pro-max -g -y
npx skills add anthropics/knowledge-work-plugins@design-system -g -y

# Cross-cutting
npx skills add wshobson/agents@typescript-advanced-types -g -y
npx skills add hoodini/ai-agents-skills@owasp-security -g -y
npx skills add pproenca/dot-skills@vitest -g -y
npx skills add mindrally/skills@zod-schema-validation -g -y

# Methodology
npx skills add feiskyer/claude-code-settings@spec-kit-skill -g -y
```

**Require manual interactive install (multi-skill repos):**

```bash
npx skills add sickn33/antigravity-awesome-skills@neon-postgres -g
npx skills add jezweb/claude-skills@tanstack-query -g
npx skills add jezweb/claude-skills@zustand-state-management -g
npx skills add jezweb/claude-skills@react-hook-form-zod -g
npx skills add supercent-io/skills-template@web-accessibility -g
npx skills add vercel/turborepo@turborepo -g
```

These skills enforce best practices per technology. The constitution doesn't dictate implementation patterns — the agents do.

### Team Workflow

**Two developers: Hector + Javi**

- Both work on specs together (review, approve)
- Tasks can be parallelized: one takes frontend tasks, the other backend — or split by module
- Spec Kit tasks mark `[P]` for parallelizable work
- PRs required for merge to main
- Branch flow: `feature/* → development → testing → main`

---

## 7. Constitution Principles (High Level)

These will be formalized when Spec Kit is installed. For now, the agreed principles:

| # | Principle | Summary |
|---|-----------|---------|
| I | Multi-Tenant Isolation | RLS with `tenant_id`. A data leak between tenants is a business-ending event. |
| II | Edge-First | Cloudflare Workers + Pages + R2 + Neon. No servers. $0-25/mo target. |
| III | TypeScript Everywhere | One language for the entire stack. Strict mode. Shared types. |
| IV | Modular by Domain | Independent modules. Adding one doesn't modify others. |
| V | Test-First (TDD) | RED → GREEN → REFACTOR. No test, no merge. |
| VI | Security by Design | LFPDPPP compliance, RLS, bcrypt, soft delete, PII protection. |
| VII | Best Practices via Agents | Specialized skills/agents enforce technology-specific best practices. The constitution doesn't dictate implementation patterns — the agents do. |
| VIII | Spec-Driven Development | GitHub Spec Kit. Specs are the source of truth. No code without an approved spec. |

---

## 8. Project Structure (Proposed)

```
bepro/
├── src/
│   ├── frontend/              # React + Vite SPA
│   │   ├── src/
│   │   │   ├── app/           # Route pages
│   │   │   ├── components/    # Shared UI components
│   │   │   ├── modules/       # Feature modules (candidates/, clients/, etc.)
│   │   │   ├── hooks/         # Shared hooks
│   │   │   ├── services/      # API client layer
│   │   │   ├── store/         # Zustand stores
│   │   │   └── lib/           # Utilities
│   │   ├── CLAUDE.md          # Frontend-specific AI instructions
│   │   └── package.json
│   │
│   ├── api/                   # Cloudflare Workers + Hono
│   │   ├── src/
│   │   │   ├── modules/       # Business modules (auth/, candidates/, etc.)
│   │   │   │   └── {module}/
│   │   │   │       ├── routes.ts
│   │   │   │       ├── service.ts
│   │   │   │       ├── types.ts
│   │   │   │       └── schema.ts   # Drizzle table definitions
│   │   │   ├── middleware/    # Tenant resolution, auth, audit
│   │   │   ├── lib/           # Shared utilities
│   │   │   └── index.ts       # Hono app entry
│   │   ├── CLAUDE.md          # Backend-specific AI instructions
│   │   └── package.json
│   │
│   └── shared/                # Shared types, constants, validation schemas
│       ├── types/
│       ├── schemas/           # Zod schemas (shared validation)
│       ├── constants/         # Roles, statuses, etc.
│       └── package.json
│
├── specs/                     # GitHub Spec Kit specs
│   ├── auth/
│   │   ├── spec.md
│   │   ├── plan.md
│   │   └── tasks.md
│   ├── candidates/
│   ├── clients/
│   ├── placements/
│   └── ...
│
├── memory/
│   └── constitution.md        # Spec Kit constitution
│
├── docs/
│   ├── architecture/          # ADRs
│   ├── api/                   # API documentation
│   └── modules/               # Business documentation
│
├── CLAUDE.md                  # Root project AI instructions
├��─ package.json               # Monorepo root (workspaces)
└── turbo.json                 # Turborepo config (if needed)
```

---

## 9. Next Steps

### Phase 0: Setup (Before any code)

| Step | Action | Command / Detail | Who |
|------|--------|------------------|-----|
| 0.1 | Review and approve this design spec | Share with Javi + Owner | Hector |
| 0.2 | Initialize new monorepo | Create repo structure from Section 8 | Hector |
| 0.3 | Install all 22 skills | See install commands in Section 6 (already done for Hector) | Hector + Javi |
| 0.4 | Install GitHub Spec Kit in repo | See setup instructions below | Hector |
| 0.5 | Create `memory/constitution.md` | Formalize principles from Section 7 using Spec Kit template | Hector |
| 0.6 | Create per-domain CLAUDE.md files | Root, frontend, api, specs | Hector |
| 0.7 | Supersede ADR-001 and update root CLAUDE.md | Mark ADR-001 as superseded, update CLAUDE.md to reflect new stack/roles | Hector |
| 0.8 | Commit and push setup | All config committed before any feature work | Hector |

### GitHub Spec Kit Setup

```bash
# Install Spec Kit in the repository
npx spec-kit@latest init

# This creates:
# .specify/              — Spec Kit configuration
# .specify/templates/    — Templates for specs, plans, tasks
# memory/constitution.md — Constitution template to fill in
```

**Spec Kit commands (available after install):**

| Command | What it does |
|---------|-------------|
| `/speckit.constitution` | Review/edit the constitution |
| `/speckit.spec <feature>` | Create a new feature spec (requirements + user stories) |
| `/speckit.plan` | Generate implementation plan from spec (design + data model) |
| `/speckit.tasks` | Generate task list from plan (atomic, parallelizable, traceable) |
| `/speckit.implement` | Implement tasks one by one, validating against spec |
| `/speckit.check` | Validate spec, plan, and tasks for completeness/consistency |

### Phase 1: Spec Writing (Per module, in order)

| Step | Spec | Key concerns |
|------|------|-------------|
| 1.1 | Auth module | JWT, refresh tokens, tenant context in token, login/logout |
| 1.2 | Tenants module | Tenant provisioning, RLS setup, config per tenant |
| 1.3 | Users module | CRUD, roles, freelancer flag, tenant-scoped |
| 1.4 | Clients module | Client CRUD, form config, user assignments |
| 1.5 | Candidates module | Registration, FSM (14 states), duplicate detection, search, export |
| 1.6 | Placements module | Hire tracking, guarantee periods, freelancer payments |
| 1.7 | Audit module | Event log, status change history, who/what/when |

**For each module:** `spec → plan → tasks → implement → review`

### Phase 2: Implementation (Per module, following Spec Kit workflow)

Each module follows the TDD cycle within Spec Kit tasks:
1. Run `/speckit.tasks` to get atomic task list
2. Pick first task, write failing test (RED)
3. Implement minimal code (GREEN)
4. Refactor, run full suite
5. Mark task complete, pick next
6. After all tasks: run `/speckit.check` to validate against spec

---

## 10. Open Questions

Items that need resolution before or during implementation:

1. **Tenant onboarding flow** — How does a new agency sign up? Self-service or BePro provisions manually?
2. **Subdomain vs. header tenancy** — `agencia1.bepro.mx` or single domain with tenant switcher?
3. **Freelancer onboarding** — Do freelancers self-register or does admin create their account?
4. **Guarantee period configuration** — Fixed per client or configurable per placement?
5. **Candidate duplicate scope** — Duplicates within a tenant only, or cross-tenant? (affects whether a candidate who's rejected at Agency A can be registered at Agency B)
6. **Excel import** — Do they need to migrate historical data from existing sheets?
7. **Mobile responsiveness priority** — Are recruiters primarily on mobile (field work) or desktop?

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| **Tenant** | A recruitment agency using the BePro platform. Each tenant's data is isolated. |
| **Placement** | A successful candidate hire — the moment a candidate starts working at the client company. |
| **Guarantee period** | Time after placement (7-90 days) during which the agency must replace the candidate at no cost if they leave. Revenue is recognized after the guarantee is met. |
| **CURP** | Clave Unica de Registro de Poblacion — Mexico's unique population registry key. An 18-character alphanumeric identifier for every person. Used for duplicate detection. |
| **CFDI** | Comprobante Fiscal Digital por Internet — Mexico's mandatory electronic invoice format (XML signed and stamped). |
| **PAC** | Proveedor Autorizado de Certificacion — authorized third-party that stamps (timbra) CFDI invoices for the SAT. |
| **CSD** | Certificado de Sello Digital — digital signing certificate issued by SAT for CFDI. Consists of .cer (public) and .key (private) files. |
| **LFPDPPP** | Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares — Mexico's federal data protection law (equivalent to GDPR). |
| **SAT** | Servicio de Administracion Tributaria — Mexico's tax authority. |
| **RLS** | Row-Level Security — PostgreSQL feature that restricts which rows a query can see based on policies. Used for tenant isolation. |
| **FSM** | Finite State Machine — the candidate status workflow with 14 states and defined transitions. |
| **Account Executive** | The role that manages a specific client relationship. Supervises recruiters assigned to that client. Previously called "Leader" in the PoC. |
| **Freelancer** | An external recruiter (not BePro employee) who receives payment per successful placement. Flagged with `is_freelancer` on the Recruiter role. |

---

*BePro Platform Redesign — Design Spec v1.0*
