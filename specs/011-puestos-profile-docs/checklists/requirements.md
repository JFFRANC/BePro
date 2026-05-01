# Specification Quality Checklist: Position Profile and Position-Scoped Documents

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-29
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit.clarify` or `/speckit.plan`
- The brief from the user covered every area of the spec: actors, priorities, edge cases, out-of-scope, constitution alignment. No [NEEDS CLARIFICATION] markers were introduced — implementation specifics (column types, endpoint paths, R2 presigning, partial unique index, RLS shape) provided in the user input are deliberately deferred to `/speckit.plan` and not surfaced in the spec body.
- Two minor items were resolved by informed default rather than clarification: (a) **soft-deleted position with documents** behavior is captured in E-02 and FR-007 — documents stay queryable, are not downloadable from the UI; (b) **upload completion semantics** are captured in E-07 and FR-005 — the document row is registered only after the upload is confirmed complete, and an expired URL produces no orphan rows. Both are reasonable defaults rooted in the user's E-02 / E-07 entries and do not change scope.

## Clarification session 2026-04-30

Four questions asked, four answered. Each integrated into `## Clarifications` and reflected in FR-001 / FR-018 of `spec.md`.

| # | Topic | Decision |
|---|-------|----------|
| Q1 | Required-documentation field shape | Free-text string list (no controlled vocabulary) |
| Q2 | "FAQ" / "Preguntas Frecuentes" structure | Flat list of free-text strings — phone-screen filter checklist, not Q/A pairs (decided after analyzing actual Excel content) |
| Q3 | Salary representation given the compound Excel cell | Hybrid — structured `salary_amount` + `salary_currency` (default MXN) + `payment_frequency`, plus a free-text `salary_notes` field for vales/bonuses |
| Q4 | Archived/replaced document UI download policy | Admin-only "Versiones" history panel on the position detail; FR-018 codifies this |

Side-effect decisions (driven by Excel analysis under Q2, recorded as additional `## Clarifications` bullets):

- **Gender**: single select `masculino` / `femenino` / `indistinto` — Excel's "MASCULINO Y FEMENINO" canonicalizes to `indistinto`.
- **Experience**: consolidate the Excel's two duplicated cells (`Años de Experiencia` + `Experiencia Requerida`) into a single `experience_text` field.
- **Schedule**: a free-text `schedule_text` textarea PLUS structured `work_days[]` and `shift` (the Excel mashes both into prose; the platform splits them so list/filter views can use the structured ones).

Items intentionally not asked and deferred to `/speckit.plan`:

- **Manager mutation scope on positions** — recoverable from existing role matrix and 008's flow without spec-level decision.
- **Concurrency tie-break on simultaneous uploads** — partial unique index serializes the two writes; "last completed wins" is the natural outcome and is not a business-level question.
- **Archived-document retention period** — LFPDPPP-aligned indefinite retention is the safe default; an explicit retention rule can be added in a future feature.
- **`vacancies = 0` semantics** — natural default ("closed for sourcing"); not blocking.
