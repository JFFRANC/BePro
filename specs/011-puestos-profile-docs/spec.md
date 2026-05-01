# Feature Specification: Position Profile and Position-Scoped Documents

**Feature Branch**: `011-puestos-profile-docs`
**Created**: 2026-04-29
**Status**: Draft
**Input**: User description: "Replace the minimal client_positions table (currently only id+name) with a full role-profile schema reflecting the company's existing 'Perfil de Puesto' Excel; move document storage (contract, pase de visita) from client level to position level; archive existing client_documents in place; remove the 'Documentos' tab from the client detail UI."

## Clarifications

### Session 2026-04-30

- Q: How should the "required documentation" profile field be captured — free-text list, predefined checklist, or paragraph? → A: Free-text string list. The AE types each required document by name; no predefined vocabulary. Maps cleanly to a list-of-strings shape and never blocks an unforeseen requirement (e.g. cédula profesional, licencia tipo C, certificado médico).
- Q: How should the "FAQ" / "Preguntas Frecuentes" section be captured? → A: List of free-text strings (one item per row, add/remove). The Excel uses this section as a phone-screen filter checklist of non-negotiables ("NO REINGRESOS", "NO MENORES DE EDAD", "NO TENER ADEUDO CON BANCOMER", etc.), not as canned question/answer pairs — so a flat string list matches the actual content.
- Q: How should "Género" be captured given the Excel value `MASCULINO Y FEMENINO`? → A: Single select with values `masculino` / `femenino` / `indistinto`. The Excel's "MASCULINO Y FEMENINO" is canonicalized to `indistinto`. One value per position keeps filtering and reporting simple.
- Q: The Excel has experience captured in two cells (`Años de Experiencia` + `Experiencia Requerida`) with the same content. → A: Consolidate to a single `experience_text` field on the position. One textarea, one source of truth.
- Q: The Excel has `Horarios` as a single prose cell (`7:30 am a 5:30 pm LUNES A VIERNES descanzo SABADO Y DOMINGO`). How is this captured? → A: A free-text `schedule_text` textarea **plus** structured `work_days[]` (any subset of Mon–Sun) and `shift` (fixed/rotating). The textarea matches the Excel's prose; the structured fields enable filtering/listing and survive translation.
- Q: The Excel salary cell is compound prose (`$1,951 MAS $350 DE VALES DE DESPENSA ADEMAS DE $70 PUNTUALIDAD Y $70 ASISTENCIA X SEMANA`). How is this captured on the position profile? → A: Hybrid — structured `salary_amount` (numeric, base salary), `salary_currency` (default `MXN`), `payment_frequency` (`weekly` / `biweekly` / `monthly`), **plus** a separate free-text `salary_notes` field for bonuses, vales, and edge detail. Recruiters get a sortable base salary; the prose survives intact in `salary_notes`.
- Q: After a position document is replaced, who can download the archived prior version through the UI? → A: Admin only, via a "Versiones" history panel on the position detail. The same short-lived-URL path is used. Manager, account executive, and recruiter roles never see archived versions, so they cannot accidentally send a stale contract to a candidate. Compliance and dispute resolution still have a UI path without engineering involvement; auditors who need raw access continue to query the data store directly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture the full position profile inside the platform (Priority: P1)

An account executive opens a position (new or existing) on a client and fills a structured profile that mirrors the company's "Perfil de Puesto" Excel: number of vacancies, work location, age range, gender, civil status, education level, experience, salary amount with currency and payment frequency, benefits, schedule, work days, shift, required documentation, responsibilities/funciones, and FAQ. From that moment on, recruiters working on the position see the full brief on the position page and no longer need the external Excel.

**Why this priority**: The position page today shows only a name. Recruiters consult an external Excel to know who they are sourcing for. This consolidation is the central business win — it makes the platform the single source of truth for what the role actually is.

**Independent Test**: Sign in as an account executive, edit a position, fill all profile sections, save, then sign in as a recruiter assigned to that client, open the same position, and verify every field saved by the AE is visible. The Excel does not need to be opened.

**Acceptance Scenarios**:

