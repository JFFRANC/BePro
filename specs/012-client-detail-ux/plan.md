# Implementation Plan: Client Detail UX + Contact Cargo + Candidate Base-Form Hardening

**Branch**: `012-client-detail-ux` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-client-detail-ux/spec.md`

## Summary

Three threads bundled into one feature, all confined to the `clients` and `candidates` modules plus `packages/shared`:

1. **Client detail UX redesign** — adds a `description` column to `clients` (≤2,000 chars, plain text), restructures the detail page into a 2-column desktop grid (map left, info+description right), single-column mobile with map last, and a "Copiar ubicación" button that writes the address to the clipboard with a sonner toast and a graceful non-secure-context fallback.
2. **Tab rename + base-form lock** — renames the admin-only "Configuración" tab to "Formulario" (label, `value`, optional URL segment, plus a defensive client-side redirect from `/config` → `/form`), and exports a frozen `BASE_CANDIDATE_FIELDS` constant from `packages/shared` listing the nine candidate-form base-field keys. The Formulario tab renders these as locked rows; the `formConfig.fields[]` PUT endpoint rejects any payload that drops, renames, retypes, or collides with a base key (400 with Spanish message). The candidate-create handler enforces the same contract at request time (500 if a tenant's `formConfig` is corrupted, 400 if the request body is missing a base value).
3. **Contact cargo** — adds an optional `position` field (1–120 chars) to `client_contacts`, surfaces it in the contact create/edit form below "Email" and on the Contactos tab, and includes it in the `contact_updated` audit diff.

A pre-deploy migration script (`scripts/012-rename-legacy-formconfig-collisions.ts`) renames any legacy custom-field key that collides with a BASE_CANDIDATE_FIELDS entry to `legacy_<key>` and rewrites the matching property on every candidate's `additional_fields` JSONB so values are preserved end-to-end.

Two pieces of pre-resolved spec context shape the plan:

- **All nine base values live in `additional_fields` JSONB** — no new column on `candidates`. The relationship `positionId → client_positions.id` is enforced at the application layer.
- **No `primary_account_executive_id` column on `clients`** (verified during Phase 0). FR-015's "primary AE" is therefore defined as the **earliest-assigned account executive** of the client (smallest `client_assignments.created_at` where `account_executive_id IS NULL` — i.e., the AE row itself, not a recruiter row) — see research.md R-04.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode), shared across `apps/web`, `apps/api`, `packages/shared`, `packages/db`.

**Primary Dependencies**:
- API: Hono 4.7.10 + `hono/jwt` + `@hono/zod-validator`, Drizzle ORM 0.44, `@neondatabase/serverless` 1.x via `drizzle-orm/neon-http`, Zod 4.x.
- Web: React 19.1, Vite 6, react-router-dom 7, Tailwind CSS 4, shadcn/ui (Tabs, Card, Dialog, Textarea, Input, Button, Badge already installed), React Hook Form + `@hookform/resolvers`, TanStack Query 5, sonner toasts, lucide-react (Copy icon), CASL 6 (existing ability layer).
- Shared: Zod 4.x.

**No new runtime dependencies are added by this feature.**

**Storage**: Neon PostgreSQL (serverless) with RLS already enforced on `clients` (`0002_rls_clients.sql`) and `client_contacts` (same migration). Two ALTER statements:
- `clients ADD COLUMN description text NULL` + `CHECK (char_length(description) <= 2000)`
- `client_contacts ADD COLUMN position varchar(120) NULL`

No RLS policy changes (new columns inherit existing `tenant_id`-scoped policies).

**Testing**: Vitest for unit + mocked-integration; Vitest with `vitest.integration.config.ts` (real Neon, `app_worker` role) for RLS-touching paths. Playwright for visual regression and e2e (configure under `apps/web/e2e/`; the repo already has Playwright via `mcp__plugin_playwright_playwright__*`).

**Target Platform**:
- API → Cloudflare Workers via Wrangler.
- Web → Cloudflare Pages.
- DB → Neon PostgreSQL (HTTP driver, stateless).

**Project Type**: Web (modular monorepo: `apps/web` + `apps/api` + `packages/{shared,db}`).

**Performance Goals**:
- Client detail page LCP ≤ 1.5 s on 3G-Fast (existing baseline must hold; map render time unchanged).
- "Copiar ubicación" → clipboard write within **200 ms** (SC-003, includes the sonner toast).
- `formConfig` PUT collision check + audit insert: ≤ 50 ms p95 added vs. today's PUT (single in-memory set lookup + one extra audit write inside the existing transaction).

**Constraints**:
- Tenant isolation MUST hold (constitution §I) — verified by integration tests using `app_worker` role. Cross-tenant fetch of a client's description or a contact's position MUST 404.
- Bundle size: Worker bundle MUST stay under existing budget; the `BASE_CANDIDATE_FIELDS` constant + helpers add ~600 B of TS, ~250 B minified. Acceptable.
- LFPDPPP: descriptions and positions are NOT PII per the spec scope, but are still tenant-scoped. Soft-delete only (description/position can be cleared by setting to `NULL`; the row is never destroyed).

**Scale/Scope**:
- ~10 tenants × ~100 clients × ~5 contacts each → ~5,000 rows touched at most by the migration. Pre-deploy script runs in seconds.
- Estimated 30 candidate-create requests/day per tenant; the new request-time validation is O(9) on `additional_fields` keys → negligible.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **§I Multi-Tenant Isolation** | ✅ Pass | New columns sit on `clients` and `client_contacts`, both already RLS-enforced. No new tables. Cross-tenant integration tests added (description GET, contact GET/PUT) using `app_worker`. The `formConfig` PUT and candidate-create handlers already run inside the standard `SET LOCAL app.tenant_id` transaction wrapper. |
| **§II Edge-First** | ✅ Pass | All work runs on Workers + Pages + Neon. No new infrastructure. The pre-deploy migration script runs locally via `pnpm --filter @bepro/db db:exec` style — no new long-running service. |
| **§III TypeScript Everywhere** | ✅ Pass | All code TS strict. `BASE_CANDIDATE_FIELDS` + its label/type metadata is exported from `packages/shared` and consumed by both `apps/web` (form) and `apps/api` (validator). No code switches in the language stack. Comments in Spanish, commits Spanish Conventional Commits. |
| **§IV Modular by Domain** | ✅ Pass | Changes confined to `clients/` (front + back), `candidates/` (back validator only), and `packages/shared`. No cross-module imports added beyond what's already wired (clients module already imports the form-config field schema; candidates module already imports candidate schemas). No existing module's public interface changes. |
| **§V Test-First (NON-NEGOTIABLE)** | ✅ Pass | Test files listed in tasks.md MUST land first. Concretely: shared unit tests for `BASE_CANDIDATE_FIELDS` shape + collision validator; API unit tests for `formConfig` PUT (collision rejection), candidate-create (missing base value, missing base key in formConfig, positionId not in client's catalog); RLS integration tests for description and position fetch/write; Vitest snapshot for the redesigned `ClientDetailPage` at md/lg breakpoints; Playwright e2e for tab rename + redirect + clipboard. Every test fails before its implementation lands (RED) and passes after (GREEN). |
| **§VI Security by Design** | ✅ Pass | Description is treated as plain text — React's default escaping prevents XSS (E-02). Description and position do not log PII (existing log scrubbers cover free-text fields by default). The `formConfig` collision check fails closed. The candidate-create endpoint already requires JWT + role guard (`recruiter` for create per 008); no permission changes. CASL ability for `Client.update` already gates the description edit dialog. |
| **§VII Best Practices via Agents** | ✅ Pass | Agents/skills consulted: `db-architect` for the two ALTER statements + check constraint; `multi-tenancy-guardian` for RLS verification; `senior-backend-engineer` for the formConfig + candidate-create validators and audit diffs; `senior-frontend-engineer` for the layout, Formulario tab lock, contact form, clipboard button; `candidate-fsm-auditor` confirmed not in scope (no FSM transitions changed). Skills used: `tailwindcss-advanced-layouts`, `shadcn-ui`, `react-vite-best-practices`, `tanstack-query-best-practices`, `zod`, `vitest`, `web-design-guidelines`, `design-system`, `frontend-design`, `huashu-design`, `verification-before-completion`. |
| **§VIII Spec-Driven Development** | ✅ Pass | spec.md → plan.md → research.md → data-model.md → contracts/ → quickstart.md → tasks.md (next). All clarifications resolved (3 in 2026-05-01 session). One Phase-0 finding (R-04, primary AE definition) is recorded in research.md. |

**Verdict**: All gates pass. No constitution violations. **Complexity Tracking section omitted (no violations to justify).**

## Project Structure

### Documentation (this feature)

```text
specs/012-client-detail-ux/
├── plan.md              # This file
├── research.md          # Phase 0 — primary-AE definition, newline rendering, clipboard payload, tab segment
├── data-model.md        # Phase 1 — schema deltas, JSONB shape, audit diff envelope
├── quickstart.md        # Phase 1 — dev setup + manual verification steps
├── contracts/
│   ├── client-update.md           # PUT /api/clients/:id (description added)
│   ├── contact-create-update.md   # POST + PUT /api/clients/:id/contacts/:cId (position added)
│   ├── form-config-fields.md      # PUT/POST/PATCH on formConfig.fields[] (base-key collision rejection)
│   ├── candidate-create.md        # POST /api/candidates (BASE_CANDIDATE_FIELDS enforcement)
│   └── shared-base-fields.md      # @bepro/shared BASE_CANDIDATE_FIELDS export contract
└── checklists/
    └── requirements.md            # Already present (from /speckit.specify)
