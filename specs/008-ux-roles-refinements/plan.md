# Implementation Plan: UX, Role Scoping, and Configurability Refinements

**Branch**: `008-ux-roles-refinements` | **Date**: 2026-04-23 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-ux-roles-refinements/spec.md`

## Summary

A cross-module UX and scoping refinement pass. Delivers:

1. **Header identity & session control** — user avatar menu with display name and "Cerrar sesión".
2. **Recruiter-only candidate creation** — API 403 gate for non-recruiters + UI hides entry points.
3. **Inline status transition on the candidate list** — per-row dropdown grouped by category, filtered by FSM validity and role authorization, optimistic update + audit event.
4. **Spanish labels on candidate dropdowns** — central `CANDIDATE_STATUS_LABELS_ES` map + fallback guard for category enums.
5. **Multi-select AE↔client assignment** — checkbox table, batch save (transactional diff add/remove).
6. **Admin-managed custom `formConfig` fields** — editor for arbitrary primitive fields (text/number/date/checkbox/select), archive-on-remove for historical preservation.
7. **Privacy-notice removal from UI** — checkbox gone, API accepts missing `privacy_notice_id`, historical rows kept read-only in DB (no reads/writes from the UI).
8. **Login simplification** — tenant/organization field hidden behind a build-time config flag defaulting to `bepro`.

Technical approach: purely incremental on the existing stack. No new packages, no new services. The only wire-level changes are (a) one new batch endpoint for assignments, (b) one new POST/PATCH for formConfig `fields` array entries, (c) loosening the create-candidate schema to make `privacy_notice_id` optional, (d) role-guard middleware on `POST /api/candidates`. Everything else is UI composition on top of shipped APIs.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode) across frontend, API, and shared packages.
**Primary Dependencies**:
- API: Hono 4.7, Drizzle ORM 0.44, `@neondatabase/serverless` 1.x, `hono/jwt`
- Web: React 19.1, Vite 6.3, TanStack Query 5.91, Zustand 5.0, React Hook Form 7.71, Zod 4.3, shadcn/ui + Tailwind 4.1, `@casl/ability` 6.8 (role gating), `lucide-react`, `sonner` (toasts)
- Shared: Zod 4.3 schemas in `@bepro/shared`

**Storage**: Neon PostgreSQL with RLS. No new tables. Existing tables touched: `candidates` (relax `privacy_notice_id` to nullable/optional at API layer only — **no migration**, the column stays), `clients.form_config` JSONB gets new keys under its existing shape, `client_assignments` receives batch diffs.

**Testing**: Vitest for unit + integration on both web and api. Playwright E2E for the most valuable flows (inline transition, multi-assign). RLS integration via the existing `app_worker` harness.

**Target Platform**: Cloudflare Workers (API), Cloudflare Pages (Web), Chromium/Safari/Firefox evergreens.

**Project Type**: Multi-tenant web app — Turborepo monorepo with `apps/web`, `apps/api`, `packages/shared`, `packages/db`.

**Performance Goals**:
- Inline status transition end-to-end (click → next status committed) ≤ 500 ms p95 on an average tenant list (200 candidates rendered).
- Multi-assign batch save ≤ 300 ms p95 for 50 row diffs.
- No regression on existing candidate list render budget (≤ 150 ms p95 at 100 rows per 007 baseline; SC-001 measures inline transition at 200 rows per spec.md).

**Constraints**:
- No new paid dependency. Must fit existing $0–25/month cost envelope.
- Privacy-notice changes MUST preserve historical data at rest (LFPDPPP evidentiary value).
- No new migrations unless unavoidable — this feature aims to be a migration-free delta.

**Scale/Scope**:
- 1 tenant operational today (`bepro`); schema already multi-tenant.
- 8 stories, 37 functional requirements, 8 success criteria.
- Affects 4 packages: `apps/web`, `apps/api`, `packages/shared`, `packages/db` (schema TS types only, no SQL).

## Constitution Check

*Gate: Must pass before Phase 0 research. Re-evaluated after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Multi-Tenant Isolation (NON-NEGOTIABLE) | PASS | No schema changes that bypass RLS. Batch-assignment endpoint still goes through tenant-scoped transaction with `SET LOCAL app.tenant_id`. |
| II. Edge-First | PASS | All work runs on existing Workers + Neon + Pages topology. No new service introduced. |
| III. TypeScript Everywhere | PASS | All new code is TypeScript strict. Spanish label map lives in `@bepro/shared` alongside existing enum. |
| IV. Modular by Domain | PASS | Changes scoped per module: `header` (shell), `candidates` (gating + inline transition + labels), `clients` (assignment + form-config editor), `auth` (login field). No module reaches into another's internals. |
| V. Test-First (NON-NEGOTIABLE) | PASS (planned) | Every FR gets a failing test first. See quickstart.md "Test plan" section. RLS integration harness from 007 is reused. |
| VI. Security by Design | PASS | Satisfied via constitution amendment v1.0.2 (2026-04-23) — see changelog. The §VI clause now states that privacy-notice evidence is captured per LFPDPPP, with recruiter-driven registrations collecting it offline and historical rows preserved read-only at rest. |
| VII. Best Practices via Agents | PASS | Each change routes to a matching skill: `shadcn-ui` for UserMenu/checkbox-table, `tanstack-query-best-practices` for optimistic transitions, `zod` for formConfig runtime validation, `owasp-security` / `jwt-security` for logout token revocation. |
| VIII. Spec-Driven Development | PASS | Spec is approved (spec.md, zero NEEDS CLARIFICATION); this plan is the required next artifact before tasks and implementation. |

**Gate result**: PASS — no tracked violations. The Principle VI amendment is staged in the constitution at v1.0.2; its PR approval handshake is tracked in tasks.md T096.

## Project Structure

### Documentation (this feature)

```text
specs/008-ux-roles-refinements/
├── spec.md                 # Completed
├── plan.md                 # This file
├── research.md             # Phase 0 output
├── data-model.md           # Phase 1 output
├── quickstart.md           # Phase 1 output
├── contracts/              # Phase 1 output
│   ├── clients-assignments-batch.md
│   ├── clients-form-config-fields.md
│   ├── candidates-create-gating.md
│   └── candidates-transition-inline.md
├── checklists/
│   └── requirements.md     # Completed
└── tasks.md                # /speckit.tasks output (not created here)
```

### Source Code (repository root)

```text
apps/
├── web/                                   # React + Vite SPA
│   └── src/
│       ├── components/
│       │   └── layout/
│       │       ├── Header.tsx             # EDIT — mount UserMenu
│       │       └── UserMenu.tsx           # NEW — avatar + dropdown + logout
│       └── modules/
│           ├── auth/
│           │   └── components/
│           │       └── LoginForm.tsx      # EDIT — hide tenant field via config
│           ├── candidates/
│           │   ├── components/
│           │   │   ├── InlineStatusMenu.tsx         # NEW
│           │   │   └── CategoryLabel.tsx            # NEW (Spanish label resolver)
│           │   ├── hooks/
│           │   │   └── useTransitionCandidate.ts    # NEW (optimistic)
│           │   └── pages/
│           │       ├── CandidateListPage.tsx        # EDIT — add action column
│           │       └── NewCandidatePage.tsx         # EDIT — remove privacy checkbox
│           └── clients/
│               ├── components/
│               │   ├── AssignmentTable.tsx          # NEW — checkbox table
│               │   └── FormConfigFieldsEditor.tsx   # NEW — custom fields CRUD
│               └── pages/
│                   └── ClientDetailPage.tsx         # EDIT — swap AssignmentManager
│
├── api/                                   # Hono on Workers
│   └── src/
│       └── modules/
│           ├── candidates/
│           │   ├── routes.ts              # EDIT — add requireRole recruiter gate
│           │   └── service.ts             # EDIT — accept optional privacyNoticeId
│           └── clients/
│               ├── routes.ts              # EDIT — batch-assign + form-config/fields endpoints
│               └── service.ts             # EDIT — batch diff, form-config mutations
│
└── packages/
    ├── shared/
    │   └── src/
    │       ├── candidates/
    │       │   ├── status.ts              # EDIT — add CANDIDATE_STATUS_LABELS_ES
    │       │   ├── schemas.ts             # EDIT — privacy_notice_id optional
    │       │   └── form-config.ts         # EDIT — widen FormFieldConfig (no schema break)
    │       └── clients/
    │           └── schemas.ts             # EDIT — batchAssignmentsSchema, formConfigFieldSchema
    └── db/
        └── src/schema/
            (no changes — form_config is JSONB; client_assignments schema unchanged)
