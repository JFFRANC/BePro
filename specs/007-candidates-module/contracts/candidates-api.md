# Contract: Candidates API

**Feature**: 007-candidates-module
**Base path**: `/api/candidates`
**Auth**: every endpoint requires a valid JWT; tenant id comes from the JWT claim, NOT from the URL/body.

All requests and responses use JSON. Validation: Zod schemas in `@bepro/shared/candidates`. All responses redact PII per actor visibility; a recruiter fetching a candidate outside their own set gets `404`, never `403`, to avoid enumeration.

---

## 1. `POST /api/candidates` — Register candidate (US1)

Creates a new candidate in `registered` status.

**Roles**: recruiter, recruiter+freelancer, account_executive, manager, admin.

### Request

```jsonc
{
  "client_id": "uuid",
  "first_name": "string(1..100)",
  "last_name": "string(1..100)",
  "phone": "string(raw, as typed)",
  "email": "string(email)",
  "current_position": "string(0..200)?",
  "source": "string(1..100)",
  "additional_fields": { /* per-client form_config payload */ },
  "privacy_notice_id": "uuid",   // MUST be the tenant's currently-active notice
  "privacy_acknowledged": true,  // MUST be true — FR-013
  "duplicate_confirmation": {    // present only on the second call after a warning
    "confirmed_duplicate_ids": ["uuid", "..."]
  }
}
```

### Response — 201 Created

```jsonc
{
  "candidate": {
    "id": "uuid",
    "client_id": "uuid",
    "registering_user_id": "uuid",
    "status": "registered",
    "is_active": true,
    "first_name": "string",
    "last_name": "string",
    "created_at": "ISO-8601"
    // ... other candidate fields
  }
}
```

### Response — 409 Conflict (duplicate warning)

Returned when duplicates are detected AND `duplicate_confirmation` is absent. Response body contains the duplicate set so the client can render the warning dialog. The client re-submits with `duplicate_confirmation` populated to proceed.

```jsonc
{
  "code": "duplicates_detected",
  "message": "Possible duplicate candidates found for this client.",
  "duplicates": [
    {
      "id": "uuid",
      "first_name": "string",
      "last_name": "string",
      "status": "string",
      "created_at": "ISO-8601",
      "registering_user": { "id": "uuid", "display_name": "string" }
    }
  ]
}
```

### Errors

- `400` invalid payload (Zod validation)
- `401` unauthenticated
- `422` privacy notice not acknowledged (FR-013) or form_config validation fails (FR-012)

### Side effects

- Inserts `candidates` row.
- Inserts `candidate_duplicate_links` rows (1 per confirmed duplicate).
- Inserts `audit_events` row with action `candidate.created`.

---

## 2. `GET /api/candidates` — List & filter (US2)

Returns paginated candidates within the actor's role scope.

**Roles**: every authenticated user; scope enforced by the service (see "Visibility" below).

### Query parameters

| Param | Type | Notes |
|---|---|---|
| `q` | `string` | Partial match on name/email/phone (FR-021) |
| `status` | `candidate_status[]` | One or more |
| `client_id` | `uuid[]` | One or more |
| `recruiter_user_id` | `uuid[]` | Manager/admin only |
| `rejection_category_id` | `uuid[]` | |
| `decline_category_id` | `uuid[]` | |
| `updated_from` | `ISO-8601` | |
| `updated_to` | `ISO-8601` | |
| `include_inactive` | `boolean` (default false) | Manager/admin only (FR-025) |
| `cursor` | `string` | keyset pagination |
| `limit` | `integer` (1..100, default 25) | |

### Response — 200 OK

```jsonc
{
  "items": [
    {
      "id": "uuid",
      "first_name": "string",
      "last_name": "string",
      "client": { "id": "uuid", "name": "string" },
      "status": "string",
      "updated_at": "ISO-8601",
      "registering_user": { "id": "uuid", "display_name": "string" },
      "is_active": true
    }
  ],
  "next_cursor": "string | null"
}
```

### Visibility (FR-020, SC-003)

| Role | Items returned |
|---|---|
| `recruiter` (incl. freelancer) | `registering_user_id = actor` |
| `account_executive` | Candidates whose `client_id` is in `client_assignments.client_id WHERE account_executive_id = actor` |
| `manager`, `admin` | All candidates in tenant |

Inactive candidates are filtered server-side unless `include_inactive=true` AND role ∈ {manager, admin}.

---

## 3. `GET /api/candidates/:id` — Single candidate

Full detail of one candidate.

**Access**: only within role scope. Otherwise `404` (not `403`, to prevent enumeration).

### Response — 200 OK

Full `candidate` record (as in `POST` response) PLUS:
- `privacy_notice` — the snapshot of the version acknowledged.
- `attachments` — active+non-obsolete attachments (use `?include_obsolete=true` to include obsolete ones if actor has edit permission).
- `status_history` — last 50 transition audit rows (projected view from `audit_events` filtered by `target_id = :id AND action = 'candidate.status.changed'`).
- `duplicate_links` — candidates flagged as duplicates at creation (both directions).

