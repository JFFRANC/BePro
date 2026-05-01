# Phase 1 — Data Model: Client Detail UX + Contact Cargo + Candidate Base-Form

**Date**: 2026-05-01
**Status**: Complete

This document captures the schema deltas (DB columns + JSONB shapes), validation rules, and audit envelopes for feature 012. Two thin ALTER statements; no new tables; no new RLS policies; no FK additions.

---

## DB schema deltas

### `clients` — add `description`

```sql
ALTER TABLE clients
  ADD COLUMN description text NULL,
  ADD CONSTRAINT clients_description_max_length
    CHECK (description IS NULL OR char_length(description) <= 2000);
```

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `description` | `text` | YES | NULL | Plain text. CHECK enforces ≤ 2,000 chars at the DB level (defense in depth alongside Zod). |

**RLS**: inherits the existing `clients_tenant_select / _insert / _update` policies from `0002_rls_clients.sql`. No additional policy.

**Drizzle update** (`packages/db/src/schema/clients.ts`):

```ts
description: text("description"),
```

(no `.notNull()`, no `.$default(…)`)

---

### `client_contacts` — add `position`

```sql
ALTER TABLE client_contacts
  ADD COLUMN position varchar(120) NULL;
```

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `position` | `varchar(120)` | YES | NULL | Free-text role / cargo. Empty string is normalized to NULL by the API (E-08). |

**RLS**: inherits existing `client_contacts_*` policies from `0002_rls_clients.sql`. No additional policy.

**Drizzle update** (`packages/db/src/schema/client-contacts.ts`):

```ts
position: varchar("position", { length: 120 }),
```

