# Tasks: Módulo de Clientes

**Input**: Design documents from `/specs/005-clients-module/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api.md

**Tests**: TDD es obligatorio por la constitución del proyecto. Los tests se incluyen antes de la implementación.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schemas de base de datos, tipos compartidos y configuración de R2

- [x] T001 [P] Create clients Drizzle schema in `packages/db/src/schema/clients.ts` — table `clients` with id, tenant_id, name, contact_info, address, latitude (numeric 10,7), longitude (numeric 10,7), form_config (jsonb default `{}`), is_active, created_at, updated_at. FK to tenants. Indexes: tenant_id, (tenant_id, name)
- [x] T002 [P] Create client_assignments Drizzle schema in `packages/db/src/schema/client-assignments.ts` — table `client_assignments` with id, tenant_id, client_id (FK clients), user_id (FK users), account_executive_id (FK users, nullable), created_at. Unique constraint (tenant_id, client_id, user_id). Indexes: tenant_id, client_id, user_id
- [x] T003 [P] Create client_contacts Drizzle schema in `packages/db/src/schema/client-contacts.ts` — table `client_contacts` with id, tenant_id, client_id (FK clients), name, phone, email, created_at, updated_at. Unique constraint (tenant_id, client_id, email). Indexes: tenant_id, client_id
- [x] T004 [P] Create client_positions Drizzle schema in `packages/db/src/schema/client-positions.ts` — table `client_positions` with id, tenant_id, client_id (FK clients), name, is_active (default true), created_at, updated_at. Unique constraint (tenant_id, client_id, name) WHERE is_active = true. Indexes: tenant_id, client_id
- [x] T005 [P] Create client_documents Drizzle schema in `packages/db/src/schema/client-documents.ts` — table `client_documents` with id, tenant_id, client_id (FK clients), original_name, document_type (varchar 30), mime_type (varchar 100), size_bytes (integer), storage_key (varchar 500), uploaded_by (FK users), created_at. Indexes: tenant_id, client_id
- [x] T006 Export all new schemas from `packages/db/src/schema/index.ts` — add exports for clients, clientAssignments, clientContacts, clientPositions, clientDocuments
- [x] T007 Run `pnpm db:generate` from `packages/db` to generate migration SQL
- [x] T008 Create RLS policies SQL in `packages/db/drizzle/0002_rls_clients.sql` — RLS for clients (SELECT/INSERT/UPDATE scoped, DELETE blocked), client_assignments (SELECT/INSERT/DELETE scoped, UPDATE blocked), client_contacts (SELECT/INSERT/UPDATE/DELETE all scoped), client_positions (SELECT/INSERT/UPDATE scoped, DELETE allowed), client_documents (SELECT/INSERT/DELETE scoped, UPDATE blocked)
- [x] T009 [P] Update shared types in `packages/shared/src/types/client.ts` — extend IClientDto with latitude?, longitude?, createdAt, updatedAt. Add IClientContactDto, IClientPositionDto, IClientDocumentDto, IClientListResponse. Update ICreateClientRequest with latitude?, longitude?. Update IUpdateClientRequest with latitude?, longitude?. Add ICreateContactRequest, IUpdateContactRequest, ICreatePositionRequest, IUpdatePositionRequest
- [x] T010 [P] Update shared Zod schemas in `packages/shared/src/schemas/client.ts` — extend clientSchema with latitude (optional numeric), longitude (optional numeric). Add createContactSchema (name required, phone required, email required with format validation), updateContactSchema (all optional), createPositionSchema (name required), updatePositionSchema (name optional), listClientsQuerySchema (page, limit, search, isActive), documentTypeSchema (enum: quotation, interview_pass, position_description)
- [x] T011 [P] Add R2 bucket binding in `apps/api/wrangler.jsonc` — add `"r2_buckets": [{ "binding": "FILES", "bucket_name": "bepro-files" }]`. Add `FILES: R2Bucket` to Bindings in `apps/api/src/types.ts`

**Checkpoint**: Database schema, shared types, and infrastructure ready for module implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Module structure and middleware helpers that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T012 Create clients module directory structure: `apps/api/src/modules/clients/routes.ts`, `service.ts`, `types.ts`
- [x] T013 Create verifyClientAccess helper in `apps/api/src/modules/clients/service.ts` — function that checks if current user (by role) has access to a specific client_id. Admin: always allowed. Manager: read-only always allowed. Account_executive: allowed if assigned. Recruiter: allowed if assigned. Returns boolean. Uses client_assignments table
- [x] T014 Mount clients routes in `apps/api/src/index.ts` — import clientsRoutes and add `app.route("/api/clients", clientsRoutes)`
- [x] T015 [P] Create frontend module directory structure: `apps/web/src/modules/clients/components/`, `hooks/`, `services/`, `pages/`
- [x] T016 [P] Create clientService API client in `apps/web/src/modules/clients/services/clientService.ts` — functions for all API calls (list, create, get, update clients + sub-resources). Use fetch with auth headers from Zustand store
- [x] T017 [P] Create TanStack Query hooks skeleton in `apps/web/src/modules/clients/hooks/useClients.ts` — query key factory (CLIENT_KEYS), useClients (list), useClient (detail), useCreateClient, useUpdateClient mutations. Leave sub-resource hooks for later phases

**Checkpoint**: Module structure ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — CRUD de Clientes (Priority: P1) 🎯 MVP

**Goal**: Los administradores pueden crear, listar, editar y desactivar empresas cliente.

**Independent Test**: Crear un cliente, verificar en la lista, editarlo, desactivarlo.

### Tests for User Story 1

- [x] T018 [P] [US1] Write service tests in `apps/api/src/modules/clients/__tests__/service.clients.test.ts` — test createClient (valid data, duplicate name warning), listClients (pagination, search, isActive filter), getClientById (found, not found), updateClient (partial update, deactivation). Mock db with tenant isolation
- [x] T019 [P] [US1] Write route tests in `apps/api/src/modules/clients/__tests__/routes.clients.test.ts` — test POST /api/clients (201, 400 validation, 403 non-admin), GET /api/clients (200 with pagination), GET /api/clients/:id (200, 404), PATCH /api/clients/:id (200, 403 non-admin)

### Implementation for User Story 1

- [x] T020 [US1] Implement createClient in `apps/api/src/modules/clients/service.ts` — insert into clients table with tenant_id from context, validate name not empty, check for duplicate name (warn, not block), set form_config default. Create audit event
- [x] T021 [US1] Implement listClients in `apps/api/src/modules/clients/service.ts` — paginated query with optional search (ILIKE on name), optional isActive filter. For admin/manager: return all. For account_executive/recruiter: join with client_assignments to filter by assigned
- [x] T022 [US1] Implement getClientById and updateClient in `apps/api/src/modules/clients/service.ts` — get with access check. Update partial fields, set updated_at. Create audit event with old/new values
- [x] T023 [US1] Wire up client CRUD routes in `apps/api/src/modules/clients/routes.ts` — POST / (admin only, zValidator), GET / (all roles, query params), GET /:id (access check), PATCH /:id (admin only). Use authMiddleware, tenantMiddleware, requireRole
- [x] T024 [P] [US1] Create ClientForm component in `apps/web/src/modules/clients/components/ClientForm.tsx` — React Hook Form + zodResolver with clientSchema. Fields: name (required), contactInfo (optional), address (optional). Submit calls createClient or updateClient mutation
- [x] T025 [P] [US1] Create ClientList component in `apps/web/src/modules/clients/components/ClientList.tsx` — table with columns: name, contactInfo, status, actions. Search input (debounced), isActive filter toggle. Pagination controls. Uses useClients hook
- [x] T026 [US1] Create ClientsPage in `apps/web/src/modules/clients/pages/ClientsPage.tsx` — page layout with header, create button (admin only), ClientList. URL query params for search, page, filter
- [x] T027 [US1] Add clients route to frontend router — register `/clients` route pointing to ClientsPage

**Checkpoint**: Client CRUD fully functional. Admin can create, list, edit, and deactivate clients.

---

## Phase 4: User Story 2 — Configuración de Formulario Dinámico (Priority: P1)

**Goal**: Los administradores pueden configurar qué campos adicionales se muestran al registrar candidatos para cada cliente.

**Independent Test**: Acceder a la configuración de un cliente, activar/desactivar campos, verificar persistencia.

### Tests for User Story 2

- [x] T028 [P] [US2] Write tests for formConfig update in `apps/api/src/modules/clients/__tests__/service.clients.test.ts` — test updateClient with formConfig partial and full update, verify JSON merge behavior, verify defaults for missing fields

### Implementation for User Story 2

- [x] T029 [US2] Create FormConfigEditor component in `apps/web/src/modules/clients/components/FormConfigEditor.tsx` — toggle switches for each IClientFormConfig field (showInterviewTime, showPosition, showMunicipality, showAge, showShift, showPlant, showInterviewPoint, showComments). Labels in Spanish. Uses useUpdateClient mutation to save. Shows current state from client data
- [x] T030 [US2] Integrate FormConfigEditor into ClientDetail — add "Configuración de formulario" tab/section in client detail view. Only editable by admin

**Checkpoint**: Form configuration editable per client. Changes persist correctly.

---

## Phase 5: User Story 3 — Asignación de Usuarios a Clientes (Priority: P2)

**Goal**: Los administradores asignan ejecutivos de cuenta y reclutadores a clientes. Usuarios asignados ven solo sus clientes.

**Independent Test**: Asignar un ejecutivo a un cliente, verificar que lo ve en su lista, verificar que un ejecutivo no asignado no lo ve.

### Tests for User Story 3

- [x] T031 [P] [US3] Write service tests in `apps/api/src/modules/clients/__tests__/service.assignments.test.ts` — test createAssignment (valid, duplicate, inactive user rejected), listAssignments, deleteAssignment (cascade recruiter removal when AE removed), verifyClientAccess for different roles
- [x] T032 [P] [US3] Write route tests in `apps/api/src/modules/clients/__tests__/routes.assignments.test.ts` — test POST /api/clients/:id/assignments (201, 400 inactive, 409 duplicate, 403), GET (200), DELETE (204, cascade)

### Implementation for User Story 3

- [x] T033 [US3] Implement assignment service functions in `apps/api/src/modules/clients/service.ts` — createAssignment (validate user active, not already assigned), listAssignments (join users for names), deleteAssignment (cascade: when removing AE, also remove recruiter assignments under that AE for this client). Create audit events
- [x] T034 [US3] Wire up assignment routes in `apps/api/src/modules/clients/routes.ts` — POST /:clientId/assignments (admin only), GET /:clientId/assignments (access check), DELETE /:clientId/assignments/:id (admin only)
- [x] T035 [P] [US3] Create AssignmentManager component in `apps/web/src/modules/clients/components/AssignmentManager.tsx` — list current assignments with user name and role. Add assignment form (select user from dropdown, optional AE select). Remove button per assignment. Only visible to admin
- [x] T036 [US3] Add assignment hooks in `apps/web/src/modules/clients/hooks/useClients.ts` — useAssignments(clientId), useCreateAssignment, useDeleteAssignment mutations. Invalidate client detail on mutation

**Checkpoint**: User assignment working. Role-based visibility enforced (US4 depends on this).

---

## Phase 6: User Story 4 — Visualización Filtrada por Rol (Priority: P2)

**Goal**: Cada rol ve solo los clientes que le corresponden según sus asignaciones.

**Independent Test**: Usuarios de diferentes roles consultan la lista y ven solo lo que les corresponde.

### Tests for User Story 4

- [x] T037 [P] [US4] Write isolation tests in `apps/api/src/modules/clients/__tests__/isolation.test.ts` — test that admin sees all clients, manager sees all, account_executive sees only assigned, recruiter sees only assigned. Test cross-tenant isolation (tenant A cannot see tenant B clients)

### Implementation for User Story 4

- [x] T038 [US4] Verify and refine listClients role filtering in `apps/api/src/modules/clients/service.ts` — ensure listClients correctly joins client_assignments for AE/recruiter roles. Admin and manager get unfiltered results. Verify pagination counts match filtered results
- [x] T039 [US4] Verify getClientById access check — ensure AE and recruiter cannot access client detail for unassigned clients (return 404, not 403 to avoid information leakage)

**Checkpoint**: All 4 roles see correct client subsets. Cross-tenant isolation verified.

---

## Phase 7: User Story 5 — Directorio de Contactos (Priority: P2)

**Goal**: Administradores y ejecutivos de cuenta asignados gestionan contactos del cliente (nombre, teléfono, email).

**Independent Test**: Crear contacto, editarlo, verificar unicidad de email por cliente, eliminarlo.

### Tests for User Story 5

- [x] T040 [P] [US5] Write service tests in `apps/api/src/modules/clients/__tests__/service.contacts.test.ts` — test createContact (valid, duplicate email rejected, email format validation, phone format validation), listContacts, updateContact, deleteContact (hard delete). Test that AE assigned can manage, AE not assigned cannot

### Implementation for User Story 5

- [x] T041 [US5] Implement contact service functions in `apps/api/src/modules/clients/service.ts` — createContact (validate access, validate email/phone format, check unique email per client), listContacts (by client_id), updateContact, deleteContact (hard delete). Create audit events
- [x] T042 [US5] Wire up contact routes in `apps/api/src/modules/clients/routes.ts` — POST /:clientId/contacts (admin + assigned AE), GET /:clientId/contacts (any with access), PATCH /:clientId/contacts/:id (admin + assigned AE), DELETE /:clientId/contacts/:id (admin + assigned AE). Use verifyClientAccess
- [x] T043 [P] [US5] Create ContactDirectory component in `apps/web/src/modules/clients/components/ContactDirectory.tsx` — list contacts (name, phone, email). Inline add form. Edit/delete buttons per row. Visible to all with access, editable by admin + assigned AE. Uses contact hooks
- [x] T044 [US5] Add contact hooks in `apps/web/src/modules/clients/hooks/useClients.ts` — useContacts(clientId), useCreateContact, useUpdateContact, useDeleteContact. Invalidate on mutation

**Checkpoint**: Contact directory CRUD working with proper authorization and email uniqueness.

---

## Phase 8: User Story 6 — Gestión de Puestos (Priority: P2)

**Goal**: Administradores y ejecutivos de cuenta asignados gestionan puestos que el cliente recluta.

**Independent Test**: Crear puesto, verificar unicidad de nombre, editarlo, eliminarlo.

### Tests for User Story 6

- [x] T045 [P] [US6] Write service tests in `apps/api/src/modules/clients/__tests__/service.positions.test.ts` — test createPosition (valid, duplicate name rejected), listPositions (active only by default, includeInactive flag), updatePosition (rename, unique check), deletePosition (hard delete if no candidates, soft delete if candidates linked)

### Implementation for User Story 6

- [x] T046 [US6] Implement position service functions in `apps/api/src/modules/clients/service.ts` — createPosition (validate access, check unique name per client), listPositions (filter by is_active, optional includeInactive), updatePosition (check rename uniqueness), deletePosition (check for linked candidates — soft delete via is_active=false if found, hard delete otherwise). Create audit events
- [x] T047 [US6] Wire up position routes in `apps/api/src/modules/clients/routes.ts` — POST /:clientId/positions (admin + assigned AE), GET /:clientId/positions (any with access, query param includeInactive), PATCH /:clientId/positions/:id (admin + assigned AE), DELETE /:clientId/positions/:id (admin + assigned AE)
- [x] T048 [P] [US6] Create PositionList component in `apps/web/src/modules/clients/components/PositionList.tsx` — list positions with name and status. Inline add form. Edit/delete buttons. Toggle to show inactive. Editable by admin + assigned AE
- [x] T049 [US6] Add position hooks in `apps/web/src/modules/clients/hooks/useClients.ts` — usePositions(clientId), useCreatePosition, useUpdatePosition, useDeletePosition

**Checkpoint**: Position CRUD working with uniqueness enforcement and conditional soft/hard delete.

---

## Phase 9: User Story 7 — Ubicación con Mapa Interactivo (Priority: P3)

**Goal**: Los administradores registran la dirección del cliente con autocompletado y selección visual en mapa.

**Independent Test**: Escribir dirección, ver autocompletado, verificar marcador en mapa, ajustar manualmente, verificar coordenadas guardadas.

### Implementation for User Story 7

- [x] T050 [US7] Install MapLibre GL JS and react-map-gl dependencies in `apps/web` — `pnpm add maplibre-gl react-map-gl` in apps/web. Add VITE_MAPBOX_TOKEN to `.env.example`
- [x] T051 [US7] Create LocationMap component in `apps/web/src/modules/clients/components/LocationMap.tsx` — MapLibre GL map with react-map-gl. Features: address autocomplete input using Mapbox Geocoding API (fetch to `api.mapbox.com/geocoding/v5/mapbox.places/`), draggable marker, auto-position on address select, read-only mode for non-admin users. Props: latitude, longitude, address, onChange callback, readOnly
- [x] T052 [US7] Integrate LocationMap into ClientForm and ClientDetail — show map in client creation/edit form. Display map in read-only mode in client detail. Latitude/longitude fields saved with client update. Handle graceful degradation if Mapbox API is unreachable

**Checkpoint**: Map with autocomplete and manual adjust working. Coordinates persist with client data.

---

## Phase 10: User Story 8 — Gestión de Documentos (Priority: P3)

**Goal**: Administradores y ejecutivos de cuenta asignados cargan, listan y eliminan documentos asociados a clientes.

**Independent Test**: Cargar PDF, PNG y XLSX. Verificar lista, previsualización de PNG, descarga, eliminación.

### Tests for User Story 8

- [x] T053 [P] [US8] Write service tests in `apps/api/src/modules/clients/__tests__/service.documents.test.ts` — test uploadDocument (valid PDF/PNG/XLSX, reject .exe, reject >10MB, correct R2 key structure), listDocuments, deleteDocument (removes from DB and R2), downloadDocument (streams from R2 with correct headers)

### Implementation for User Story 8

- [x] T054 [US8] Implement document service functions in `apps/api/src/modules/clients/service.ts` — uploadDocument (parse multipart, validate MIME allowlist, validate size <=10MB, generate R2 key `{tenantId}/clients/{clientId}/documents/{uuid}.{ext}`, put to R2 via c.env.FILES, insert DB record), listDocuments (by client_id, join users for uploader name), downloadDocument (get from R2, stream with Content-Type and Content-Disposition), deleteDocument (delete from R2 + DB). Create audit events
- [x] T055 [US8] Wire up document routes in `apps/api/src/modules/clients/routes.ts` — POST /:clientId/documents (admin + assigned AE, multipart), GET /:clientId/documents (any with access), GET /:clientId/documents/:id/download (any with access, binary response), DELETE /:clientId/documents/:id (admin + assigned AE)
- [x] T056 [P] [US8] Create DocumentManager component in `apps/web/src/modules/clients/components/DocumentManager.tsx` — file upload area with drag-and-drop. Document type selector (cotización/pase de entrevista/descripción de puestos). Document list with name, type, size, uploader, date. PNG inline preview. Download button per document. Delete button (admin + assigned AE). Show upload progress. Client-side validation of file type and 10MB size limit before upload
- [x] T057 [US8] Add document hooks in `apps/web/src/modules/clients/hooks/useClients.ts` — useDocuments(clientId), useUploadDocument (FormData mutation), useDeleteDocument. Download handled by window.open to stream URL

**Checkpoint**: Document upload, list, preview, download, and delete working with proper file type and size validation.

---

## Phase 11: User Story 9 — Búsqueda y Filtrado de Clientes (Priority: P3)

**Goal**: Los usuarios buscan clientes por nombre y filtran por estado, con paginación.

**Independent Test**: Buscar por nombre parcial, filtrar por inactivo, navegar paginación.

### Implementation for User Story 9

- [x] T058 [US9] Verify search and pagination in listClients service — ensure ILIKE search on name works correctly, isActive filter works, pagination returns correct total and totalPages. Already partially implemented in T021 — verify and refine
- [x] T059 [US9] Verify ClientList component search/filter/pagination — ensure debounced search input updates URL params, isActive toggle works, pagination controls navigate correctly. Already partially implemented in T025 — verify and refine

**Checkpoint**: Search, filter, and pagination fully working across all roles.

---

## Phase 12: Client Detail Page (Cross-Story Integration)

**Purpose**: Integrate all sub-resources into a unified client detail view with tabs.

- [x] T060 Create ClientDetailPage in `apps/web/src/modules/clients/pages/ClientDetailPage.tsx` — page layout with client header (name, status). Tabs: General (client info + LocationMap), Configuración (FormConfigEditor, admin only), Contactos (ContactDirectory), Puestos (PositionList), Asignaciones (AssignmentManager, admin only), Documentos (DocumentManager). Fetch client detail with useClient hook. Show/hide tabs based on role
- [x] T061 Add client detail route to frontend router — register `/clients/:id` route pointing to ClientDetailPage
- [x] T062 Add navigation from ClientList rows to ClientDetailPage — click row navigates to detail

**Checkpoint**: Unified client detail page with all sub-resources accessible via tabs.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Audit trail, final validations, type safety

- [x] T063 [P] Verify audit trail coverage — ensure every mutation (create, update, deactivate client; create/delete assignment; CRUD contacts; CRUD positions; upload/delete documents) creates an audit_events record with correct actor_id, action, target_type, target_id, old/new values
- [x] T064 [P] Run typecheck across all packages — `pnpm typecheck` from root. Fix any type errors
- [x] T065 [P] Run lint across all packages — `pnpm lint` from root. Fix any lint issues
- [x] T066 Run full test suite — `pnpm test` from root. All tests must pass
- [x] T067 Run quickstart.md validation — follow quickstart.md steps from scratch to verify setup works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T006, T007 complete)
- **US1 (Phase 3)**: Depends on Phase 2
- **US2 (Phase 4)**: Depends on US1 (extends client CRUD with formConfig)
- **US3 (Phase 5)**: Depends on Phase 2 (uses client_assignments table)
- **US4 (Phase 6)**: Depends on US3 (needs assignments to test filtering)
- **US5 (Phase 7)**: Depends on Phase 2 (independent sub-resource)
- **US6 (Phase 8)**: Depends on Phase 2 (independent sub-resource)
- **US7 (Phase 9)**: Depends on US1 (extends client form with map)
- **US8 (Phase 10)**: Depends on Phase 2 + T011 R2 binding
- **US9 (Phase 11)**: Depends on US1 (refines search already in T021)
- **Detail Page (Phase 12)**: Depends on all user story phases
- **Polish (Phase 13)**: Depends on all phases

### User Story Dependencies

- **US1 (P1)**: Foundational → US1 (no story dependencies)
- **US2 (P1)**: US1 → US2 (formConfig is part of client CRUD)
- **US3 (P2)**: Foundational → US3 (independent, uses assignments table)
- **US4 (P2)**: US3 → US4 (needs assignments for role filtering)
- **US5 (P2)**: Foundational → US5 (independent sub-resource)
- **US6 (P2)**: Foundational → US6 (independent sub-resource)
- **US7 (P3)**: US1 → US7 (extends client form)
- **US8 (P3)**: Foundational → US8 (independent, needs R2)
- **US9 (P3)**: US1 → US9 (refines list from US1)

### Parallel Opportunities

After Phase 2 (Foundational), these can run **in parallel**:
- US1 + US3 + US5 + US6 + US8 (all independent after foundational)

After US1 completes:
- US2 + US7 + US9 (all extend US1)

After US3 completes:
- US4 (needs assignments)

---

## Parallel Example: Phase 1 Setup

```
All schema tasks T001-T005 can run in parallel (different files):
  Task T001: clients.ts
  Task T002: client-assignments.ts
  Task T003: client-contacts.ts
  Task T004: client-positions.ts
  Task T005: client-documents.ts

