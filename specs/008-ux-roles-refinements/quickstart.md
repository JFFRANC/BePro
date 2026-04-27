# Quickstart — UX, Role Scoping, and Configurability Refinements

**Feature**: 008-ux-roles-refinements
**Audience**: anyone picking up a task from `tasks.md`.

## Scope in one paragraph

Ship: (1) header user menu with logout, (2) recruiter-only candidate create gate + UI hiding, (3) inline per-row status-transition dropdown, (4) Spanish labels for candidate enums, (5) multi-select AE↔client assignment table, (6) admin-managed custom `formConfig` fields, (7) privacy-notice UI removal (keep DB read-only), (8) hidden login tenant field defaulting to `bepro`.

## Local setup

Nothing new to install. From the repo root:

```bash
pnpm install
pnpm -F @bepro/api dev      # API on :8787
pnpm -F @bepro/web dev      # Web on :5173
```

For the integration tests against Neon:

```bash
# Requires apps/api/.dev.vars with DATABASE_URL_WORKER set
pnpm -F @bepro/api test:integration
```

## Environment variables

| Name | Default | Effect |
|---|---|---|
| `VITE_LOGIN_TENANT_FIXED` | `bepro` | Hides the tenant input on the login screen and submits this value. Set to empty string to re-enable the input. |

## Test plan (TDD order)

1. **API — candidate-create role gate** (`contracts/candidates-create-gating.md`)
   - Add failing tests in `apps/api/src/modules/candidates/__tests__/routes.register.test.ts` for 403 under admin/manager/AE tokens, 201 under recruiter tokens with and without `privacyNoticeId`.
   - Implement `requireRole(["recruiter"])` on `POST /api/candidates`.
   - Relax `privacyNoticeId` in the shared schema and service.

2. **Shared — Spanish label map**
   - Failing test asserting every `CandidateStatus` enum value has a non-empty Spanish label in `CANDIDATE_STATUS_LABELS_ES`.
   - Implement the map + `statusLabel()` helper. English map stays for audit.

3. **Web — inline status transition** (`contracts/candidates-transition-inline.md`)
   - Failing component test for `InlineStatusMenu` rendering only valid transitions per (role × current status). Table-driven.
   - Failing hook test for `useTransitionCandidate` optimistic path, rollback on 500, 409 re-fetch.
   - Implement both, wire into `CandidateListPage.tsx` as a new action column.

4. **API — batch assignments** (`contracts/clients-assignments-batch.md`)
   - Failing service test: diff semantics with reactivation, partial failure abort, cross-tenant 404, audit row shape.
   - Implement `POST /api/clients/:clientId/assignments/batch`.

5. **Web — assignment checkbox table**
   - Failing test for `AssignmentTable` rendering eligible users with correct checked state, search filter, save-diff payload shape.
   - Implement + replace `AssignmentManager` usage on `ClientDetailPage`.

6. **API — formConfig fields CRUD** (`contracts/clients-form-config-fields.md`)
   - Failing tests for create/update/archive/unarchive, duplicate-key 409, immutable `type`/`key` 422.
   - Implement mutations with Zod + `SELECT ... FOR UPDATE`.

7. **Web — formConfig fields editor**
   - Failing test for `FormConfigFieldsEditor` covering field creation, edit, archive, unarchive; rendered under client settings.
   - Implement + wire into client detail page.

8. **Web — privacy-notice UI removal**
   - Failing test asserting `NewCandidatePage` does not render `PrivacyNoticeCheckbox` and submits without `privacyNoticeId`.
   - Failing test asserting `CandidateDetailPage` no longer shows the "Accepted at/by" block.
   - Remove the components/blocks. Verify `PrivacyNoticeCheckbox.tsx` has zero remaining importers; delete the file.

9. **Web — login tenant hide**
   - Failing test (driven by `VITE_LOGIN_TENANT_FIXED`) that the tenant input is absent and submission sends `tenantSlug: "bepro"`.
   - Implement the config read + conditional render.

10. **Web — header user menu**
    - Failing test for `UserMenu`: initials fallback, display name rendering, dropdown open, logout invokes auth logout + navigates to `/login`.
    - Implement + mount in `Header.tsx`.
    - Smoke: every authenticated route shows the menu.

11. **E2E (Playwright)**
    - Inline transition end-to-end.
    - Multi-assign save end-to-end.
    - Login without tenant field end-to-end.

12. **Run the full gate**:

```bash
pnpm lint
pnpm -r typecheck
pnpm -r test
pnpm -F @bepro/api test:integration   # requires DATABASE_URL_WORKER
pnpm -F @bepro/web test:e2e           # requires `pnpm exec playwright install chromium`
```

## Done definition

- All 37 FRs from spec.md have at least one automated test referencing them.
- CI pipeline green on `lint → typecheck → test`.
- Constitution §VI amendment PR merged (separate PR, tracked in plan.md Complexity Tracking).
- Feature PR opened against `main` (this team's current flow).