```

### Source Code (repository root)

```text
apps/api/src/modules/
├── clients/
│   ├── routes.ts          # PUT /:id accepts description; PUT /:id/contacts/:cId accepts position;
│   │                      # PUT /:id/form-config/fields rejects base-key collisions
│   ├── service.ts         # updateClient diff includes description; updateContact diff includes position;
│   │                      # validateFormConfigPayload extended with base-key check (uses BASE_CANDIDATE_FIELDS)
│   ├── types.ts           # IClientDto + description; IClientContactDto + position
│   └── __tests__/
│       ├── service.clients.test.ts          # +description happy path + max-length 400
│       ├── service.contacts.test.ts         # +position happy path + max-length 400 + audit diff
│       ├── service.formconfig.test.ts       # +base-key collision rejection
│       └── routes.clients.test.ts           # +RLS integration: tenant A can't read tenant B's description
└── candidates/
    ├── routes.ts          # POST /api/candidates pre-validates BASE_CANDIDATE_FIELDS before zValidator
    ├── service.ts         # registerCandidate calls assertEffectiveFormConfigContainsBase() (500 if tampered)
    │                      # and validates positionId ∈ client_positions for the client
    └── __tests__/
        ├── service.basefields.test.ts       # NEW — missing base value (400), missing base key in formConfig (500)
        ├── service.position-fk.test.ts      # NEW — positionId not in client's catalog → 400
        └── routes.candidates.test.ts        # extended

