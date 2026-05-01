# Quickstart — Position Profile and Position-Scoped Documents

**Feature**: `011-puestos-profile-docs`
**Branch**: `011-puestos-profile-docs`
**Audience**: any developer about to start implementation. Run through this end-to-end before writing the first line of production code — TDD per Constitution §V.

---

## 0. Prerequisites

- You are on branch `011-puestos-profile-docs` (created by `/speckit.specify`).
- Local `.dev.vars` includes `DATABASE_URL`, `DATABASE_URL_WORKER`, `JWT_ACCESS_SECRET`, and the `FILES` R2 binding is wired (already configured in `apps/api/wrangler.jsonc`).
- `pnpm install` is up to date at the repo root.
- Read the Excel reference content captured in `spec.md` (Clarifications) and the reasoning in `research.md` before opening any file. Most "weird" decisions in this plan trace back to a specific Excel cell.

---

## 1. Order of work (test-first)

The work is sequenced so each user story can be merged as a vertical slice. Do not skip tests; do not write production code without a failing test first.

### Slice A — schema, shared types, and the legacy archive (US-1 + US-5 foundation)

1. **Write a failing migration test** (Vitest integration, `service.legacy-archive.integration.test.ts`):
   - Seed a tenant with 5 `client_documents` rows.
   - Run the `0010_legacy_client_documents_archive.sql` migration helper.
   - Assert all 5 rows have `is_active = false` afterwards.
   - Assert one `audit_events` row with `entity_type='client_document', action='archive', new->>'rowsAffected'='5'`.
2. **Write a failing schema test** for `client_position_documents` (`packages/db/src/schema/__tests__/client-position-documents.test.ts`):
   - Insert two rows with the same `(tenant_id, position_id, type)` and `is_active = true`. Expect Postgres error 23505 from the partial unique index.
3. **Generate the migrations**:
   - Edit `packages/db/src/schema/client-positions.ts` — add the 18 new columns + the 3 enum imports.
   - Create `packages/db/src/schema/client-position-documents.ts`.
   - Edit `packages/db/src/schema/client-documents.ts` — add `isActive`.
   - Run `pnpm --filter @bepro/db db:generate` → produces `0009_position_profile.sql`.
   - Hand-write `0009_position_profile_rls.sql` (RLS policies for the new table) and `0010_legacy_client_documents_archive.sql` (ALTER + UPDATE + per-tenant audit insert).
   - `pnpm --filter @bepro/db db:push` to apply locally.
4. **Make the failing tests pass**.
5. **Add shared types and Zod schemas** in `packages/shared/src/schemas/positions.ts` and `packages/shared/src/types/positions.ts`. Export the new pg_enum unions, `IClientPositionDto` (extended), `IPositionDocumentDto`, and the `createPositionSchema` / `updatePositionSchema` / `createDocumentSchema`.
6. **Re-run the existing `apps/api/src/modules/clients/__tests__/service.positions.test.ts`** — keep all current behavior green; you'll widen them in slice B.

### Slice B — position profile API + form (US-1)

1. **Write failing API tests** (`service.position-profile.test.ts`, `service.position-profile.integration.test.ts`):
   - `createPosition` accepts every profile field, persists them, emits `client_position.create` audit with full payload.
   - `updatePosition` partial accepts a `null` for any field and clears it; emits diffed audit.
   - Cross-field rule: `ageMin > ageMax` returns 400 `{ code: 'invalid_age_range' }`.
   - Cross-tenant `posId` returns 404 (uniform not-found).
2. **Extend `service.ts`**:
   - Replace the existing `createPosition({ name })` body with the full Zod-validated input.
   - Same for `updatePosition`.
   - Map the rejection `POSITION_DUPLICATE` → 409 stays untouched.
3. **Update `routes.ts`** to swap the existing `createPositionSchema`/`updatePositionSchema` from `@bepro/shared` (the schemas now carry every profile field).
4. **Verify with `pnpm --filter bepro-api test`**.
5. **Write failing UI tests** (`PositionForm.test.tsx`):
   - All seven accordion sections render.
   - `ageMin > ageMax` is reported by Zod resolver before submit.
   - Submitting with only `name` succeeds.
   - Submitting with `null` clears existing values on edit.
