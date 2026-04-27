# Contract — Candidate-create role gating and privacy-notice relaxation

**Endpoint**: `POST /api/candidates`
**Status**: amended (no URL change)

## Authorization

| Role | Allowed? |
|---|---|
| `recruiter` (any `is_freelancer`) | YES |
| `admin` | NO — 403 |
| `manager` | NO — 403 |
| `account_executive` | NO — 403 |

**403 body**:

```json
{
  "error": "forbidden",
  "message": "Solo reclutadores pueden registrar candidatos."
}
```

## Request body changes

| Field | Before | After |
|---|---|---|
| `privacyNoticeId` | required UUID | **optional** UUID |

No other field changes. When `privacyNoticeId` is absent, the service:
- SKIPS the "verify active notice for tenant" branch.
- Writes `candidates.privacy_notice_id = NULL`.
- Emits the normal `AuditEvent` on creation.

Backwards compatibility: clients still sending `privacyNoticeId` continue to work; the server validates it against the active notice as today.

## Tests required (TDD — RED first)

- Admin/manager/AE tokens POST → 403.
- Recruiter (with and without `is_freelancer`) POSTs without `privacyNoticeId` → 201.
- Recruiter POSTs with a valid `privacyNoticeId` → 201 (legacy path still works).
- Recruiter POSTs with an invalid `privacyNoticeId` → 422 (unchanged).
- RLS integration: recruiter cannot create a candidate for a client belonging to another tenant (unchanged, re-verified).
