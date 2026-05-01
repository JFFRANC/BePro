# Phase 0 — Research: Client Detail UX + Contact Cargo + Candidate Base-Form

**Date**: 2026-05-01
**Status**: Complete — all NEEDS CLARIFICATION resolved.

This document consolidates the research needed before locking the data model and contracts.

---

## R-01 — Description rendering: collapse newlines, or preserve them as visible line breaks?

**Decision**: Preserve newlines. Render the description in a `<p>` (or `<div>`) styled with `whitespace-pre-line`. Spaces collapse normally; `\n` produces a visible break.

**Rationale**:
- Users will paste multi-line content from email/WhatsApp ("Manufactura de autopartes\nPlanta San Juan del Río\nContacto principal: Mariana"). Collapsing to a single line erases that structure and forces them to re-format on every save.
- `whitespace-pre-line` is the safest CSS choice: it preserves `\n` but collapses runs of spaces, which prevents pasted-text artifacts (multiple trailing spaces, accidental tabs) from inflating the visual height.
- `pre-wrap` would also preserve internal whitespace runs — overkill for a description field and visually noisy.
- React's default escaping still applies; HTML/markdown markup is shown literally (E-02 honored).

**Alternatives considered**:
- *Collapse all whitespace* (`whitespace-normal`): simpler, but fails the realistic paste flow.
- *Render as Markdown*: out of scope (spec §Out of Scope) and a security expansion.

---

## R-02 — "Copiar ubicación": what exactly gets written to the clipboard?

**Decision**: Copy `client.address` verbatim, after collapsing internal whitespace runs to a single space and trimming. Do **not** prepend the client name. The button is hidden when `address` is empty (FR-007 already covers this implicitly via E-01).

Implementation contract (in `apps/web/src/modules/clients/components/CopyAddressButton.tsx`):

```ts
const formatted = address.replace(/\s+/g, " ").trim();
await navigator.clipboard.writeText(formatted);
toast.success("Ubicación copiada");
```

Non-secure-context fallback (no `navigator.clipboard`):

```ts
toast.message("Copia manual: " + formatted, { duration: 8000 });
```

**Rationale**:
- The user's stated intent is "paste into WhatsApp without typing." A bare address pastes cleanly into the WhatsApp location bar / Maps deep links. Prepending the client name forces users to delete it 80% of the time.
- Whitespace normalization removes paste artifacts so the clipboard payload matches what the user sees.
- The 8-second fallback toast gives enough time to hand-select the address text from the toast itself.

**Alternatives considered**:
- *Compose `${client.name} — ${address}`*: rejected, see above.
- *Compose a full vCard / `geo:` URI*: out of scope; would require `latitude/longitude` (often null in real data).
- *Use the older `document.execCommand("copy")` for the fallback*: discouraged by every modern browser; the toast-with-text approach is the simplest robust path.

---

## R-03 — Tab rename: does `ClientDetailPage` use a URL segment per tab today?

**Decision**: It does **not**. The current `ClientDetailPage.tsx` uses `<Tabs defaultValue="contacts">` with in-memory tab state — no `useSearchParams`, no nested routes per tab. Therefore:

- Rename: `value="config"` → `value="form"`, label `"Configuración"` → `"Formulario"`.
- The defensive client-side redirect from `/clients/:id/config` (FR-008, E-05) is implemented as a `useEffect` that reads `useLocation().pathname`, detects a stray `/config` suffix (in case a future router introduces one or a stale cached URL hits the route), and `navigate(/clients/:id, { replace: true })`. Today this is a near-no-op; tomorrow it stays correct.
- There are no internal `<Link to=".../config">` references in the codebase to update beyond renaming the tab `value`.

**Rationale**:
- Verified by inspecting `apps/web/src/modules/clients/pages/ClientDetailPage.tsx` (line 147–175 in the current `main` snapshot). The Tabs component holds its own selected value; URL is unchanged when switching tabs.
- Building a URL-segment redirect is cheap insurance — costs ~6 lines of code and prevents future bookmark breakage if the router model evolves.

