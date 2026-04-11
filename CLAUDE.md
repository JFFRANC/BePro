# BePro - Sistema de Reclutamiento y Selección de Personal

## Project Description
Multi-tenant web platform for BePro, a recruitment and staffing company.
Replaces manual processes based on Google Sheets and Google Forms.
Manages the full cycle: candidate registration, vacancy tracking, interview control,
and candidate placement at client companies.

## Tech Stack
- **Frontend:** React + Vite SPA deployed to Cloudflare Pages
- **API:** Cloudflare Workers with Hono framework (TypeScript)
- **Database:** Neon PostgreSQL (serverless) with Row-Level Security (RLS)
- **ORM:** Drizzle ORM (type-safe, schema co-located with modules)
- **Shared:** Zod validation schemas + TypeScript types in `packages/shared`
- **Storage:** Cloudflare R2 for file storage
- **Auth:** JWT (15-60 min) + refresh tokens (7 days) with rotation, issued/validated in Workers
- **Testing:** Vitest for frontend and API
- **CI/CD:** GitHub Actions — `lint → typecheck → test → deploy`
- **Deploy:** Cloudflare Pages (frontend) + Cloudflare Workers via Wrangler (API)
- **Target cost:** $0-25/month

## Repository Structure
```
bepro/
├── apps/
│   ├── web/                   # React + Vite SPA (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── modules/       # Domain modules (components, hooks, services)
│   │   │   ├── components/    # Shared UI components
│   │   │   ├── lib/           # Utilities and helpers
│   │   │   └── store/         # Global state (Zustand)
│   │   └── public/
│   └── api/                   # Cloudflare Workers + Hono
│       └── src/
│           └── modules/       # Domain modules (routes, service, types, schema)
├── packages/
│   ├── shared/                # Shared types + Zod schemas (consumed by web + api)
│   └── db/                    # Drizzle ORM schemas + migrations
├── docs/
│   ├── architecture/          # ADRs (Architecture Decision Records)
│   ├── api/                   # API endpoint documentation
│   └── modules/               # Module-level documentation
├── .specify/                  # GitHub Spec Kit (constitution, specs, plans, tasks)
├── .github/
│   └── workflows/             # GitHub Actions CI/CD
├── scripts/                   # Utility scripts (seed, migrations)
├── CLAUDE.md                  # This file (project-wide)
└── turbo.json                 # Turborepo configuration
```

Per-domain CLAUDE.md files:
- `apps/web/CLAUDE.md` — React + Vite patterns
- `apps/api/CLAUDE.md` — Hono + Workers patterns
- `packages/db/CLAUDE.md` — Drizzle + RLS patterns (created with auth module)

## Architecture
- **Pattern:** Edge-first, modular by domain, multi-tenant
- **Multi-tenancy:** `tenant_id` on every tenant-scoped table, RLS at PostgreSQL level, tenant context from JWT claims via `SET LOCAL app.tenant_id`
- **API:** RESTful with Hono on Cloudflare Workers
- **Frontend:** React SPA with client-side routing
- **Modules:** Each domain is independent — own routes, services, types, and schema
- **Module structure (API):** `modules/{name}/routes.ts`, `service.ts`, `types.ts`, `schema.ts`
- **Module structure (Frontend):** `modules/{name}/` with components, hooks, and services
- **Adding a module MUST NOT require modifying existing modules**

## Modules (implementation order)
1. `auth` — JWT login, token rotation, middleware
2. `tenants` — Tenant provisioning and isolation
3. `users` — User CRUD within tenant, role assignment
4. `clients` — Client company management
5. `candidates` — Candidate registration and tracking
6. `placements` — Candidate-to-client placement lifecycle
7. `audit` — Append-only audit trail (who/what/when/old/new)

## Roles
| Role | Access Level |
|------|-------------|
| `admin` | Full system access within tenant |
| `manager` | Supervises all teams and clients, cannot create users/clients |
| `account_executive` | Manages assigned clients only, sees only their recruiters' candidates |
| `recruiter` | Registers candidates, views only own candidates, cannot change status |
| `recruiter` + `is_freelancer: true` | Same as recruiter, flagged for payment tracking |