1. **Given** an account executive editing a position on a client they are assigned to, **When** they fill in the full profile (age range, gender, schedule, work days, salary, etc.) and save, **Then** the profile persists and is visible on subsequent visits.
2. **Given** the same position later, **When** a recruiter assigned to that client opens it, **Then** they see every profile field the AE captured, in a readable mobile-first layout.
3. **Given** a partially completed profile (only some fields entered), **When** the AE saves, **Then** the form accepts the partial input and the missing fields render as empty/placeholder on the recruiter view — no field is required individually except the position name.

---

### User Story 2 - Attach a contract and a pase de visita PDF to each position (Priority: P1)

For each position, an account executive uploads two role-specific documents: the contract and the pase de visita. Uploading a new file of either type replaces the prior one — the new file becomes the active version, and the previous file is archived (still queryable for audit, no longer surfaced for download). At any time the position has at most one active contract and one active pase de visita.

**Why this priority**: Contracts and visit passes vary per position, not per client. Today they live at the client level, which forces operators to keep them generic or duplicate manually. Without per-position documents, recruiters routinely download a contract that does not match the role they are filling.

**Independent Test**: As an AE, upload a contract PDF on a position, then upload a different contract PDF on the same position. Verify the second one is the active version, the first one is archived (no longer offered for download), and the audit trail shows both events.

**Acceptance Scenarios**:

1. **Given** a position with no contract attached, **When** the AE uploads a 4 MB PDF named `contract-vendedor.pdf`, **Then** the position page shows that contract as available for download.
2. **Given** a position that already has an active contract, **When** the AE uploads a new contract, **Then** the prior contract is archived (timestamped) and the new one becomes the active version, all in a single save (no orphaned in-between state).
3. **Given** the same position, **When** the AE uploads a pase de visita PDF, **Then** the contract slot is unaffected and both documents remain independently downloadable.
4. **Given** a position whose AE attempts to upload an 11 MB file or a file whose type is not PDF or Word, **When** they submit, **Then** the system rejects the upload with a clear error and no document row is created.

---

### User Story 3 - Recruiter downloads the contract and pase de visita from the position view; the client-level "Documentos" tab is gone (Priority: P1)

A recruiter assigned to the client opens a position they are working on and downloads the contract and the pase de visita with one click each. The client detail page no longer has a "Documentos" tab — those documents have moved to the positions where they belong.

**Why this priority**: Solves the discoverability problem at the recruiter end. If documents stay attached to the client, recruiters keep loading the wrong file for the role they are sourcing for. Removing the tab also prevents new uploads from continuing to land at the wrong granularity.

**Independent Test**: As a recruiter assigned to a client, open one of its positions, click the contract download, click the pase de visita download — both files arrive. Then open the client detail page and confirm the "Documentos" tab no longer renders.

**Acceptance Scenarios**:

1. **Given** a position with both a contract and a pase de visita attached, **When** a recruiter assigned to that client clicks each download, **Then** both files arrive in ≤ 2 seconds (p95 for files up to 10 MB) via JWT-protected URLs whose access is re-verified on every call.
2. **Given** the client detail page, **When** any operator (admin, manager, AE, or recruiter) opens it, **Then** there is no "Documentos" tab and no way to upload or browse documents at the client level.
3. **Given** a recruiter who is *not* assigned to the client, **When** they attempt to access the position or its documents directly, **Then** the system denies access — same scoping as for any other client-scoped resource.

---

### User Story 4 - Position list shows inline download icons per document type (Priority: P2)

When a recruiter views the list of positions for a client, each row shows download icons for the document types that exist on that position. Clicking the icon downloads the document directly without opening the position detail.

**Why this priority**: Quality-of-life improvement on top of US-3. Recruiters often want the contract or visit pass to send to a candidate without reading the whole position profile. Doing it from the list saves a navigation hop.

**Independent Test**: Open the position list of a client where two of three positions have a contract and only one has a pase de visita. Verify each row's icons reflect exactly what is available on that position, and clicking each icon downloads the right file.

**Acceptance Scenarios**:

1. **Given** a position list, **When** rendered, **Then** each row shows a contract download icon if and only if that position has an active contract, and likewise for pase de visita.
2. **Given** the same list, **When** the recruiter clicks a download icon on a row, **Then** the file downloads without navigating to the position detail.
3. **Given** a position that has neither document type attached, **When** the row renders, **Then** no download affordance is shown for that row.

