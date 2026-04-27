# Contract — Batch AE↔client assignment

**Endpoint**: `POST /api/clients/:clientId/assignments/batch` (new)
**Replaces**: N sequential single-assignment writes (not removed, still available for backwards compat)

## Authorization

| Role | Allowed? |
|---|---|
| `admin`, `manager` | YES |
| everyone else | 403 |

## Request

```json
{
  "userIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

- `userIds`: desired end-state of active assignments for this client.
- Duplicates in the array are deduped server-side.
- Unknown `userIds` (not in the tenant or not `account_executive`) → 422 with a list of offenders.

## Response (200)

```json
{
  "clientId": "...",
  "added":    [{ "userId": "...", "at": "2026-04-23T..." }],
  "removed":  [{ "userId": "...", "at": "2026-04-23T..." }],
  "unchanged": ["..."]
}
```

## Server behavior

1. Enter transaction with `SET LOCAL app.tenant_id = $actor.tenantId`.
2. Fetch `currentActive = client_assignments WHERE tenant_id, client_id, is_active = true`.
3. Compute `toAdd = desired \ currentActive` and `toRemove = currentActive \ desired`.
4. For each in `toAdd`: upsert with `is_active = true`.
5. For each in `toRemove`: `UPDATE ... SET is_active = false, updated_at = NOW()`.
6. Append one `AuditEvent` summarizing the batch (`entity_type = 'client_assignment_batch'`, `summary = { added, removed }`).
7. Commit.

Partial failure aborts the whole transaction. The response returns 500 with the offending row index.

## Tests required

- Happy path: 3 desired, 2 already active → 1 add, 1 remove, 1 unchanged.
- Removing all: empty array → all current assignments soft-deleted.
- Reactivating: desired userId that has a soft-deleted row → reactivated, not inserted; `created_at` preserved.
- Unknown `userIds` → 422 with offenders list; nothing written.
- Non-admin role → 403.
- Cross-tenant `clientId` → 404 (RLS).
- Concurrent calls from two admins on the same client → last-write-wins with deterministic audit ordering (test via controlled delay).
