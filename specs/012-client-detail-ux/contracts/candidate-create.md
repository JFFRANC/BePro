# Contract — `POST /api/candidates` (BASE_CANDIDATE_FIELDS enforcement)

**Module**: `apps/api/src/modules/candidates/`
**Feature**: 012 / FR-009, FR-011, FR-012, FR-015 + R-07
**Auth**: JWT required. RBAC: `recruiter` only (008-FR introduced; unchanged).
**Tenant context**: existing middleware.

This document only describes the behavior changes added by feature 012. The existing 007 contract (duplicate detection, privacy notice handling, FSM start state, etc.) is untouched.

---

## Request

```http
POST /api/candidates
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "client_id": "<uuid>",
  "first_name": "Mariana",
  "last_name":  "López Pérez",
  "phone":      "+524422223344",
  "email":      "mariana@example.com",
  "current_position": "Operadora línea",
  "source":     "referido",
  "additional_fields": {
    "fullName":            "Mariana López Pérez",
    "interviewPhone":      "+524422223344",
    "interviewDate":       "2026-05-15",
    "interviewTime":       "10:30",
    "positionId":          "<uuid of an active client_positions row for this client>",
    "state":               "Querétaro",
    "municipality":        "San Juan del Río",
    "recruiterName":       "Hector Franco",
    "accountExecutiveName":"Javier Romero"
  }
}
```

The `additional_fields` JSONB MUST contain all 9 BASE_CANDIDATE_FIELDS keys with non-empty values. Any admin-managed custom fields (defined in the client's `form_config.fields[]`) appear as additional keys in the same object.

---

## Validation pipeline (new in 012)

```
Body parsed by zValidator (existing 007 schema; additional_fields stays z.record(string, unknown))
   ▼
Service.registerCandidate():
   1. Load client (RLS-scoped). Read formConfig.fields[] (custom).
   2. Build effective config = BASE_CANDIDATE_FIELDS ∪ formConfig.fields[]
   3. assertEffectiveFormConfigContainsBase(effective):
        for each k in BASE_FIELD_KEY_SET:
          if k ∉ effective.keys() → throw HTTPException(500, repair-message)   ← FR-011
   4. dynamicSchema = buildDynamicSchema(effective)
   5. dynamicSchema.parse(body.additional_fields)   ← FR-012  (400 on missing/invalid base values)
   6. SELECT 1 FROM client_positions
        WHERE id = body.additional_fields.positionId
          AND client_id = body.client_id
          AND is_active = true
        ─ if 0 rows → 400 { field: "positionId", message: "El puesto seleccionado no existe en este cliente." }   ← R-07
   7. continue with existing 007 logic (duplicate detection, privacy notice, INSERT, audit)
```

---

## Responses

### 201 Created

Existing 007 envelope; no shape change.

### 400 Bad Request — missing base value

```json
{
  "error": "validation_error",
  "issues": [
    { "path": ["additional_fields", "positionId"], "message": "Required" },
    { "path": ["additional_fields", "interviewDate"], "message": "Fecha inválida" }
  ]
}
```

### 400 Bad Request — invalid `positionId`

```json
{
  "error": "invalid_position",
  "field": "additional_fields.positionId",
  "message": "El puesto seleccionado no existe en este cliente."
}
```

### 500 Internal Server Error — tampered formConfig

```json
{
  "error": "form_config_tampered",
  "tenantId": "<uuid>",
  "clientId": "<uuid>",
  "missingBaseKeys": ["fullName", "positionId"],
  "message": "Los campos base del candidato no están en el formConfig del cliente. Re-ejecuta scripts/012-rename-legacy-formconfig-collisions.ts para este tenant."
}
```

This is a fail-closed signal — never silently merge. The error message points the operator at the data-migration script because that is the **actual** repair path: there is no UI affordance for an admin to add a missing base key (the Formulario tab's custom-field flow rejects collisions on every save). The payload includes `tenantId` and `clientId` so support can run the script targeted without log diving.

> Implementation detail: in practice this 500 fires only if the pre-deploy migration was skipped or a tenant was provisioned after the migration ran without inheriting BASE_CANDIDATE_FIELDS handling. Re-running the script (idempotent) clears the condition.

### 403 Forbidden

Caller is not a recruiter (existing 008 rule).

### 404 Not Found

Client is not in the caller's tenant or is inactive.

---

## Test matrix

| Scenario | Body | Expected |
|---|---|---|
| Happy path — all base values present, valid positionId | full body above | 201; candidate persisted with `additional_fields` containing all 9 base keys |
| Missing `fullName` | omit `additional_fields.fullName` | 400 with Zod issue on `additional_fields.fullName` |
| Empty `interviewDate` | `interviewDate: ""` | 400 |
| `positionId` not in this client's catalog | `positionId: <uuid of another client's position>` | 400 `invalid_position` |
| `positionId` archived (is_active=false) | `positionId: <archived uuid>` | 400 `invalid_position` |
| Tenant's `formConfig` missing a base key (post-tamper test) | full body, but seed db with broken formConfig | 500 `form_config_tampered` listing the missing keys |
| Custom admin field present alongside base | `additional_fields.shoeSize: "8"` (with `shoeSize` defined in formConfig.fields) | 201 |
| Custom field key collides with base (legacy data) | seed db with collision before migration | 500 `form_config_tampered` (formConfig validator separately rejects via FR-010 if the admin tries to save) |
| Duplicate phone for this client | full body, phone matches existing candidate | 200 with duplicate warning (existing 007 behavior — unchanged) |
| Cross-tenant client_id | `client_id: <other tenant's id>` | 404 |
| Recruiter not authorized for this client | (depends on assignment rules) | 403 |

---

## Pre-fill helpers (FR-015 — UI-only, no API change)

The candidate registration form (`apps/web/src/modules/candidates/components/RegisterCandidateForm.tsx`) seeds `recruiterName` and `accountExecutiveName` on mount:

- `recruiterName` ← `useAuth().user.fullName` (already in JWT claims; existing auth context exposes it).
- `accountExecutiveName` ← `client.primaryAccountExecutiveName ?? ""` from `useClient(clientId)` (the field is added to `IClientDetailDto` server-side per R-04).

Both inputs remain editable; values are read from the form on submit and posted as part of `additional_fields`. The server does not pre-fill — it just receives whatever the client sends.