**Alternatives considered**:
- *Add full `useSearchParams` per-tab persistence as part of this feature*: out of scope and risks a bigger refactor than the spec calls for.

---

## R-04 — "Primary AE" definition (no `primary_account_executive_id` column exists)

**Decision**: Define **primary AE** as the **earliest-assigned account executive** of the client — i.e., the `client_assignments` row where `user_id` is itself an AE (that row has `account_executive_id IS NULL` AND the linked user has `role = 'account_executive'` AND the linked user has `is_active = true`), ordered by `created_at ASC`, take first. If zero matching rows exist, the field is empty.

> Note on "active": `client_assignments` has no `is_active` column today — assignments are managed by 008's batch-diff (insert/delete rows). Therefore every row that still exists in `client_assignments` is by definition "current". The activeness filter is applied to the **joined user** (`users.is_active = true`) so a deactivated AE does not surface as the primary AE on a stale assignment row.

API surface (in `apps/api/src/modules/clients/service.ts`):

- Extend `getClientDetail()` to populate `primaryAccountExecutiveName` in the returned DTO. Computed on the fly via a single LEFT JOIN to `users.full_name`. Stored nowhere — recomputed per request.
- Extend `IClientDetailDto` (in `packages/shared/src/types/client.ts`) with `primaryAccountExecutiveName?: string`.

UI consumption (in `apps/web/src/modules/candidates/components/RegisterCandidateForm.tsx`):

- On form mount, set the default value of `accountExecutiveName` to `client.primaryAccountExecutiveName ?? ""`. The recruiter can edit. The form already loads the client detail via TanStack Query (`useClient(clientId)`).

**Rationale**:
- The codebase has no "primary" flag and no column; introducing one would be a multi-feature data-model change and require a backfill decision per tenant. Pure speculation about future intent.
- The "earliest assigned" rule is deterministic, requires zero schema work, and matches user intuition ("the first AE we put on this client"). It also matches what 008's `AssignmentTable` shows by default — the top row is the earliest-assigned AE.
- Pre-fill + editable means the recruiter can override in the (rare) case where the second-assigned AE is the actual contact for this candidate.

**Alternatives considered**:
- *Add a `primary_account_executive_id` column on `clients`*: out of scope; would require admin UI to set it and a backfill decision. Punted to a future feature if the team finds the deterministic ordering insufficient.
- *Always leave the field empty*: rejected — the user explicitly accepted "pre-fill from client's primary AE" in clarify session Q3.
- *Render a Select among all assigned AEs*: rejected — would inflate the form footprint and contradict the user's stated goal of pre-fill + edit.
- *Use the latest-assigned AE*: less intuitive; "earliest" matches the assignment table's display order.

**Implication for spec**: FR-015's wording "client's primary AE (resolved via `clients.primary_account_executive_id`)" is technically incorrect because that column does not exist. The plan and contracts use the operational definition above. The spec text remains valid in intent — both Q3's clarification and FR-015 say "the client's primary AE name" without committing to a specific column. This document is the source of truth for the resolution mechanism.

---

## R-05 — Pre-deploy migration script: idempotency and tenant ordering

**Decision**: Single-script, multi-pass, **idempotent** approach. Implemented in TypeScript (`scripts/012-rename-legacy-formconfig-collisions.ts`), executed via `pnpm --filter scripts run 012-migrate` (or equivalent). Connects with `DATABASE_URL` (admin / `neondb_owner` role — bypasses RLS — needed to scan all tenants).

Per tenant, in a single transaction:

1. SELECT `clients.id`, `clients.form_config` for that tenant.
2. For each client row, compute `collisions = formConfig.fields[].key ∩ BASE_CANDIDATE_FIELDS`.
3. If empty → no-op for this client.
4. Else: rewrite `form_config.fields[]` so each colliding `key` becomes `legacy_<key>`, preserving `label`, `type`, `required`, `options`, `archived`, `createdAt`, and `updatedAt`.
5. UPDATE `clients SET form_config = $1, updated_at = now() WHERE id = $clientId`.
6. SELECT `candidates.id`, `additional_fields` for the same client; for each, if `additional_fields[k]` exists for any colliding `k`, copy the value to `additional_fields[legacy_<k>]` and delete the old key.
7. UPDATE `candidates SET additional_fields = $1`.
8. Append one `audit_events` row per tenant: `{ event: "012_legacy_formconfig_collision_rename", diff: { renames: [{ key, count }, ...] } }`.

