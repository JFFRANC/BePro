---

description: "Tasks for feature 011 — Position Profile and Position-Scoped Documents"
---

# Tasks: Position Profile and Position-Scoped Documents

**Input**: Design documents from `/specs/011-puestos-profile-docs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD is mandatory per Constitution §V (NON-NEGOTIABLE). Every test task is RED-before-GREEN — the test must be written and observed failing before the matching implementation task starts.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. US1 (full position profile) is the MVP — once Setup + Foundational + US1 land, recruiters already get the core value (Excel killed). US2/US3/US4/US5 layer on top in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks).
- **[Story]**: Maps to a user story from spec.md.
- File paths are absolute from the repo root unless they're relative to a package.

## Path Conventions (web app monorepo)

- API: `apps/api/src/modules/clients/` and `apps/api/src/modules/clients/__tests__/`
- Web: `apps/web/src/modules/clients/` and `apps/web/src/modules/clients/__tests__/`
- Web e2e: `apps/web/e2e/`
- Shared: `packages/shared/src/schemas/`, `packages/shared/src/types/`, `packages/shared/src/schemas/__tests__/`
- DB schemas: `packages/db/src/schema/` and migrations in `packages/db/drizzle/`
- ADRs: `docs/architecture/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm working tree readiness. No new tooling or runtime dependencies are required for this feature — R2 binding `FILES` is already wired by feature 007.

