# Audit Event Contract — `user.created` (010 enrichment)

**Action**: `user.created` (unchanged)
**Target**: `target_type = "user"`, `target_id = <new user's uuid>` (unchanged)
**Storage**: existing `audit_events` table; only the JSONB `new_values` column shape changes.

## new_values JSONB shape

| Key | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | unchanged |
| `firstName` | string | yes | unchanged |
| `lastName` | string | yes | unchanged |
| `role` | enum | yes | unchanged — one of `admin\|manager\|account_executive\|recruiter` |
| `isFreelancer` | boolean | yes | unchanged |
| `clientId` | string (uuid) | **no — present only when captured** | **NEW (010)**. Present when role is `account_executive` or `recruiter` and a `client_assignments` row was inserted in the same transaction. Absent for `admin` and `manager` (and absent for AE/recruiter if a future call site somehow omits it). |

## Examples

### Recruiter assigned to a client

```json
{
  "tenantId": "...",
  "actorId": "...",
  "action": "user.created",
  "targetType": "user",
  "targetId": "...",
  "newValues": {
    "email": "ana.lopez@bepro.mx",
    "firstName": "Ana",
    "lastName": "López",
    "role": "recruiter",
    "isFreelancer": false,
    "clientId": "1c1c63d9-2b5a-4f7e-9d1a-2cd2af1fbb0e"
  }
}
```

### Admin without client assignment

```json
{
  "tenantId": "...",
  "actorId": "...",
  "action": "user.created",
  "targetType": "user",
  "targetId": "...",
  "newValues": {
    "email": "boss@bepro.mx",
    "firstName": "Hector",
    "lastName": "Franco",
    "role": "admin",
    "isFreelancer": false
  }
}
```

## Backward compatibility

- Consumers that read `new_values` MUST tolerate the optional `clientId` field. None currently project on this shape, so the change is additive.
- Bulk-import call site (`bulkImportUsers`) continues to omit `clientId` (out of scope per spec assumption).

## Atomicity guarantee

The audit row is inserted in the same transaction as the `users` row (and the `client_assignments` row, when applicable). On any failure (invalid client, duplicate email after the SELECT, db error), the entire transaction rolls back — no audit event is recorded for a user-create that didn't happen.