All shared code tasks T009-T011 can run in parallel:
  Task T009: types/client.ts
  Task T010: schemas/client.ts
  Task T011: wrangler.jsonc + types.ts
```

## Parallel Example: After Foundational

```
Developer A (backend): US1 (T018-T023) then US2 (T028-T030)
Developer B (frontend): US5 backend (T040-T042) + US6 backend (T045-T047) in parallel

Or split by domain:
Developer A: US1 + US3 + US4 (client CRUD + assignments + visibility)
Developer B: US5 + US6 + US8 (contacts + positions + documents)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (all schemas, types, R2 binding)
2. Complete Phase 2: Foundational (module structure, helpers)
3. Complete Phase 3: US1 — Client CRUD
4. Complete Phase 4: US2 — Form Config
5. **STOP and VALIDATE**: Admin can create/edit/deactivate clients with dynamic form config
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 → Client CRUD + Form Config (MVP!)
3. US3 + US4 → Assignments + Role visibility
4. US5 + US6 → Contacts + Positions
5. US7 → Map with autocomplete
6. US8 → Document management (R2)
7. US9 → Search polish
8. Detail Page → Integrated view
9. Polish → Audit, typecheck, lint, tests

### Parallel Team Strategy (Hector + Javi)

1. Both complete Setup + Foundational together
2. Once Foundational is done:
   - **Javi**: US1 → US2 → US7 → US9 (client CRUD flow + map)
   - **Hector**: US3 → US4 → US5 → US6 → US8 (assignments + sub-resources)
3. Both collaborate on Detail Page (Phase 12) and Polish (Phase 13)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- TDD obligatorio: write tests first, verify they fail, then implement
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- R2 bucket must be created once via `npx wrangler r2 bucket create bepro-files`
- MapLibre + Mapbox token needed only for US7 (map feature)
