# Contract — `POST` & `PUT /api/clients/:clientId/contacts/:contactId?` (position added)

**Module**: `apps/api/src/modules/clients/`
**Feature**: 012 / FR-002, FR-004, FR-013, FR-014
**Auth**: JWT required. RBAC: `admin` OR `manager` OR (`account_executive` assigned to this client). Same as existing.
**Tenant context**: existing `SET LOCAL app.tenant_id` middleware.

---

## Create — `POST /api/clients/{clientId}/contacts`

### Request

```http
POST /api/clients/{clientId}/contacts
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "name": "Mariana López",
  "phone": "+524422223344",
  "email": "mariana@acme.com",
  "position": "Recursos Humanos"
}
```

### Body schema (Zod)

```ts
export const createContactRequestSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
  email: z.string().email().max(255),
  position: z.string().max(120).optional(),
});
```

| Field | Type | Optional | Constraints |
|---|---|---|---|
| `position` | `string` | yes | `max(120)`. Empty string `""` is normalized server-side to `null` per spec E-08 (no 400). |

### Responses

| Status | Meaning |
|---|---|
| 201 Created | Returns full `IClientContactDto` including `position` (or undefined). |
| 400 | Zod validation error (e.g., position > 120 chars). |
| 403 | Not authorized for this client. |
| 404 | Client not in tenant. |
| 409 | Contact email already exists for this client (existing unique constraint). |

---

## Update — `PUT /api/clients/{clientId}/contacts/{contactId}`

### Request

```http
PUT /api/clients/{clientId}/contacts/{contactId}
Content-Type: application/json
Authorization: Bearer <jwt>

{
  "position": "Finanzas"
}
```

Partial body — any subset of fields. `position: null` clears the field.

### Body schema (Zod)

```ts
export const updateContactRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().min(1).max(20).optional(),
  email: z.string().email().max(255).optional(),
  position: z.string().max(120).nullable().optional(),
});
```

`position`: `max(120)`, empty string `""` normalized to `null` server-side (E-08).

### Responses

| Status | Meaning |
|---|---|
| 200 OK | Updated `IClientContactDto`. |
| 400 | Validation error. |
| 403 / 404 / 409 | Same as create. |

---

## Audit

`contact_updated` diff includes `position: { old, new }` only when changed:

```json
{ "position": { "old": "Recursos Humanos", "new": "Finanzas" } }
```

`contact_created` audit envelope is unchanged in shape; `position` appears as one of the captured field values when present.

---

## Test matrix

| Scenario | Method | Body | Expected |
|---|---|---|---|
| Create with position | POST | `{name,phone,email,position:"RH"}` | 201; payload includes `position:"RH"` |
| Create without position | POST | `{name,phone,email}` | 201; `position` undefined in response |
| Update sets position | PUT | `{position:"Finanzas"}` | 200; audit diff `position:{old:null,new:"Finanzas"}` |
| Update changes position | PUT | `{position:"Operaciones"}` | 200; audit diff `position:{old:"Finanzas",new:"Operaciones"}` |
| Update clears position | PUT | `{position:null}` | 200; persisted as NULL; audit diff present |
| Position > 120 chars | POST/PUT | `{position:"x".repeat(121)}` | 400 |
| Position empty string on create | POST | `{position:""}` | 201; persisted as NULL (E-08 normalize, no 400) |
| Position empty string on update | PUT | `{position:""}` | 200; persisted as NULL (E-08 normalize, no 400) |
| Cross-tenant write | PUT to `<other-tenant>/contacts/...` | any | 404 |
| Recruiter (no permission) | POST | any | 403 |
| List shows position | GET `/api/clients/:id/contacts` | — | each row contains `position` when present, omitted when null |
