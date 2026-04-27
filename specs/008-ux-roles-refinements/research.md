# Research — UX, Role Scoping, and Configurability Refinements

**Feature**: 008-ux-roles-refinements
**Date**: 2026-04-23

The spec has no unresolved clarifications. Research focuses on *how* each story lands against the existing stack.

---

## R-01 — Header user menu composition

**Decision**: Build `UserMenu.tsx` on top of the shipped `DropdownMenu` + `Avatar` primitives (shadcn). Identity is read from the existing `useAuth()` hook. Logout triggers the current `authService.logout()` path (refresh-token revocation) and clears Zustand auth state, then navigates to `/login`.

**Rationale**:
- Both primitives already exist in `apps/web/src/components/ui/` (verified during audit).
- `useAuth()` already exposes the session — no new provider needed.
- Header slot is reserved (`Header.tsx:21 "Reservado para Phase 9: NotificationsBell, UserMenu"`). No layout work required.

**Alternatives considered**:
- Home-grown popover: rejected — reinvents what shadcn `DropdownMenu` already solves with keyboard and a11y defaults.
- Keep logout only on the dashboard placeholder: rejected — fails FR-HD-002 and is a session/security regression.

**Open items**: None for MVP. Profile picture upload is explicitly out of scope (A-06); `Avatar` falls back to initials tile via its built-in `AvatarFallback`.

---

## R-02 — Optimistic inline status transition

**Decision**: A `useTransitionCandidate` TanStack Query mutation wraps the existing `candidateApi.transition()` call. Cache key is `CANDIDATE_KEYS.list(filters)`. On `onMutate` we snapshot the list query, optimistically update the row's status. On `onError` we roll back and emit a `sonner` error toast. On `onSettled` we `invalidate` the detail and list queries to reconcile with server state (audit/timestamps).

**Rationale**:
- Optimistic UX is critical for the 3× speed SC-001.
- `tanstack-query-best-practices` skill explicitly recommends `onMutate` + snapshot/rollback for per-row mutations on a list.
- Server returns the full updated candidate, so `setQueryData` for the detail cache is free of round-trips.

**Alternatives considered**:
- Pessimistic-only with a spinner: rejected — loses the SC-001 speed goal.
- Client-side websocket push for row updates: rejected — infra scope creep; not needed at current scale.

**Failure mode handled**: stale client vs. server FSM change. The server returns a typed 409 (`invalid_transition`). The hook catches it and re-fetches the row before showing the "estado cambió, intenta de nuevo" toast.

---

## R-03 — Hidden tenant field on login

**Decision**: Add a build-time config flag `VITE_LOGIN_TENANT_FIXED` (default `"bepro"`). When set, `LoginForm.tsx` does not render the input and the form submits the fixed value. When the env var is unset or empty string, the field renders as today (current behavior preserved for tests and for when we re-enable it).

**Rationale**:
- Keeps the input schema intact — `loginSchema` still requires `tenantSlug`, which means no shared/API change.
- A single env var is the minimum surface for "turn it off now, turn it back on later" — no feature-flag service needed.
- Unit tests that already cover the field behavior continue to pass by leaving the flag unset in the test environment.

**Alternatives considered**:
- Runtime flag from the backend: rejected — would introduce a fetch before login can render (cold start).
- Drop the field from the schema entirely: rejected — blocks the re-enable path and the existing tenant-aware flows (seed tooling, admin onboarding).

---

## R-04 — Batch AE↔client assignment

**Decision**: Add `POST /api/clients/:clientId/assignments/batch` accepting `{ userIds: string[] }`. The service computes the diff against existing rows inside a Drizzle transaction under `SET LOCAL app.tenant_id = $1`:
- For each `userId` present in the new set but absent in the current set: `INSERT` (or `UPDATE ... is_active = true` if a soft-deleted row exists).
- For each `userId` absent from the new set but present: soft-delete (`is_active = false`).
- Everything in one transaction; partial failure aborts the whole diff.

**Rationale**:
- The `client_assignments` table and RLS policies from the clients module already support many-to-many.
- Transactional diff beats "N sequential calls" both in user-perceived latency and in atomicity.
- Soft-delete (vs. hard-delete) keeps the audit trail intact per constitution §VI.

**Alternatives considered**:
- Two endpoints (`POST` for add, `DELETE` for remove) called N times: rejected — produces N audit events and is non-atomic.
- Only accept the diff from the client: rejected — the client would need to track the previous state; easier and safer to send the desired end-state and have the server compute the diff.

**Role gating**: reuse `requireRole(["admin", "manager"])` middleware (admins and managers manage assignments).

---

## R-05 — Custom fields in client `formConfig`

**Decision**: The existing `FormFieldConfig` in `packages/shared/src/candidates/form-config.ts` already models `{ key, label, type, required, options? }`. Expose CRUD via two endpoints:
- `POST /api/clients/:clientId/form-config/fields` — append a new field.
- `PATCH /api/clients/:clientId/form-config/fields/:key` — edit label / required / options, or set `archived: true`.

