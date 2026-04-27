# Data Model — UX, Role Scoping, and Configurability Refinements

**Feature**: 008-ux-roles-refinements
**Date**: 2026-04-23

**TL;DR**: Zero new tables. Zero SQL migrations. All changes are (a) TypeScript-level Zod/type refinements in `@bepro/shared`, (b) JSONB shape extensions inside `clients.form_config`, (c) role-guard middleware.

---

## Entities touched

### 1. `User` (unchanged)

Used by the header to render identity. No schema change.

| Field | Source | Used for |
|---|---|---|
| `first_name`, `last_name`, `email`, `role` | `users` table | Header display name + menu |
| `is_freelancer` | `users` table | Candidate-create gate (`recruiter` OR `recruiter + is_freelancer` both allowed) |

> Out of scope: `avatar_url` (profile picture). Fallback to initials (see A-06).

---

### 2. `Client.form_config` (extended shape, same column)

`clients.form_config` is an existing JSONB column. Today it carries the 8 boolean toggles. We extend the shape to carry a `fields: FormFieldConfig[]` array alongside the toggles.

**Read compatibility**: unchanged. The 8 toggles remain siblings:

```ts
type LegacyToggles = {
  showAge: boolean;
  showPlant: boolean;
  showShift: boolean;
  showComments: boolean;
  showPosition: boolean;
  showMunicipality: boolean;
  showInterviewTime: boolean;
  showInterviewPoint: boolean;
};

type FormConfig = LegacyToggles & {
  fields?: FormFieldConfig[]; // NEW — admin-managed custom fields
};
```

**FormFieldConfig** (already declared in `packages/shared/src/candidates/form-config.ts`, now tightened by a Zod schema):

| Field | Type | Rule |
|---|---|---|
| `key` | `string` | `^[a-z][a-z0-9_]{0,30}$`, unique within one client |
| `label` | `string` | 1..80 chars |
| `type` | `"text" \| "number" \| "date" \| "checkbox" \| "select"` | Enumerated (FR-FC-006) |
| `required` | `boolean` | Default `false` |
| `options` | `string[]` | Required and non-empty when `type === "select"`; forbidden otherwise |
| `archived` | `boolean` | Default `false`; archived fields excluded from candidate form, kept in JSON for historical values |
| `createdAt` | `string` (ISO) | Stamped by the server on create |
| `updatedAt` | `string` (ISO) | Stamped by the server on each edit |

**Writes**: go through two API endpoints (see contracts/clients-form-config-fields.md). Direct JSONB mutation from the client is not permitted.

---

### 3. `ClientAssignment` (batch writes, no schema change)

Existing table `client_assignments(client_id, user_id, tenant_id, is_active, created_at, updated_at)`. No new columns, no new indexes.

Batch endpoint (contract) computes and applies a diff against the current set of active assignments for `(tenant_id, client_id)`:

```text
currentActive = SELECT user_id FROM client_assignments
                WHERE tenant_id = :tenant_id AND client_id = :client_id AND is_active = true;

toAdd    = desiredUserIds \ currentActive   # new or soft-deleted — insert or reactivate
toRemove = currentActive \ desiredUserIds   # soft-delete (is_active = false)
```

Reactivation is an `UPDATE SET is_active = true, updated_at = NOW() WHERE (tenant_id, client_id, user_id) = ...` so we preserve the original `created_at`.

---

### 4. `Candidate` (schema relaxation only)

No SQL migration. Only the API-layer Zod schema for `POST /api/candidates` changes:

| Field | Before | After |
|---|---|---|
| `privacyNoticeId` | `required: UUID` | `optional: UUID` |

The DB column `candidates.privacy_notice_id` stays as-is (nullable already in the existing migration). Historical rows remain viewable; future rows written by this feature will be `NULL` for that column.

---

### 5. `PrivacyNotice` (frozen read-only)

`privacy_notices` table, tenant-scoped. No writes from this feature. No UI surfaces read from it after this feature ships. The table stays in the DB for LFPDPPP evidentiary retention.

---

### 6. `AuditEvent` (unchanged contract)

Every inline status transition MUST append one `AuditEvent` row — same shape as today (`entity_type='candidate', old_status, new_status, actor_id, reason?, category_id?`). No new fields.

---

## Derived / computed data

### Spanish label map (compile-time, not DB)

| Key | Source | Purpose |
|---|---|---|
| `CANDIDATE_STATUS_LABELS_ES` | `packages/shared/src/candidates/status.ts` | Single source of truth for the 14 FSM state labels in Spanish |
| `statusLabel(s, lang)` | same file | Helper used by all dropdowns and badges. Logs a warning at runtime if a status is missing a Spanish entry (caught by CI presence test). |

---

## Validation rules added

| Rule | Where |
|---|---|
| `privacyNoticeId` optional on create | `packages/shared/src/candidates/schemas.ts` |
| `formConfigFieldSchema` with `key`, `label`, `type`, `required`, `options`, `archived` | `packages/shared/src/clients/schemas.ts` (new) |
| `batchAssignmentsSchema` (`{ userIds: string[] }`) | `packages/shared/src/clients/schemas.ts` (new) |
| `loginSchema` unchanged — field hiding is a UI concern, not a schema concern | `packages/shared/src/auth/...` |

---

## State transitions

No new FSM states. Inline transitions exercise the existing 14-state FSM introduced in 007. The only new concern: the client now mutates the list-query cache optimistically — covered in research.md R-02.

---

## Tenant isolation

All reads/writes stay under the existing RLS policies. The new batch endpoint enters one transaction with `SET LOCAL app.tenant_id` and does not escape it. The form-config mutations go through the existing `clients` row policy.

No multi-tenancy risk is introduced — confirmed by db-architect and multi-tenancy-guardian review before implementation.