---

### User Story 5 - Compliance retains legacy client-level documents at rest (Priority: P3)

Existing client-level documents are not deleted or migrated. They are archived in place — preserved at rest for audit and any downstream compliance review — but they no longer surface in the UI now that the "Documentos" tab is gone.

**Why this priority**: Confidence/compliance story. We must not destroy historical documentation as part of the move, even though the UI no longer references it. This is also why we keep documents soft-deleted under the `is_active` model rather than hard-deleting.

**Independent Test**: Before the rollout, capture a list of existing client-level document rows. After the rollout, verify the same rows still exist in storage and the database, just flagged inactive. None has been deleted.

**Acceptance Scenarios**:

1. **Given** a tenant with N client-level document rows captured before the rollout, **When** the rollout completes, **Then** the same N rows still exist, are flagged inactive, and remain queryable for audit.
2. **Given** any UI screen the existing roles can reach after the rollout, **When** they navigate, **Then** there is no path that resurfaces the legacy documents.
3. **Given** an audit query against the document store, **When** an auditor runs it months later, **Then** the legacy documents and their original metadata (uploader, timestamp, file name) are still findable.

---

### Edge Cases

- **E-01 — Replacing an active document**: An upload of a contract on a position that already has an active contract MUST archive the prior active row and create the new active row in a single save, leaving the position with exactly one active contract at any time. No window where two contracts are active or no contract is active.
- **E-02 — Position soft-deleted with documents attached**: Soft-deleting a position MUST leave its document rows untouched in storage (still queryable for audit) but the documents MUST NOT be reachable for download from the UI while the position itself is hidden.
- **E-03 — Invalid age range**: An attempt to save a profile with a minimum age greater than the maximum age MUST be rejected with a clear validation error, and no part of the save MUST be applied.
- **E-04 — Empty work-days selection**: A position MAY be saved with no work days selected — this represents a position whose schedule is not yet defined and is not a validation failure.
- **E-05 — Migration on a tenant with many existing client-level documents**: The one-time archive of legacy client-level documents during rollout MUST complete in under 30 seconds for tenants with up to a few thousand existing rows (per SC-004) — never in minutes.
- **E-06 — Recruiter not assigned to the client**: A recruiter who is not assigned to the client MUST NOT be able to view or download the position's documents, even with a direct URL to the document. Existing client-scoping enforces this.
- **E-07 — JWT expires mid-upload**: When the operator's JWT expires while the upload request is in flight, the client MUST be able to refresh the token and retry the same upload call (idempotent on the document id) without leaving orphan rows or dangling object-store bytes. The server-side flip from "draft" to "active" (and the corresponding audit event) MUST NOT happen until the bytes are received and validated.
- **E-08 — Two AEs upload to the same position simultaneously**: When two uploads of the same document type complete near-simultaneously on the same position, the system MUST end up with exactly one active row of that type, with the other archived; no duplicate active rows.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A position MUST be able to carry, in addition to its name and active flag, a full role profile composed of: number of vacancies (positive integer), work location (free text), age range (minimum and maximum integers, with `min ≤ max`), gender (single select: masculine / feminine / indistinct — "indistinct" representing the Excel's "MASCULINO Y FEMENINO"), civil status (single / married / indistinct), education level (none / primary / secondary / high school / technical / bachelor / graduate), experience description (single free-text field — consolidating the Excel's duplicated `Años de Experiencia` and `Experiencia Requerida` cells), base salary amount and currency (default `MXN`), payment frequency (weekly / biweekly / monthly), salary notes (free-text field for bonuses, vales, and other compensation edge detail that does not fit the base amount — e.g. "MAS $350 DE VALES DE DESPENSA ADEMAS DE $70 PUNTUALIDAD Y $70 ASISTENCIA X SEMANA"), benefits (multi-line free text), schedule description (multi-line free text mirroring the Excel's prose, e.g. "7:30 am a 5:30 pm LUNES A VIERNES descanso SABADO Y DOMINGO"), work days (any subset of Mon–Sun, captured as structured selection in addition to the prose), shift (fixed or rotating), required documentation (a free-text list of document names the candidate must bring — no predefined vocabulary), responsibilities (funciones, multi-line free text), and FAQ entries (a list of free-text strings, one per item — used in practice as a phone-screen filter checklist of non-negotiables, not as question/answer pairs).
- **FR-002**: Every profile field MUST be optional individually — only the position name remains required. Existing positions that predate this feature MUST remain valid with their profile fields empty until first edit; no backfill is performed.
- **FR-003**: A position MUST support up to two attached documents at any time: one active contract and one active pase de visita. The system MUST reject attempts to attach a document of any other type.
- **FR-004**: Uploading a new document of either type to a position that already has one active document of that type MUST archive the prior active document (set inactive, timestamp the replacement) and register the new one as active in a single atomic operation. The position MUST never be observable in a state with two active documents of the same type or with the prior one removed before the new one is registered.
- **FR-005**: Downloading or uploading a position document MUST be done through a JWT-protected endpoint URL whose access is re-verified on every call (not only at session start) and whose effective validity is bounded by the JWT TTL (≤ 60 minutes per Constitution §VI). The system MUST verify the operator's permission, the document's tenant scope, and the parent position's active state on every request — never trusting a previously-issued URL. Bytes flow through the API, not via direct R2 access (server-proxied pattern, see plan research §R1 / ADR-002).
- **FR-006**: Documents and their position MUST be tenant-isolated: a request that attempts to read or write a document outside the operator's tenant MUST be denied, and no information that would distinguish "wrong tenant" from "does not exist" MUST be returned.
- **FR-007**: When a position is soft-deleted, its document rows MUST remain present and queryable for audit but MUST NOT be downloadable from the UI for as long as the position is hidden.
- **FR-008**: Existing client-level document rows MUST be preserved in place during rollout (a one-time archive that flags them inactive but does not delete them or move their underlying files). They MUST remain queryable for audit and MUST NOT surface in any UI after rollout.
- **FR-009**: The "Documentos" tab on the client detail screen MUST be removed for every role. No role MUST retain a path to upload, list, or download documents at the client level after this feature ships.
- **FR-010**: The position list (per client) MUST display, on each row, an inline download affordance for each document type that the position currently has attached. Rows whose position has no attached document of a given type MUST NOT show that affordance.
- **FR-011**: The position edit experience MUST present the profile in clearly grouped sections (general data, profile, compensation, schedule, required documentation, responsibilities, FAQ) and MUST work on mobile-first layouts.
- **FR-012**: Permissions MUST follow the existing role matrix: admin, manager, and account executive can create/edit positions and upload/replace/remove documents on positions of clients they have access to; recruiter has read-only access to positions and download-only access to documents on positions of clients they are assigned to. Both UI guards and server-side checks MUST enforce this.
- **FR-013**: Document uploads MUST enforce a maximum size of 10 MB per file and MUST accept only PDF and Word document file types. Files outside these constraints MUST be rejected before any record is created.
- **FR-014**: Saving a profile in which the minimum age is greater than the maximum age MUST be rejected with a validation error. No part of the save MUST be applied in that case.
- **FR-015**: Audit events MUST be emitted when: a position is created or updated (`position_updated`), a document is uploaded for the first time on a position (`position_document_uploaded`), and a document is uploaded that supersedes an existing active one (`position_document_replaced`). Each event MUST identify the actor, the position, the tenant, the document type, and (for replacements) the prior document being archived.
- **FR-016**: A recruiter or any operator without assignment to the client MUST be denied access to its positions and documents, returning the same not-found surface as for nonexistent positions to avoid leaking the existence of client-scoped resources.
- **FR-017**: Field types and value sets used by both the form and the server for profile fields MUST be defined once in a shared module so that frontend validation and backend validation cannot drift.
- **FR-018**: The position detail screen MUST surface a "Versiones" history panel for each document type, visible only to admin operators, listing every archived (replaced) version with its upload timestamp, replacement timestamp, original file name, and uploader. Each row MUST allow downloading the archived version through the same short-lived-URL mechanism used for active downloads, with the same tenant-scoping and permission checks. Manager, account executive, and recruiter roles MUST NOT see this panel and MUST NOT be able to download archived versions through any UI path.

### Key Entities *(include if feature involves data)*

- **Position**: A role at a client that recruiters source for. Carries the full profile defined in FR-001, plus the existing name, active flag, tenant scope, and link to the client. May have at most one active contract and one active pase de visita document attached at any time.
- **Position Document**: A binary file attached to a position with a fixed type (contract or pase de visita), uploader, original file name, content type, and size. Carries an active flag and, when archived, the timestamp at which it was superseded. The combination of position + document type permits at most one active row at a time.
- **Legacy Client Document**: A binary file historically attached at the client level. Read-only after this feature ships — preserved at rest for audit, removed from all UI surfaces.
- **Audit Event**: Append-only record of position and position-document operations (created, updated, document uploaded, document replaced). Carries actor, tenant, target identifiers, and operation-specific metadata.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After rollout, recruiters can answer every "what does this role look like?" question from the platform alone — zero consultation of the legacy "Perfil de Puesto" Excel is required for any position whose profile has been filled in. Measured by a sampling of positions whose profile sections are non-empty for at least 80% of newly created positions one month after rollout.
- **SC-002**: Replacing a document on a position never leaves the position with zero active documents of that type. In acceptance and adversarial tests, the position always has either the prior or the new document available, never neither.
- **SC-003**: Document downloads complete in **≤ 2 seconds (p95) for files up to 10 MB on a warm Worker**, and the underlying download endpoint stops being usable as soon as the operator's JWT expires (at most 60 minutes; immediately on session reset/logout).
- **SC-004**: The one-time archive of legacy client-level documents during rollout finishes in under 30 seconds for tenants with up to a few thousand legacy document rows. No tenant experiences a visible outage of the application during the migration.
- **SC-005**: Cross-tenant access to a position document is impossible. In adversarial tests where an operator submits a position or document identifier belonging to another tenant, the request is rejected and indistinguishable from a not-found response.
- **SC-006**: A recruiter who is not assigned to a client cannot view or download any position document of that client, even with a direct identifier.
- **SC-007**: Provisioning a new position with full profile and both documents takes a single AE **no more than 5 minutes** from start to recruiter visibility — replacing the prior multi-tool workflow (Excel + client-level upload + manual coordination), which took 15+ minutes.
- **SC-008**: After rollout, no role has any UI path that surfaces a legacy client-level document. The client detail page has zero references to a "Documentos" tab.

## Assumptions

- The two document types in scope are exactly *contract* and *pase de visita*. Other position-level document types (offer letters, ID copies, NDAs, etc.) are out of scope for this feature and would be added incrementally.
- The 10 MB size cap and PDF/Word file types match the documents the company actually uses today. Larger files or other formats are out of scope.
- A position is owned by a single client (existing model) and is scoped to its tenant (existing model). No cross-client or cross-tenant position concept is introduced.
- The existing client-scoping rules already enforce who can see which positions; no new role or permission concept is introduced beyond what FR-012 codifies.
- Importance ratings (the 5/4/3/2 weights for each profile field captured in the Excel) are deferred to a future iteration. Profile fields are equally treated in v1.
- Position templating — saving a profile as a reusable template across positions — is deferred. Each position carries its own profile.
- Multi-tenant document sharing is explicitly out of scope. Documents belong to one tenant.
- Contract templating with placeholder substitution (e.g. `${candidateName}`) is deferred to a future feature.
- Editing the `is_active` flag on a legacy client-level document after archiving is out of scope. The archive is one-way for the purposes of this feature; an operator who needs to resurrect a legacy document would do so via a controlled, audited operation outside the UI.
- The audit entity, role-based access control, and tenant-scoping middleware are already in place and only need to be extended to the new operations defined here. No new framework or platform component is introduced by this feature.
- `vacancies` MUST be ≥ 1 when set, or `NULL` when not yet specified. "Closed for sourcing" is represented by setting the position's `is_active = false`, **not** by `vacancies = 0`.
- FR-018 (admin-only "Versiones" history panel for archived position-document versions) is implementation-bundled into User Story 5 (compliance preservation) for execution: both surface archived data, both target admin/audit consumers, and grouping them keeps the privileged surface in a single review.
