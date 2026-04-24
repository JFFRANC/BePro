# Data Model: Candidates Module

**Feature**: 007-candidates-module
**Date**: 2026-04-21

All new tables follow BePro conventions: `id` (uuid PK), `created_at`, `updated_at`, `is_active`, plus `tenant_id` FK on every tenant-scoped table. All tenant-scoped tables have RLS `FORCE ROW LEVEL SECURITY` + tenant-filter policy per `packages/db/CLAUDE.md`.

---

## 1. `candidates`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `tenant_id` | `uuid NOT NULL` FK → `tenants.id` | RLS key |
| `client_id` | `uuid NOT NULL` FK → `clients.id` | the opportunity context (FR-010) |
| `registering_user_id` | `uuid NOT NULL` FK → `users.id` | never null; preserved on recruiter deactivation |
| `first_name` | `varchar(100) NOT NULL` | PII |
| `last_name` | `varchar(100) NOT NULL` | PII |
| `phone` | `varchar(40) NOT NULL` | raw, as typed by recruiter — PII |
| `phone_normalized` | `varchar(20) NOT NULL` | digits-only, computed on write (R2) |
| `email` | `varchar(255) NOT NULL` | PII |
| `current_position` | `varchar(200)` | |
| `source` | `varchar(100) NOT NULL` | e.g. "LinkedIn", "referral" |
| `status` | `candidate_status` enum NOT NULL default `'registered'` | see §4 |
| `additional_fields` | `jsonb NOT NULL default '{}'` | per-client form_config payload (R7) |
| `rejection_category_id` | `uuid NULL` FK → `rejection_categories.id` | populated only when `status='rejected'` |
| `decline_category_id` | `uuid NULL` FK → `decline_categories.id` | populated only when `status='declined'` |
| `privacy_notice_id` | `uuid NOT NULL` FK → `privacy_notices.id` | version acknowledged (R11) |
| `privacy_notice_acknowledged_at` | `timestamptz NOT NULL` | |
| `is_active` | `boolean NOT NULL default true` | flipped false on negative terminals (FR-038) |
| `created_at` | `timestamptz NOT NULL default now()` | |
| `updated_at` | `timestamptz NOT NULL default now()` | |

### Indexes

- `candidates_tenant_client_status_idx` on `(tenant_id, client_id, status) WHERE is_active`
- `candidates_tenant_recruiter_idx` on `(tenant_id, registering_user_id) WHERE is_active`
- `candidates_dup_idx` on `(tenant_id, phone_normalized, client_id) WHERE is_active` — powers duplicate lookup (R2)
- `candidates_search_idx` GIN on `to_tsvector('simple', first_name || ' ' || last_name || ' ' || email || ' ' || phone)` for FR-021 search
- `candidates_updated_idx` on `(tenant_id, updated_at DESC)` — powers default list order

### Validation & invariants

- When `status = 'rejected'`, `rejection_category_id` MUST be non-null.
- When `status = 'declined'`, `decline_category_id` MUST be non-null.
- When `status` reaches a negative terminal (Rejected / Declined / No Show / Discarded / Termination / Replacement), `is_active` MUST atomically become `false` (FR-038).
- When `status` reaches a positive terminal (Hired / In Guarantee / Guarantee Met), `is_active` stays `true`.
- Phone normalization is the writer's responsibility — a CHECK constraint asserts `phone_normalized ~ '^\d+$'`.

### RLS

```sql
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;
CREATE POLICY candidates_tenant_select ON candidates FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY candidates_tenant_insert ON candidates FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY candidates_tenant_update ON candidates FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
-- No DELETE policy: hard deletes forbidden (FR-003).
```

---

## 2. `candidate_attachments`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `candidate_id` | `uuid NOT NULL` FK → `candidates.id` | |
| `tenant_id` | `uuid NOT NULL` | denormalized for RLS (avoids JOIN in policy) |
| `uploader_user_id` | `uuid NOT NULL` FK → `users.id` | |
| `file_name` | `varchar(255) NOT NULL` | |
| `mime_type` | `varchar(100) NOT NULL` | whitelisted (R5) |
| `size_bytes` | `integer NOT NULL` | ≤ 10 MB (R5) |
| `storage_key` | `varchar(500) NOT NULL` | full R2 key |
| `tag` | `varchar(50)` | e.g. "cv", "cover-letter" |
| `is_obsolete` | `boolean NOT NULL default false` | FR-043 |
| `is_active` | `boolean NOT NULL default true` | never hard-deleted |
| `uploaded_at` | `timestamptz NOT NULL default now()` | |
| `created_at` | `timestamptz NOT NULL default now()` | |
| `updated_at` | `timestamptz NOT NULL default now()` | |

### Indexes

- `attachments_candidate_idx` on `(tenant_id, candidate_id) WHERE is_active AND NOT is_obsolete`

### RLS

Same pattern as `candidates`. No DELETE policy.

---

## 3. `candidate_duplicate_links`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid NOT NULL` | RLS |
| `candidate_id` | `uuid NOT NULL` FK → `candidates.id` | the newly created candidate |
| `duplicate_of_candidate_id` | `uuid NOT NULL` FK → `candidates.id` | pre-existing candidate(s) |
| `confirmed_by_user_id` | `uuid NOT NULL` FK → `users.id` | |
| `created_at` | `timestamptz NOT NULL default now()` | |

### Indexes

- `dup_links_candidate_idx` on `(tenant_id, candidate_id)`
- `dup_links_reverse_idx` on `(tenant_id, duplicate_of_candidate_id)`

