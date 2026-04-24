# Data Model: UI/UX Visual Refresh

**Feature**: 009-ui-visual-refresh
**Phase**: 1 (Design & Contracts)

## Applicability

**Not applicable.** This feature is purely presentational. It introduces no new database tables, no new entities, and no new API request/response shapes. It does not persist any new state.

## Existing data touched

None. The refresh re-styles views that consume existing entities (User, Client, Candidate, Placement, AuditEvent, etc.), but those entities and their access patterns are unchanged.

## Client-side state

- The theme-mode preference (`light` / `dark` / `system`) continues to be owned by feature 006-theme-toggle (`next-themes` with `localStorage` key `bepro.theme`). This feature does not read or write that state directly.
- No new client state is introduced.