6. **Build `PositionForm.tsx`** with shadcn `Accordion`. Use one TanStack Query mutation for create/update.
7. **Build `PositionDetailPage.tsx`** as the read+edit surface. Recruiter sees read-only fields; AE+ sees the editable form.
8. **`pnpm --filter bepro-web test`** until green.

### Slice C — position documents (US-2 + US-3)

1. **Write failing API tests** (`service.position-documents.test.ts`, `routes.position-documents.test.ts`, `service.position-documents.integration.test.ts`):
   - Two-step upload: POST `/documents` returns `{ id, uploadUrl, expiresAt }`; POST `/documents/:id/upload` accepts bytes and flips `uploaded_at`.
   - First upload of a `(position, contract)` emits `position_document.create`.
   - Second upload of the same `(position, contract)` archives the first row (`is_active=false, replaced_at` set) and emits `position_document.replace` carrying `priorDocumentId`.
   - 422 on MIME outside FR-013 list, 422 on `Content-Length > 10 * 1024 * 1024`.
   - Cross-tenant `docId` returns 404.
   - Recruiter not assigned → 404 on download.
   - Concurrent uploads (5 parallel) end with exactly 1 active row (partial unique index proof).
   - JWT-expired retry of `/upload` succeeds without creating a new row.
2. **Build `position-documents-storage.ts`** (constants + `buildPositionStorageKey`).
3. **Extend `service.ts`** with `createPositionDocumentRecord`, `uploadPositionDocumentBytes`, `getPositionDocumentForDownload`, `softDeletePositionDocument`. The replace transaction is in a single helper (`replaceActivePositionDocument`).
4. **Wire routes** under the existing `clientsRoutes` Hono sub-app:
   - `POST /:clientId/positions/:posId/documents`
   - `POST /:clientId/positions/:posId/documents/:docId/upload`
   - `GET /:clientId/positions/:posId/documents/:docId/download`
   - `DELETE /:clientId/positions/:posId/documents/:docId`
5. **Frontend**:
   - `PositionDocumentSlot.tsx` per type (active card with download button, "Reemplazar" button → file input → progress).
   - Use TanStack Query `useMutation` for create+upload; chain the two requests with rollback on the second's failure.
   - Wire into `PositionDetailPage.tsx`.
6. **Remove the legacy "Documentos" UI**:
   - Delete `apps/web/src/modules/clients/components/DocumentManager.tsx`.
   - Edit `ClientDetailPage.tsx`: remove the `TabsTrigger value="documents"`, the `TabsContent value="documents"`, and the `DocumentManager` import.
   - Update `clientService.ts` to drop the legacy document methods (any remaining callers will fail TypeScript).
   - Test: `ClientDetailPage.test.tsx` asserts no element with name "Documentos" exists for any role.
7. **API legacy tombstones**: in `apps/api/src/modules/clients/routes.ts`, replace the legacy `POST/GET/DELETE /:clientId/documents…` handlers with a 410 Gone response. Keep the route registered for clarity.

### Slice D — position-list inline icons (US-4)

1. **Write failing UI tests** (`PositionList.test.tsx`):
   - Each row renders contract download icon iff `documents.contract` is present in the response.
   - Same for `pase_visita`.
   - Click downloads via the existing service method (verifies the right id is hit).
2. **Extend `listPositions`** server-side to include the active-document summary (one row per type, optional). Either join in the same query or do a second `SELECT … WHERE is_active = true GROUP BY position_id, type`. Pick whichever is faster on `EXPLAIN` for the typical workload (likely the GROUP BY is fine — there is at most 2N rows for N positions).
3. **Extend the client-side `PositionList.tsx`** with two icon buttons that conditionally render.

### Slice E — admin-only Versiones panel (US-5 / FR-018)

1. **Write failing API test** (`service.position-documents.integration.test.ts` extension):
   - `GET /…/documents/history` as admin returns archived rows ordered by `replaced_at desc`.
   - As manager / AE / recruiter: 403.
2. **Add `listArchivedPositionDocuments`** in `service.ts` with `requireRole("admin")` on the route.
3. **Extend `lib/ability.ts`** to add `Position.history` for admin.
4. **Build `PositionVersionsPanel.tsx`** — shadcn `Collapsible` showing the table; each row has a download button calling the same `GET /download` (admin can download archived).
5. **Test that the panel does NOT render for non-admins** in `PositionDetailPage.test.tsx`.

