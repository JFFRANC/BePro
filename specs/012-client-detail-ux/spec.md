# Feature Specification: Client Detail UX + Contact Cargo + Candidate Base-Form Hardening

**Feature Branch**: `012-client-detail-ux`
**Created**: 2026-05-01
**Status**: Implemented (2026-05-01) — ADR-012 records decisions. Production cutover gate (T079a — `pnpm tsx scripts/012-rename-legacy-formconfig-collisions.ts` against staging then production) pending the deploy window.
**Input**: User description: "Polish the client experience after positions/documents have moved (011). Add a description field to clients, redesign the detail page with a 2-column desktop layout, rename the 'Configuración' tab to 'Formulario', harden the candidate base form (the 9 mandatory fields) on UI and API, and add a 'Puesto' (cargo) field to client contacts."

## Clarifications

### Session 2026-05-01

- Q: For the two ambiguous BASE_CANDIDATE_FIELDS keys (Puesto, Líder/Ejecutivo de cuenta), which naming should the constant export? → A: `positionId` (FK to `client_positions`, rendered as a Select bound to the client's curated catalog from feature 011) + `accountExecutiveName` (denormalized free text, mirrors the existing `recruiterName` pattern). Both keys are stored as values inside the candidate's `additional_fields` JSONB; no new column is added to the `candidates` table. Final BASE_CANDIDATE_FIELDS order: `fullName`, `interviewPhone`, `interviewDate`, `interviewTime`, `positionId`, `state`, `municipality`, `recruiterName`, `accountExecutiveName`.
- Q: When an admin saves the Formulario tab and a custom field's key collides with a BASE_CANDIDATE_FIELDS key (legacy data from 008 or a fresh attempt), how does the server respond? → A: Server **rejects** the save with a 400 and a clear Spanish error ("la clave `<key>` ya es un campo base; renómbrala o elimínala"). The UI also blocks the collision at edit time as a first line of defense. Tenants with pre-existing collisions in `formConfig.fields[]` (carried over from 008) are repaired by a one-shot data-migration script that runs **before** this feature deploys: each colliding custom field is renamed to `legacy_<key>` (e.g., `legacy_fullName`), preserving every value already captured under it. No silent drops, no last-write-wins, no auto-filter on read.
- Q: How are the two name-style base fields (`recruiterName`, `accountExecutiveName`) populated when a recruiter opens the candidate registration form? → A: Both are **pre-filled and editable**. `recruiterName` defaults to the full name of the logged-in user (resolved from JWT claims at form load); `accountExecutiveName` defaults to the name of the client's **primary** account executive. (Note: this was originally described as resolving via `clients.primary_account_executive_id`. Phase-0 research established that no such column exists; "primary AE" is now operationally defined as the earliest-assigned AE row in `client_assignments` — see Assumptions > "Primary AE — operational definition" and research.md R-04.) If the client has zero AE assigned, the field is empty and the recruiter types it. Both fields remain editable in case the recruiter is registering on behalf of someone else. No new API endpoint is required — both values come from data the form already loads (current user, client detail).

## User Scenarios & Testing *(mandatory)*

After feature 011 shipped, the client detail page was left with three rough edges:

1. The map sits below the general info card and dominates the page — no longer matches the importance of the data.
2. The page lacks a description block: nothing tells you *what the company does* at a glance.
3. The tab labeled "Configuración" actually configures the candidate registration form. The label is ambiguous, and admins can still strip out fields the rest of the system depends on.

This feature fixes those three rough edges and lands two small wins on adjacent surfaces (contact "puesto", candidate base-form lock).

### User Story 1 — Description block at the top of the client card (Priority: P1)

Any user (admin, manager, AE, recruiter) opens a client detail page and immediately sees a "Descripción" block describing what the company does (e.g., "Manufactura de autopartes, planta en San Juan del Río"). Admins/managers/AE with edit permission can edit it from the existing "Editar cliente" dialog.

**Why this priority**: Recruiters routinely call clients without remembering what they do. A two-line description at the top is the single highest-value piece of context on this page.

**Independent Test**: Open any active client, see the "Descripción" block populated; edit a description from the existing dialog and verify it persists across reloads. Delivers value as soon as one client has a description filled in.

**Acceptance Scenarios**:

1. **Given** a client with a non-empty description, **When** any tenant user opens the detail page, **Then** the description is rendered in a labeled block, above or alongside the general info card on desktop and at the top of the stack on mobile.
2. **Given** an admin/manager/AE editing a client, **When** they open the edit dialog, **Then** the form has a "Descripción" textarea with a 2,000-character limit, optional, and saving persists the value.
3. **Given** a client with an empty description, **When** the detail page is rendered, **Then** the description block is hidden (no empty placeholder) but the rest of the layout is unaffected.
4. **Given** a description containing pasted markdown or HTML markup, **When** rendered, **Then** the page shows the plain text only — no formatting, no executable HTML.

---

### User Story 2 — Two-column desktop layout with map + "Copiar ubicación" (Priority: P1)

On desktop (≥ md / 768px), the client detail page renders a two-column grid: the **left** column holds a smaller map (fixed height, ~h-64) followed by the address line and a "Copiar ubicación" button; the **right** column holds the description block plus the general info card (name, email, phone, primary AE, badges). On mobile (< md), the layout collapses to a single column with the map at the bottom.

**Why this priority**: The current single-column layout wastes desktop real estate and forces scrolling past a giant map to see basic info. Recruiters also paste addresses into WhatsApp dozens of times a day; a one-click copy button removes a real friction point.

**Independent Test**: Open a client with `latitude`/`longitude` and an address on a desktop viewport; verify the two-column layout renders correctly, the map is on the left, and clicking "Copiar ubicación" puts the formatted address into the clipboard with a confirmation toast. Resize to < 768px and verify single-column with map at bottom.

**Acceptance Scenarios**:

1. **Given** a client with an address and coordinates, **When** the page is viewed at ≥ 768px viewport, **Then** the map (height ≈ 16rem) renders in the left column with the address line and the "Copiar ubicación" button immediately below it; the right column holds the description block followed by the general info card.
2. **Given** the same client, **When** the page is viewed at < 768px viewport, **Then** all blocks stack vertically in a single column with the map appearing **last** (at the bottom of the page, after info, description, and tabs).
3. **Given** a tablet portrait viewport (~768px width), **When** the layout switches to two columns, **Then** the right column does not collapse below the map's height (visual regression target).
4. **Given** the user clicks "Copiar ubicación", **When** the browser supports `navigator.clipboard`, **Then** the formatted address (single line) is written to the clipboard and a sonner success toast confirms it.
5. **Given** a client without `latitude` and `longitude` (E-01), **When** the detail page is rendered, **Then** the map area shows a "Sin ubicación capturada" placeholder; the "Copiar ubicación" button is shown only if the address text is present and copies the address.

---

### User Story 3 — Tab rename "Configuración" → "Formulario" (Priority: P1)

The admin-only tab on the client detail page that controls the candidate registration form is renamed from "Configuración" to "Formulario". The tab key, label, and (if present) the URL segment are all updated, and any deep link to the old name redirects to the new one.

**Why this priority**: "Configuración" is a generic word that says nothing about what the tab does; new users routinely click it expecting tenant-wide settings. Renaming it to "Formulario" — the actual artifact admins are configuring — eliminates the confusion in one stroke.

**Independent Test**: As an admin, open a client detail page; verify the tab reads "Formulario" (not "Configuración"); navigate directly to `/clients/:id/config` and verify the URL is rewritten to `/clients/:id/form` (or equivalent) and the tab is selected.

**Acceptance Scenarios**:

1. **Given** an admin user on a client detail page, **When** they look at the tab list, **Then** the last tab reads "Formulario" (not "Configuración").
2. **Given** the URL `/clients/:id/config` (a deep link from email or a bookmark), **When** an admin opens it, **Then** the page redirects/rewrites to the new path and selects the "Formulario" tab.
3. **Given** any non-admin user, **When** they open a client detail page, **Then** the "Formulario" tab is not visible (existing behavior preserved).

---

### User Story 4 — Candidate base-form is locked: 9 mandatory fields cannot be removed (Priority: P1)

Every client's candidate registration form always presents nine base fields (Nombre, Teléfono entrevista, Fecha entrevista, Horario entrevista, Puesto, Estado, Municipio, Nombre del Reclutador, Líder/Ejecutivo de cuenta). These nine fields are rendered first, in fixed order, with locked labels and locked field types. Admins editing the "Formulario" tab cannot delete, rename, or change the type of any base field; admin-managed custom fields appear after the base block.

**Why this priority**: The 008 release exposed admins to a footgun — removing a base field broke candidate creation across the tenant. This story closes the loop: the UI prevents the mistake and the API double-checks at submission time.

**Independent Test**: As an admin, open the "Formulario" tab; observe the 9 base rows rendered with a "campo base" badge, no delete button, no rename input. Attempt to remove or rename one via crafted UI state and verify the change is rejected. As a recruiter, register a candidate omitting a base value and confirm the API returns a structured 400. Manually corrupt a tenant's `formConfig` to remove a base key and confirm the API fails closed with 500.

**Acceptance Scenarios**:

1. **Given** an admin viewing the "Formulario" tab, **When** the page renders, **Then** the 9 base fields appear at the top of the field list, each with a visible "Campo base" indicator, no delete control, and no rename input.
2. **Given** an admin who tries to bypass the UI (e.g., direct service call from devtools), **When** the request is sent, **Then** the server rejects mutations that attempt to delete or rename any base field key (the base set is server-enforced, not just UI-enforced).
3. **Given** a recruiter creating a candidate, **When** the request body is missing any base-field value, **Then** the server returns a 400 with a Zod-shaped error mentioning the missing key.
4. **Given** a tenant whose `formConfig` has been tampered with so a base key is absent (legacy or manual edit), **When** any candidate-create request arrives, **Then** the server returns a 500-class error with a clear Spanish message instructing the operator to re-run `scripts/012-rename-legacy-formconfig-collisions.ts` for the affected tenant; the error payload includes `tenantId`, `clientId`, and `missingBaseKeys` (fail closed, do not silently merge — see FR-011 for the full envelope).
5. **Given** a brand-new client with no `formConfig` saved yet, **When** the candidate form loads, **Then** the 9 base fields are present and required, and an admin can immediately add custom fields below them.
6. **Given** a logged-in recruiter opens the candidate registration form for a client with a primary AE assigned, **When** the form mounts, **Then** `recruiterName` shows the recruiter's full name and `accountExecutiveName` shows the primary AE's full name; both are editable; submitting without changes saves both values into `additional_fields` JSONB.
7. **Given** a logged-in recruiter opens the form for a client with **zero** AE assigned, **When** the form mounts, **Then** `accountExecutiveName` is empty, the form remains valid, and the recruiter can type a name freely.

---

### User Story 5 — Contacts show a "Puesto" (cargo) (Priority: P2)

Each row in the Contactos tab shows the contact's role/cargo — e.g., "RH", "Finanzas", "Operaciones" — alongside the existing name/email/phone. The contact create and edit forms include a "Puesto" input below "Email", optional, free text 1–120 characters. Existing contacts without a position are blank (no migration data step).

**Why this priority**: A nice-to-have once the page is restructured. Reduces "who do I call for X?" friction but is not blocking the broader UX redesign.

**Independent Test**: Add a contact with `position = "RH"`; verify it appears as a labeled column or sub-line on the Contactos tab. Edit the contact, change the position, and verify the audit event diff includes the change.

**Acceptance Scenarios**:

1. **Given** a contact with `position = "RH"`, **When** the Contactos tab is rendered, **Then** the position is shown next to or below the contact's name (visually unambiguous, not buried in a tooltip).
2. **Given** the contact create/edit form, **When** an admin/manager/AE with permission opens it, **Then** the "Puesto" input is shown below "Email", labeled in Spanish, with a 120-character max and a "Opcional" hint.
3. **Given** an existing contact without a position, **When** the Contactos tab loads, **Then** the position column is empty (or hidden for that row) — no "null" or placeholder text leaks into the UI.
4. **Given** an admin updates a contact's position, **When** the change is saved, **Then** the audit log entry for `contact_updated` includes the diff `{ position: { old: …, new: … } }`.

---

### User Story 6 — Mobile single-column layout (Priority: P3)

On viewports below the md breakpoint (768px), the page collapses cleanly: header → description → general info card → tabs → map (last). The map keeps its full mobile-friendly height; it does not shrink to fit a narrow column.

**Why this priority**: Most clients will be reviewed on desktop, but recruiters in the field do open these pages on phones. Acceptable mobile rendering is not optional; it just isn't worth blocking shipping the desktop layout for.

**Independent Test**: Open the page at 375px viewport (iPhone SE) and at 768px (tablet portrait); verify each block renders in the order specified, no horizontal scroll, no collision between map and right-column content.

**Acceptance Scenarios**:

1. **Given** a 375px viewport, **When** the detail page renders, **Then** the order is: page header → description block → general info card → tabs → map (with its address + copy button). No horizontal overflow.
2. **Given** a 767px viewport (one pixel below md), **When** the page renders, **Then** the layout is still single-column (map at bottom).
3. **Given** a 768px viewport (exactly md), **When** the page renders, **Then** the two-column layout activates and the map is on the left.

---

### Edge Cases

- **E-01 — No coordinates**: Client without `latitude`/`longitude` shows a "Sin ubicación capturada" placeholder in the map area; the "Copiar ubicación" button is shown only if `address` is non-empty and copies the address.
- **E-02 — Markdown/HTML in description**: Description is stored as plain text; on render, any markdown or HTML markup is shown literally (no rendering, no XSS path). Sanitize on write or escape on read — both are acceptable, but the rendered output must never execute markup.
- **E-03 — Existing contacts without position**: No data migration step. The position column for legacy contacts is empty; the UI hides the column for those rows or shows a single em-dash, never the literal "null" or "undefined".
- **E-04 — Tampered formConfig (missing base key)**: Server fails closed with a 500-class response and a Spanish error message instructing the operator to re-run `scripts/012-rename-legacy-formconfig-collisions.ts` for the affected tenant. The candidate-create endpoint must NOT silently merge the missing base field — that would mask data corruption. The error payload includes the offending tenant id and the list of missing base keys so support can act without log diving.
- **E-05 — Deep link to old tab path**: `/clients/:id/config` (any historical link, bookmark, or email reference) is client-side redirected to `/clients/:id/form` (or whatever the new segment is) on mount. The redirect is invisible to users; the back button does not loop.
- **E-06 — Tablet portrait breakpoint**: At exactly 768px the two-column layout activates. Verify the right column does not collapse below the map height; if needed, the right column gets `min-height: 16rem` to match the map.
- **E-07 — Description max length**: A description of exactly 2,000 characters saves successfully; 2,001 characters returns a Zod-shaped 400 with a Spanish error.
- **E-08 — Position max length**: A contact position of 120 characters saves; 121 returns a 400. Empty string is treated as `null` (not a 400).
- **E-09 — Clipboard API unavailable**: If `navigator.clipboard` is undefined (rare, but possible in non-secure contexts), the "Copiar ubicación" button shows a fallback toast: "Copia manual: <address>" so the user can still grab the text.
- **E-10 — Legacy `formConfig` collision with a base key**: If a tenant's `formConfig.fields[]` already contains a custom field whose key matches a BASE_CANDIDATE_FIELDS key (residue from feature 008 before this lock existed), a one-shot pre-deploy migration script renames that custom field to `legacy_<key>` (e.g., `legacy_fullName`). Existing candidate records that captured values under the old key keep them under the renamed `legacy_<key>` JSONB property — zero data loss. Post-migration, any save attempt that re-introduces a collision is rejected by FR-010's server check.
- **E-11 — Empty positions catalog at registration**: If a client has zero active rows in `client_positions` when a recruiter opens the candidate registration form, the `positionId` Select renders empty with a helper "No hay puestos activos para este cliente. Pídele al admin que cree al menos uno." The form remains submittable in the rest of its fields, but the recruiter cannot complete the registration until a position exists. No silent fallback (such as auto-creating a placeholder position) is acceptable.
- **E-12 — Legacy candidate read with partial `additional_fields`**: GET endpoints (`/api/candidates/:id`, list endpoints) MUST be tolerant of candidates created before this feature whose `additional_fields` does not contain all 9 base keys. Reads return whatever is present; missing keys are simply absent. The 9-key contract is enforced **only on create/update** (FR-011, FR-012). Backfilling historical candidates is explicitly out of scope.

## Requirements *(mandatory)*

### Functional Requirements

#### Data model

- **FR-001**: System MUST add a nullable `description` field to the client record (max 2,000 characters, plain text).
- **FR-002**: System MUST add a nullable `position` field to the contact record (1–120 characters when present).

#### API contract

- **FR-003**: The client detail and update endpoints MUST include `description` in their payloads. The schema enforces optionality and the 2,000-character cap; descriptions exceeding the cap MUST be rejected with a 400.
- **FR-004**: The contact detail and update endpoints MUST include `position` in their payloads. The schema enforces optionality and the 1–120 character bound; positions outside the bound MUST be rejected with a 400.
- **FR-014**: The audit trail entries `client_updated` and `contact_updated` MUST capture diffs for `description` and `position` respectively (old → new values).

#### Client detail page layout

- **FR-005**: At viewports ≥ 768px, the page MUST render a two-column grid: left column = map (height ≈ 16rem) + address line + "Copiar ubicación" button; right column = description block + general info card. The header, tabs, and dialogs sit above/below the grid, not inside it.
- **FR-006**: At viewports < 768px, the page MUST collapse to a single column with the order: header → description → general info card → tabs → map (last block on the page).
- **FR-007**: The "Copiar ubicación" button MUST copy a single-line formatted address to the clipboard via `navigator.clipboard.writeText` and surface a sonner toast on success. If the clipboard API is unavailable, it MUST show a fallback toast with the address inline (E-09).

#### Tab rename

- **FR-008**: The admin-only tab MUST be renamed from "Configuración" to "Formulario": tab label, tab key, URL segment (if any), and any internal references in tests/snapshots are all updated. A client-side redirect from the old segment (`/config` or whatever exists today) to the new segment MUST land users on the renamed tab.

#### Candidate base form

- **FR-009**: `packages/shared` MUST export a frozen `BASE_CANDIDATE_FIELDS` constant containing exactly nine base field keys, in display order: `fullName`, `interviewPhone`, `interviewDate`, `interviewTime`, `positionId`, `state`, `municipality`, `recruiterName`, `accountExecutiveName`. The constant MUST also expose, per key, its display label (Spanish), field type, and required flag, so the UI and the candidate-create handler share a single source of truth. `positionId` is rendered as a Select populated from the client's `client_positions` catalog (built in feature 011); `accountExecutiveName` is a denormalized free-text field that mirrors the `recruiterName` pattern. All nine values are persisted inside the candidate's `additional_fields` JSONB — no new column is added to the `candidates` table.
- **FR-010**: The "Formulario" tab MUST render the BASE_CANDIDATE_FIELDS as locked rows at the top (visible "Campo base" badge, no delete control, no rename input, no type select). Admin custom fields render below the base block. The frontend MUST block any UI action that would delete, rename, or retype a base field. The server MUST also enforce this contract on the `formConfig` PUT endpoint: any payload that (a) drops a base key, (b) renames a base key, (c) changes a base key's type/required flag, or (d) introduces a custom field whose key collides with a base key MUST be rejected with a 400 and a Spanish error message identifying the offending key. The check runs before persistence; partial saves are not allowed.
- **FR-011**: The candidate-create handler MUST validate, at request time, that the resolved effective form config (BASE_CANDIDATE_FIELDS ∪ admin custom fields) contains all base keys. If not, it MUST return a 500-class error with a clear Spanish message instructing the operator that the data-migration script `scripts/012-rename-legacy-formconfig-collisions.ts` must be re-run for this tenant. The Formulario tab itself does NOT offer a repair affordance — base fields cannot be added via the custom-field flow (that path rejects collisions). The error message MUST therefore point to the script, not to the tab.
- **FR-012**: The candidate-create handler MUST validate that the request body carries values for every base field. Missing values MUST return a 400 with a Zod-shaped error.

#### Contacts cargo

- **FR-013**: The contact create/edit form MUST display a "Puesto" input below "Email", optional, 1–120 characters, free text. The Contactos tab MUST display the position alongside the contact's name when present.

#### Candidate registration form pre-fill

- **FR-015**: When the candidate registration form mounts, `recruiterName` MUST be pre-filled with the logged-in user's full name (from JWT claims) and `accountExecutiveName` MUST be pre-filled with the client's primary AE full name (see "Primary AE — operational definition" Assumption below; surfaced server-side as `IClientDetailDto.primaryAccountExecutiveName`). Both pre-fills MUST remain editable. If the client has no AE assigned, `accountExecutiveName` mounts empty (no error, no warning).

### Key Entities *(include if feature involves data)*

- **Client**: Existing entity. New attribute `description` (plain text, ≤ 2,000 chars, optional). No relationship changes.
- **ClientContact**: Existing entity. New attribute `position` (string, 1–120 chars, optional). No relationship changes.
- **BASE_CANDIDATE_FIELDS**: A new public constant exported from `packages/shared`. Conceptually a frozen list of the nine candidate-form base-field keys, in display order. Consumed by the "Formulario" tab UI (to render locked rows) and by the candidate-create handler (to enforce presence at request time). Not stored in the database.
- **AuditEvent**: Existing entity. The `client_updated` and `contact_updated` event types extend their diff payloads to include the new fields when changed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly created or edited clients can save a description up to 2,000 characters; descriptions render as plain text in all browsers without ever rendering HTML or executing scripts.
- **SC-002**: On viewports ≥ 768px, the client detail page shows the map and primary info side-by-side; the map height is fixed at ~16rem (`h-64`); description and general info are visible above the fold without scrolling on a 1024×768 desktop. Verified by visual regression at md / lg / xl breakpoints.
- **SC-003**: 100% of clicks on "Copiar ubicación" result in the formatted address in the user's clipboard with no perceptible delay, or — if the clipboard API is unavailable (non-secure context) — a visible fallback toast. Zero silent failures. Behavior verified by unit + Playwright tests; perceived latency is acceptance-tested manually per the quickstart flow.
- **SC-004**: Zero candidate-create failures attributable to a missing base field after this feature ships — all such requests are caught either at the UI (locked rows prevent removal) or at the API (returns 500 with a clear repair message). Measured via audit/log review for 30 days post-deployment.
- **SC-005**: All existing deep links to `/clients/:id/config` (and any other reference to the "Configuración" tab) continue to land users on the renamed tab; zero 404s reported.
- **SC-006**: Contact records updated with a `position` value reflect that value within 1 second on the Contactos tab; the audit log captures every change.
- **SC-007**: All Playwright visual regressions pass at md (768px), lg (1024px), and xl (1280px) breakpoints, plus a 375px and 767px snapshot to lock in the mobile boundary.

## Assumptions

- **Tenant isolation**: New columns (`clients.description`, `client_contacts.position`) inherit the existing RLS policies on their parent tables; no new RLS work is needed. Verification of this is delegated to the `multi-tenancy-guardian` agent during planning.
- **No data migration**: Existing clients have `description = NULL`; existing contacts have `position = NULL`. The UI handles null gracefully (E-01, E-03). No backfill or data step is part of this feature.
- **Map provider unchanged**: The `LocationMap` component and its underlying tile provider stay as-is. This feature only resizes the map (h-64) and re-positions it in the layout.
- **Description sanitation**: Plain-text storage with display-time escaping (the default in React) is sufficient — no markdown renderer, no rich-text editor. If the team later wants formatted descriptions, that's a follow-up feature.
- **Tab segment naming**: The current `/clients/:id` page may not use a URL segment per tab today; if it does, the segment renames from `config` to `form`. If it doesn't, only the tab `value` and label change, and the redirect requirement (FR-008) becomes a no-op (still implemented defensively in case a future router introduces segments).
- **Base-field key freeze**: Once `BASE_CANDIDATE_FIELDS` ships, the keys are stable contracts. Renaming a key in a future release requires a coordinated migration of all tenant `formConfig` rows that already include the legacy key as a custom field — out of scope here.
- **Base-field storage**: All nine BASE_CANDIDATE_FIELDS values are written to and read from the candidate's `additional_fields` JSONB column. No schema change to `candidates` is part of this feature. The relationship `positionId → client_positions.id` is enforced at the application layer (the candidate-create handler validates the FK against the client's catalog); JSONB does not enforce referential integrity natively.
- **Custom-field collision**: An admin who tries to add a custom field whose key matches a base key (e.g., `fullName`) MUST be blocked at the UI with a clear error. This is implicit in FR-010 but worth flagging for the planner.
- **Primary AE — operational definition**: There is no `clients.primary_account_executive_id` column today. "Primary AE" is computed at request time from the `client_assignments` table as the **earliest-assigned account executive** of the client (smallest `created_at` among AE rows for that client) **whose user is still active** (`users.is_active = true`). `client_assignments` itself has no `is_active` column — assignment lifecycle is row-presence-only (008's batch diff inserts/deletes rows), so every row that exists is "current". If zero matching rows exist, the value is undefined/empty. This is surfaced on `IClientDetailDto.primaryAccountExecutiveName` (added by this feature). See research.md R-04 for the full rationale and alternatives considered. If the team later decides to introduce an explicit primary-AE column, that is a follow-up feature.
- **Constitution alignment**: Changes are confined to the `clients/` and `candidates/` modules and `packages/shared` — no cross-module dependency added (§IV Modular). Test-First applies: shared validator unit tests, layout snapshot tests, and Playwright e2e all written before implementation (§V).

## Dependencies

- **Feature 011 (Puestos / Position docs)**: Already shipped. The "Documentos" tab is gone from the client detail page; the new layout slots into the space 011 freed up.
- **Feature 008 (UX & roles refinements)**: Introduced admin-managed `formConfig.fields[]`. This feature hardens that surface by adding the base-field lock.
- **Feature 010 (User ↔ client assignment)**: The Asignaciones tab is unchanged; it must still render correctly under the new layout (visual regression covers it).
- **`@bepro/shared` build cycle**: Adding `BASE_CANDIDATE_FIELDS` requires the standard `pnpm --filter @bepro/shared build` step before consumer tests pick up the new export (per `packages/shared/CLAUDE.md`).
- **Pre-deploy migration script**: A one-shot script (`scripts/012-rename-legacy-formconfig-collisions.ts` or equivalent) MUST run before the feature deploys. It scans every tenant's `clients.form_config.fields[]`, renames any key that collides with a BASE_CANDIDATE_FIELDS entry to `legacy_<key>`, and rewrites the matching JSONB property on every candidate's `additional_fields` so values are preserved end-to-end. The script is idempotent (safe to re-run) and emits a per-tenant summary of renames performed. Without it, FR-010's server check would reject saves on legacy tenants.

## Out of Scope

- New client fields beyond `description` (no industry, no logo upload, no annual revenue, etc.).
- New contact fields beyond `position` (no department, no birthday, no LinkedIn).
- Changing the map provider, switching to a vector map, or supporting drawing/polygons.
- Contact import/export (CSV, vCard).
- Tenant-configurable labels for the base candidate fields (e.g., letting tenant A rename `Estado` to `Provincia`). Base labels are hard-coded for this iteration.
- A WYSIWYG editor or markdown renderer for the client description.
- Localizing or auto-suggesting `position` values (no enum, no autocomplete) — free text only.
