# Implementation Plan: Candidates Module

**Branch**: `007-candidates-module` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-candidates-module/spec.md`

## Summary

Build the candidates domain module — API + web UI — for registering candidates, moving them through a 14-state FSM, attaching documents, and producing audit records compatible with the existing `audit_events` table. The module is tenant-scoped end-to-end (RLS in PostgreSQL + `SET LOCAL app.tenant_id` middleware), writes PII with zero plain-text logging, warns on duplicate `(tenant_id, normalized_phone, client_id)` without blocking, and auto-deactivates candidates that reach a negative terminal state. The clarifications session locked three business decisions: FSM negative-branch matrix (Q1), indefinite retention with annual admin review (Q2), and auto-deactivate only on negative terminals (Q3).

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode) on API and Web.
**Primary Dependencies (API)**: Hono 4.7.x on Cloudflare Workers, Drizzle ORM 0.44.x, `@neondatabase/serverless` 1.x, Zod 4.x (from `packages/shared`), R2 binding via `@cloudflare/workers-types` (presigned PUT / GET pattern), existing auth middleware from the `auth` module, CASL-compatible ability helpers from `users`.
**Primary Dependencies (Web)**: React 19.1, TanStack Query 5.91, React Hook Form 7.71 + `@hookform/resolvers`/Zod, shadcn/ui + Tailwind 4, react-router-dom 7.6, the 005 app shell, Zustand 5 for local UI state where needed.
**Storage**:
- Neon PostgreSQL via `drizzle-orm/neon-http` with transaction-scoped `SET LOCAL app.tenant_id` per existing RLS pattern (see `packages/db/CLAUDE.md`).
- Cloudflare R2 for candidate attachments. Key schema: `tenants/{tenantId}/candidates/{candidateId}/attachments/{attachmentId}/{sanitized-filename}`. Download via short-lived signed URLs issued by the API.
**Testing**: Vitest for API (unit + integration — integration tests hit a real Neon branch per existing `004-users-module` pattern) and Web (component + integration with `@testing-library/react` + MSW for API mocking). RLS isolation tests mandatory.
**Target Platform**: Web — Cloudflare Pages SPA (modern evergreen browsers). API — Cloudflare Workers edge runtime. DB — Neon Serverless Postgres (US-East per constitution).
**Project Type**: Web application with backend — monorepo modules by domain.
**Performance Goals**: Register a candidate end-to-end (form open → confirmation) under 90 s (SC-001); list + filter on 10 k active candidates under 1 s (SC-002); search one candidate among 10 k under 3 s (SC-008); duplicate check returns within 500 ms to keep the submit flow snappy.
**Constraints**:
- PII (first name, last name, phone, email, CURP, RFC) MUST NEVER appear in plain-text logs at any level — a redaction helper is required.
- Cross-tenant reads/writes MUST be impossible even if a bug slips past the application layer — RLS is the safety net, not application-level filters.
- Soft delete only; `is_active=false` flipped atomically with the transition that triggers it.
- Audit writes are append-only — DB role used by the worker MUST lack `UPDATE`/`DELETE` on `audit_events`.
- Candidate numbers can scale to 50 k rows per tenant (FR-023). Indexes must cover list filters (tenant_id + client_id + status, tenant_id + registering_user_id, tenant_id + normalized_phone + client_id).
- File size cap ≤ 10 MB per file; allowed types: PDF, DOCX, DOC, JPG, PNG, ZIP (research R5 locks this).
**Scale/Scope**: Up to 50 k active candidates per tenant, low-to-mid five-figure attachments per tenant. Single-region deployment (CF Workers auto-edge + Neon US-East).

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Multi-Tenant Isolation (NON-NEGOTIABLE) | ✅ Pass | All 7 new tables carry `tenant_id` with FK to `tenants`. RLS policies on every table. `SET LOCAL app.tenant_id` inside every request's transaction. Cross-tenant integration tests required (SC-004). |
| II. Edge-First | ✅ Pass | API in Hono on CF Workers. Web on CF Pages. R2 for files. Neon for DB. No traditional servers. |
| III. TypeScript Everywhere | ✅ Pass | Strict TS. Shared Zod schemas in `packages/shared`. Drizzle ORM types co-located with module. Comments in Spanish; identifiers English. |
| IV. Modular by Domain | ✅ Pass | New `candidates` module at `apps/api/src/modules/candidates/` and `apps/web/src/modules/candidates/`. Does NOT modify `auth`, `users`, or `clients` — consumes their public interfaces (`useAuth()`, client `form_config` JSONB, ability helpers). |
| V. Test-First (NON-NEGOTIABLE) | ✅ Pass | RED → GREEN for every FR. Integration tests on real DB for RLS + FSM + duplicate flows. `vitest` agent guidance used. |
| VI. Security by Design | ✅ Pass | No passwords (auth owns those). PII never in logs — enforced by a redaction util + test that scans log output. Signed URLs for files with 5-min TTL. CORS unchanged (already restricted). Append-only audit enforced by DB privileges. |
| VII. Best Practices via Agents | ✅ Pass | Uses `postgres-drizzle`, `drizzle-orm`, `hono`, `hono-cloudflare`, `jwt-security` (for auth integration), `tanstack-query-best-practices`, `react-vite-best-practices`, `shadcn-ui`, `owasp-security`, `vitest`, `web-design-guidelines`, `candidate-fsm-auditor`, `multi-tenancy-guardian`. |
| VIII. Spec-Driven Development | ✅ Pass | This plan follows spec → plan → tasks → implement. Spec clarified (3 questions resolved). |

**Gate verdict**: PASS — no violations. `Complexity Tracking` section omitted.

## Project Structure

### Documentation (this feature)

```text
specs/007-candidates-module/
├── plan.md              # this file
├── research.md          # Phase 0 output — 11 decisions
├── data-model.md        # Phase 1 output — 7 new tables, FSM, indexes, RLS
├── quickstart.md        # Phase 1 output — module-author recipes
├── contracts/
│   └── candidates-api.md  # Phase 1 output — HTTP contract + audit shape
├── checklists/
│   └── requirements.md  # from /speckit.specify — 16/16 pass
└── tasks.md             # next: /speckit.tasks
```

### Source Code (repository root)

```text
apps/api/src/modules/candidates/
├── routes.ts               # Hono router — endpoints from contracts/candidates-api.md
├── service.ts              # Business logic — FSM validator, duplicate detector, audit writer
├── types.ts                # Re-exports from @bepro/shared + local-only types
├── fsm.ts                  # 14-state transition matrix + per-role gate + negative-branch rules (FR-031a)
├── duplicates.ts           # Phone normalization + duplicate lookup
├── redact.ts               # PII redaction helper for logs (FR-004)
├── storage.ts              # R2 presigned URL helpers (R4)
└── __tests__/
    ├── service.test.ts     # unit tests — FSM, duplicates, redaction
    ├── routes.test.ts      # integration — HTTP surface with mocked DB
    ├── isolation.test.ts   # cross-tenant RLS verification (SC-004)
    └── audit.test.ts       # audit_events shape + append-only enforcement

