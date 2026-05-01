# Phase 0 Research: Position Profile and Position-Scoped Documents

**Feature**: `011-puestos-profile-docs`
**Date**: 2026-04-30

This document resolves every NEEDS CLARIFICATION item in the Technical Context and records the rationale + alternatives for each non-trivial design choice. The brief from the user mentioned several implementation specifics (presigned URLs, RLS shape, partial unique index, file caps). Where these align with the existing codebase they are adopted; where they diverge, the deviation is recorded here with the existing pattern as the binding constraint.

---

## R1 — R2 upload pattern: server-proxied, not presigned

**Decision**: Use the **server-proxied upload pattern from ADR-002** for position documents — `POST /…/documents` creates the record, then `POST /…/documents/:docId/upload` streams the raw bytes through the Worker via the `FILES` R2 binding. Downloads use `GET /…/documents/:docId/download`, also through the Worker. There are **no presigned R2 URLs** in this feature.

**Rationale**:
- ADR-002 (accepted 2026-04-23, feature 007) is binding for the entire platform: every binary upload goes through Workers, validated against MIME and size before any object lands in R2. Adding a parallel presigned-URL path here would split the surface, duplicate CORS/validation/audit logic, and require introducing `@aws-sdk/s3-request-presigner` (or hand-written SigV4) into the bundle for the first time.
- The candidate-attachment module (`apps/api/src/modules/candidates/storage.ts` + `service.ts`) already uses `bucket.put(key, body, opts)` and `bucket.get(key)` directly; reusing that pattern means zero new dependencies.
- The spec's FR-005 ("short-lived URL whose validity does not exceed 15 minutes; permission verified on every URL issuance") is satisfied **more strictly** by the proxy pattern than by presigned URLs: every download is gated by a fresh JWT (TTL 15–60 min per Constitution §VI), permission is re-evaluated on every request, and revocation is immediate (no signed URL exists in the wild that survives a session reset).
- E-07 (presigned URL expires before upload completes) does not apply with the proxy pattern; the analogous failure (JWT expires mid-upload) is handled by the existing refresh-token rotation. The atomic record-creation-then-byte-upload preserves the spec's intent that no orphan rows remain on a failed upload — the existing ADR-007 (orphan attachment cleanup) covers the rare case where the bytes never arrive after the row is created.

