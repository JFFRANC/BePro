# Research: Candidates Module

**Feature**: 007-candidates-module
**Date**: 2026-04-21
**Scope**: Resolve every Technical Context and Assumptions-level open question raised by `spec.md` and `/speckit.clarify`. All questions locked before tasks are generated.

---

## R1 — FSM transition matrix & per-role gate

**Decision**: Encode the 14-state FSM as a compile-time `const` lookup in `packages/shared/src/candidates/status.ts`, with two layered validators in `apps/api/src/modules/candidates/fsm.ts`: (a) FSM-legal edges (pure data structure), (b) role-gated edges (function of `UserRole` + whether the actor owns the client assignment).

The legal-edges graph — derived from the spec and the Q1 clarification:

```text
Happy path:
  Registered → Interview Scheduled → Attended → Pending → Approved → Hired → In Guarantee → Guarantee Met

Re-loop (recovery paths):
  Pending → Interview Scheduled       (re-interview)
  Approved → Pending                  (request more info)
  Approved → Interview Scheduled      (final panel)

Negative terminals (per FR-031a / Q1 matrix):
  Rejected:  from Interview Scheduled, Attended, Pending, Approved
  Declined:  from Approved
  No Show:   from Interview Scheduled
  Discarded: from Registered, Interview Scheduled, Attended, Pending, Approved

Post-Hired negative (written by the future placements module but defined here for FSM completeness):
  Termination: from In Guarantee
  Replacement: from Termination
```

Per-role gates (FR-032..034):

| Transition class | Recruiter | Account Executive (own clients) | Manager | Admin |
|---|---|---|---|---|
| Register (create in `Registered`) | ✅ | ✅ | ✅ | ✅ |
| Any FSM-legal transition | ❌ | ✅ | ✅ | ✅ |
| Reactivate from terminal | ❌ | ❌ | ❌ | ✅ |

**Rationale**: Two-layer check keeps the FSM rules pure + unit-testable and the role rules close to the HTTP layer where auth context is available. The `candidate-fsm-auditor` agent will own the transition-matrix tests.

**Alternatives considered**:
- *XState library for the FSM*: overkill for a 14-state linear FSM with a small branch set; adds a dependency and runtime cost for no test advantage.
- *Store the matrix in the database*: pushes a testable invariant into a data table and complicates deploys; rejected — this FSM evolves with product, not per-tenant.

---

## R2 — Duplicate detection & phone normalization

**Decision**: Duplicate detection is defined as an exact match on `(tenant_id, normalized_phone, client_id)` against non-deactivated candidates. A `normalize_phone(raw)` utility strips spaces, dashes, parentheses, dots, and a leading `+` country-code sequence, producing a digits-only string. The DB stores the raw phone alongside `phone_normalized` (computed at write time). A composite B-tree index `(tenant_id, phone_normalized, client_id) WHERE is_active = true` powers the lookup.

**Rationale**:
- Exact match is good enough for v1 (Mexican mobile numbers are standardized to 10 digits after country code; the false-negative risk is small).
- Stored normalized form avoids normalizing on every query and prevents subtle collation bugs.
- Partial index on `is_active = true` keeps the index small even as the deactivated tail grows.

**Alternatives considered**:
- *Fuzzy match on name + email + phone*: higher recall, much higher false-positive rate, painful UX. Rejected for v1.
- *DB-level UNIQUE on (tenant_id, phone_normalized, client_id)*: would forbid the recruiter-confirmed duplicates that FR-015 explicitly allows. Rejected.

---

## R3 — Audit trail integration with existing `audit_events` table

**Decision**: Use the pre-existing `audit_events` table (shape captured in `packages/db/src/schema/audit-events.ts`) for all candidate audit records — no new module-owned audit table. FR-063 is satisfied out of the box because the future audit module is already the table's owner.

Write shapes:

- Status transition:
  ```
  { action: "candidate.status.changed",
    target_type: "candidate",
    target_id: <candidateId>,
    old_values: { status, is_active },
    new_values: { status, is_active, rejection_category_id?, note? } }
  ```
- PII edit (one row per changed field):
  ```
  { action: "candidate.field.edited",
    target_type: "candidate",
    target_id: <candidateId>,
    old_values: { <field>: <old> },
    new_values: { <field>: <new> } }
  ```

Append-only enforcement: the DB role used by Workers will have `INSERT` on `audit_events` but NOT `UPDATE`/`DELETE`. The role change lives in `packages/db/drizzle/0004_candidates_rls.sql` alongside the new RLS policies.