apps/web/src/modules/candidates/
├── pages/
│   ├── CandidateListPage.tsx
│   ├── CandidateDetailPage.tsx
│   └── NewCandidatePage.tsx
├── components/
│   ├── CandidateForm.tsx           # dynamic fields via client.form_config
│   ├── DuplicateWarningDialog.tsx
│   ├── PrivacyNoticeCheckbox.tsx
│   ├── StatusBadge.tsx              # reuses 003-design-system badge tokens
│   ├── StatusTransitionDialog.tsx
│   ├── RejectionCategoryPicker.tsx
│   ├── AttachmentList.tsx
│   └── AttachmentUploader.tsx
├── hooks/
│   ├── useCandidates.ts             # TanStack Query list + filters
│   ├── useCandidate.ts              # single-candidate detail
│   ├── useCreateCandidate.ts        # mutation with duplicate-confirm flow
│   ├── useTransitionCandidate.ts    # FSM-aware mutation
│   └── useCandidateAttachments.ts
└── services/
    └── candidateApi.ts              # thin fetch wrappers over /api/candidates/*

packages/shared/src/candidates/
├── schemas.ts               # Zod: CandidateCore, RegisterCandidateRequest, TransitionRequest, UpdatePiiRequest, etc.
├── status.ts                # 14-state enum + transition matrix as const
├── form-config.ts           # buildDynamicSchema(formConfig) shared by API + Web (R7)
└── index.ts

packages/db/src/schema/
├── candidates.ts                    # new table
├── candidate-attachments.ts         # new table
├── candidate-duplicate-links.ts     # new table
├── rejection-categories.ts          # new table
├── decline-categories.ts            # new table
├── privacy-notices.ts               # new table
├── retention-reviews.ts             # new table
└── index.ts                         # re-exports added

packages/db/drizzle/
├── 0002_candidate_enums.sql
├── 0003_candidates_tables.sql
├── 0004_candidates_rls.sql
├── 0005_candidates_search_trigger.sql
└── 0006_candidates_seed_categories.sql
```

**Structure Decision**: Constitution-native "modules by domain". Add `candidates/` to API and Web; add 7 new DB tables; extend shared Zod schemas. No existing module is modified. Route integration: the web shell (005) already has a `/candidates` nav item — we satisfy it with the new pages; role gating (005 Phase 5) still applies at the shell level.

## Complexity Tracking

*No constitution violations — section omitted.*
