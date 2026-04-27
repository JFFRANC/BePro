# Contract — Admin-managed custom fields in client `formConfig`

Two endpoints. Both mutate the JSONB `clients.form_config.fields[]` array.

## 1. Create a custom field

**`POST /api/clients/:clientId/form-config/fields`** (new)

### Authorization

| Role | Allowed? |
|---|---|
| `admin` | YES |
| everyone else | 403 |

### Request

```json
{
  "key": "custom_contract_number",
  "label": "Número de contrato",
  "type": "text",
  "required": false,
  "options": null
}
```

- `key`: `^[a-z][a-z0-9_]{0,30}$`, unique within this client.
- `type`: `"text" | "number" | "date" | "checkbox" | "select"`.
- `options`: `string[]` with ≥1 item when `type === "select"`; must be `null` / omitted otherwise.

### Response (201)

```json
{
  "clientId": "...",
  "field": {
    "key": "custom_contract_number",
    "label": "Número de contrato",
    "type": "text",
    "required": false,
    "options": null,
    "archived": false,
    "createdAt": "2026-04-23T...",
    "updatedAt": "2026-04-23T..."
  }
}
```

### Error cases

- 409 `duplicate_key` — key already present (archived or active) in this client's config.
- 422 `invalid_key` — key fails the regex.
- 422 `missing_options` — `type === "select"` without options.
- 404 — client not in tenant (RLS).

---

## 2. Update / archive a custom field

**`PATCH /api/clients/:clientId/form-config/fields/:key`** (new)

### Authorization

Same as create (admin only).

### Request (any subset)

```json
{
  "label": "Número de contrato (ES)",
  "required": true,
  "options": null,
  "archived": false
}
```

- `type` and `key` are immutable. Attempting to change either returns 422 `immutable_field`.
- Setting `archived: true` hides the field from the candidate form but preserves historical values on existing candidate records.
- Un-archiving (`archived: false`) restores the field to the form.

### Response (200)

```json
{
  "clientId": "...",
  "field": {
    "key": "custom_contract_number",
    "label": "Número de contrato (ES)",
    "type": "text",
    "required": true,
    "options": null,
    "archived": false,
    "createdAt": "...",
    "updatedAt": "2026-04-23T..."
  }
}
```

### Error cases

- 404 `field_not_found`.
- 422 `immutable_field` when `type` or `key` in payload.
- 422 `missing_options` when updating a `select` field to remove all options.

---

## Server behavior (both endpoints)

1. Enter transaction with `SET LOCAL app.tenant_id = $actor.tenantId`.
2. `SELECT form_config FROM clients WHERE id = $clientId FOR UPDATE`.
3. Mutate the `fields[]` array in-memory (enforce the Zod schema).
4. `UPDATE clients SET form_config = $newJson, updated_at = NOW() WHERE id = $clientId`.
5. Append an `AuditEvent` row with `entity_type = 'client_form_config_field'`, `action ∈ { create, update, archive, unarchive }`.

## Tests required

- Create a field, assert JSONB shape, assert candidate-create form then renders it.
- Create with duplicate key → 409.
- PATCH `label` only → updatedAt bumps, other fields stable.
- Archive a field → candidate-create form omits it; existing candidate records retain historical values.
- Un-archive → reappears.
- Attempt to PATCH `type` or `key` → 422.
- Non-admin → 403.
- Tenant isolation: client from another tenant → 404.