**Rationale**: Reuses existing infrastructure, no schema duplication, retains the "future audit module" promise because there's nothing to migrate.

**Alternatives considered**:
- *Module-owned audit tables (`candidate_status_transitions`, `candidate_field_edits`)*: cleaner per-module schema, but duplicates the generic `audit_events` design and creates a later migration burden. Rejected.

---

## R4 — File storage on Cloudflare R2

**Decision**: Store attachments in R2 under the key `tenants/{tenantId}/candidates/{candidateId}/attachments/{attachmentId}/{sanitized-filename}`. The API issues short-lived (5-minute) signed URLs for downloads; uploads go through a two-step flow: POST `/api/candidates/:id/attachments` returns a pre-signed PUT URL + the `attachmentId`, the client PUTs the file directly to R2, then calls POST `/attachments/:attId/complete` to finalize the DB row (sets `uploaded_at`, records size + MIME).

**Rationale**:
- Tenant-prefixed keys give a belt-and-suspenders isolation — even if RLS somehow fails, the R2 key schema blocks cross-tenant access.
- Two-step presigned upload keeps the Worker's CPU budget small (no streaming multi-MB bodies through the Worker).
- 5-minute TTL on download URLs balances UX (page-load + a download click) against the risk of long-lived hot links.

**Alternatives considered**:
- *Stream uploads through the Worker*: simpler DB flow, but a 10 MB file on CF Workers can exceed the CPU-time limit on cold starts; and consumes egress-class bandwidth from the Worker.
- *Direct-to-R2 multipart upload with CORS*: same outcome as presigned PUT for our file sizes; presigned PUT is simpler.

---

## R5 — File type whitelist & size cap

