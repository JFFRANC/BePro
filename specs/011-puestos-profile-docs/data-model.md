# Phase 1 Data Model: Position Profile and Position-Scoped Documents

**Feature**: `011-puestos-profile-docs`
**Date**: 2026-04-30

## Entity overview

```
                ┌─────────────┐
                │   tenants   │
                └──────┬──────┘
                       │ 1:N (existing)
                       ▼
                ┌─────────────┐
                │   clients   │
                └──────┬──────┘
                       │ 1:N (existing)
                       ▼
                ┌────────────────────┐         ┌──────────────────────────────┐
                │  client_positions  │  1:N    │  client_position_documents   │
                │  (EXTENDED — full  │◄────────│  (NEW — type ∈ contract,     │
                │   profile cols)    │         │   pase_visita; is_active     │
                └─────────┬──────────┘         │   partial-unique per type)   │
                          │                    └──────────────────────────────┘
                          │
                          │ siblings on client (existing)
                          ▼
                ┌────────────────────┐
                │  client_documents  │  ◄── ALTERED: + is_active (default true,
                │  (LEGACY — kept    │       UPDATEd to false during rollout —
                │   read-only)       │       no UI surface remaining)
                └────────────────────┘

                  audit_events  (existing — unchanged schema; new entity_type
                                 and action values per research.md §R5)
```

---

## Entities

### `client_positions` — EXTENDED