Multiple duplicate matches at the same submission write multiple rows.

---

## 4. Candidate status enum + FSM

### Enum

```sql
CREATE TYPE candidate_status AS ENUM (
  'registered',
  'interview_scheduled',
  'attended',
  'pending',
  'approved',
  'hired',
  'in_guarantee',
  'guarantee_met',
  'rejected',
  'declined',
  'no_show',
  'termination',
  'discarded',
  'replacement'
);
```

> **Case mapping**: storage and the API use **lowercase snake_case** for every enum value (the strings above). The web UI maps them to TitleCase labels for display ("Registered", "Interview Scheduled", "No Show", etc.) via a single helper in `packages/shared/src/candidates/status.ts`. Spec text uses TitleCase for human readability — when in doubt, the enum value above is canonical.

### Transition matrix (from R1)

```text
Happy path:
  registered → interview_scheduled → attended → pending → approved → hired
                                                                    → in_guarantee → guarantee_met

Recovery:
  pending → interview_scheduled
  approved → pending
  approved → interview_scheduled

Negative terminals:
  interview_scheduled → rejected | no_show | discarded
  attended            → rejected | discarded
  pending             → rejected | discarded
  approved            → rejected | declined | discarded
  registered          → discarded

Post-placement (for FSM completeness; triggered by placements module):
  in_guarantee → termination
  termination  → replacement
```

Any transition outside this matrix is refused (FR-031, FR-031a).

### Role gate

| Role | Allowed actions |
|---|---|
| `recruiter` | Create (register new). **Cannot transition.** (FR-032) |
| `recruiter+freelancer` | Same as recruiter; billing flag only. |
| `account_executive` | Any legal transition **for candidates of their assigned clients** (FR-033). |
| `manager` | Any legal transition on any candidate in the tenant (FR-034). |
| `admin` | Full transitions + reactivate from terminal (edge case: candidate reactivation). |

---

## 5. `rejection_categories`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid NOT NULL` | RLS |
| `label` | `varchar(100) NOT NULL` | |
| `is_active` | `boolean NOT NULL default true` | (FR-051) |
| `created_at` | `timestamptz NOT NULL default now()` | |
| `updated_at` | `timestamptz NOT NULL default now()` | |

Unique `(tenant_id, label) WHERE is_active`.

---

## 6. `decline_categories`

Same shape as `rejection_categories`. Same uniqueness.

Seed defaults per tenant on tenant provisioning (R8).

---

## 7. `privacy_notices`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid NOT NULL` | RLS |
| `version` | `varchar(20) NOT NULL` | e.g. "2026-04" |
| `text_md` | `text NOT NULL` | LFPDPPP text; Spanish |
| `effective_from` | `timestamptz NOT NULL` | |
| `is_active` | `boolean NOT NULL default true` | only one active per tenant |
| `created_at` | `timestamptz NOT NULL default now()` | |

Unique `(tenant_id, version)`. Partial unique index on `(tenant_id) WHERE is_active` guarantees one active notice per tenant.

---

## 8. `retention_reviews`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid NOT NULL` | RLS |
| `reviewer_user_id` | `uuid NOT NULL` FK → `users.id` | |
| `reviewed_at` | `timestamptz NOT NULL default now()` | |
| `next_due_at` | `timestamptz NOT NULL` | reviewed_at + 12 months |
| `justification_text` | `text NOT NULL` | |
| `created_at` | `timestamptz NOT NULL default now()` | |

Append-only (no updates).

---

## 9. Reuse of `audit_events` (existing table)

Candidates module writes to `audit_events` per R3. No schema change. Canonical actions:

- `candidate.status.changed` — on every accepted transition
- `candidate.field.edited` — on each PII field change (one row per field)
- `candidate.created` — on initial registration (new_values includes full payload + `privacy_notice_id` + `privacy_notice_acknowledged_at`; old_values null). The privacy-acknowledgement is captured here — there is **no separate `candidate.privacy_acknowledged` event**.
- `candidate.reactivated` — on admin reactivation from a negative-terminal state (FR-038a)
- `candidate.attachment.added` — attachment lifecycle
- `candidate.attachment.obsoleted`

Append-only is enforced by DB grants — the Workers role has `INSERT` only on `audit_events` (no `UPDATE`/`DELETE`).

---

## 10. Scale + performance

- Target: 50 k candidates per tenant (FR-023), up to 10 attachments per candidate on average.
- All list queries hit composite indexes, never seq-scan.
- Full-text search column `search_tsv` auto-maintained by a trigger from name + email + phone for FR-021; GIN index for ILIKE-free performance.
- Duplicate check: B-tree `(tenant_id, phone_normalized, client_id) WHERE is_active` → O(log N).
- Pagination: keyset on `(updated_at DESC, id)` to avoid OFFSET degradation.

---

## 11. Migrations

Order:
1. `0002_candidate_enums.sql` — `candidate_status` enum.
2. `0003_candidates_tables.sql` — 7 new tables (candidates, candidate_attachments, candidate_duplicate_links, rejection_categories, decline_categories, privacy_notices, retention_reviews) + indexes.
3. `0004_candidates_rls.sql` — RLS + worker-role grants (append-only on audit_events).
4. `0005_candidates_search_trigger.sql` — `search_tsv` column + `tsvector_update_trigger`.
5. `0006_candidates_seed_categories.sql` — seed default rejection/decline categories for existing tenants.

All migrations tenant-safe: no data copy from foreign tables, no blocking lock beyond enum create.