> **Pre-existing tech debt note**: `client_contacts` does not have an `is_active` column (the constitution's table convention says it should). This is out of scope for 012 and noted here so future work can address it without surprise.

---

### Migration file

Path: `packages/db/drizzle/0011_client_description_contact_position.sql`

```sql
-- 012-client-detail-ux — adds clients.description (text, ≤2000) and
-- client_contacts.position (varchar(120)). No data backfill: existing rows
-- get NULL and the UI handles that gracefully (E-01, E-03).

ALTER TABLE clients
  ADD COLUMN description text NULL;

ALTER TABLE clients
  ADD CONSTRAINT clients_description_max_length
  CHECK (description IS NULL OR char_length(description) <= 2000);

ALTER TABLE client_contacts
  ADD COLUMN position varchar(120) NULL;
```

Generated, **not** pushed via `db:push` (per `feedback_db_push_safety` memory: never `db:push` against a Neon DB with hand-written RLS/triggers; use `db:exec` to apply this single SQL file).

---

## JSONB shape: `candidates.additional_fields` (existing column, new contract)

`candidates.additional_fields jsonb NOT NULL DEFAULT '{}'` already exists. Feature 012 establishes a hard contract that the nine BASE_CANDIDATE_FIELDS keys MUST be present in every newly-created candidate's record. Existing candidates are not retroactively updated (the migration script in research.md R-05 only touches `legacy_<key>` collisions, never inserts new base values).

### Frozen base-field shape (exported from `packages/shared/src/candidates/base-fields.ts`)

```ts
export const BASE_CANDIDATE_FIELDS = [
  { key: "fullName",            label: "Nombre completo",        type: "text",   required: true },
  { key: "interviewPhone",      label: "Teléfono de entrevista", type: "text",   required: true },
  { key: "interviewDate",       label: "Fecha de entrevista",    type: "date",   required: true },
  { key: "interviewTime",       label: "Horario de entrevista",  type: "text",   required: true },
  { key: "positionId",          label: "Puesto",                  type: "select", required: true }, // options resolved per-client from client_positions
  { key: "state",               label: "Estado",                  type: "text",   required: true },
  { key: "municipality",        label: "Municipio",               type: "text",   required: true },
  { key: "recruiterName",       label: "Nombre del reclutador",   type: "text",   required: true },
  { key: "accountExecutiveName",label: "Líder/Ejecutivo de cuenta", type: "text", required: true },
] as const satisfies ReadonlyArray<BaseFieldDef>;

export type BaseFieldKey = typeof BASE_CANDIDATE_FIELDS[number]["key"];
export const BASE_FIELD_KEY_SET: ReadonlySet<BaseFieldKey> = new Set(BASE_CANDIDATE_FIELDS.map(f => f.key));
```

### JSONB contract for new candidates

```jsonc
// candidates.additional_fields  ← required to contain ALL of:
{
  "fullName": "Mariana López Pérez",
  "interviewPhone": "+524421234567",
  "interviewDate": "2026-05-15",         // YYYY-MM-DD
  "interviewTime": "10:30",               // free text — "10:30", "10:30 AM", "Mañana 10:30" all OK
  "positionId": "<uuid of an active row in client_positions for this client>",
  "state": "Querétaro",
  "municipality": "San Juan del Río",
  "recruiterName": "Hector Franco",
  "accountExecutiveName": "Javier Romero"
  // ...plus any admin-managed custom keys; never a key matching the base set
}
```

### Validation rules (enforced by `apps/api/src/modules/candidates/service.ts`)

1. **Effective formConfig completeness** (FR-011, fail-closed): before invoking `buildDynamicSchema`, the service computes `effective = BASE_CANDIDATE_FIELDS ∪ formConfig.fields[]` and asserts every `BaseFieldKey` is present. If not → throw `HTTPException(500, { error: "form_config_tampered", tenantId, clientId, missingBaseKeys, message: "Los campos base del candidato no están en el formConfig del cliente. Re-ejecuta scripts/012-rename-legacy-formconfig-collisions.ts para este tenant." })` per `contracts/candidate-create.md`. The Formulario tab is **not** a repair surface (FR-011) — the message points at the script, never at the tab.
2. **Body shape** (FR-012): the body is parsed with the dynamic Zod schema derived from `effective`. Missing required base values → 400 with the standard Zod error envelope.
3. **`positionId` referential check** (R-07): one SELECT against `client_positions WHERE id = $positionId AND client_id = $clientId AND is_active = true`. 0 rows → 400 `{ field: "positionId", message: "El puesto seleccionado no existe en este cliente." }`.
4. **Custom-field collision** (already validated by Zod refinement in `packages/shared/src/clients/schemas.ts`): cannot occur post-migration; defense in depth here is the assertion in (1).

---

## Server-side `formConfig` PUT validation (FR-010)

The existing `fieldKeySchema` in `packages/shared/src/clients/schemas.ts` has a deny-list (`LEGACY_FORM_CONFIG_KEYS`) for legacy toggle keys. Extend the same refine to also reject any key in `BASE_FIELD_KEY_SET`:

```ts
const fieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,30}$/, { message: "..." })
  .refine((k) => !LEGACY_FORM_CONFIG_KEYS.has(k), { message: "..." })
  .refine((k) => !BASE_FIELD_KEY_SET.has(k as BaseFieldKey), {
    message: "La clave colisiona con un campo base del formulario de candidatos. Renómbrala.",
  });
```

> Note: the existing regex `^[a-z][a-z0-9_]{0,30}$` rejects camelCase, so `fullName` cannot be re-introduced as a custom key via the normal create-field flow even **without** the new refine. The new refine is what protects against the post-migration `legacy_<key>` collision flow and any future regex relaxation. Two layers, intentional.

In addition, the service-layer validator (`apps/api/src/modules/clients/service.ts → validateFormConfigPayload`) MUST also detect and reject:

| Bad payload | Server response |
|---|---|
| `fields[].key` not in incoming list but **was** in the previous saved list AND is a legacy/custom key (delete) | Allowed (admins can delete custom fields). |
| Any base-field key present in `fields[]` (even with the same label/type) | 400 — base fields are not stored in `fields[]`. |
| `key` mutation on an existing custom field | 400 — `key` is immutable (already enforced by `patchFormConfigFieldSchema`'s `key: z.never().optional()`). |

---

## Audit envelopes (no new event types — see R-06)

### `client_updated`

```jsonc
{
  "event": "client.updated",
  "actorId": "<userId>",
  "tenantId": "<tenantId>",
  "subjectType": "client",
  "subjectId": "<clientId>",
  "diff": {
    "name":         { "old": "Acme",       "new": "Acme S.A." },
    "address":      { "old": "Calle 1",   "new": "Calle 1, Col. Centro" },
    "description":  { "old": null,         "new": "Manufactura de autopartes." }   // ← NEW
    // ...other changed fields
  },
  "occurredAt": "2026-05-01T15:00:00Z"
}
```

### `contact_updated`

```jsonc
{
  "event": "client.contact.updated",
  "actorId": "<userId>",
  "tenantId": "<tenantId>",
  "subjectType": "client_contact",
  "subjectId": "<contactId>",
  "diff": {
    "phone":    { "old": "+5215511112222", "new": "+5215511113333" },
    "position": { "old": null,             "new": "Recursos Humanos" }             // ← NEW
  },
  "occurredAt": "2026-05-01T15:01:00Z"
}
```

The diff is computed by the service before the UPDATE. If `description` (or `position`) is unchanged, it's absent from the diff entirely.

---

## DTO shape changes (`packages/shared/src/types/client.ts`)

```diff
 export interface IClientDto {
   id: string;
   name: string;
   email?: string;
   phone?: string;
   address?: string;
   latitude?: number;
   longitude?: number;
+  description?: string;                        // 012-FR-001
   isActive: boolean;
   formConfig: IClientFormConfig;
   createdAt: string;
   updatedAt: string;
 }

 export interface IClientDetailDto extends IClientDto {
   contacts: IClientContactDto[];
   positions: IClientPositionDto[];
   assignments: IClientAssignmentDto[];
+  primaryAccountExecutiveName?: string;        // 012-R-04 — server-computed
 }

 export interface IClientContactDto {
   id: string;
   clientId: string;
   name: string;
   phone: string;
   email: string;
+  position?: string;                            // 012-FR-002
   createdAt: string;
   updatedAt: string;
 }

 export interface IUpdateClientRequest {
   name?: string;
   email?: string;
   phone?: string;
   address?: string;
   latitude?: number;
   longitude?: number;
   isActive?: boolean;
   formConfig?: IClientFormConfig;
+  description?: string | null;                  // null = clear
 }

 export interface ICreateContactRequest {
   name: string;
   phone: string;
   email: string;
+  position?: string;                            // 012-FR-013
 }

 export interface IUpdateContactRequest {
   name?: string;
   phone?: string;
   email?: string;
+  position?: string | null;                     // null = clear
 }
```

---

## State transitions

None. No FSM is introduced or modified by this feature. The candidate FSM (007) is unchanged. All changes are CRUD-shape extensions on existing resources.

---

## Validation rules summary

| Rule | Layer | Source | Failure response |
|---|---|---|---|
| `description` ≤ 2,000 chars | DB CHECK + Zod `max(2000)` | FR-001, FR-003, E-07 | 400 (Zod) before reaching DB; 23514 if bypassed |
| `position` length ∈ `[1, 120]` when present | Zod `min(1).max(120)` | FR-002, FR-004, E-08 | 400 |
| `position` empty string → NULL | Service-layer normalize | E-08 | n/a (200 OK) |
| `formConfig.fields[].key` ∉ `BASE_FIELD_KEY_SET` | Zod refine on `fieldKeySchema` + service `validateFormConfigPayload` | FR-010 | 400 |
| All `BASE_FIELD_KEY_SET` present in effective `formConfig` at candidate-create | service `assertEffectiveFormConfigContainsBase` | FR-011 | 500 with repair instruction |
| Request body has values for every base-field key | dynamic Zod from `buildDynamicSchema` | FR-012 | 400 |
| `positionId` ∈ active `client_positions` for this client | service SELECT against `client_positions` | R-07 | 400 |
| `clients.description`, `client_contacts.position` tenant-scoped | RLS | constitution §I | 404 (silent — RLS filter) |

---

## Index strategy

No new indexes. Reasoning:

- `description` is never queried — only fetched as part of a single-row SELECT on `clients.id`, which already uses the PK index. No filter, no sort, no full-text search.
- `position` is also never queried as a filter today. The Contactos tab loads all rows for one client via the existing `client_contacts_client_id_idx`. If a future feature adds a "search by puesto" filter, that's its job to add the index.

Adding speculative indexes would burn write throughput (constitution §II — edge-first cost discipline).