---

## 4. `PATCH /api/candidates/:id` — Edit PII & additional fields

Update a candidate's editable fields. Status is NOT editable via this endpoint — use transitions.

**Roles**: account_executive (own scope), manager, admin.
Also: the registering recruiter may edit their own candidate's PII and additional_fields until the candidate's status advances past `registered`.

### Request

```jsonc
{
  "first_name": "string?",
  "last_name": "string?",
  "phone": "string?",
  "email": "string?",
  "current_position": "string?",
  "source": "string?",
  "additional_fields": { /* partial; merged with existing */ }
}
```

### Response — 200 OK

Returns the updated candidate. A `409` is returned if the actor lacks permission (masked as `404`).

### Side effects

- One `audit_events` row PER changed field, action `candidate.field.edited`.
- `phone` edits re-normalize `phone_normalized`.

---

## 5. `POST /api/candidates/:id/transitions` — Change status (US3)

Moves a candidate through the FSM. Validates both the FSM edge and the role gate.

**Roles**: account_executive (own scope), manager, admin.

### Request

```jsonc
{
  "from_status": "candidate_status",     // current status as seen by the actor (R6)
  "to_status": "candidate_status",
  "rejection_category_id": "uuid?",      // required if to_status === 'rejected'
  "decline_category_id": "uuid?",        // required if to_status === 'declined'
  "note": "string(0..500)?"
}
```

### Response — 200 OK

```jsonc
{
  "candidate": { /* updated candidate */ },
  "transition": {
    "id": "uuid",                       // audit event id
    "from_status": "...",
    "to_status": "...",
    "actor_user_id": "uuid",
    "created_at": "ISO-8601"
  }
}
```

### Errors

- `400` invalid `to_status` or missing required category.
- `409` stale write — `from_status` does not match current DB state (R6). Response body includes current status.
- `422` transition not allowed by the FSM (FR-031, FR-031a).
- `403` transition not allowed for this role / scope — masked as `404` when the candidate is not visible to the actor.

### Side effects

- Update `candidates.status` + (for negative terminals) `candidates.is_active = false` atomically.
- Insert one `audit_events` row with action `candidate.status.changed`.

---

## 5a. `POST /api/candidates/:id/reactivate` — Admin reactivation (FR-038a)

Reactivates a candidate currently sitting in a negative-terminal state (`rejected`, `declined`, `no_show`, `discarded`, `termination`, `replacement`). Sets `is_active = true` while leaving the terminal `status` value intact so lifecycle history is preserved.

**Roles**: admin only.

### Request

```jsonc
{
  "note": "string(0..500)?"   // optional justification, included in audit row
}
```

### Response — 200 OK

```jsonc
{
  "candidate": { /* updated candidate, is_active=true, status unchanged */ },
  "reactivation": {
    "id": "uuid",            // audit_events row id
    "actor_user_id": "uuid",
    "created_at": "ISO-8601",
    "note": "string?"
  }
}
```

### Errors

- `403` actor is not admin (masked as `404` if the candidate is not visible to the actor).
- `409` candidate is not in a negative-terminal state — body includes the current status.
- `422` candidate is already `is_active = true` — no-op refused.

### Side effects

- Update `candidates.is_active = true` (status unchanged) atomically with the audit insert.
- Insert one `audit_events` row with action `candidate.reactivated`, `old_values = { is_active: false }`, `new_values = { is_active: true, note }`.

---

## 6. `POST /api/candidates/:id/attachments` — Start upload

Creates an attachment row with `uploaded_at = NULL` and returns an **internal upload URL** that points at the finalize endpoint (§7). Bytes are streamed through the Workers runtime; the presigned direct-to-R2 PUT variant from research R4 is deferred until bandwidth cost justifies the extra wiring (CORS, signed-URL issuance, client SDK handling). See **ADR-002 — Attachment upload via Workers proxy** for the decision record.

**Roles**: any user with edit permission on the candidate.

### Request

```jsonc
{
  "file_name": "string",
  "mime_type": "string",
  "size_bytes": "integer (<= 10 * 1024 * 1024)",
  "tag": "string?"
}
```

### Response — 200 OK

```jsonc
{
  "attachment_id": "uuid",
  "upload_url": "/api/candidates/{candId}/attachments/{attId}/upload",
  "storage_key": "tenants/{tenantId}/candidates/{candId}/attachments/{attId}/…"
}
```

Creates a `candidate_attachments` row with `uploaded_at = NULL` (finalized by the next call).

---

## 7. `POST /api/candidates/:id/attachments/:attId/upload` — Finalize upload (server proxy)

Client streams the raw file bytes in the HTTP body. The Worker validates MIME type + byte count against the init payload, writes the object to R2 under `storage_key`, marks the row `uploaded_at = now()`, and emits the `candidate.attachment.added` audit event.