### Slice F — end-to-end (Playwright)

1. **`apps/web/e2e/positions-profile-and-documents.spec.ts`**:
   - Sign in as AE.
   - Open a client → "Puestos" tab → create a position with the full profile (every accordion section).
   - Upload `fixtures/contract-v1.pdf` → assert active card shows the file name.
   - Replace with `fixtures/contract-v2.pdf` → assert active card now shows v2.
   - Sign out, sign in as recruiter assigned to the client.
   - Open the position list → assert contract icon visible on the row.
   - Click contract icon → file downloads.
   - Open the position detail → assert pase de visita slot is empty, contract slot shows v2.
   - Sign out, sign in as admin.
   - Open the position detail → expand "Versiones" → assert v1 is listed.
   - Open client detail → assert "Documentos" tab does not exist.

---

## 2. Useful commands

| Goal | Command |
|---|---|
| Run unit + mocked-integration tests on the API | `pnpm --filter bepro-api test` |
| Run real-Neon integration tests | `pnpm --filter bepro-api test:integration` |
| Run web unit tests | `pnpm --filter bepro-web test` |
| Run Playwright e2e | `pnpm --filter bepro-web e2e` |
| Generate a new Drizzle migration after schema edits | `pnpm --filter @bepro/db db:generate` |
| Apply pending migrations to local Neon | `pnpm --filter @bepro/db db:push` |
| Apply a hand-written SQL file to local Neon | `pnpm --filter @bepro/db db:exec packages/db/drizzle/0010_legacy_client_documents_archive.sql` |
| Type-check everything | `pnpm typecheck` |
| Lint everything | `pnpm lint` |
| Start API dev server | `pnpm --filter bepro-api dev` (port 8787) |
| Start web dev server | `pnpm --filter bepro-web dev` (port 5173) |

---

## 3. Manual smoke test recipe

After all six slices land locally, the following manual sequence should succeed without surprises:

1. `pnpm --filter @bepro/db db:push` — applies 0009 + 0009-rls + 0010.
2. `pnpm --filter bepro-api dev` and `pnpm --filter bepro-web dev` in two terminals.
3. Open `http://localhost:5173`, sign in as a seed admin.
4. Create a client, create a position with the full profile (paste actual values from the Excel).
5. Upload a real ≤10 MB PDF as the contract; refresh the page; the contract slot shows the file.
6. Upload a different PDF as the contract; the slot now shows the new one. Open "Versiones" — the previous file is listed.
7. Click each download — files arrive. Verify the URL after click is on the API origin (proxy, not R2).
8. Open the client detail — confirm "Documentos" tab is gone.
9. Sign in as a seed recruiter assigned to the same client; open the position list — both download icons visible. Click them. Files arrive.
10. Sign in as a seed recruiter NOT assigned — the client / position is invisible (404 path).

---

## 4. Verification before claiming a slice is "done" (Constitution §V + verification-before-completion)

Before opening any PR slice:

- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm --filter bepro-api test` and `pnpm --filter bepro-api test:integration` both green.
- `pnpm --filter bepro-web test` green.
- For UI slices, the dev server runs and the manual flow you implemented works in a browser. Don't claim a UI feature works on the strength of unit tests alone.
- The relevant ADR section in `docs/architecture/ADR-011-position-profile-and-documents.md` has been updated to reflect any deviations from this plan that emerged during implementation.

---

## 5. Things to NOT do (common traps)

- **Do not** introduce `@aws-sdk/*` or `aws4fetch` packages. The R2 binding is sufficient (ADR-002).
- **Do not** drop or rename `client_documents`. FR-008 is non-negotiable.
- **Do not** merge a slice with the legacy "Documentos" tab still rendering. The deletion is part of US-3 (P1).
- **Do not** add a "primary" flag to documents. Active vs archived is the only state.
- **Do not** allow a document type other than `contract` or `pase_visita`. The pg_enum + Zod enum guard against this; resist the temptation to add a third type "just in case".
- **Do not** make the "Versiones" panel visible to manager or AE. Server-side `requireRole("admin")` is the safety net; the CASL check is for UX only.
- **Do not** convert `faq` to `{question, answer}` objects "for cleanliness". The Excel content is filter-rules, not Q/A pairs (Q2 clarification, 2026-04-30).