**Decision**: Accept `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx), `application/msword` (doc), `image/jpeg`, `image/png`, `application/zip`. Size cap: **10 MB per file**. Enforce at three layers: client-side Zod validation + HTML5 `accept` attr, API route schema, and the signed-URL's `Content-Length` check on finalization.

**Rationale**: Covers CVs (PDF/Word), scanned IDs (JPG/PNG), and batched documents (ZIP). 10 MB is generous for a single CV without opening the door to video/media.

**Alternatives considered**:
- *Allow everything under 25 MB*: invites abuse (video uploads) and increases R2 storage costs.
- *Different caps per file type*: not worth the UX confusion for v1.

---

## R6 — Optimistic concurrency for status transitions

**Decision**: The transition request carries `from_status` — the status the actor sees on their screen when they submit. The service compares it to the DB's current status inside the same transaction that does the update; mismatch → HTTP 409 with the current status payload. FR-037 is satisfied cleanly without adding a version column.

**Rationale**: The `from_status` field is already a required part of the audit `old_values` — reusing it as the concurrency check costs nothing. Zero extra schema.

**Alternatives considered**:
- *`row_version` integer incremented on every write*: more precise (catches any field edit, not just status), but complicates every write and isn't needed for spec correctness.
- *ETag on GET + `If-Match` on PATCH*: HTTP-idiomatic but extra client work; skipped for v1.

---

## R7 — Per-client `form_config` consumption

**Decision**: At candidate-creation time, the API fetches the target client's `form_config` JSONB (already exposed by the `clients` module's public interface per its module docs). The candidate module:

1. Reads the JSONB.
2. Derives a Zod schema dynamically from the config (`z.object({...})`) — a small `buildDynamicSchema(formConfig)` utility in `packages/shared/src/candidates/` keeps the logic shared.
3. Validates the client-submitted `additional_fields` payload against that schema.
4. Stores the raw validated payload in `candidates.additional_fields` JSONB.

The web `CandidateForm.tsx` uses the same `buildDynamicSchema` + React Hook Form + `@hookform/resolvers/zod` to render the correct inputs and validate client-side before submit.

**Rationale**: Single source of truth (clients owns `form_config`); shared utility means API and Web cannot drift. No schema change to `clients.form_config`.

**Alternatives considered**:
- *Copy the form_config onto the candidate at create time*: easier audit ("what schema did this candidate fill out?"), but creates drift when the client admin edits the config. Skipped for v1; revisit if auditors ask.

---

## R8 — Rejection/decline category model & tenant seed

**Decision**: Two independent tenant-scoped tables — `rejection_categories` and `decline_categories` — each `(id, tenant_id, label, is_active, created_at, updated_at)`. Default catalog seeded on tenant provisioning (via the future `tenants` module; for now seeded via migration + test factory):

- Rejection defaults: "Not qualified", "Overqualified", "Salary mismatch", "Failed background check", "Cultural fit", "Other".
- Decline defaults: "Counter-offer accepted", "Moved location", "Role mismatch", "Compensation", "Withdrew without reason", "Other".

Historical audit rows snapshot the label at transition time (in `new_values.rejection_category_label`) so a later rename or deactivation does not rewrite history. FR-051 is met.

**Rationale**: Two tables rather than one with a `type` column keeps SQL queries precise and the Zod schemas clean.

**Alternatives considered**:
- *Single `candidate_outcome_categories` table with a `kind` enum*: fewer tables, but Zod validation branches awkwardly; rejected.
- *Hardcoded category list in code*: fastest but blocks per-tenant customization required by FR-050; rejected.

---

## R9 — Retention review reminder

**Decision**: A `retention_reviews` table holds one row per completed annual review per tenant `(id, tenant_id, reviewer_user_id, reviewed_at, next_due_at, justification_text)`. On admin login, the web shell queries an endpoint `GET /api/retention-reviews/status` that returns `{ next_due_at, days_remaining, status: "ok" | "due_soon" | "overdue" }`. When `status !== "ok"`, the admin sees a dismissable banner in the shell header (integration point with the 005 header — dismissal is per-session only). An overdue review does NOT block operations (we never hard-fail on compliance UX); it only raises UI pressure.

**Rationale**: FR-003a requires an annual review + 30-day reminder; a DB-backed review log + UI banner satisfies both without adding a scheduled Worker. Avoids the extra infra cost of a cron worker for a monthly check.

**Alternatives considered**:
- *CF Worker cron that emails admins*: proper but requires an email service integration; out of scope for this module. Revisit in a notifications module.
- *Just a column on `tenants`*: loses history of past reviews.

---

## R10 — PII redaction in logs

**Decision**: A tiny util at `apps/api/src/modules/candidates/redact.ts` exports `redact(candidate)` returning a safe object: `{ id, tenant_id, client_id, status, is_active, registering_user_id }` — plus a generic `redactObject(obj, piiKeys)` for ad-hoc use. All logging inside the candidates module MUST route through `redact` or an explicit safe subset. An integration test asserts no plain-text PII appears in `console.log`/`console.error` output when stubbed during a fake run of every endpoint.

**Rationale**: Keeps FR-004 enforceable by test, not just by code review.

**Alternatives considered**:
- *Winston/Pino with built-in redaction*: fine libraries, but Workers runs on the base `console`. A 20-line util fits the constraint without a dependency.

---

## R11 — Privacy notice versioning

**Decision**: Keep a single table `privacy_notices (id, tenant_id, version, text_md, effective_from, is_active)` and store `privacy_notice_id` on the candidate at the moment of acknowledgement (alongside `privacy_notice_acknowledged_at` from FR-013). Admin-level notice updates create a new row and flip `is_active` on the previous; existing candidates keep their original acknowledgement reference.

**Rationale**: Covers the future need to prove *which version* of the LFPDPPP notice the candidate accepted without forcing retro-acks. Small cost now, large compliance payoff later.

**Alternatives considered**:
- *Store the full notice text inline on each candidate*: wastes storage at 50 k×3 KB = 150 MB per tenant.
- *No versioning, track only the timestamp*: loses the exact text shown; blocks defensible compliance responses.

---

## Summary of decisions

| ID | Decision | Locks |
|---|---|---|
| R1 | Two-layer FSM: legal edges + role gate | `packages/shared/src/candidates/status.ts`, `apps/api/src/modules/candidates/fsm.ts` |
| R2 | Phone normalization + exact-match duplicate check | `duplicates.ts`, index on `(tenant_id, phone_normalized, client_id) WHERE is_active` |
| R3 | Reuse existing `audit_events` table with canonical action strings + append-only grants | `0004_candidates_rls.sql` |
| R4 | R2 presigned PUT + 5-min signed GET; tenant-prefixed keys | module-scoped storage util |
| R5 | File types PDF/DOCX/DOC/JPG/PNG/ZIP ≤ 10 MB | Zod schema + client-side guards |
| R6 | `from_status` concurrency check inside transaction | service layer |
| R7 | Shared `buildDynamicSchema(formConfig)` | `packages/shared/src/candidates/` |
| R8 | Two tables for rejection/decline categories; label snapshot on audit | new DB tables |
| R9 | `retention_reviews` + shell banner for admins | new DB table + shell integration |
| R10 | `redact()` helper + zero-PII-log test | `redact.ts` + dedicated test |
| R11 | `privacy_notices` table + per-candidate `privacy_notice_id` | new DB table |

All `NEEDS CLARIFICATION` items resolved. Ready for Phase 1.