Existing primary keys, FKs, and `client_positions_tenant_client_name_uq` constraint are preserved.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | existing PK |
| `tenant_id` | `uuid` | NO | — | existing FK → `tenants.id`, RLS key |
| `client_id` | `uuid` | NO | — | existing FK → `clients.id` |
| `name` | `varchar(200)` | NO | — | existing; **only required field** (FR-002) |
| `is_active` | `boolean` | NO | `true` | existing soft-delete flag |
| `created_at` | `timestamptz` | NO | `now()` | existing |
| `updated_at` | `timestamptz` | NO | `now()` | existing |
| `vacancies` | `smallint` | YES | `null` | NEW — number of positions, 1..32767 (Zod-enforced) |
| `work_location` | `varchar(500)` | YES | `null` | NEW |
| `age_min` | `smallint` | YES | `null` | NEW — 0..120 |
| `age_max` | `smallint` | YES | `null` | NEW — 0..120, must be ≥ age_min when both set |
| `gender` | `position_gender` | YES | `null` | NEW pg_enum: `'masculino' \| 'femenino' \| 'indistinto'` |
| `civil_status` | `position_civil_status` | YES | `null` | NEW pg_enum: `'soltero' \| 'casado' \| 'indistinto'` |
| `education_level` | `position_education_level` | YES | `null` | NEW pg_enum: `'ninguna' \| 'primaria' \| 'secundaria' \| 'preparatoria' \| 'tecnica' \| 'licenciatura' \| 'posgrado'` |
| `experience_text` | `text` | YES | `null` | NEW (consolidates Excel's `Años de Experiencia` + `Experiencia Requerida`) |
| `salary_amount` | `numeric(10,2)` | YES | `null` | NEW — base salary |
| `salary_currency` | `char(3)` | YES | `'MXN'` | NEW — ISO 4217 |
| `payment_frequency` | `position_payment_frequency` | YES | `null` | NEW pg_enum: `'weekly' \| 'biweekly' \| 'monthly'` |
| `salary_notes` | `text` | YES | `null` | NEW — free-text bonuses/vales/extras (Q3 hybrid) |
| `benefits` | `text` | YES | `null` | NEW — multi-line prestaciones |
| `schedule_text` | `text` | YES | `null` | NEW — prose schedule |
| `work_days` | `text[]` | YES | `null` | NEW — subset of `mon..sun`; CHECK constraint enforces members |
| `shift` | `position_shift` | YES | `null` | NEW pg_enum: `'fixed' \| 'rotating'` |
| `required_documents` | `text[]` | YES | `null` | NEW — free-text list (Q1 decision) |
| `responsibilities` | `text` | YES | `null` | NEW — funciones |
| `faq` | `text[]` | YES | `null` | NEW — flat strings, NOT q/a pairs (Q2 decision) |

**Constraints (added by migration `0009_position_profile.sql`)**:

```sql
-- Cross-field validation
ALTER TABLE client_positions
  ADD CONSTRAINT client_positions_age_range_chk
  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max);

-- Work-day vocabulary
ALTER TABLE client_positions
  ADD CONSTRAINT client_positions_work_days_chk
  CHECK (
    work_days IS NULL OR
    work_days <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']::text[]
  );

-- Vacancies positive
ALTER TABLE client_positions
  ADD CONSTRAINT client_positions_vacancies_chk
  CHECK (vacancies IS NULL OR vacancies >= 1);
```

**Indexes**: existing `client_positions_tenant_id_idx` and `client_positions_client_id_idx` are sufficient. No new indexes — profile fields are looked up by `id`, not filtered.

**RLS**: existing policy in `0002_rls_clients.sql` covers the table. No change.

---

### `client_position_documents` — NEW

Tenant-scoped, RLS-enforced, soft-delete only.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `tenant_id` | `uuid` | NO | — | FK → `tenants.id`, RLS key |
| `position_id` | `uuid` | NO | — | FK → `client_positions.id` |
| `type` | `position_document_type` | NO | — | pg_enum: `'contract' \| 'pase_visita'` |
| `original_name` | `varchar(255)` | NO | — | sanitized file name |
| `mime_type` | `varchar(100)` | NO | — | one of the FR-013 allowed list |
| `size_bytes` | `integer` | NO | — | ≤ 10 * 1024 * 1024 |
| `storage_key` | `varchar(500)` | NO | — | `tenants/{tenantId}/positions/{positionId}/documents/{id}-{originalName}` |
| `uploaded_by` | `uuid` | NO | — | FK → `users.id` |
| `uploaded_at` | `timestamptz` | YES | `null` | populated only when bytes arrive (matches `candidate_attachments` pattern) |
| `replaced_at` | `timestamptz` | YES | `null` | set when superseded; `NULL` for active |
| `is_active` | `boolean` | NO | `true` | soft-delete flag |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Indexes**:

```sql
CREATE INDEX client_position_documents_tenant_id_idx
  ON client_position_documents (tenant_id);

CREATE INDEX client_position_documents_position_id_idx
  ON client_position_documents (position_id);

-- The safety net: at most one active doc per (position, type) per tenant
CREATE UNIQUE INDEX client_position_documents_active_uq
  ON client_position_documents (tenant_id, position_id, type)
  WHERE is_active = true;
```

**RLS** (in `0009_position_profile_rls.sql`, mirrors `client_documents`):

```sql
ALTER TABLE client_position_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_position_documents FORCE  ROW LEVEL SECURITY;

CREATE POLICY client_position_documents_tenant_select ON client_position_documents
  FOR SELECT TO app_worker
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_position_documents_tenant_insert ON client_position_documents
  FOR INSERT TO app_worker
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_position_documents_tenant_update ON client_position_documents
  FOR UPDATE TO app_worker
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Hard-delete forbidden — soft delete only (LFPDPPP)
CREATE POLICY client_position_documents_no_delete ON client_position_documents
  FOR DELETE TO app_worker
  USING (false);

GRANT SELECT, INSERT, UPDATE ON client_position_documents TO app_worker;
```

**Lifecycle (state machine)**:

```
            ┌──────────────────┐
   POST     │  draft (row      │
   .../documents ─►│  created,       │
            │  uploaded_at=NULL,│
            │  is_active=true) │
            └────────┬─────────┘
                     │  POST .../upload (bytes) — happy path
                     ▼
            ┌──────────────────┐    POST .../upload (new file, same type)
            │     active       │ ──────────────────────────────────────────►
            │  (uploaded_at    │ ┌──────────────────┐
            │   set,           │ │ archived         │
            │   is_active=true)│ │ (is_active=false,│
            └────────┬─────────┘ │  replaced_at set,│
                     │           │  uploaded_at     │
                     │           │  preserved)      │
                     │ DELETE    └──────────────────┘
                     │ (admin)
                     ▼
            ┌──────────────────┐
            │  archived        │
            │  (replaced_at=now,
            │   no successor)  │
            └──────────────────┘
```

A row never returns from `is_active=false` to `true`. No row is ever DELETE-d (RLS + GRANT both deny it).

---

### `client_documents` — ALTERED (legacy, kept at rest)

| Column | Change | Notes |
|---|---|---|
| `is_active` | **NEW** `boolean NOT NULL DEFAULT true` | Added by migration `0010_legacy_client_documents_archive.sql`. Immediately after the column add, every existing row is `UPDATE`d to `is_active = false`. |

No other column changes. RLS remains as-is (already has tenant policies). The Drizzle schema gains the `isActive` field for TS-side consistency — useful if a future read path ever lists archived rows for audit.

---

### `audit_events` — UNCHANGED schema

The existing table absorbs new entries with these `(entity_type, action)` combinations:

| `entity_type` | `action` | New / extends? |
|---|---|---|
| `client_position` | `create`, `update`, `delete` | extends — payload now includes diffed profile fields |
| `position_document` | `create` | new |
| `position_document` | `replace` | new — `new` payload carries `priorDocumentId`, `priorReplacedAt`, `originalName`, `sizeBytes`, `type` |
| `position_document` | `delete` | new — soft-delete by admin |
| `client_document` | `archive` | new — emitted exactly once during the `0010` migration; `actor_id = 'system'` (a sentinel UUID `00000000-0000-0000-0000-000000000000`); `entity_id = NULL`; payload `{ rowsAffected }`. |

---

## Relationships

- `client_positions.client_id` → `clients.id` (existing).
- `client_position_documents.position_id` → `client_positions.id` (NEW).
- `client_position_documents.uploaded_by` → `users.id` (NEW).
- All `tenant_id` FKs reference `tenants.id` (NEW for `client_position_documents`, existing for the rest).
- Cascade behavior: `ON UPDATE NO ACTION ON DELETE NO ACTION` everywhere — soft-delete only; no FK CASCADE will ever fire.

---

## Migration sequence

| File | Type | Description |
|---|---|---|
| `0009_position_profile.sql` | Drizzle-generated DDL | `CREATE TYPE` for the 5 pg_enums, `ALTER TABLE client_positions ADD COLUMN …` for the 18 new columns, the 3 CHECK constraints, `CREATE TABLE client_position_documents`, the 3 indexes (including the partial unique). |
| `0009_position_profile_rls.sql` | Hand-written RLS | `ALTER TABLE client_position_documents ENABLE/FORCE RLS`, the 4 policies, the `GRANT` to `app_worker`. |
| `0010_legacy_client_documents_archive.sql` | Hand-written | `ALTER TABLE client_documents ADD COLUMN is_active boolean NOT NULL DEFAULT true;` then `UPDATE client_documents SET is_active = false WHERE is_active = true;` then `INSERT INTO audit_events (…) VALUES (…, 'client_document', 'archive', NULL, …, jsonb_build_object('rowsAffected', $1));` |

All three apply in `pnpm db:push` order; the first two ship together (Drizzle-generated runs first because the new table must exist before its RLS policies). Both are idempotent — re-running is a no-op.

---

## Validation rules (consolidated)

| Rule | Where enforced |
|---|---|
| `name` is required (1..200 chars) | Zod (shared) + DB NOT NULL + existing unique constraint |
| Profile fields are individually optional | Zod (shared, `nullable()` on every field) |
| `age_min ≤ age_max` when both set | Zod refinement + DB CHECK constraint |
| `vacancies ≥ 1` when set | Zod + DB CHECK constraint |
| `work_days[]` ⊆ `{mon..sun}` | Zod enum array + DB CHECK constraint |
| `salary_currency` is exactly 3 chars | Zod + char(3) |
| `salary_amount ≥ 0`, max 99,999,999.99 | Zod + numeric(10,2) |
| Document type ∈ {`contract`, `pase_visita`} | Zod + pg_enum |
| Document size ≤ 10 MB | Worker validates Content-Length / accumulated bytes; rejects 422 before R2 put |
| Document MIME ∈ FR-013 allowed list | Worker validates request `Content-Type`; rejects 422 |
| At most one active doc per (position, type) | Partial unique index — DB-level safety net, also enforced in service via the archive-then-insert transaction |
| Tenant isolation | RLS (DB) + tenant middleware (`SET LOCAL app.tenant_id`) + storage-key prefix |
| Permission to create/edit position or upload doc | `requireRole(["admin","manager","account_executive"])` + `verifyClientWriteAccess` |
| Permission to view archived versions | `requireRole(["admin"])` |

---

## Out-of-model decisions referenced

- **R2 storage key format** (research §R1) — not a DB concern but documented here so reviewers see the full data flow: `tenants/{tenantId}/positions/{positionId}/documents/{documentId}-{originalName}`.
- **Audit event payload shape** — a separate contracts file, `contracts/audit-events.position.md`, holds the per-event JSON examples.
- **Soft-deleted positions hide their documents from UI** (E-02) — enforced in the service join (`WHERE client_positions.is_active = true` on every list/detail) rather than in a DB constraint, since archived-position rows still need to be auditable.