## Code Conventions

### General
- Code language: **English** (variables, functions, classes)
- Comments and documentation: **Spanish**
- Commits in Spanish following Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- TypeScript in strict mode (`"strict": true`) everywhere

### Frontend (React + Vite / TypeScript)
- Components: PascalCase (`CandidateCard.tsx`)
- Hooks: camelCase with `use` prefix (`useCandidates.ts`)
- Services: camelCase (`candidateService.ts`)
- Types/Interfaces: PascalCase with `I` prefix for interfaces (`ICandidate.ts`)
- Styles: Tailwind CSS with shadcn/ui components
- State: Zustand for global state, TanStack Query for server state
- Forms: React Hook Form + Zod validation

### API (Hono / TypeScript)
- Routes: camelCase (`candidates.routes.ts`)
- Services: camelCase (`candidates.service.ts`)
- Zod schemas for request/response validation (shared with frontend via `packages/shared`)
- Middleware: JWT validation, tenant resolution, rate limiting

### Database
- Tables: snake_case plural (`candidates`, `job_positions`)
- Columns: snake_case (`first_name`, `created_at`)
- All tables include: `id`, `created_at`, `updated_at`, `is_active`
- All tenant-scoped tables include: `tenant_id`
- Unique constraints: `(tenant_id, email)` on User; `(tenant_id, phone, client_id)` on Candidate
- Soft delete only (`is_active` flag) — never hard delete PII (LFPDPPP compliance)
- Drizzle ORM schemas co-located with their module in `packages/db`

### Git
- Branch flow: `feature/* → development → testing → main`
- Feature branches: `feature/descriptive-name`
- Fix branches: `fix/descriptive-name`
- PRs required for merge to main
- Direct commits to `main`, `testing`, or `development` are prohibited

## Security & Compliance
- Passwords: bcrypt with cost factor >= 12
- PII MUST NOT be logged in plain text (LFPDPPP)
- Privacy notice MUST be presented during candidate registration
- API protection: rate limiting (Cloudflare built-in), CORS restricted to known origins
- Audit trail: append-only `AuditEvent` table for every state change
- If a service requires a traditional server (e.g., CFDI processing), use Fly.io — document in an ADR

## Development Workflow
- **Spec-driven:** Constitution → Spec → Plan → Tasks → Implementation (GitHub Spec Kit)
- **TDD mandatory:** RED → GREEN → REFACTOR. No test, no merge.
- **CI pipeline:** `lint → typecheck → test → deploy` — a failing stage blocks the pipeline
- **Team:** Two developers (Hector + Javi). Both review and approve specs.

## Rules for Claude
- Do not create README.md files unless requested
- Do not add unnecessary comments to code
- Prefer simple, readable code over premature abstractions
- Always read existing files before modifying them
- Run builds/tests after significant changes
- When analyzing company Excel files, document findings in `docs/modules/`
- Consult project memory before making architecture decisions
- Constitution (`.specify/memory/constitution.md`) supersedes this file in case of conflict

## Active Technologies
- TypeScript 5.x (strict mode) + Hono 4.x (`hono/jwt`, `hono/cookie` for auth), bcryptjs 2.x (password hashing), Drizzle ORM 0.44.x, @neondatabase/serverless 1.x
- Neon PostgreSQL (serverless) via HTTP driver (`drizzle-orm/neon-http`) with batch transactions for RLS (`SET LOCAL`)
- Zod 4.x (shared validation schemas in `packages/shared`)
- TypeScript 5.8.3 (strict mode) + React 19.1, Tailwind CSS 4.1.10 (`@tailwindcss/vite`), class-variance-authority 0.7.1, lucide-react, sonner, clsx + tailwind-merge (003-design-system)
- N/A (CSS tokens only; tenant theme storage deferred to tenant module) (003-design-system)

## Recent Changes
- 002-jwt-auth-module: JWT auth with opaque refresh tokens (httpOnly cookie), tenant resolution via slug, per-account brute-force lockout, role-based middleware, RLS tenant isolation