**Alternatives considered**:
- **Presigned PUT directly to R2** (the user's original brief): rejected for the reasons in ADR-002 — CORS complexity, no active validation, requires SDK or hand-written signing. Re-opening this would also reopen ADR-002 for the whole platform, which is out of scope for this feature.
- **Hybrid: presigned for upload, proxy for download**: rejected as the worst of both worlds — two code paths to maintain and only the upload side gets the (small) latency benefit.

**Implementation notes**:
- Storage key namespace: `tenants/{tenantId}/positions/{positionId}/documents/{documentId}-{originalFileName}`. The tenant prefix lets ops list a single tenant's blobs without scanning the whole bucket; the doc-id prefix makes the key unique even if the same file name is reused (no overwrites).
- Allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (FR-013).
- Size cap: 10 MB enforced *before* the body is streamed to R2 (read `Content-Length`; if missing, accumulate up to 10 MB then abort). Mirrors how the candidate attachment handler does it.
- Range/streaming reads on download follow the existing candidate-attachment pattern (`bucket.get(key)` → `c.body(obj.body, { headers: { "content-type": obj.httpMetadata?.contentType } })`).

---

## R2 — Legacy `client_documents` archive: ALTER + UPDATE in one migration

**Decision**: Add `is_active boolean NOT NULL DEFAULT true` to `client_documents` in migration `0010_legacy_client_documents_archive.sql`, then immediately `UPDATE client_documents SET is_active = false WHERE is_active = true;` in the same migration file. The migration runs once at deploy as `neondb_owner` (BYPASSRLS) so it touches every tenant's rows in a single statement. Idempotent re-runs are safe (the UPDATE is a no-op when all rows are already inactive).

**Rationale**:
- The existing `client_documents` schema (see `packages/db/src/schema/client-documents.ts`) **does not have an `is_active` column today** — it carries `created_at` only. The user's brief assumed the column existed; we need to add it as part of this feature, then flip it.
- Adding the column with `DEFAULT true` and a single subsequent `UPDATE` is faster than two-step (add nullable, backfill, set NOT NULL) because the table is small (a few thousand rows max in the largest tenant per SC-004) and the UPDATE rewrites every row anyway.
- Per E-05 / SC-004, the operation must complete in under 30 s for tenants with up to a few thousand legacy rows. A single `UPDATE … WHERE is_active = true` against a non-indexed boolean column is well within that budget for the expected scale; Neon's serverless write throughput is more than sufficient.
- Running the archive as `neondb_owner` (the migration runner) intentionally bypasses RLS — the migration is **not** a per-tenant operation; it is a global schema/data event recorded in the migration history and in the ADR. After the migration, every subsequent read of `client_documents` happens via `app_worker` under RLS as before.
- Bytes in R2 are NOT touched by this migration. The `storage_key` rows remain valid; objects remain reachable via direct R2 console / CLI for ops or a future audit retrieval. Per FR-008, this preserves the LFPDPPP-aligned at-rest record indefinitely.

**Alternatives considered**:
- **Move legacy bytes to a `legacy/` R2 prefix**: rejected — needless I/O and breaks the recoverability invariant if the move fails partway. The bytes' immutability at their original keys *is* the audit anchor.
- **DROP TABLE `client_documents`**: rejected outright by spec FR-008 / Constitution §VI (no hard delete of PII/audit data).
- **Leave the `is_active` column off and gate everything in the application layer**: rejected — every read path on `client_documents` would need a hardcoded `WHERE false` filter; messier than a single column flip and more error-prone for any future "show legacy in audit panel" feature.

**Implementation notes**:
- The Drizzle schema for `client_documents` gets an `isActive` boolean field added (with `default(true).notNull()`); after the migration runs, the application code that previously never filtered on it can be deleted along with `DocumentManager.tsx`.
- The migration file ends with `-- IDEMPOTENT: rerunning is a no-op (column add is IF NOT EXISTS, UPDATE only matches rows still active).`
- A separate ADR (`docs/architecture/ADR-011-position-profile-and-documents.md`) records the rationale for keeping the legacy table at rest.

---

## R3 — Concurrency on document replace: partial unique index + transactional archive-then-insert

**Decision**: The new table `client_position_documents` carries a **partial unique index** `client_position_documents_active_uq ON (tenant_id, position_id, type) WHERE is_active = true`. The replace flow runs inside a single `db.transaction(async tx => …)`:

1. `SET LOCAL app.tenant_id = $tenantId`
2. `UPDATE client_position_documents SET is_active = false, replaced_at = now() WHERE tenant_id = $1 AND position_id = $2 AND type = $3 AND is_active = true RETURNING id` (zero or one row).
3. `INSERT INTO client_position_documents (..., is_active = true) RETURNING …`.
4. `INSERT INTO audit_events (entity_type='position_document', action= 'create' or 'replace', ...)`.
5. R2 `bucket.put(key, body, …)` happens *after* the transaction commits — if the DB transaction fails, no bytes were written; if the R2 put fails, the inserted row is the orphan that ADR-007's cleanup sweep will eventually mop up. The position never observes "two active rows" or "active row points to bytes that never landed" because the active flag flips only in step 2/3, before the put.

**Rationale**:
- The partial unique index is the **safety net**: under E-08 (two simultaneous uploads completing near-simultaneously), exactly one transaction wins the unique-index race and the other is rejected with Postgres error 23505. The losing client retries — same flow, the row from the winning transaction is now what gets archived. The end state always has exactly one active row.
- **Note on spec wording vs implementation reality**: spec E-08 reads "exactly one active row of that type, with the other archived; no duplicate active rows". The implementation here does NOT keep the rejected row on disk — it is rolled back by the failing transaction. The "with the other archived" wording is satisfied **after the retry cycle**: the losing client's retry inserts a new row, which then archives the prior winner. The post-condition spec cares about ("exactly one active row at any time, no duplicate active rows") holds in both readings. Tests in T034 assert the post-retry steady state (1 active + ≥1 archived row visible to audit), not the in-flight micro-state.
- The order "archive then insert" inside the transaction is preferred over "insert then archive" because the partial unique index would block the insert in the latter ordering until the archive has committed; we'd be relying on row-level locks instead of transactional guarantees, which is more fragile.
- The R2 put is intentionally moved *after* commit because R2 has no transactional rollback; doing it inside the transaction would create the worst case (DB committed, R2 failed → zombie active row pointing nowhere). With the order chosen here, the worst case is "DB committed, R2 failed → orphan active row that ADR-007's cleanup will neutralize when the upload doesn't complete within the grace window".

**Alternatives considered**:
- **Advisory lock per (position_id, type)** before doing the upsert: rejected as overkill — the partial unique index already serializes the writes at the database layer, and Neon's HTTP driver has no per-request session for `pg_advisory_xact_lock` to live across.
- **CTE-style "INSERT … ON CONFLICT DO UPDATE"**: rejected — the conflict is on the partial unique, not a regular unique; ON CONFLICT against a partial index requires the same WHERE predicate on INSERT and is brittle. The two-statement form is clearer and equally safe.
- **R2 put before DB writes**: rejected — leaves bytes in R2 with no row pointing at them on a DB failure. The cleanup sweep would have to scan the bucket, which doesn't scale.

**Implementation notes**:
- Service helper `replaceActivePositionDocument(tx, tenantId, positionId, type, newRow)` encapsulates steps 2–4 and is the only place that touches the `is_active` column to maintain the invariant.
- Audit `action`: `create` for first-time upload, `replace` for supersession (carries `priorDocumentId` and `priorReplacedAt` in the `new` payload).
- Integration test exercises 5 concurrent uploads of the same `(position, type)` and asserts the final state is exactly 1 active row + 4 archived rows with strictly-monotonic `replaced_at`.

---

## R4 — Profile field shapes & enums

**Decision**: Profile field types and value sets are defined once in `packages/shared/src/schemas/positions.ts` (Zod). Database stores them as documented in `data-model.md`. The shared Zod is the only validator both the React Hook Form and the Hono route call into (FR-017).

| Field | DB type | Zod | UI control |
|---|---|---|---|
| `name` | `varchar(200) NOT NULL` (existing, unique with `client_id`) | `z.string().min(1).max(200)` | text input (required) |
| `vacancies` | `smallint` nullable | `z.number().int().min(1).max(32767).nullable()` | integer input |
| `work_location` | `varchar(500)` nullable | `z.string().max(500).nullable()` | text input |
| `age_min`, `age_max` | `smallint` nullable each | refined `z.number().int().min(0).max(120).nullable()` with cross-field `min ≤ max` | two number inputs |
| `gender` | pg_enum `position_gender('masculino','femenino','indistinto')` nullable | `z.enum(['masculino','femenino','indistinto']).nullable()` | select |
| `civil_status` | pg_enum `position_civil_status('soltero','casado','indistinto')` nullable | enum | select |
| `education_level` | pg_enum `position_education_level('ninguna','primaria','secundaria','preparatoria','tecnica','licenciatura','posgrado')` nullable | enum | select |
| `experience_text` | `text` nullable | `z.string().max(2000).nullable()` | textarea |
| `salary_amount` | `numeric(10,2)` nullable | `z.number().nonnegative().multipleOf(0.01).nullable()` | number input |
| `salary_currency` | `char(3)` nullable, default `'MXN'` | `z.string().length(3).default('MXN').nullable()` | select (MXN default) |
| `payment_frequency` | pg_enum `position_payment_frequency('weekly','biweekly','monthly')` nullable | enum | select |
| `salary_notes` | `text` nullable | `z.string().max(2000).nullable()` | textarea |
| `benefits` | `text` nullable | `z.string().max(4000).nullable()` | textarea |
| `schedule_text` | `text` nullable | `z.string().max(2000).nullable()` | textarea |
| `work_days` | `text[]` with CHECK each value ∈ `('mon','tue','wed','thu','fri','sat','sun')` | `z.array(workDayEnum).nullable()` (empty array allowed per E-04) | checkbox grid |
| `shift` | pg_enum `position_shift('fixed','rotating')` nullable | enum | select |
| `required_documents` | `text[]` nullable | `z.array(z.string().min(1).max(200)).nullable()` | tag/chip input |
| `responsibilities` | `text` nullable | `z.string().max(4000).nullable()` | textarea |
| `faq` | `text[]` nullable | `z.array(z.string().min(1).max(2000)).nullable()` (flat strings, **NOT** `{q,a}` pairs — clarified 2026-04-30) | repeatable single-line input |

**Rationale**:
- Postgres enums are preferred over CHECK constraints for the small fixed value sets (`gender`, `civil_status`, etc.) because adding a value later is a one-line `ALTER TYPE … ADD VALUE` and the type system in Drizzle gives us autocomplete on both sides. The trade-off — pg_enums are slightly more annoying to remove a value from — is acceptable since these vocabularies are stable.
- `work_days` is a `text[]` with a CHECK rather than an enum array because Postgres enum arrays compose less cleanly with Drizzle and we want the Zod array validation to be the canonical check.
- `required_documents` and `faq` are both `text[]` per the clarification session: free-text strings, no enum. Empty array is treated identically to NULL by the API ("no value yet") to keep front-end logic simple.
- `salary_amount` is `numeric(10,2)` (8 integer digits + 2 decimals → max ~99,999,999.99) which covers any plausible salary in MXN, USD, EUR. `salary_notes` is the free-text companion (Q3 hybrid decision).

**Alternatives considered**:
- **JSONB blob for the entire profile**: rejected — kills SQL filtering, breaks indexing, and forces every consumer to validate at read time.
- **`faq` as `jsonb` array of `{question, answer}` objects** (the user's original brief): rejected after the Excel analysis showed the section is a flat filter checklist. `text[]` is simpler and matches the data.
- **`work_days` as a bitfield `int`**: rejected — clever but defeats query inspectability; `WHERE 'sat' = ANY(work_days)` is more grep-able than `WHERE (work_days & 64) <> 0`.

---

## R5 — Audit event taxonomy

**Decision**: Reuse the existing `audit_events` table (no schema change) and add the following entity-type/action combinations:

| `entity_type` | `action` | When |
|---|---|---|
| `client_position` | `create` | A position is created. (Already emitted today; no change.) |
| `client_position` | `update` | Any profile field is updated. (Already emitted today; payload extended to include diffed fields.) |
| `client_position` | `delete` | Position is soft-deleted. (Already emitted; no change.) |
| `position_document` | `create` | First active document of a (position, type) is uploaded successfully. |
| `position_document` | `replace` | An upload supersedes an existing active document of the same (position, type). The `new` JSON includes `priorDocumentId`, `priorReplacedAt`, `originalName`, `sizeBytes`. |
| `position_document` | `delete` | Soft-delete (set `is_active = false`) without replacement (admin only). |
| `client_document` | `archive` | One-time entry when the legacy archive migration runs. Single row per migration, payload `{ rowsAffected }`. Emitted by the migration script as `system` actor. |

**Rationale**:
- The existing `audit_events` schema (`tenant_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `old`, `new`, `created_at`) accommodates all of these without modification. The `entity_id` field for the `client_document.archive` row is `null` (the operation is global within the tenant) — already permitted by the column nullability.
- Naming follows the existing pattern (`client_position`, `client_assignment`, etc.) — no `position_*` rename, just an additive `position_document` entity type. Anything that already filters by `entity_type LIKE 'client_%'` continues to work.

**Alternatives considered**:
- **Single `position_document` action with a `mode` payload field** (`mode='create'|'replace'|'delete'`): rejected — query patterns prefer `WHERE action = 'replace'` over `WHERE new->>'mode' = 'replace'`.
- **Separate audit table for documents**: rejected — would fragment the audit surface and complicate the future audit-query module.

---

## R6 — UI deletion of legacy DocumentManager

**Decision**: Delete `apps/web/src/modules/clients/components/DocumentManager.tsx` and the corresponding `Tabs > TabsTrigger value="documents"` + `TabsContent value="documents"` blocks in `ClientDetailPage.tsx`. Also remove the `clientService.ts` methods that targeted the now-disabled client-document endpoints from the UI surface (the API endpoints themselves stay registered but return 410 Gone — see contracts/) so any browser tab still pointing at a stale URL gets a clear signal.

**Rationale**:
- Per FR-009, no role retains a client-level document UI path. The most direct way to enforce this is deletion + an explicit 410 on the now-vestigial API routes (the alternative — silently 404 — is worse for ops since the route still exists in `routes.ts` and could be re-rendered if accidentally re-mounted).
- Recruiter, AE, manager, and admin all share the same `ClientDetailPage`, so a single removal covers every role (FR-012).

**Alternatives considered**:
- **Hide the tab via CASL ability**: rejected — the tab still ships in the JS bundle and a malicious operator could un-hide it via DevTools. Deletion is cleaner.
- **Repoint `DocumentManager` at position docs**: rejected — the position docs UX is per-position (slot per type, replace/version), not the multi-document table that `DocumentManager` exposes today; reuse would force a UI compromise that serves neither model well.

**Implementation notes**:
- Backend: keep the routes registered but return 410 for `POST/DELETE` on `client_documents` operations. `GET` returns 410 too. This is registered in the contracts file under `removed-endpoints.openapi.yaml` for completeness.
- Frontend: `clientService.ts` keeps a `getLegacyClientDocumentTombstone()` no-op that returns the empty array if any consumer tries to call it; otherwise the methods are deleted. Tests assert no consumer remains.
- `e2e/positions-profile-and-documents.spec.ts` opens `ClientDetailPage` and asserts `getByRole('tab', { name: /documentos/i })` is `null`.

---

## R7 — Versions panel authorization (admin only)

**Decision**: The "Versiones" history panel on the position detail (FR-018) is gated by `requireRole("admin")` on the API listing endpoint **and** by a CASL `Position.history` ability on the React side. Both must agree — the server is the safety net; the CASL check is for UX (not rendering the panel for non-admins).

**Rationale**:
- Constitution §VI: privileged surfaces require server-side enforcement; UI-only checks are insufficient.
- The pattern matches the user-creation modal in feature 010 (admin-only) and the form-config field editor in feature 008 (admin-only) — same recipe, same agents, same verification.

**Alternatives considered**:
- **Manager role also**: rejected — managers are a "supervise all" role per the constitution role table but cannot create users/clients; archived contracts are sensitive (may carry candidate names that have since been declined / fired). Admin-only matches the principle of least privilege chosen during /clarify.
- **Make `Versiones` a separate page `/admin/positions/:id/history`**: rejected — fewer clicks for admins to keep their existing workflow on the position detail; the panel collapses by default so it's invisible-by-design even for admins.

---

## R8 — Mobile-first form composition

**Decision**: `PositionForm.tsx` uses shadcn/ui `Accordion` (already installed; verified via `apps/web/src/components/ui/accordion.tsx` if present, otherwise added via `npx shadcn add accordion`). One `AccordionItem` per section: "Datos generales", "Perfil", "Compensación", "Horario", "Documentación requerida", "Funciones", "FAQ". Sections are collapsed-by-default on mobile, expanded-by-default on desktop. Form submit is a single button at the bottom of the accordion that submits the entire React Hook Form, so partial sections still save correctly per FR-002.

**Rationale**:
- The Excel maps cleanly onto these seven sections (one accordion = one Excel header). FR-011 explicitly demands grouped sections.
- A single submit button matches FR-002 (every field optional) — no per-section save complicates the audit (would emit one event per save instead of one event per logical edit).
- `next-themes` already drives light/dark; no new theme work.

**Alternatives considered**:
- **Multi-step wizard (one section per page)**: rejected — overkill for an edit form where AEs frequently jump between sections, and it complicates "edit one field" workflows.
- **Single long form**: rejected — too dense on mobile and the seven sections give the form a natural cognitive map.

---

## R9 — Manager mutation scope on positions (deferred clarification — resolved here)

**Decision**: For this feature, **manager has the same write access as admin and account_executive on positions and position documents** of clients in the tenant. Server-side: the role check is `requireRole(["admin","manager","account_executive"])` on the POST/PUT/DELETE position routes. The client-scoping helper (`verifyClientWriteAccess` from `clients/service.ts`) is the gate for AE-specific scoping; manager passes that gate for all clients in the tenant by current convention.

**Rationale**:
- The current `clients/routes.ts` already allows manager + admin + account_executive on the existing position CRUD; this feature inherits that behavior unchanged. Recruiter remains read-only.
- Constitution role table says manager "Supervises all teams and clients, cannot create users/clients". Positions are not clients, so the prohibition does not apply.
- Tested for completeness via routes integration tests that loop through all four roles × (create/update/delete position, upload/replace/delete document, list archived) and assert the expected 200/403/404 outcomes.

**Alternatives considered**:
- **Manager read-only on positions**: rejected — manager today edits client form_config and managers' supervision role makes them the natural escalation path when an AE is unavailable to update a position profile.
- **Manager can edit but not upload documents**: rejected — splitting permissions inside a tightly-coupled feature is unnecessary complexity; admins can revoke manager rights via a future role-management feature if needed.

---

## R10 — Position name uniqueness (already enforced)

**Decision**: Position name remains unique within `(tenant_id, client_id)` per the existing `client_positions_tenant_client_name_uq` constraint. No change for this feature.

**Rationale**: The constraint already exists in the current schema and the existing service rejects duplicates with a `POSITION_DUPLICATE` error mapped to HTTP 409 in `routes.ts`. No clarification was needed; this is recorded for completeness so anyone reading the plan sees the rule is enforced at the database, not just the application.

---

## R11 — Idempotency of the upload endpoint under retries

**Decision**: The two-step API gives the client a stable record-id before any bytes are sent: `POST /…/documents` returns `{ id, uploadUrl, expiresAt }` where `uploadUrl = /api/clients/:clientId/positions/:posId/documents/:id/upload`. Re-issuing `POST /…/documents/:id/upload` for the same `id` overwrites the same R2 key (the storage_key embeds the document `id`); the row's `is_active` and `replaced_at` are unaffected on a retry. The audit `position_document.create` (or `.replace`) event is emitted only on the first successful upload, idempotency-keyed on `(entity_id=document.id, action='create')`.

**Rationale**:
- Reusing the same `id` on retry avoids the "two records, one with bytes" pathology.
- The R2 binding's `put(key, body)` is idempotent at the object-store level (same key → object replaced); we accept this as the underlying retry semantic.
- No idempotency-key header is needed at the HTTP level; the document id IS the key.

**Alternatives considered**:
- **Append-only versions on retry**: rejected — would produce N rows on a flaky network when only one upload was intended.
- **Require an `Idempotency-Key` header**: rejected — adds protocol surface for no functional gain.

---

## Resolved unknowns checklist

| Unknown | Resolution |
|---|---|
| Upload pattern (presigned vs proxy) | R1 — proxy per ADR-002 |
| Legacy `client_documents` archive shape (column missing today) | R2 — add `is_active` column, then UPDATE all rows in same migration |
| Concurrency tie-break on simultaneous uploads | R3 — partial unique index serializes; Postgres 23505 → client retry |
| Profile field types (DDL + Zod) | R4 — single source-of-truth in `packages/shared/src/schemas/positions.ts` |
| Audit event naming for new operations | R5 — `client_position` (extended) + `position_document` + `client_document.archive` |
| Vestigial client-level document API and UI | R6 — delete UI; API returns 410 |
| Authorization for archived (replaced) doc viewer | R7 — admin only, server + CASL |
| Form composition strategy | R8 — shadcn Accordion, mobile-first, single-submit |
| Manager mutation scope | R9 — write access on par with admin and AE |
| Name uniqueness | R10 — already enforced; no change |
| Upload idempotency | R11 — two-step API with stable doc id; R2 put is idempotent at the key level |

No NEEDS CLARIFICATION items remain.