Historical note: the contract previously named this endpoint `/complete` and expected the client to have already PUT the bytes directly to R2 via a presigned URL. The shipped implementation proxies the upload through the Worker. See ADR-002.

### Request

Raw file body (any `Content-Type` matching the MIME declared at step 6). No JSON envelope.

### Response — 200 OK

Returns the finalized attachment record.

### Errors

- `422 file_too_large` — body exceeds the 10 MB cap.
- `422 mime_mismatch` — body content type disagrees with init payload.
- `404 not_found` — candidate or attachment id not in the actor's scope.

### Failure mode

If the client never calls this endpoint within 10 minutes of step 6, the partial row remains with `uploaded_at = NULL` and is hidden from the attachment list by the `uploaded_at IS NOT NULL` filter. **Tech debt**: a scheduled cleanup of orphan rows + R2 keys is intentionally deferred to a future maintenance task (tracked in Phase 9 — see tasks T123a/ADR). Operators can manually purge orphans in the meantime by querying `WHERE uploaded_at IS NULL AND created_at < now() - interval '24 hours'`.

---

## 8. `GET /api/candidates/:id/attachments/:attId/download` — Signed GET URL

Returns a short-lived (5 min) signed URL for the attachment. The API enforces visibility before issuing the URL.

**Roles**: any user with read access to the candidate (and `NOT is_obsolete` unless the actor is manager/admin).

### Response — 200 OK

```jsonc
{
  "download_url": "https://r2…presigned GET, 5min",
  "expires_at": "ISO-8601"
}
```

---

## 9. `PATCH /api/candidates/:id/attachments/:attId` — Mark obsolete

**Roles**: any user with edit permission on the candidate.

### Request

```jsonc
{ "is_obsolete": true }
```

(Only `is_obsolete` is editable via this endpoint. Re-uploads create new rows.)

---

## 10. `GET /api/candidates/duplicates` — Pre-submit duplicate probe (optional UX helper)

Lets the web form display a duplicate warning *before* the user types the full record, e.g. on phone-field blur.

**Roles**: same as POST.

### Query

- `client_id=uuid`
- `phone=<raw phone>`

### Response — 200 OK

```jsonc
{ "duplicates": [ /* same shape as §1 409 response */ ] }
```

No DB write.

---

## 11. Categories (admin CRUD — US5)

- `GET  /api/rejection-categories` — list active + inactive for tenant.
- `POST /api/rejection-categories` — `{ label }`. Admin only.
- `PATCH /api/rejection-categories/:id` — `{ label?, is_active? }`. Admin only.

Same shape for `decline_categories`. Renaming or deactivating does NOT affect historical records (FR-051) because the audit row snapshotted the label at transition time.

---

## 12. Retention reviews (admin — FR-003a)

- `GET  /api/retention-reviews/status` — `{ next_due_at, days_remaining, status: 'ok'|'due_soon'|'overdue', last_review?: {...} }`.
- `POST /api/retention-reviews` — `{ justification_text }`. Admin only. Creates a row and advances `next_due_at` by 12 months.

---

## 13. Audit-event shape (contract for consumers)

Candidates module writes to `audit_events` using these canonical action strings:

| `action` | `old_values` | `new_values` |
|---|---|---|
| `candidate.created` | `null` | `{ id, client_id, status, privacy_notice_id, privacy_notice_acknowledged_at, ... non-PII summary }` |
| `candidate.status.changed` | `{ status, is_active }` | `{ status, is_active, rejection_category_id?, decline_category_id?, rejection_category_label?, decline_category_label?, note? }` |
| `candidate.field.edited` | `{ <field>: <old> }` | `{ <field>: <new> }` |
| `candidate.reactivated` | `{ is_active: false }` | `{ is_active: true, note? }` |
| `candidate.attachment.added` | `null` | `{ attachment_id, file_name, mime_type, size_bytes, tag? }` |
| `candidate.attachment.obsoleted` | `{ is_obsolete: false }` | `{ is_obsolete: true }` |

> Privacy-notice acknowledgement is captured inside the `candidate.created` row's `new_values` (`privacy_notice_id` + `privacy_notice_acknowledged_at`); there is no separate `candidate.privacy_acknowledged` event.

All rows share: `tenant_id`, `actor_id`, `target_type = 'candidate'`, `target_id = <candidateId>`, `created_at`.

---

## 14. Error envelope

All non-2xx responses conform to:

```jsonc
{
  "code": "kebab-case-error-code",
  "message": "Human-readable Spanish string",
  "details": { /* optional, structured */ }
}
```

Error codes are stable; message text may be localized/translated.

---

## 15. Non-exposed surfaces

Not part of the public contract in v1:

- Bulk import / CSV upload.
- Candidate merging (reconciling two records that refer to the same person).
- Public recruiter-facing search API beyond `q=`.
- Webhook notifications on transitions.
- `DELETE` on ANY resource (hard delete forbidden).

All of the above live in later modules or feature flags.
