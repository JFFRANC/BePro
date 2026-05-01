# ADR-012 — Client detail UX + contact cargo + candidate base-form hardening

**Status**: Accepted
**Date**: 2026-05-01
**Spec**: `specs/012-client-detail-ux/`

## Context

Feature 012 bundles three threads against the `clients` and `candidates` modules:

1. **Client detail UX** — add `clients.description text NULL CHECK char_length ≤ 2000`, restructure the detail page into a 2-column desktop grid with a clipboard "Copiar ubicación" affordance, rename the admin tab "Configuración" → "Formulario" with a defensive `/config` redirect.
2. **Candidate base-form lock** — guarantee the nine BASE_CANDIDATE_FIELDS keys are present on every newly-created candidate and protect the `formConfig.fields[]` editor against collisions with those keys.
3. **Contact cargo** — add `client_contacts.position varchar(120) NULL` end-to-end (form, list, audit diff).

## Decisions

### D-1 — `BASE_CANDIDATE_FIELDS` is a frozen contract in `@bepro/shared`

Exported from `packages/shared/src/candidates/base-fields.ts` as a 9-entry `Object.freeze`d array. Every consumer (Formulario tab UI, candidate registration form, API service, pre-deploy migration script) imports the same source of truth.

- Order is part of the contract — the candidate form renders fields in the documented order.
- Mutation is a runtime error in strict mode (Object.isFrozen + nested freeze).
- The shared package's `dist/` cache is rebuilt before consumer tests (per `packages/shared/CLAUDE.md`).

**Why**: a single static contract avoids drift between three consumers and makes the migration script's collision detection trivial.

### D-2 — Application-layer FK enforcement for `additional_fields.positionId`

Per research §R-07: PostgreSQL doesn't support FK constraints into JSONB. At candidate-create time the service runs one SELECT against `client_positions WHERE id = $positionId AND client_id = $clientId AND is_active = true`. 0 rows → HTTP 400 `{ error: "invalid_position", field: "additional_fields.positionId" }`.

- Cost: ~5 ms p99 over the existing PK index.
- The Zod schema validates `positionId` is a UUID before the SELECT runs.
- RLS scopes the lookup to the caller's tenant.

**Why**: server-side defense in depth (constitution §VI). The UI Select shows only active positions for the client, but the server can't trust client-supplied IDs.

### D-3 — Deterministic "earliest-assigned AE" rule for primary AE

Per research §R-04: there is no `clients.primary_account_executive_id` column. `primaryAccountExecutiveName` on `IClientDetailDto` is computed per request as the earliest-assigned AE — i.e., `client_assignments.created_at ASC` where the row represents the AE itself (`account_executive_id IS NULL` AND `users.role = 'account_executive'` AND `users.is_active = true`). Returns `undefined` when there's no AE.

- Implementation: SQL composes display name from `users.firstName + " " + users.lastName` (the schema uses split columns; no `full_name` column exists).
- The candidate registration form pre-fills `accountExecutiveName` from this value but leaves the input editable for the (rare) case of overriding to a different AE.

**Why**: avoids a multi-feature data-model change; deterministic ordering matches user intuition ("the first AE we put on this client") and the assignment table's display order.

### D-4 — Pre-deploy migration script renames colliding `legacy_<key>` keys

`scripts/012-rename-legacy-formconfig-collisions.ts` connects with admin credentials (bypasses RLS, scans every tenant), and per tenant in a single transaction:

1. Renames `clients.form_config.fields[k].key` → `legacy_<k>` where `k ∈ BASE_FIELD_KEY_SET`.
2. Rewrites `candidates.additional_fields[k] → additional_fields[legacy_<k>]` so values are preserved.
3. Writes one `audit_events` row per tenant with `action = "012_legacy_formconfig_collision_rename"`.

Idempotent — re-running after a successful pass is a no-op. The script is dry-run-able via `--dry-run`.

**Cutover gate**: the production cutover path must run the script against staging then production before the new validators in the candidate-create endpoint go live; otherwise legacy tenants would receive 500 `form_config_tampered` on every candidate-create.

**Why**: zero data loss on a known migration class while preserving a permanent forensic audit trail.

### D-5 — `// @ts-nocheck` on the migration script

The script imports `@bepro/db` + `@bepro/shared` which only resolve from inside a workspace package's `node_modules`. Including the script in `apps/api`'s tsconfig wouldn't work because module resolution starts from the script's directory. The integration test (in `apps/api/src/__tests__/`) imports `processTenant` at runtime via vitest — works fine. Static typecheck of the script is intentionally skipped.

**Why**: pragmatic — the runtime contract is exercised end-to-end by the integration test against real Neon, which is the load-bearing validation. Keeping `scripts/` as a flat staging area (instead of carving out its own workspace package + tsconfig) avoids overhead for a single one-shot migration.

### D-6 — Layout decision: `grid md:grid-cols-2` + mobile-last map

Desktop: map (left, `h-64`) + address + clipboard button | description + info card.
Mobile: header → description → info card → tabs → map (last) via `order-last md:order-none`.

**Why**: research §R-02 — users paste addresses into WhatsApp; the clipboard button placed under the map is the clearest UX. On mobile, the map occupies less perceived priority than the description, so it goes last.

### D-7 — `description` rendering with `whitespace-pre-line`

React's default escaping prevents XSS (E-02). `whitespace-pre-line` preserves `\n` line breaks while collapsing runs of spaces — matches the realistic paste flow from email/WhatsApp without rendering markdown literally.

**Why**: research §R-01 — preserve newlines but collapse spaces. `pre-wrap` is overkill; `normal` would erase structure on every save.

## Consequences

- Tenants whose `formConfig.fields[]` carry pre-existing collisions with BASE_CANDIDATE_FIELDS keys MUST run the migration script before the new validators ship; otherwise candidate-create returns 500 `form_config_tampered`.
- The candidate registration form now requires all 9 base fields; existing UI flows that didn't supply a `positionId` will need to select one (the form Select is bound to the client's `client_positions` catalog).
- The Formulario tab's first 9 rows are locked, read-only, and labeled "Campo base"; admin custom fields appear below.
- Description and contact position are tenant-scoped via existing RLS policies on `clients` / `client_contacts`. Cross-tenant tests added (`routes.clients.rls.integration.test.ts`).

## References

- spec.md — feature requirements
- research.md R-01..R-07 — Phase 0 decisions
- contracts/shared-base-fields.md — BASE_CANDIDATE_FIELDS export shape
- contracts/candidate-create.md — POST /api/candidates validation pipeline
- contracts/client-update.md — description field
- contracts/contact-create-update.md — position field
- contracts/form-config-fields.md — collision rejection
- packages/db/drizzle/0011_client_description_contact_position.sql — schema delta
- scripts/012-rename-legacy-formconfig-collisions.ts — migration script
