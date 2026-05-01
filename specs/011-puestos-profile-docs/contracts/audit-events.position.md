# Audit Events — Position & Position Documents

**Feature**: `011-puestos-profile-docs`
**Date**: 2026-04-30
**Table**: `audit_events` (existing — no schema change)

The `audit_events` columns are: `id, tenant_id, actor_id, action, entity_type, entity_id, old, new, created_at`. This contract specifies the new `(entity_type, action)` combinations introduced by this feature, plus example payloads. All payloads are JSON; the `old` and `new` columns are JSON-typed.

---

## `client_position` — extends existing entity

The `client_position` entity already emits `create / update / delete` audit events (existing position CRUD). This feature **extends the payload** to include diffed profile fields. No new actions.

### `client_position.create`

| Field | Value |
|---|---|
| `entity_type` | `client_position` |
| `action` | `create` |
| `entity_id` | new position `id` |
| `old` | `null` |
| `new` | full profile snapshot |

```json
{
  "entity_type": "client_position",
  "action": "create",
  "entity_id": "0a7b…",
  "old": null,
  "new": {
    "clientId": "8d22…",
    "name": "AYUDANTE GENERAL",
    "vacancies": 80,
    "ageMin": 18, "ageMax": 48,
    "gender": "indistinto",
    "civilStatus": "indistinto",
    "educationLevel": "primaria",
    "salaryAmount": "1951.00", "salaryCurrency": "MXN",
    "paymentFrequency": "weekly",
    "salaryNotes": "MAS $350 DE VALES DE DESPENSA…",
    "workDays": ["mon","tue","wed","thu","fri"],
    "shift": "fixed",
    "requiredDocuments": ["ACTA DE NACIMIENTO","CURP","RFC"],
    "faq": ["NO REINGRESOS","NO MENORES DE EDAD"]
  }
}
```

### `client_position.update`

Diffed payload — `old` and `new` carry only the fields that changed.

```json
{
  "entity_type": "client_position",
  "action": "update",
  "entity_id": "0a7b…",
  "old": { "salaryAmount": "1951.00", "salaryNotes": "..." },
  "new": { "salaryAmount": "2050.00", "salaryNotes": "+ vales actualizados" }
}
```

### `client_position.delete`

Existing soft-delete event; payload unchanged.

---

## `position_document` — new entity

### `position_document.create`

Emitted on the **first** active document for a `(position, type)` (no prior active row archived). Payload identifies the new active document; `old` is `null`.

```json
{
  "entity_type": "position_document",
  "action": "create",
  "entity_id": "f31e…",
  "old": null,
  "new": {
    "positionId": "0a7b…",
    "type": "contract",
    "originalName": "contrato-ayudante-general.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 412380,
    "uploadedBy": "u_admin_…"
  }
}
```

### `position_document.replace`

Emitted when an upload **supersedes** an existing active row of the same `(position, type)`. The transaction archives the prior row and inserts the new one in one go. Payload includes the prior document id so an auditor can locate the archived bytes via `GET /…/documents/history`.

```json
{
  "entity_type": "position_document",
  "action": "replace",
  "entity_id": "f31e…",
  "old": {
    "priorDocumentId": "c882…",
    "priorReplacedAt": "2026-04-30T14:22:01.123Z",
    "priorOriginalName": "contrato-ayudante-general-v1.pdf",
    "priorSizeBytes": 401020
  },
  "new": {
    "positionId": "0a7b…",
    "type": "contract",
    "originalName": "contrato-ayudante-general-v2.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 412380,
    "uploadedBy": "u_admin_…"
  }
}
```

### `position_document.delete`

Admin-only — soft-deletes the active row without inserting a successor. Used in extraordinary cases (e.g. mistaken upload that shouldn't surface even archived). The bytes remain in R2.

```json
{
  "entity_type": "position_document",
  "action": "delete",
  "entity_id": "f31e…",
  "old": {
    "positionId": "0a7b…",
    "type": "contract",
    "originalName": "contrato-ayudante-general-v2.pdf"
  },
  "new": null
}
```

---

## `client_document` — new `archive` action (one-time)

Emitted exactly once during the `0010_legacy_client_documents_archive.sql` migration. Recorded as a tenant-scoped event for **each tenant** that had at least one row affected (the migration runs the `INSERT INTO audit_events` once per `tenant_id`). The `actor_id` is the platform sentinel `00000000-0000-0000-0000-000000000000` (designated `system`) so the row is distinguishable from operator actions in audit queries.

```json
{
  "entity_type": "client_document",
  "action": "archive",
  "entity_id": null,
  "old": null,
  "new": {
    "rowsAffected": 142,
    "migrationId": "0010_legacy_client_documents_archive",
    "reason": "feature-011-rollout",
    "executedAt": "2026-05-15T03:14:22.000Z"
  }
}
```

**Note on RLS**: the migration runs as `neondb_owner` (BYPASSRLS), so the `INSERT` into `audit_events` does NOT have `app.tenant_id` set. To preserve the per-tenant scoping of the audit row, the migration query reads distinct `tenant_id` values from `client_documents` first, then inserts one row per tenant explicitly setting `tenant_id`. The migration SQL does this in a loop via `DO $$ … LOOP … $$` — see `0010_legacy_client_documents_archive.sql` for the canonical implementation.

---

## Query examples for auditors

```sql
-- All replace events for a specific position in a tenant
SELECT created_at, actor_id, old, new
FROM audit_events
WHERE tenant_id = $1
  AND entity_type = 'position_document'
  AND action = 'replace'
  AND new->>'positionId' = $2
ORDER BY created_at DESC;

-- Find every legacy archive event ever emitted (one per tenant on rollout)
SELECT tenant_id, created_at, new->>'rowsAffected' AS rows
FROM audit_events
WHERE entity_type = 'client_document'
  AND action = 'archive'
ORDER BY created_at;

-- Reconstruct the version chain for a (position, type)
WITH chain AS (
  SELECT id, created_at, new->>'priorDocumentId' AS prior_id, new
  FROM audit_events
  WHERE tenant_id = $1
    AND entity_type = 'position_document'
    AND new->>'positionId' = $2
    AND new->>'type' = $3
)
SELECT * FROM chain ORDER BY created_at;
```

---

## Verification checklist

- [ ] Every `position_document.create` row has a non-null `entity_id` matching the inserted document `id`.
- [ ] Every `position_document.replace` row has `old.priorDocumentId` referencing a previously-active document row that is now `is_active=false`.
- [ ] No `position_document.*` event has `actor_id = system`.
- [ ] The `client_document.archive` event is emitted at most once per `(tenant_id, migrationId)`.
- [ ] All four event payloads above pass the existing `auditPayloadSchema` Zod check (extended in `packages/shared/src/schemas/audit.ts` to recognize the new entity types).