apps/web/src/modules/clients/
├── pages/
│   ├── ClientDetailPage.tsx     # Layout refactor: 2-col grid ≥md, single-col <md;
│   │                            # description block; tab rename "Configuración" → "Formulario";
│   │                            # client-side redirect /config → /form
│   └── __tests__/
│       └── ClientDetailPage.layout.test.tsx  # NEW — md and <md layout snapshots; redirect smoke
├── components/
│   ├── ClientForm.tsx                       # +description Textarea (max 2000)
│   ├── ContactDirectory.tsx                 # +position column / sub-line; "—" for empty
│   ├── ContactForm.tsx (extracted)          # +Puesto Input below Email
│   ├── CopyAddressButton.tsx (new)          # navigator.clipboard.writeText + sonner; non-secure fallback
│   ├── LocationMap.tsx                      # untouched; just resized via prop in parent
│   ├── FormConfigFieldsEditor.tsx           # +renders BASE_CANDIDATE_FIELDS as locked rows w/ "Campo base" Badge;
│   │                                        # blocks UI ops on base rows; client-side collision check on add
│   └── __tests__/
│       ├── CopyAddressButton.test.tsx       # NEW — clipboard, fallback, toast
│       ├── FormConfigFieldsEditor.test.tsx  # extended — locked rows, no delete on base, collision blocks add
│       └── ContactForm.test.tsx (new)       # NEW — position field round-trip
├── hooks/
│   └── useClients.ts                        # +description in shape; useClientContacts already handles fields
└── services/
    └── clientService.ts                     # types align via @bepro/shared

apps/web/src/modules/candidates/
└── components/
    └── RegisterCandidateForm.tsx            # +pre-fills recruiterName (from auth context) and accountExecutiveName
                                             #  (from primary-AE resolved server-side via existing /api/clients/:id);
                                             #  +renders BASE_CANDIDATE_FIELDS first; +positionId Select bound to client positions

packages/shared/src/
├── candidates/
│   ├── base-fields.ts (new)                 # exports BASE_CANDIDATE_FIELDS + types + label map (Spanish)
│   ├── form-config.ts                       # buildDynamicSchema() unchanged; receives merged base+custom
│   ├── index.ts                             # re-export base-fields
│   └── __tests__/
│       └── base-fields.test.ts (new)        # frozen-shape, label coverage, key uniqueness, regex compatibility
└── clients/
    ├── schemas.ts                           # +update-client (description), +contact (position),
    │                                        # +rejectBaseKeyCollision() applied to fieldKeySchema refine
    └── __tests__/
        └── schemas.basefields-collision.test.ts (new)

packages/db/
├── src/schema/
│   ├── clients.ts                           # +description column
│   └── client-contacts.ts                   # +position column
└── drizzle/
    └── 0011_client_description_contact_position.sql  # ALTER TABLE … ADD COLUMN (nullable, no defaults)

scripts/
└── 012-rename-legacy-formconfig-collisions.ts (new)  # idempotent rename:
                                                       #   form_config.fields[k].key  → legacy_<k> (where collision)
                                                       #   candidates.additional_fields[k] → legacy_<k>
                                                       # one transaction per tenant; dry-run flag; per-tenant report

apps/web/e2e/
└── 012-client-detail-ux.spec.ts (new)        # Playwright: visual regression at 375/767/768/1024/1280;
                                              # tab rename smoke; /config → /form redirect; clipboard happy path
```

**Structure Decision**: Web monorepo — feature changes touch `apps/web` (UI), `apps/api` (validators + audit diff), `packages/shared` (BASE_CANDIDATE_FIELDS + Zod refinements), `packages/db` (two ALTERs), and `scripts/` (one-shot pre-deploy migration). No new packages, no new modules.

## Complexity Tracking

> No constitution violations to justify. Section intentionally empty.
