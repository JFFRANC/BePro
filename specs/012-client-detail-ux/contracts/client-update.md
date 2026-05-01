# Contract — `PUT /api/clients/:id` (description added)

**Module**: `apps/api/src/modules/clients/`
**Feature**: 012 / FR-001, FR-003, FR-014
**Auth**: JWT required. RBAC: `admin` OR `manager` OR (`account_executive` assigned to this client). Existing `RoleGate` and assignment-check unchanged.
**Tenant context**: `SET LOCAL app.tenant_id = $jwt.tenantId` inside the transaction (existing middleware).

---

## Request

```http
PUT /api/clients/{clientId}
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "description": "Manufactura de autopartes; planta en San Juan del Río."
}
```

The body is partial — any field already accepted by the existing `updateClient` route may be sent. Only the `description` extension is documented here.

### Body schema (Zod, in `packages/shared/src/clients/schemas.ts`)

```ts
export const updateClientRequestSchema = z.object({
  // ... existing fields
  description: z
    .string()
    .max(2000, "La descripción no puede exceder 2,000 caracteres.")
    .nullable()
    .optional(),
});
```

| Field | Type | Optional | Constraints |
|---|---|---|---|
| `description` | `string \| null` | yes | `max(2000)`. `null` clears the field. Empty string `""` is normalized server-side to `null`. |

---

## Responses

### 200 OK

```json
{
  "id": "8a3f...",
  "name": "Acme S.A.",
  "description": "Manufactura de autopartes; planta en San Juan del Río.",
  "address": "Av. Industrial 123",
  "latitude": 20.39,
  "longitude": -100.0,
  "isActive": true,
  "formConfig": { /* ... */ },
  "createdAt": "2026-04-12T...",
  "updatedAt": "2026-05-01T..."
}
```

The full `IClientDto` (with the new `description` field) is returned.

### 400 Bad Request

```json
{
  "error": "validation_error",
  "issues": [
    { "path": ["description"], "message": "La descripción no puede exceder 2,000 caracteres." }
  ]
}
```

### 403 Forbidden

Caller is not admin / manager / assigned AE.

### 404 Not Found

Client does not exist in this tenant (RLS hides it; the route returns 404 — never 403, no enumeration leak).

---

## Audit

If `description` changed, append to `audit_events.diff`:

```json
{ "description": { "old": "Manufactura de autopartes.", "new": "Manufactura de autopartes; planta en San Juan del Río." } }
```

If unchanged, the key is absent from the diff. Empty diff → no audit row written.

---

## Test matrix

| Scenario | Method | Path | Body | Expected |
|---|---|---|---|---|
| Happy path — set description | PUT | `/api/clients/:id` | `{"description":"X"}` | 200; payload contains `description: "X"`; audit row with `description.old=null,new="X"` |
| Update description | PUT | `/api/clients/:id` | `{"description":"Y"}` | 200; audit row with `description.old="X",new="Y"` |
| Clear description | PUT | `/api/clients/:id` | `{"description":null}` | 200; payload contains `description: null` (omitted in JSON); audit row with `description.old="Y",new=null` |
| Empty string normalization | PUT | `/api/clients/:id` | `{"description":""}` | 200; persisted as `NULL`; audit row only if previously non-empty |
| Over 2,000 chars | PUT | `/api/clients/:id` | `{"description":"x".repeat(2001)}` | 400 with Zod issue on `description` |
| Tenant isolation (RLS) | PUT | `/api/clients/<other-tenant-id>` | `{"description":"X"}` | 404 |
| Recruiter (no permission) | PUT | `/api/clients/:id` | `{"description":"X"}` | 403 |
