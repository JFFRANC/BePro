# Implementation Plan: Position Profile and Position-Scoped Documents

**Branch**: `011-puestos-profile-docs` | **Date**: 2026-04-30 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-puestos-profile-docs/spec.md`

## Summary

Extend the existing `client_positions` row from "id + name" to a full role profile (vacancies, age range, gender, civil status, education, experience, salary base + currency + frequency + free-text notes, benefits, schedule prose + structured work-days + shift, required-documentation list, responsibilities, FAQ list) — every new column nullable, no backfill. Add a new tenant-scoped table `client_position_documents` (uuid PK, tenant_id, position_id, type ∈ {`contract`, `pase_visita`}, original_name, mime_type, size_bytes, storage_key, uploaded_by, uploaded_at, replaced_at NULLABLE, is_active default true) with a **partial unique index** on `(tenant_id, position_id, type) WHERE is_active = true` so at most one active row per (position, type) is enforced at the database layer. Reuse the **server-proxied R2 upload pattern from ADR-002** (two-step: create record → POST raw bytes to `/upload`) — *not* presigned URLs — so the upload path mirrors the existing candidate-attachment flow and inherits its CORS, validation, audit, and orphan-cleanup tooling. The legacy `client_documents` table gains an `is_active` column in the same migration, then a one-shot UPDATE flips every existing row to `false` (kept at rest for LFPDPPP audit; never destroyed). Every UI surface for client-level documents is removed: the "Documentos" tab leaves `ClientDetailPage`, and `DocumentManager.tsx` is deleted along with its route. The position list and detail surface inline download icons (recruiter+) per active document type; the position detail also surfaces a `Versiones` history panel for archived rows visible **only to admins** (FR-018). All paths inherit the existing `authMiddleware + tenantMiddleware + SET LOCAL app.tenant_id` chain, so RLS on every new query is automatic.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode) across web, api, and shared packages.
**Primary Dependencies**: Hono 4.7.10 (API), Drizzle ORM 0.44 (DB), Zod 4.x (shared validation), React 19.1 + React Hook Form + `@hookform/resolvers` (forms), TanStack Query 5.91 (server state), shadcn/ui Accordion / Dialog / Select / Tabs / Badge (already installed), `lucide-react` (icons), CASL 6.x (UI ability — extended with `Position` + `PositionDocument` subjects). No new runtime dependencies. **No `@aws-sdk/*` or `aws4fetch`** — uploads use the Workers `R2Bucket` binding directly per ADR-002.
**Storage**: Neon PostgreSQL — schema delta: ALTER `client_positions` (15 nullable columns + 1 enum array + 1 jsonb-or-text-array for FAQ), CREATE `client_position_documents` (full RLS policy mirrors `client_documents`), ALTER `client_documents` ADD `is_active boolean NOT NULL DEFAULT true`, then `UPDATE client_documents SET is_active = false`. R2 bucket `FILES` (binding `bepro-files`) — already provisioned by feature 007. Storage key namespace: `tenants/{tenantId}/positions/{positionId}/documents/{docId}-{originalName}` (prefix-isolated per tenant for cheap audit listing).
**Testing**: Vitest unit (mocked Drizzle + mocked `R2Bucket`) + Vitest integration with `app_worker` Neon role (proves RLS on the new table, partial unique index behavior under concurrency, and atomic archive-on-replace) + Playwright e2e for the create-position-with-profile + upload-contract + replace-contract + download flows + the absent-Documentos-tab assertion.
**Target Platform**: Cloudflare Workers (API) + Cloudflare Pages (Web) + R2 (binary storage) + Neon (PG). Edge-first; no traditional servers added.
**Project Type**: Web application (monorepo: `apps/web`, `apps/api`, `packages/shared`, `packages/db`).
**Performance Goals**: `GET /api/clients/:id/positions/:posId` p95 ≤ 200 ms (single SELECT + LEFT JOIN against active docs); `POST /api/clients/:id/positions/:posId/documents/:docId/upload` ≤ 2 s for a 10 MB PDF on warm Worker (matches the candidate-attachment baseline); legacy archive UPDATE ≤ 30 s for ≤5,000 rows (single statement per SC-004).
**Constraints**: Worker file body cap = 100 MB but feature limit is 10 MB/file (FR-013); JWT TTL (15–60 min) bounds the effective "URL TTL" referenced in FR-005 — no separate URL signing layer is introduced (interprets "short-lived URL" as "JWT-protected endpoint URL whose access is re-verified on every call", which is stricter than presigned URLs since revocation is immediate). $0–25/month cost ceiling unchanged. No new env vars. No new wrangler bindings (R2 `FILES` already bound).
**Scale/Scope**: ~6 backend touch-points (`packages/db/src/schema/client-positions.ts`, new `packages/db/src/schema/client-position-documents.ts`, `packages/db/src/schema/client-documents.ts`, `apps/api/src/modules/clients/service.ts`, `apps/api/src/modules/clients/routes.ts`, new `apps/api/src/modules/clients/position-documents.ts` storage helper); ~5 frontend touch-points (`PositionList.tsx`, new `PositionForm.tsx`, new `PositionDetailPage.tsx`, `ClientDetailPage.tsx` to remove the tab, `clientService.ts`); 1 deletion (`DocumentManager.tsx`); 2 migrations (Drizzle-generated DDL + a hand-written legacy archive SQL). Expected position count per tenant ≤ a few hundred; documents ≤ 2 active per position.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|---|---|
| **I. Multi-Tenant Isolation (NON-NEGOTIABLE)** | ✅ The new table `client_position_documents` carries `tenant_id` and inherits the same RLS policy shape used by `client_documents` (`FORCE ROW LEVEL SECURITY`, `app_worker` USING/WITH CHECK on `current_setting('app.tenant_id', true)::uuid`, DELETE denied). All new endpoints sit under the existing `clients/routes.ts` Hono app, which already runs `authMiddleware + tenantMiddleware` (sets `SET LOCAL app.tenant_id` per request inside the transaction). Integration test will assert: (a) cross-tenant `positionId` returns 404 indistinguishable from "not found"; (b) cross-tenant `documentId` cannot be downloaded; (c) the legacy archive SQL touches only the current tenant's rows when run via `app_worker` (it is run as `neondb_owner` during migration, intentionally — documented in research §R2). |
| **II. Edge-First** | ✅ No new server-side runtime. Uploads use the existing `R2Bucket` binding (no SDK dependencies). Wrangler config unchanged — `FILES` is already bound. |
| **III. TypeScript Everywhere** | ✅ Profile field types and value sets defined once in `packages/shared/src/schemas/positions.ts` (Zod) and reused on both sides via `IClientPositionDto` (FR-017). All enums (`gender`, `civil_status`, `education_level`, `payment_frequency`, `shift`, `work_day`, `document_type`) live in shared. Code English, comments Spanish, commits Conventional. |
| **IV. Modular by Domain** | ✅ All new code lives in the `clients` module (api + web). Position documents are a sub-resource of clients, mirroring how `client_documents` was organized — adding the new sub-resource does **not** require modifying any other module. The candidates module's `storage.ts` pattern is *referenced* (research §R1) but not imported — `clients/position-documents-storage.ts` is its own scope. |
| **V. Test-First (NON-NEGOTIABLE)** | ✅ TDD per US in tasks.md. RED tests written first per US1 (profile create/edit), US2 (upload + replace + size/MIME validation), US3 (recruiter download + Documentos tab gone), US4 (inline icons), US5 (legacy archive idempotence). Integration tests run against `app_worker` Neon role to prove RLS + partial unique index + atomic archive-on-replace. Vitest integration covers the upload happy path with a mocked `R2Bucket` (writing actual bytes to a Map in memory) and unit tests cover validation/permissions. Playwright e2e at the end. |
| **VI. Security by Design** | ✅ MIME and size validation happens in the Worker before bytes touch R2 (ADR-002 pattern). Soft-delete only — `is_active=false` and `replaced_at` markers; no hard delete of any document, ever. Tenant isolation by RLS + storage-key prefix; cross-tenant download attempt returns 404. Admin-only `Versiones` panel for archived rows (FR-018) — server-side `requireRole("admin")` enforced on the listing endpoint, not just CASL. PII (uploader id, file names) not logged in plain text — the audit pipeline already redacts. LFPDPPP retention preserved via FR-008 (legacy `is_active=false`, never deleted). |
| **VII. Best Practices via Agents** | ✅ Skills used: postgres-drizzle, drizzle-orm, hono, hono-cloudflare, shadcn-ui, react-hook-form, zod, tanstack-query-best-practices, react-vite-best-practices, vitest, superpowers:test-driven-development, superpowers:verification-before-completion, owasp-security. Agents: db-architect (schema + migration + partial unique index + RLS policy), senior-backend-engineer (endpoints + R2 proxy + transactional replace), senior-frontend-engineer (multi-section form + position detail + tab removal), multi-tenancy-guardian (RLS + cross-tenant isolation tests). |
| **VIII. Spec-Driven Development** | ✅ Spec (post-clarify) → this plan → tasks (next). Constitution v1.0.2 acknowledged; no amendments needed. |

**Result**: All gates pass. No violations to track in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/011-puestos-profile-docs/
├── plan.md              # This file
├── spec.md              # Feature specification (post-clarify)
├── research.md          # Phase 0 output (this run)
├── data-model.md        # Phase 1 output (this run)
├── quickstart.md        # Phase 1 output (this run)
├── contracts/           # Phase 1 output (this run)
│   ├── position-profile.openapi.yaml
│   ├── position-documents.openapi.yaml
│   └── audit-events.position.md
├── checklists/
│   └── requirements.md  # Spec quality + clarification log
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/db/src/schema/
├── client-positions.ts                    # EXTENDED — 15+ nullable profile columns + enums
├── client-position-documents.ts           # NEW — table + partial unique index + indexes
└── client-documents.ts                    # ALTERED — add is_active boolean (legacy archive flag)

packages/db/drizzle/
├── 0009_position_profile.sql              # NEW — Drizzle-generated ALTER on client_positions + CREATE on client_position_documents + new pg_enums (gender, civil_status, education_level, payment_frequency, shift)
├── 0009_position_profile_rls.sql          # NEW — hand-written RLS for client_position_documents (mirrors 0002_rls_clients.sql shape)
└── 0010_legacy_client_documents_archive.sql  # NEW — ALTER client_documents ADD is_active + UPDATE … SET is_active = false

packages/shared/src/schemas/
└── positions.ts                           # NEW — Zod schemas for profile fields, document types, work-day enum (consumed by web + api)

packages/shared/src/types/
└── positions.ts                           # NEW — IClientPositionDto extended, IPositionDocumentDto, enum unions

apps/api/src/modules/clients/
├── routes.ts                              # EXTENDED — new sub-routes under /:clientId/positions/:posId/documents{,/:docId/{upload,download,history}}
├── service.ts                             # EXTENDED — createPosition/updatePosition accept the full profile; new createPositionDocument, uploadPositionDocumentBytes, getPositionDocumentForDownload, listArchivedPositionDocuments, deletePositionDocument
├── position-documents-storage.ts          # NEW — buildPositionStorageKey, MIME + size validation constants (no R2 SDK)
└── __tests__/
    ├── service.position-profile.test.ts             # NEW — MOCKED — profile validation, partial save, age-min>max rejection
    ├── service.position-documents.test.ts           # NEW — MOCKED — upload, replace transaction, MIME/size rejection
    ├── service.position-documents.integration.test.ts  # NEW — REAL Neon — RLS, partial unique index, cross-tenant 404, atomic replace
    ├── routes.position-documents.test.ts            # NEW — MOCKED — admin-only Versiones, recruiter download, AE upload
    └── service.legacy-archive.integration.test.ts   # NEW — REAL Neon — legacy archive UPDATE idempotence + RLS scope

apps/web/src/modules/clients/
├── components/
│   ├── PositionList.tsx                   # EXTENDED — inline contract & pase_visita download icons per row, behind FR-007/E-02 gating
│   ├── PositionForm.tsx                   # NEW — accordion (Datos generales, Perfil, Compensación, Horario, Documentación, Funciones, FAQ); React Hook Form + Zod from shared
│   ├── PositionDocumentSlot.tsx           # NEW — single doc-type slot (active card, upload, replace, delete, download)
│   ├── PositionVersionsPanel.tsx          # NEW — admin-only archived-history panel; uses CASL `Position.history`
│   └── DocumentManager.tsx                # DELETED
├── pages/
│   ├── ClientDetailPage.tsx               # ALTERED — remove "Documentos" tab + import + route
│   └── PositionDetailPage.tsx             # NEW — profile (read for recruiter, edit for AE+) + document slots + (admin) Versiones panel
├── services/
│   └── clientService.ts                   # EXTENDED — createPositionDocument, uploadPositionDocumentBytes, downloadPositionDocument, listArchivedPositionDocuments
└── __tests__/
    ├── PositionForm.test.tsx              # NEW — RTL — accordion sections, age-min>max client-side block, partial save
    ├── PositionList.test.tsx              # NEW — RTL — icons appear iff active doc of type exists
    ├── PositionDetailPage.test.tsx        # NEW — RTL — admin sees Versiones, others don't; replace flow
    └── ClientDetailPage.test.tsx          # EXTENDED — assert "Documentos" tab is absent for every role

apps/web/src/lib/
└── ability.ts                             # EXTENDED — add Position + PositionDocument subjects, admin gets `manage Position.history`

apps/web/e2e/
└── positions-profile-and-documents.spec.ts  # NEW — Playwright — full profile create + upload contract + upload pase + replace contract + download both + assert Documentos tab gone

docs/architecture/
└── ADR-011-position-profile-and-documents.md  # NEW — records: (a) reuse of ADR-002 proxy upload, (b) legacy client_documents in-place archive, (c) admin-only Versiones panel
```

**Structure Decision**: Web application monorepo (option 2). All new files cluster inside the existing `clients` module on both api and web — no new module is introduced because positions are a long-standing sub-resource of clients. Schema lives in `packages/db` per Drizzle convention. Shared validation in `packages/shared/src/schemas/positions.ts` is the single source of truth (FR-017). The legacy `client_documents` archive is an ALTER + UPDATE in a separate migration file (0010) so it ships independently of the schema change for `client_position_documents` — easier to review, easier to roll back surgically if needed.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