```

> Note: `packages/shared/src/` has two parallel conventions (pre-dating this feature): domain folders (`candidates/`, `clients/`) and a flat `schemas/` folder holding cross-domain Zod schemas used by the API (`auth.ts`, `candidate.ts`, `client.ts`, `users.ts`). This feature writes to both as listed above; no unification is attempted here.

**Structure Decision**: Reuse the existing modules-by-domain layout. Each change lands in the module it belongs to with no cross-module imports beyond `@bepro/shared`. No new packages, no new apps.

## Complexity Tracking

No active violations. The §VI constraint that drove the prior tracked violation has been rephrased in the constitution via a PATCH amendment.

| Historical violation | Resolution |
|----------------------|------------|
| Privacy notice removed from candidate registration UI (previously conflicted with constitution §VI "Privacy notice MUST be presented during candidate registration") | RESOLVED by constitution amendment v1.0.2 (2026-04-23). §VI now reads: "Privacy-notice evidence MUST be captured per LFPDPPP for every registered candidate. For recruiter-driven registrations, evidence is collected offline by the recruiter and retained outside the candidate-create API flow; historical database rows for prior in-product acknowledgements MUST be preserved read-only at rest." |

**Remaining follow-up**: the v1.0.2 amendment is staged in `.specify/memory/constitution.md`. Per §Governance, both developers must review/approve via PR before the feature PR merges — tracked in tasks.md T096.

## Phase 0 — Outline & Research

See [research.md](./research.md).

Unknowns from Technical Context are zero at the functional level (spec has no NEEDS CLARIFICATION left). Research focuses on *how*, not *what*:

1. UserMenu composition using shipped shadcn primitives + `@casl/ability` gating.
2. Optimistic status transition with TanStack Query — cache key, rollback, toast pattern.
3. Hidden-but-preserved tenant field on login — config strategy that survives future re-enable without schema churn.
4. Batch assignment semantics — add/remove diff in one Drizzle transaction under RLS.
5. formConfig `fields` JSONB mutations — concurrency, Zod runtime validation.
6. Spanish label authority — where does it live, and what to do with missing tokens at runtime.
7. Privacy-notice UI removal without dropping data — dead-code removal plan + regression test.

## Phase 1 — Design & Contracts

See [data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md).

**Agent context update**: run `.specify/scripts/bash/update-agent-context.sh claude` at the end of Phase 1 to register no new technologies (all dependencies already registered from 003/004/005/006/007).

## Post-Design Constitution Re-Check

PASS — no violations (Principle VI satisfied via constitution amendment v1.0.2). No new violations introduced by the data-model or contracts (both deltas stay on the existing tables/endpoints; assignment batch is additive, form-config mutations stay within the existing JSONB shape, role gate is a middleware-only addition).
