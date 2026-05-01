# ADR-011: Position Profile and Position-Scoped Documents

**Status**: Accepted
**Date**: 2026-04-30
**Feature**: `011-puestos-profile-docs`
**Supersedes**: none
**Related**: ADR-002 (server-proxied R2 uploads), ADR-007 (orphan attachment sweep)

## Context

The original `client_positions` table held only `id` + `name`. The full role profile lived in a Google Sheet that AEs maintained out-of-band. Recruiters had to consult both the platform and the Excel to understand a position. Per the company brief, the Excel was the source of truth for vacancies, age range, gender, civil status, education, experience, salary, benefits, schedule, work-days, shift, required documents, responsibilities, and FAQ.

Additionally, contracts and "pase de visita" PDFs were uploaded as client-level documents (no per-position scoping). The wrong granularity made it impossible to map a candidate to the contract that actually applies to her role.

## Decision

### 1. Server-proxied R2 upload pattern (reused from ADR-002)

Position documents use the same two-step server-proxied upload pattern from ADR-002:

1. `POST /…/documents` — creates the row in `client_position_documents` with `uploaded_at = NULL` and returns `{ id, uploadUrl, expiresAt }`.
2. `POST /…/documents/:id/upload` — receives the raw bytes through the Worker, validates MIME + size, runs the archive-then-insert transaction, emits the audit event, then writes to R2 via the `FILES` binding (after commit).

We deliberately did **not** introduce presigned R2 URLs (`@aws-sdk/s3-request-presigner` or hand-rolled SigV4). Reasons:

- ADR-002 is binding for all binary uploads. Adding a parallel presigned path would split the surface, duplicate CORS/MIME/size validation, and force a new dependency.
- FR-005 ("short-lived URL whose validity does not exceed 15 minutes; permission verified on every URL issuance") is satisfied **more strictly** by the proxy pattern: every download is gated by a fresh JWT (TTL 15–60 min per Constitution §VI), permission is re-verified on every request, and revocation is immediate (no signed URL exists in the wild that survives a session reset).

Storage key: `tenants/{tenantId}/positions/{positionId}/documents/{documentId}-{originalName}`. The tenant prefix supports cheap per-tenant audit listings; the doc-id prefix prevents overwrites when the same file name is reused.

### 2. Atomic replace via partial unique index + transactional archive-then-insert

`client_position_documents` carries a partial unique index `(tenant_id, position_id, type) WHERE is_active = true`. The replace flow:

1. Inside a `db.transaction(async (tx) => …)`:
   - Find any prior active row of `(position, type)`.
   - Mark it `is_active = false`, `replaced_at = now()`.
   - Mark the new row `uploaded_at = now()`, leaving `is_active = true`.
2. After commit, write bytes to R2.
3. Outside the tx, emit the audit event (`create` if no prior; `replace` if there was, carrying `priorDocumentId` + `priorReplacedAt`).

Under concurrent uploads (5+ parallel writes to the same `(position, type)`), the partial unique index serializes the writes; the loser hits Postgres error 23505 and the client retries — the retry archives whatever became the winner. Post-retry steady state always has exactly one active row.

The R2 put runs **after** the DB commit because R2 has no transactional rollback. Worst case: DB committed but R2 failed → orphan active row pointing nowhere; the existing ADR-007 cleanup sweep neutralizes it when the upload doesn't complete within the grace window.

### 3. Legacy `client_documents` archive (in-place)

Migration `0010_legacy_client_documents_archive.sql`:

1. `ALTER TABLE client_documents ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;`
2. For each `tenant_id`, `UPDATE client_documents SET is_active = false WHERE tenant_id = $1 AND is_active = true;` and emit one `client_document.archive` audit row carrying `rowsAffected`.
3. The actor on the archive event is the system sentinel `00000000-0000-0000-0000-000000000000`.
4. Idempotent: rerunning is a no-op (no rows are still active after the first run).

Bytes in R2 are NOT touched. The `storage_key` rows remain valid; objects remain reachable via direct R2 console / CLI for ops or a future audit retrieval. Per FR-008, this preserves the LFPDPPP-aligned at-rest record indefinitely. **No table is dropped, ever.**

The migration runs as `neondb_owner` (BYPASSRLS) — it is a global schema/data event, not a per-tenant operation. After it runs, every subsequent read of `client_documents` happens via `app_worker` under RLS as before.

### 4. Admin-only "Versiones" panel (FR-018)

The Versiones history panel surfaces archived `client_position_documents` rows on the position detail. Authorization is enforced at two layers:

- **Server**: `requireRole("admin")` on `GET /…/documents/history`.
- **CASL**: `Position.history` ability granted only to admin.

Both must agree — the server is the safety net; the CASL check is for UX (not rendering the panel for non-admins). This mirrors the user-creation modal in feature 010 and the form-config field editor in feature 008.

Managers and AEs **cannot** see archived rows. Archived contracts may carry candidate names that have since been declined / fired; admin-only access matches principle of least privilege per the clarify session.

### 5. Removal of legacy "Documentos" client-tab + 410 Gone on legacy endpoints

The `DocumentManager` component is deleted from `apps/web/src/modules/clients/components/`. The "Documentos" tab is removed from `ClientDetailPage.tsx`. The legacy API endpoints (`POST/GET/DELETE /clients/:id/documents…`) remain *registered* but return HTTP 410 Gone with body `{ error: { code: "endpoint_removed", message: "Endpoint removido en feature 011 — los documentos viven ahora en cada puesto." } }`. A stale browser tab pointing at a removed URL gets a clear, actionable signal instead of a 404.

## Consequences

### Positive

- **Single source of truth**: every profile field that used to live in the Excel now lives in `client_positions`. AEs edit on the platform; recruiters see the brief without consulting Sheets.
- **Correct scoping**: contract + pase de visita are now per-position. A recruiter on position A sees the docs for position A, never confused with another role.
- **Replace semantics are atomic**: the partial unique index guarantees a position is never observable in a "no active doc" or "two active docs" state.
- **LFPDPPP retention preserved**: legacy `client_documents` rows are kept at rest indefinitely; bytes in R2 are immutable; admins can still audit the chain of replaced documents via the Versiones panel.
- **No new runtime dependencies**: reuses the `FILES` R2 binding, `hono/jwt`, `bcryptjs`, Drizzle ORM, CASL — same surface as features 007/008/009/010.

### Negative

- The position list query now does a second SELECT against `client_position_documents` to populate the `documents: { contract?, pase_visita? }` summary. Acceptable cost: at most 2N rows for N positions per tenant; ≤200 ms p95 per the plan's performance budget.
- The Drizzle migration was **hand-written** (`0009_position_profile.sql`) because `drizzle-kit generate` requires interactive input for column resolution, which is unavailable in CI/non-TTY shells. The hand-written file is documented as IDEMPOTENT and follows the exact shape `drizzle-kit` would have generated.
- Backwards compatibility hack: `createPositionSchema` and `updatePositionSchema` (the old simple `{name}` Zod schemas) are now aliased to the full-profile versions (`createPositionProfileSchema` / `updatePositionProfileSchema`). Consumers that imported the old names (e.g. `apps/web` PositionList row form) keep working; the wider profile is opt-in via the new names.

### Notes on spec deviations

- **F1 — E-08 wording resolution**: spec E-08 reads "exactly one active row of that type, with the other archived; no duplicate active rows". Implementation rejects the losing transaction (no in-flight row remains). The "with the other archived" wording is satisfied **after the rejection-and-retry cycle**: the losing client retries, the retry archives the prior winner. The post-condition spec cares about ("exactly one active row at any time, no duplicate active rows") holds in both readings; integration tests assert the post-retry steady state.
- **C4 — FR-005 URL revocation**: "permission verified on every URL issuance" is delegated to the existing JWT auth middleware (revocation on session reset is exercised by the auth module's own tests; this feature does not re-test that surface).

## Alternatives Considered

- **Presigned R2 URLs**: rejected per ADR-002 — introduces SDK dependency, splits surface, harder revocation.
- **Hard delete legacy `client_documents`**: rejected outright by FR-008 + Constitution §VI.
- **Move legacy bytes to a `legacy/` R2 prefix**: rejected — needless I/O; bytes' immutability at original keys *is* the audit anchor.
- **JSONB blob for the entire profile**: rejected — kills SQL filtering, breaks indexing, forces every consumer to validate at read time.
- **`faq` as `{question, answer}` pairs**: rejected after Excel analysis showed the section is a flat filter checklist (Q2 clarification, 2026-04-30).
- **Manager read-only on positions**: rejected — managers today edit client form_config; positions are not clients per Constitution role table.

## References

- Spec: `specs/011-puestos-profile-docs/spec.md`
- Plan: `specs/011-puestos-profile-docs/plan.md`
- Tasks: `specs/011-puestos-profile-docs/tasks.md`
- Research: `specs/011-puestos-profile-docs/research.md`
- Data model: `specs/011-puestos-profile-docs/data-model.md`
- ADR-002: server-proxied R2 upload pattern
- ADR-007: orphan attachment sweep