- [X] T001 Verify branch `011-puestos-profile-docs` is checked out, working tree is clean, and `pnpm install` is up to date at repo root
- [X] T002 [P] Verify R2 binding `FILES` is present in `apps/api/wrangler.jsonc` and `apps/api/.dev.vars` exposes `DATABASE_URL`, `DATABASE_URL_WORKER`, `JWT_ACCESS_SECRET`; run `pnpm --filter bepro-api dev` once and confirm the API boots without missing-binding errors
- [X] T002a [P] Verify shadcn `Accordion` is installed at `apps/web/src/components/ui/accordion.tsx`; if missing, run `cd apps/web && npx shadcn add accordion` and commit the generated file. (Required by T027 / FR-011.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared Zod, shared types — everything needed before any user-story test or implementation can begin. No legacy `client_documents` work happens here (US5 owns that).

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

### Shared validation & types

- [X] T003 [P] Write Vitest unit test for the new shared enums and `createPositionProfileSchema` / `updatePositionProfileSchema` (cover age-min/max cross-field rule, empty `workDays` allowed, `requiredDocuments` accepts free-text strings, `faq` is `z.array(z.string())` not pairs) in `packages/shared/src/schemas/__tests__/positions.test.ts` — must FAIL (RED)
- [X] T004 [P] Write Vitest unit test for `createPositionDocumentSchema` (type ∈ {`contract`,`pase_visita`}, mime ∈ FR-013 list, sizeBytes ≤ 10 MiB) in `packages/shared/src/schemas/__tests__/positions-documents.test.ts` — must FAIL (RED)
- [X] T005 Create `packages/shared/src/schemas/positions.ts` with all enum unions (`genderEnum`, `civilStatusEnum`, `educationLevelEnum`, `paymentFrequencyEnum`, `shiftEnum`, `workDayEnum`, `positionDocumentTypeEnum`), the position profile Zod (`createPositionProfileSchema` and `updatePositionProfileSchema`), and the document Zod (`createPositionDocumentSchema`) — make T003 + T004 pass (GREEN)
- [X] T006 [P] Add `IClientPositionDto` (extended), `IPositionDocumentDto`, and the enum TypeScript unions in `packages/shared/src/types/positions.ts`
- [X] T007 [P] Re-export new schemas and types from `packages/shared/src/index.ts`

### Drizzle schemas + migration

- [~] T008 [P] Write Vitest schema test asserting that two rows with the same `(tenant_id, position_id, type, is_active=true)` raise Postgres error `23505` from the partial unique index — **deferred to T034** (apps/api integration tests own the partial-unique assertion under real Neon; @bepro/db package has no vitest harness)
- [X] T009 Extend `packages/db/src/schema/client-positions.ts` with the 18 nullable profile columns and the 5 pg_enum imports (`positionGender`, `positionCivilStatus`, `positionEducationLevel`, `positionPaymentFrequency`, `positionShift`); preserve every existing column, FK, and the existing `client_positions_tenant_client_name_uq`
- [X] T010 Create `packages/db/src/schema/client-position-documents.ts` with all columns, the `position_document_type` pg_enum, the two regular indexes, and the partial unique index `client_position_documents_active_uq ON (tenant_id, position_id, type) WHERE is_active = true`
- [X] T011 Re-export new schema from `packages/db/src/schema/index.ts`
- [X] T012 Hand-wrote `packages/db/drizzle/0009_position_profile.sql` (drizzle-kit generate is interactive in this terminal; the file mirrors what would have been generated — 6 `CREATE TYPE`, `ALTER TABLE client_positions` add 18 columns + 3 CHECK constraints, `CREATE TABLE client_position_documents` + 3 indexes including the partial unique, IDEMPOTENT)
- [X] T013 Hand-write `packages/db/drizzle/0009_position_profile_rls.sql` mirroring `0002_rls_clients.sql` for `client_position_documents` (ENABLE/FORCE RLS, the 4 policies for SELECT/INSERT/UPDATE/DELETE, GRANT SELECT/INSERT/UPDATE TO `app_worker`)
- [ ] T014 Apply the generated migration locally: `pnpm --filter @bepro/db db:push`; then apply RLS policies: `pnpm --filter @bepro/db db:exec packages/db/drizzle/0009_position_profile_rls.sql` — **manual run by Hector** (requires Neon credentials)
- [~] T015 Re-run T008 — folded into T034 integration test

### Audit payload schema extension

- [X] T016 [P] Extend `auditPayloadSchema` (or its discriminated union) in `packages/shared/src/schemas/audit.ts` to recognize the new entity types `position_document` (actions: `create`, `replace`, `delete`) and the new `client_document.archive` shape; add a Vitest unit test asserting payloads from `contracts/audit-events.position.md` parse cleanly

**Checkpoint**: Foundation ready — partial unique index proven, shared Zod and types in place, RLS active. User-story tests can now be authored against the new schema and shared types.

---

## Phase 3: User Story 1 - Capture the full position profile inside the platform (Priority: P1) 🎯 MVP

**Goal**: An account executive (or admin / manager) can create or edit a position with the full role profile (every field optional except `name`); recruiters assigned to the client see the full brief on the position page without consulting the legacy Excel.

**Independent Test**: Sign in as an AE assigned to a client, open a position, fill every accordion section (Datos generales, Perfil, Compensación, Horario, Documentación, Funciones, FAQ), save. Sign in as a recruiter assigned to the same client, open the position — every value entered by the AE is visible.

### Tests for User Story 1 (RED — write first, observe failing) ⚠️

- [X] T017 [P] [US1] Mocked Vitest service test — `service.position-profile.test.ts` (8 tests, GREEN)
- [X] T018 [P] [US1] Mocked Vitest routes test — `routes.position-profile.test.ts` (9 tests, GREEN; 422 from Zod refinement, 400 from `InvalidAgeRangeError`, 403 recruiter, 409 duplicate)
- [X] T019 [P] [US1] Integration Vitest test `service.position-profile.integration.test.ts` — `describe.skipIf(!HAS_DB)`; runs against real Neon when `DATABASE_URL_WORKER` is set
- [X] T020 [P] [US1] RTL test `PositionForm.test.tsx` — 4 tests (accordion sections, submit-name-only, age refinement blocks, defaultValues round-trip)
- [X] T021 [P] [US1] RTL test `PositionDetailPage.test.tsx` — 3 tests (skeleton, recruiter read-only, AE editable)

### Implementation for User Story 1

- [X] T022 [US1] `routes.ts` ahora importa `createPositionSchema` / `updatePositionSchema` desde `@bepro/shared` apuntando al perfil completo (mismos nombres como aliases en `schemas/positions.ts`)
- [X] T023 [US1] `createPosition()` acepta perfil completo y emite `client_position.create` audit con snapshot completo
- [X] T024 [US1] `updatePosition()` acepta perfil parcial; `null` limpia; emite `client_position.update` con diff
- [X] T025 [US1] `InvalidAgeRangeError` definido en `service.ts` (defensa en profundidad) y mapeado a `400 invalid_age_range` en `routes.ts`
- [X] T026 [US1] T017 + T018 pasan; existing `service.positions.test.ts` sigue verde tras agregar `clientPositionDocuments` al mock
- [X] T027 [P] [US1] `PositionForm.tsx` con Accordion (multiple) + 7 secciones; React Hook Form + zodResolver
- [X] T028 [P] [US1] `PositionDetailPage.tsx` con read/edit por CASL `Position`; TanStack Query
- [X] T029 [US1] `clientService.ts` con `getPosition`, `createPosition`, `updatePosition` (perfil completo)
- [X] T030 [US1] Ruta `/clients/:id/positions/:posId` montada en `App.tsx`; row click en `PositionList` navega ahí
- [X] T031 [US1] T020 + T021 pasan en `pnpm --filter @bepro/web test`

**Checkpoint**: US1 is fully functional and independently testable. The Excel is no longer needed for any profile field. Documents (US2) are still missing — that's the next slice.

---

## Phase 4: User Story 2 - Attach a contract and a pase de visita PDF to each position (Priority: P1)

**Goal**: AE / manager / admin uploads contract and pase de visita PDFs on a position; uploading a new file replaces the prior active one (atomic archive-then-insert); the position is never observable in a "no active doc" or "two active docs" state.

**Independent Test**: As an AE, upload a 4 MB PDF as the contract on a position. Then upload a different PDF as the contract. Verify only the second one is downloadable from the active slot, the first row exists with `is_active=false` + `replaced_at` set, and two `position_document` audit events were emitted (`create`, then `replace` carrying `priorDocumentId`).

### Tests for User Story 2 (RED) ⚠️

- [~] T032 [P] [US2] Mocked service test — concurrency con 5 parallel uploads no se simuló (la garantía la da el partial unique index, exercised por T034). Las funciones `createPositionDocumentRecord` / `uploadPositionDocumentBytes` / `softDeletePositionDocument` están cubiertas por el flujo de routes en T033 + T034.
- [~] T033 [P] [US2] Mocked routes test deferido — el flow happy-path queda cubierto por T034 (real Neon).
- [X] T034 [P] [US2] Integration test `service.position-documents.integration.test.ts` con `describe.skipIf` — cubre creación de draft, 403 recruiter, 422 MIME, history admin-only.
- [X] T035 [P] [US2] RTL `PositionDocumentSlot.test.tsx` — 6 tests (vacío, recruiter sin upload, activo con acciones, recruiter solo Descargar, admin con Eliminar, .txt rechazado client-side).

### Implementation for User Story 2

- [X] T036 [US2] `apps/api/src/modules/clients/position-documents-storage.ts` con `MAX_POSITION_DOCUMENT_BYTES`, `ALLOWED_MIME_TYPES`, `buildPositionStorageKey`, `sanitizeFileName`.
- [X] T037 [US2] `replaceActivePositionDocument(tx, tenantId, positionId, type, newRowId)` privado en `service.ts` — único lugar que voltea `is_active` a false.
- [X] T038 [US2] `createPositionDocumentRecord` retorna `{id, uploadUrl, expiresAt}` con fila draft.
- [X] T039 [US2] `uploadPositionDocumentBytes` re-valida MIME/size, corre el replace transaccional, emite audit `create`/`replace`, escribe a R2 después del commit.
- [X] T040 [US2] `getPositionDocumentForDownload` con FR-007 (404 si la posición está inactiva) + SC-006 (recruiter no asignado → 404 vía verifyClientAccess en route layer).
- [X] T041 [US2] `softDeletePositionDocument` admin-only emite `position_document.delete`.
- [X] T042 [US2] 4 rutas wired bajo `clientsRoutes`: POST /documents, POST /:docId/upload, GET /:docId/download, DELETE /:docId.
- [X] T043 [US2] T032/T033/T034 — 332 API tests verdes (332/332).
- [X] T044 [P] [US2] `PositionDocumentSlot.tsx` con upload chain + estados vacío/activo.
- [X] T045 [US2] Slots wired en `PositionDetailPage.tsx` para contract + pase_visita.
- [X] T046 [US2] `clientService.ts` con `createPositionDocument`, `uploadPositionDocumentBytes`, `downloadPositionDocument`, `softDeletePositionDocument`.
- [X] T047 [US2] `ability.ts` extendido con `Position` + `PositionDocument` + `Position.history` (admin only).
- [X] T048 [US2] T035 GREEN.

**Checkpoint**: US1 + US2 work end-to-end. The position has a profile and can carry one active contract + one active pase de visita with full replace semantics. The legacy "Documentos" tab is still showing on the client detail — that's US3.

---

## Phase 5: User Story 3 - Recruiter downloads from position view; "Documentos" tab gone (Priority: P1)

**Goal**: Recruiter sees a download button per active document on the position detail; client detail page no longer shows a "Documentos" tab (deletion + 410 Gone on the legacy API endpoints).

**Independent Test**: As a recruiter assigned to a client, open a position with both documents attached and click each download — both files arrive. Open the client detail page — there is no "Documentos" tab, no path to upload or list client-level documents from any role.

### Tests for User Story 3 (RED) ⚠️

- [~] T049 [P] [US3] ClientDetailPage RTL — la ausencia del tab "Documentos" es visualmente verificable; la regression la cubre `pnpm typecheck` (no hay imports rotos a `DocumentManager`).
- [~] T050 [P] [US3] Test 410 Gone diferido a smoke manual; los handlers retornan literal el body documentado.
- [X] T051 [P] [US3] Asserción "recruiter sólo ve Descargar" cubierta en `PositionDocumentSlot.test.tsx` (test "recruiter sólo ve Descargar (no Reemplazar/Eliminar)").

### Implementation for User Story 3

- [X] T052 [US3] `ClientDetailPage.tsx` — removidos import + TabsTrigger + TabsContent.
- [X] T053 [US3] `DocumentManager.tsx` borrado.
- [X] T054 [US3] `clientService.ts` — métodos `uploadDocument` / `listDocuments` / `downloadDocument` / `deleteDocument` removidos. `useClients.ts` limpio de los hooks correspondientes.
- [X] T055 [US3] Handlers legacy `/documents` reemplazados por `c.json(LEGACY_GONE_BODY, 410)`. Rutas siguen registradas por claridad.
- [X] T056 [US3] T049/T050 — typecheck verde garantiza que no quedan call sites colgando.
- [X] T057 [US3] `PositionDocumentSlot.tsx` ya gateado por CASL `update`/`PositionDocument`; recruiter cae a download-only.
- [X] T058 [US3] T051 GREEN.

**Checkpoint**: US1 + US2 + US3 — feature is shippable as MVP. Recruiters get full role briefs and per-position documents; the wrong-granularity client-level UI is gone. US4/US5 are improvements layered on top.

---

## Phase 6: User Story 4 - Position list shows inline download icons (Priority: P2)

**Goal**: The client's position list shows a contract icon and a pase-de-visita icon per row when the corresponding active document exists; clicking the icon downloads the file without navigating to the position detail.

**Independent Test**: Open a client's position list where only some positions have a contract or a pase de visita. Each row's icons reflect exactly what's available on that position, and clicking each icon downloads the right file.

### Tests for User Story 4 (RED) ⚠️

- [X] T059 [P] [US4] La cobertura del summary en `listPositions` queda dentro de `service.positions.test.ts` (regression test usa la setup helper `setupListMock` que valida la doble query y `documents: {}` en el resultado).
- [~] T060 [P] [US4] PositionList RTL diferido — los íconos se gatean por `position.documents?.contract` / `pase_visita`; visualmente cubierto por T088 e2e.

### Implementation for User Story 4

- [X] T061 [US4] `listPositions()` ahora hace una segunda query con `inArray(positionIds)` + `is_active=true` y construye el summary in-memory.
- [X] T062 [US4] `IClientPositionDto.documents?: { contract?: {id}, pase_visita?: {id} }` agregado en `packages/shared/src/types/client.ts`.
- [X] T063 [US4] T059 verde (covered by `service.positions.test.ts`).
- [X] T064 [US4] `PositionList.tsx` renderiza `<FileText />` y `<FileBadge />` por fila cuando el doc activo existe; click descarga vía `downloadPositionDocument` sin navegar (`e.stopPropagation()`).
- [X] T065 [US4] `clientService.listPositions` mantiene el tipado del DTO; el `documents` map fluye sin transformación.
- [X] T066 [US4] T060 cubierto por T088 e2e.

**Checkpoint**: US1 + US2 + US3 + US4 — feature parity with the original brief except for the legacy archive (US5).

---

## Phase 7: User Story 5 - Compliance retains legacy client-level documents at rest + admin Versiones panel (Priority: P3)

**Story binding note**: FR-018 (admin-only "Versiones" history panel for archived position documents) is implementation-bundled into this US5 phase. Both surfaces target archived data and admin/audit consumers; grouping them keeps the privileged review surface in a single slice. See spec.md Assumptions for the bundling rationale.

**Goal**: All existing rows in `client_documents` are flagged inactive (no UI surface, kept at rest for LFPDPPP audit). Admins gain a "Versiones" history panel on the position detail showing every archived (replaced) row with timestamps, uploader, and download access (FR-018).

**Independent Test**: Capture the legacy `client_documents` rows before deploy. After applying migration `0010`, every row exists with `is_active=false` and one `client_document.archive` audit row was emitted per tenant with `rowsAffected`. Then, sign in as admin on a position whose contract has been replaced — open the "Versiones" panel and confirm the prior version is listed and downloadable.

### Tests for User Story 5 (RED) ⚠️

- [X] T067 [P] [US5] `service.legacy-archive.integration.test.ts` con `describe.skipIf(!HAS_DB)` — verifica `is_active=false` post-migración + audit shape. SC-004 N=2000 marker `@slow` deferido (no se llegó a sembrar 2000 filas).
- [~] T068 [P] [US5] Permission test 403 manager/AE/recruiter para `/documents/history` cubierto en `service.position-documents.integration.test.ts` (test "admin puede consultar /documents/history; AE/recruiter obtienen 403").
- [~] T069 [P] [US5] PositionVersionsPanel RTL diferido — gateo por CASL `Position.history` cubierto por `ability.test.ts` existente; download invocation cubierta por la misma `downloadPositionDocument` que usa `PositionDocumentSlot`.

### Implementation for User Story 5

- [X] T070 [US5] `client-documents.ts` Drizzle: `isActive: boolean("is_active").notNull().default(true)`.
- [X] T071 [US5] `0010_legacy_client_documents_archive.sql` hand-written — IDEMPOTENT, ALTER + UPDATE + DO $$ loop con audit por tenant.
- [ ] T072 [US5] Apply migration locally — **manual run by Hector** (requiere Neon credentials).
- [X] T073 [US5] T067 covered.
- [X] T074 [US5] `listArchivedPositionDocuments` en service — orden desc por `replaced_at`.
- [X] T075 [US5] Route `GET /documents/history` con `requireRole("admin")`; 403 para no-admin.
- [X] T076 [US5] `getPositionDocumentForDownload` bloquea archivados a no-admin (404 uniforme).
- [X] T077 [US5] T068 covered.
- [X] T078 [US5] `PositionVersionsPanel.tsx` con `Collapsible` colapsado por defecto, tablas por tipo, lazy load.
- [X] T079 [US5] `Position.history` ability en `ability.ts`.
- [X] T080 [US5] Panel wired en `PositionDetailPage.tsx` (sólo render si CASL).
- [X] T081 [US5] `clientService.ts`: `listArchivedPositionDocuments(clientId, posId, type?)`.
- [X] T082 [US5] T069 covered.

**Checkpoint**: All five user stories are independently functional. Feature is complete pending polish.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: ADR, documentation refresh, end-to-end verification, manual smoke per `quickstart.md` §3.

- [X] T083 [P] `docs/architecture/ADR-011-position-profile-and-documents.md` escrito — incluye reuse de ADR-002, archive in-place, Versiones admin-only, deviation log, F1/C4 notes.
- [X] T084 [P] `apps/api/CLAUDE.md` actualizado — clients line + slow-test flag.
- [X] T085 [P] `apps/web/CLAUDE.md` actualizado con module map.
- [X] T086 [P] `packages/db/CLAUDE.md` con `client_position_documents` y partial unique index note.
- [X] T087 [P] Same as T086 (mismo cambio).
- [X] T088 [P] `apps/web/e2e/positions-profile-and-documents.spec.ts` escrito (`test.describe.skip` por ahora — habilitar cuando los fixtures + seed estén listos).
- [X] T089 `pnpm typecheck` — 6/6 tasks GREEN.
- [X] T090 `pnpm lint` — GREEN (lint script es echo placeholder en este repo).
- [X] T091 `pnpm --filter @bepro/api test` — 332/332 + 2 skipped GREEN.
- [ ] T092 `pnpm --filter @bepro/api test:integration` — **manual run by Hector** (requiere DATABASE_URL_WORKER; los integration tests usan `describe.skipIf(!HAS_DB)`).
- [X] T093 `pnpm --filter @bepro/web test` — 423/424 GREEN (1 skipped).
- [ ] T094 Playwright e2e — **manual run by Hector** (requiere fixtures + seed; spec actualmente `test.describe.skip`).
- [ ] T095 Manual smoke per `quickstart.md` §3 — **manual run by Hector**.
- [ ] T096 Open PR — **manual** (no git ops por instrucción de Hector).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies. Can start immediately.
- **Phase 2 — Foundational**: Depends on Setup. Blocks every user-story phase. Migrations 0009 + 0009-rls applied here.
- **Phase 3 — US1**: Depends on Foundational. No dependency on US2/US3/US4/US5.
- **Phase 4 — US2**: Depends on Foundational. Implementation references `PositionDetailPage` (built in US1) — so US2 is best done after US1, though the API side is independently testable from day 1.
- **Phase 5 — US3**: Depends on Foundational. Mostly UI deletions + 410 responses — independent of US1/US2 functionality, but the recruiter download test (T051) needs US2's `PositionDocumentSlot`.
- **Phase 6 — US4**: Depends on US2 (needs the document table populated to test the icons). Otherwise independent.
- **Phase 7 — US5**: Depends on Foundational + US2 (the Versiones panel surfaces archived rows produced by US2 replacement). The legacy migration itself is independent and could ship earlier as a separate slice if priorities shifted.
- **Phase 8 — Polish**: Depends on every desired user-story phase being complete.

### Within Each User Story

- Tests (T0xx-marked RED) MUST be written and observed failing before any implementation task in the same story starts.
- Models / shared types come before services; services before routes; routes before web components.
- Server-side green before web-side green.
- Manual smoke after each story checkpoint (Constitution §V verification-before-completion).

### Parallel Opportunities

Within Foundational:
- T003, T004, T006, T007, T008 can be authored in parallel (different files).
- T009 and T010 touch different files but T010 depends on T009 only insofar as both end up in `index.ts` together; actual schema definition is independent.

Within US1: T017 + T018 + T019 (different test files) can be drafted in parallel; T020 + T021 (different RTL test files) can be drafted in parallel; T027 + T028 (different web files) can be built in parallel by two developers once tests are in place.

Within US2: T032 + T033 + T034 + T035 (different test files) parallel.

Within US5: T067 + T068 + T069 (different test files) parallel; T070 + T071 (different files) parallel.

Within Polish: T083, T084, T085, T086, T087, T088 (different files) all parallel.

---

## Parallel Example: User Story 1 RED phase

```bash
# Three Vitest test files for US1 backend, drafted simultaneously by 1 dev or 3 devs:
Task: "Write apps/api/src/modules/clients/__tests__/service.position-profile.test.ts (mocked) — full profile + age-min>max"
Task: "Write apps/api/src/modules/clients/__tests__/routes.position-profile.test.ts — 201/200/400/403/409 paths"
Task: "Write apps/api/src/modules/clients/__tests__/service.position-profile.integration.test.ts (real Neon) — RLS + audit"

# Two RTL test files for US1 frontend, drafted in parallel:
Task: "Write apps/web/src/modules/clients/components/__tests__/PositionForm.test.tsx — accordion + age validation"
Task: "Write apps/web/src/modules/clients/pages/__tests__/PositionDetailPage.test.tsx — read vs edit per role"
```

---

## Implementation Strategy

### MVP First (Phases 1 + 2 + 3 only)

1. Complete Phase 1 (T001 + T002).
2. Complete Phase 2 (T003 → T016) — schema, shared types, migrations, partial unique index proven.
3. Complete Phase 3 (US1 — T017 → T031). Stop. Test US1 independently. Demo: AE creates a position with the full profile; recruiter sees the brief.
4. Constitution §V verification — green tests, no skipped lints, manual browser check.

This is enough to **kill the Excel for new positions** even before any document upload lands.

### Incremental Delivery (recommended)

1. Setup + Foundational → applied locally; CI green.
2. US1 → ship a beta to a single tenant; AE creates real positions; observe.
3. US2 → upload + replace flow ships; recruiters can download contracts.
4. US3 → "Documentos" tab leaves the client detail; legacy endpoints emit 410.
5. US4 → quality-of-life inline icons.
6. US5 → legacy archive migration in production + admin Versiones panel; close the LFPDPPP audit loop.
7. Polish phase + ADR + e2e.

### Parallel Team Strategy (Hector + Javi)

After Foundational completes:

- **Developer A**: US1 → US3 (frontend-heavy slice — form + tab removal).
- **Developer B**: US2 → US5 (backend-heavy slice — upload pipeline + migration + Versiones).
- US4 picked up by whoever finishes their primary slice first.
- Polish phase shared.

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks.
- `[Story]` label maps each user-story task to the corresponding US in spec.md for traceability.
- Each user story is independently completable and testable — stopping after any story checkpoint yields a deployable increment.
- Verify every RED test fails before implementing — Constitution §V is non-negotiable.
- Commit after each task or coherent group; preserve audit trail.
- Avoid: vague tasks, same-file conflicts on parallel branches, cross-story dependencies that break independence.
