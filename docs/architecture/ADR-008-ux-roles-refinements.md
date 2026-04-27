# ADR-008 — UX, Role Scoping, and Configurability Refinements

**Status**: Accepted (partial — API + shared complete, US5/US6 UI pending follow-up)
**Date**: 2026-04-23
**Spec**: `specs/008-ux-roles-refinements/`
**Constitution**: v1.0.2 (§VI rephrased for recruiter-driven privacy evidence)

## Context

Feature 008 is a cross-module refinement pass. It closes UX gaps, hardens role scoping, and unlocks per-client configurability without introducing new services, tables, or migrations. This ADR captures the three decisions with long-term consequences.

## Decisions

### 1. Privacy-notice acknowledgement is collected offline for recruiter-driven registrations

**Why**: The candidate is never the self-registrant. The recruiter registers them. An in-product checkbox between the system and the recruiter is not a meaningful LFPDPPP acknowledgement. The real evidence is the recruiter's offline-signed document.

**What changed**:
- `packages/shared/src/candidates/schemas.ts` — `privacy_notice_id` / `privacy_acknowledged` are now optional in `registerCandidateRequestSchema`.
- `apps/api/src/modules/candidates/service.ts` — when the caller omits `privacy_notice_id`, the service auto-stamps it from the tenant's active notice so the NOT-NULL DB column stays intact without a migration; audit trail fields remain stable.
- `apps/web/src/modules/candidates/pages/NewCandidatePage.tsx` — `PrivacyNoticeCheckbox` and its card removed.
- `apps/web/src/modules/candidates/components/PrivacyNoticeCheckbox.tsx` — file deleted (zero importers).
- `apps/web/src/modules/candidates/pages/CandidateDetailPage.tsx` — "Aviso de privacidad" row removed from the data panel.

**What did NOT change**:
- `privacy_notices` table and the `candidates.privacy_notice_id` column remain in the schema untouched. Historical rows are preserved read-only at rest for LFPDPPP evidentiary retention.
- The `PATCH /api/candidates/:id` edit surface and the audit query endpoints continue to return historical values.

**Compliance path**: A follow-up feature will introduce a recruiter-uploaded "signed offline notice" attachment that replaces the old checkbox path for new evidence. Constitution §VI (v1.0.2) already permits this.

### 2. Admin-managed custom fields live inside `clients.form_config.fields[]` (JSONB extension, no new table)

**Why**: The 8 legacy toggles (`showAge`, `showPlant`, …) already live inside `clients.form_config` JSONB. Adding a sibling `fields[]` array keeps read compatibility perfect, avoids a migration, and reuses the dynamic-form renderer shipped in 007.

**What changed**:
- `packages/shared/src/clients/schemas.ts` (new) — `formConfigFieldSchema`, `createFormConfigFieldSchema`, `patchFormConfigFieldSchema`. Enforces snake_case keys (`^[a-z][a-z0-9_]{0,30}$`), immutable `type` and `key` on update, `options` required for `select`, and disallows collision with legacy toggle keys.
- `apps/api/src/modules/clients/service.ts` — `createFormConfigField`, `patchFormConfigField`. Archive-on-remove (flag) rather than hard-delete to preserve historical candidate values filed under that key.
- `apps/api/src/modules/clients/routes.ts` — `POST /clients/:clientId/form-config/fields` and `PATCH /clients/:clientId/form-config/fields/:key`, both admin-only.

**What did NOT change**:
- `packages/db/src/schema/clients.ts` — no migration. `form_config` stays `jsonb`.
- The dynamic form in `CandidateForm.tsx` already walked `formConfig.fields`; no code path change there.

**Archive semantics**: Setting `archived: true` hides a field from the candidate-create form but keeps the key in the JSONB so historical candidate records' `additional_fields[key]` values remain viewable on the detail page. Re-archive cycles are permitted (`archived: false` restores the field).

### 3. JSONB extension pattern (vs. new table) for per-client configurability

This ADR establishes the general pattern for "per-tenant / per-client configurability that binds to an existing entity":

1. If the shape is bounded (< ~20 keys, primitives only, no cross-entity references) → extend the existing JSONB column.
2. If the shape needs relational lookups, constraints, or >20 keys → spin up a new table.

Feature 008's custom formConfig fields are bounded primitives, so they stayed in JSONB. A future feature needing cross-tenant field templates or per-field permission rules should upgrade to a dedicated `form_config_fields` table.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Drop `privacy_notices` table / column | Destroys LFPDPPP evidentiary retention. |
| Keep the privacy-notice checkbox, move it offline in Phase 2 | Misleading UX and unnecessary audit noise during the gap. |
| Dedicated `custom_fields` table | Over-engineered for single-tenant JSON shape; breaks read compatibility with 8 legacy toggles. |
| Allow arbitrary JSON field types | Unvalidated inputs break the dynamic Zod schema renderer. |
| Full i18n framework for Spanish labels | Adds runtime dependency for a 14-row static map. |

## Consequences

**Positive**
- Zero migrations. Zero new services. Zero new packages. Lands entirely within the existing Cloudflare Workers + Neon + Pages topology.
- Honors the $0-25/month cost envelope (Constitution §II).
- RLS policies and `SET LOCAL app.tenant_id` invariants untouched (Constitution §I).

**Neutral / to monitor**
- `clients.form_config` JSONB now carries variable-shape admin data. If a tenant starts defining >20 custom fields per client, query performance on form_config reads should be reviewed (current indexing is sufficient for tens of fields).
- The US5 batch assignment endpoint uses hard-DELETE rather than soft-delete against `client_assignments` (table has no `is_active` column today). A later feature may add soft-delete + `updated_at` if audit-trail reconstruction on assignment churn becomes a requirement.

**Negative / deferred**
- The UI pieces for US5 (AssignmentTable checkbox table) and US6 (FormConfigFieldsEditor CRUD panel) are scoped to a follow-up session. API + shared schemas + service logic + service-level tests for both are already on the `008-ux-roles-refinements` branch; only the React components + TanStack Query hooks remain. This is called out in `specs/008-ux-roles-refinements/tasks.md` polish notes.

## Constitution impact

v1.0.2 amendment (2026-04-23) — staged on this branch in `.specify/memory/constitution.md`:
- §VI privacy-notice clause rephrased to permit recruiter-driven offline evidence.
- Branch Strategy extended to accept spec-kit numbered branches alongside `feature/descriptive-name`.

Both changes require Hector + Javi sign-off via PR before the 008 feature PR merges (§Governance).