**Idempotency**: re-running the script after step 4 sees no collisions on `form_config` (already renamed) and exits per-tenant in step 3.

**Dry-run flag**: `--dry-run` prints the per-tenant rename summary without writing.

**Rationale**:
- One transaction per tenant scopes the blast radius if a tenant has a malformed `form_config`. Keep going for the other tenants and report.
- Audit row gives a permanent forensic trail (constitution §VI).
- Zero data loss: every captured value is moved, not dropped.
- Running outside RLS is required to span tenants. The script connects with admin credentials, never the Worker `app_worker` role.

**Alternatives considered**:
- *Per-row `UPDATE … SET form_config = jsonb_set(...)`*: doable in pure SQL but loses the per-tenant rollup audit. Higher risk if multiple collisions overlap.
- *Auto-run on first deploy via a Worker cron*: rejected — surprise data mutations should run by hand under human supervision.

---

## R-06 — Audit diff envelope for `client_updated` and `contact_updated`

**Decision**: Continue using the existing `audit_events.diff` JSONB envelope: `{ <fieldName>: { old: <value>, new: <value> } }`. No new event type, no new column. The existing `client_updated` event extends naturally to include `description`; the existing `contact_updated` event extends to include `position`.

**Rationale**:
- 008 already established this shape for arbitrary fields; the diff is a free-form JSONB. No code changes beyond the service computing the diff before the UPDATE.
- Keeps the audit query surface unchanged (no new event types to filter on; downstream readers already iterate over `diff` keys).

**Alternatives considered**:
- *Introduce `client_description_updated` / `contact_position_updated` event types*: rejected — pollutes the event space and requires audit consumers to learn new types for marginal value.

---

## R-07 — JSONB `additional_fields` and the application-layer FK enforcement for `positionId`

**Decision**: At candidate-create time, the service runs a single SELECT against `client_positions` with `WHERE id = $positionId AND client_id = $clientId AND is_active = true` (RLS already filters by tenant). If 0 rows, return 400 with `{ field: "positionId", message: "El puesto seleccionado no existe en este cliente." }`.

**Rationale**:
- JSONB does not enforce referential integrity natively. Without this check, a recruiter could submit a stale `positionId` (deleted/archived position) and corrupt a candidate's record.
- The check is one extra SELECT per candidate-create, p99 < 5 ms — well within budget.
- The Zod schema marks `positionId` as `uuid`, so the format is already validated before the SELECT runs.

**Alternatives considered**:
- *Trigger-based enforcement on the `candidates` table*: PostgreSQL doesn't support FK constraints into JSONB fields; would need a CHECK constraint with a function — high complexity, low payoff.
- *Skip the check and rely on the UI*: rejected — server is the last line of defense (constitution §VI).

---

## Decisions summary table

| Topic | Decision |
|---|---|
| R-01 description newlines | `whitespace-pre-line`; `\n` preserved, runs of spaces collapse. |
| R-02 clipboard payload | Bare `client.address`, whitespace-normalized; no client name prefix. |
| R-03 tab URL segment | None today; rename is `value` + label only; defensive `/config` redirect added. |
| R-04 primary AE | Earliest-assigned AE row by `client_assignments.created_at`; surfaced as `primaryAccountExecutiveName` on the client detail DTO. |
| R-05 migration script | Idempotent TS script, per-tenant transactions, dry-run flag, audit row per tenant. |
| R-06 audit diff | Existing `client_updated` and `contact_updated` events extended; no new event types. |
| R-07 positionId FK | Application-layer SELECT against `client_positions` at candidate-create. |

All NEEDS CLARIFICATION resolved. Phase 1 may proceed.
