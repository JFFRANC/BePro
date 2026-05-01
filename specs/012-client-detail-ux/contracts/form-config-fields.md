# Contract — `formConfig.fields[]` admin endpoints (base-key collision rejection)

**Module**: `apps/api/src/modules/clients/`
**Feature**: 012 / FR-010, E-10
**Auth**: JWT required. RBAC: `admin` only (existing).
**Tenant context**: existing middleware.

The exact endpoint surface for admin custom fields was introduced in 008. Feature 012 adds **one** new validation rule across every endpoint that mutates `clients.form_config.fields[]`: **the field key must not collide with any `BASE_CANDIDATE_FIELDS` key**.

---

## Affected endpoints

| Method | Path | Behavior change |
|---|---|---|
| `POST` | `/api/clients/{clientId}/form-config/fields` | New field's `key` is checked against `BASE_FIELD_KEY_SET`. Collision → 400. |
| `PATCH` | `/api/clients/{clientId}/form-config/fields/{key}` | Existing endpoint already rejects `key` mutation; no behavior change here. The `key` cannot be changed, so a base-key collision can only appear via `POST` or via legacy data. |
| `PUT` (if used as bulk replace) | `/api/clients/{clientId}/form-config` | Bulk validator runs the collision check on every entry in `fields[]`. Any single collision rejects the whole payload (no partial saves). |

The exact route shapes are inherited from feature 008 — this document only adds the collision rule.

---

## Validation pipeline

```
Request body
   └─▶ Zod (fieldKeySchema): regex + LEGACY_FORM_CONFIG_KEYS deny-list + NEW BASE_FIELD_KEY_SET deny-list
   └─▶ Service (validateFormConfigPayload): defense-in-depth set check; rejects whole payload on first hit
   └─▶ DB UPDATE (atomic, inside SET LOCAL transaction)
```

### Zod refinement (in `packages/shared/src/clients/schemas.ts`)

```ts
import { BASE_FIELD_KEY_SET, type BaseFieldKey } from "../candidates/base-fields";

const fieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,30}$/, { message: "..." })
  .refine((k) => !LEGACY_FORM_CONFIG_KEYS.has(k), { message: "..." })
  .refine((k) => !BASE_FIELD_KEY_SET.has(k as BaseFieldKey), {
    message: "La clave colisiona con un campo base del formulario de candidatos. Renómbrala.",
  });
```

> Note: BASE_CANDIDATE_FIELDS keys are camelCase; the regex is lowercase + `_` only. So today the regex alone blocks them. The new refine is belt-and-suspenders for tomorrow's regex relaxation and for the `legacy_<key>` migration path.

---

## Responses

### 400 Bad Request — collision

```json
{
  "error": "validation_error",
  "issues": [
    {
      "path": ["fields", 2, "key"],
      "message": "La clave colisiona con un campo base del formulario de candidatos. Renómbrala."
    }
  ]
}
```

### 400 Bad Request — base-field deletion (PUT bulk replace)

If the bulk-replace payload omits a custom key that previously existed → that's a delete, allowed.
If the payload introduces a key in `BASE_FIELD_KEY_SET` → 400 (collision).

The payload may NOT contain entries representing base fields under any circumstance — base fields are not stored in `form_config.fields[]`. They live in `BASE_CANDIDATE_FIELDS` and are merged at read time by the candidate-create handler and by the Formulario tab UI.

---

## Test matrix

| Scenario | Endpoint | Body | Expected |
|---|---|---|---|
| Create custom field, normal key | POST | `{ "key": "ageGroup", "label":"Grupo edad", "type":"select", "options":["A","B"] }` | Rejected by regex (camelCase) — existing behavior |
| Create custom field, snake_case ok | POST | `{ "key": "age_group", "label":"...", ... }` | 201 |
| Create custom field, base-key collision | POST | `{ "key": "fullName", ... }` | 400 — regex + new refine both reject |
| Create custom field, lowercased base-key | POST | `{ "key": "fullname", ... }` | 200 today (`fullname` ≠ `fullName`); after migration any candidate-side data lives under `fullName` only — no functional collision. |
| Bulk replace introduces collision | PUT | `fields: [..., { key: "fullName", ... }]` | 400 — entire payload rejected, no partial save |
| Patch existing field's label | PATCH | `{ "label": "..." }` | 200 (no collision possible — key is immutable) |
| Patch attempts key change | PATCH | `{ "key": "..." }` | 400 (existing `z.never()` rule) |
| Cross-tenant write | any | any | 404 |
| Non-admin caller | any | any | 403 |

---

## Migration interaction (E-10)

The pre-deploy migration script (`scripts/012-rename-legacy-formconfig-collisions.ts`, see research.md R-05) renames any pre-existing collision to `legacy_<key>` (e.g., `legacy_fullName`). After the script runs, **no tenant has a colliding custom key**, so the new validator never trips on legacy data. If the script is skipped, the first admin who tries to save the Formulario tab gets a 400 with the offending key — recoverable but disruptive.
