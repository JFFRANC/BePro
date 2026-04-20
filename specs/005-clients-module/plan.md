# Implementation Plan: Módulo de Clientes

**Branch**: `005-clients-module` | **Date**: 2026-04-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-clients-module/spec.md`

## Summary

Módulo completo de gestión de empresas cliente para la plataforma BePro. Incluye CRUD de clientes con configuración dinámica de formularios, directorio de contactos, gestión de puestos, ubicación geográfica con mapa interactivo (MapLibre + Mapbox Geocoding), gestión de documentos (Cloudflare R2), asignación de usuarios por roles y visibilidad filtrada. Todo bajo aislamiento multi-tenant con RLS.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode)  
**Primary Dependencies**: Hono 4.7.10 (API), React 19.1 (UI), Drizzle ORM 0.44.7 (DB), Zod 4.3.6 (validation), MapLibre GL JS + react-map-gl (mapa), Mapbox Geocoding API (autocompletado)  
**Storage**: Neon PostgreSQL (serverless) + Cloudflare R2 (documentos)  
**Testing**: Vitest  
**Target Platform**: Cloudflare Workers (API) + Cloudflare Pages (SPA)  
**Project Type**: Web service (API + SPA)  
**Performance Goals**: Lista de 100+ clientes < 2s, carga de documentos 10MB < 30s  
**Constraints**: $0-25/mes total, Workers body limit 128MB, R2 free tier 10GB storage  
**Scale/Scope**: ~50-200 clientes por tenant, ~20 usuarios concurrentes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Multi-Tenant Isolation | PASS | `tenant_id` en todas las tablas, RLS policies para SELECT/INSERT/UPDATE/DELETE, `SET LOCAL` en middleware |
| II. Edge-First | PASS | Cloudflare Workers + Pages + R2. MapLibre es client-side. Mapbox Geocoding free tier dentro del presupuesto |
| III. TypeScript Everywhere | PASS | Todo TypeScript strict. Zod schemas compartidos en packages/shared |
| IV. Modular by Domain | PASS | Módulo independiente en `apps/api/src/modules/clients/`. Solo necesita montar ruta en `index.ts` |
| V. Test-First | PENDING | Tests se escriben antes de implementación (TDD). Integration tests para RLS, API contracts, role-based access |
| VI. Security by Design | PASS | Soft delete para clientes (LFPDPPP). Hard delete para contactos comerciales (no PII protegido). Documentos servidos a través de Worker autenticado, nunca bucket público |
| VII. Best Practices via Agents | PASS | Especialistas disponibles para DB, multi-tenancy, backend, frontend |
| VIII. Spec-Driven Development | PASS | Spec → Plan → Tasks → Implementation |

**Post-design re-check**: All gates PASS. R2 access through authenticated Worker maintains tenant isolation at storage level.

## Project Structure

### Documentation (this feature)

```text
specs/005-clients-module/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: technology research
├── data-model.md        # Phase 1: entity definitions
├── quickstart.md        # Phase 1: setup guide
├── contracts/
│   └── api.md           # Phase 1: API endpoint contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/src/schema/
├── clients.ts                # Tabla clients
├── client-assignments.ts     # Tabla client_assignments
├── client-contacts.ts        # Tabla client_contacts
├── client-positions.ts       # Tabla client_positions
├── client-documents.ts       # Tabla client_documents
└── index.ts                  # Agregar exports

packages/db/drizzle/
└── 0002_rls_clients.sql      # RLS policies para tablas de clientes

packages/shared/src/
├── types/client.ts            # Actualizar DTOs (agregar lat/lng, contactos, puestos, documentos)
└── schemas/client.ts          # Actualizar Zod schemas

apps/api/
├── src/
│   ├── index.ts               # Montar clientsRoutes
│   ├── types.ts               # Agregar FILES: R2Bucket a Bindings
│   └── modules/clients/
│       ├── routes.ts           # Endpoints Hono
│       ├── service.ts          # Lógica de negocio
│       ├── types.ts            # Tipos del módulo
│       └── __tests__/
│           ├── service.clients.test.ts
│           ├── service.assignments.test.ts
│           ├── service.contacts.test.ts
│           ├── service.positions.test.ts
│           ├── service.documents.test.ts
│           ├── routes.test.ts
│           └── isolation.test.ts
└── wrangler.jsonc              # Agregar r2_buckets binding

apps/web/src/modules/clients/
├── components/
│   ├── ClientForm.tsx          # Formulario creación/edición
│   ├── ClientList.tsx          # Lista con búsqueda y paginación
│   ├── ClientDetail.tsx        # Vista detalle con tabs
│   ├── FormConfigEditor.tsx    # Editor de form_config (toggles)
│   ├── ContactDirectory.tsx    # CRUD de contactos inline
│   ├── PositionList.tsx        # CRUD de puestos inline
│   ├── LocationMap.tsx         # MapLibre + autocompletado Mapbox
│   ├── DocumentManager.tsx     # Carga y lista de documentos
│   └── AssignmentManager.tsx   # Gestión de asignaciones
├── hooks/
│   └── useClients.ts           # TanStack Query hooks
├── services/
│   └── clientService.ts        # API client functions
├── pages/
│   ├── ClientsPage.tsx         # Página de lista
│   └── ClientDetailPage.tsx    # Página de detalle con tabs
└── __tests__/
    ├── ClientForm.test.tsx
    └── ClientList.test.tsx
```

**Structure Decision**: Sigue el patrón existente de módulos (auth, users). El módulo clients es independiente — solo requiere montar la ruta en `apps/api/src/index.ts` y agregar la ruta en el router del frontend.

## Complexity Tracking

No hay violaciones de la constitución que requieran justificación. El módulo sigue todos los principios establecidos.

| Decisión | Justificación |
|----------|--------------|
| R2 para documentos (nueva dependency) | Requerido por la spec. Ya previsto en wrangler.jsonc como binding futuro. Free tier de 10GB suficiente |
| MapLibre + Mapbox Geocoding (nueva dependency) | Requerido por la spec (mapa interactivo + autocompletado). Free tier dentro del presupuesto $0-25/mes |
| 5 tablas nuevas | Una por entidad del modelo de datos. Cada tabla sigue las convenciones existentes (tenant_id, timestamps, RLS) |