Server-side validation via a Zod schema in `@bepro/shared` (`formConfigFieldSchema`) enforces:
- Unique `key` within the client's config (case-insensitive).
- `key` pattern `^[a-z][a-z0-9_]{0,30}$` (snake_case, URL-safe, collision-free with future column names).
- `type ∈ { "text", "number", "date", "checkbox", "select" }` (FR-FC-006).
- `options: string[]` required and non-empty when `type === "select"`.
- `archived: boolean` (default false). Archived fields are filtered out of the candidate-create form but kept in the JSONB for historical values.

**Rationale**:
- No migration: `clients.form_config` is JSONB. Adding `fields[]` entries preserves read compatibility with today's 8 toggles (`showAge`, etc.) because those are sibling keys.
- The dynamic form in `CandidateForm.tsx:50-65` already walks `formConfig.fields`; it just hasn't had any production data under that key. We get rendering for free.
- Archiving instead of deleting preserves historical per-candidate values under the same key (A-07 parallel).

**Alternatives considered**:
- Separate `custom_fields` table: rejected — over-engineered for single-tenant JSON shape.
- Allow arbitrary JSON types (including nested): rejected — unvalidated inputs break the renderer and the dynamic Zod schema.

---

## R-06 — Spanish label map for statuses

**Decision**: Add `CANDIDATE_STATUS_LABELS_ES` in `packages/shared/src/candidates/status.ts` next to the existing English `CANDIDATE_STATUS_LABELS`. Export a `statusLabel(status, lang?)` helper defaulting to `"es"`. All web callers switch to `statusLabel()` with no argument. A runtime guard logs a warning (and returns the English token) when a new status is added without a Spanish entry — caught in CI by a presence test.

**Spanish mapping (v1)**:

| Enum (EN) | Label (ES) |
|---|---|
| `Registered` | Registrado |
| `InterviewScheduled` | Entrevista programada |
| `Attended` | Asistió a entrevista |
| `NoShow` | No asistió |
| `Approved` | Aprobado |
| `Rejected` | Rechazado |
| `Hired` | Contratado |
| `Declined` | Declinado |
| `InGuarantee` | En periodo de garantía |
| `GuaranteeMet` | Garantía cumplida |
| `Replacement` | En reemplazo |
| `Termination` | Terminado |
| `Inactive` | Inactivo |
| `Reactivated` | Reactivado |

**Rationale**:
- One module handles both languages; no i18n framework.
- The English source stays for log/audit payloads (where enum tokens are canonical).
- Category enums (rejection/decline) use tenant-managed labels already (verified during audit); no mapping needed there beyond a fallback.

**Alternatives considered**:
- Full `react-intl` / `i18next`: rejected — adds a runtime dependency for a 14-row map.
- Rename the enum values to Spanish: rejected — breaks audit trail, existing tests, and cross-system interop.

---

## R-07 — Privacy-notice UI removal without data loss

**Decision**: Remove three UI surfaces:
1. `PrivacyNoticeCheckbox.tsx` import + render in `NewCandidatePage.tsx`.
2. Privacy-notice management page under tenant admin (if rendered via a route — to be verified during implementation; remove the route and the menu item).
3. The "Accepted privacy notice at / by" block on `CandidateDetailPage.tsx`.

Keep:
- `privacy_notices` table and `candidates.privacy_notice_id` column — untouched in DB.
- API endpoint `POST /api/candidates` — relaxed to accept `privacyNoticeId` as optional; service skips the verification when absent; when present (legacy clients), it still validates against the tenant's active notice.

**Rationale**:
- Constitution §VI amendment (see plan.md Complexity Tracking) realigns the principle with the operating model.
- Preserving the column and rows honors LFPDPPP evidentiary retention.
- Keeping the endpoint backward-compatible avoids a client release-ordering constraint.

**Alternatives considered**:
- Drop the column + tables: rejected — destroys compliance evidence.
- Require a feature flag to toggle the UI: rejected — the UI is simply removed; there is no "put it back" path planned.

---

## Summary of research outcomes

| Area | Outcome | Risk after research | Migration? |
|---|---|---|---|
| Header user menu | shadcn primitives, `useAuth()` | Low | None |
| Inline transition | TanStack mutation, optimistic + rollback | Low | None |
| Login tenant hide | `VITE_LOGIN_TENANT_FIXED` env, default `"bepro"` | Low | None |
| Batch assignments | Transactional diff, soft-delete for removals | Low | None |
| Custom formConfig fields | JSONB `fields[]`, Zod-validated, archive-on-remove | Low | None |
| Spanish labels | New map + helper in `@bepro/shared` | Low | None |
| Privacy notice removal | UI removal, schema kept read-only | Medium (constitution amendment) | None |
