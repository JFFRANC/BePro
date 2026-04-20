# Quickstart: Módulo de Clientes

**Feature**: 005-clients-module  
**Date**: 2026-04-15

## Prerequisitos

- Node.js 20+, pnpm
- Neon PostgreSQL con RLS habilitado
- Cloudflare Workers account (para R2)
- Mapbox account (API key para geocoding)

## Setup local

```bash
# 1. Clonar y cambiar al branch
git checkout 005-clients-module
pnpm install

# 2. Variables de entorno (apps/api/.dev.vars)
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
# Agregar cuando se implemente R2:
# (R2 binding se configura en wrangler.jsonc, no como env var)

# 3. Variables de entorno frontend (apps/web/.env.local)
VITE_MAPBOX_TOKEN=pk.xxx  # Mapbox public token para geocoding

# 4. Crear bucket R2 (una sola vez)
cd apps/api
npx wrangler r2 bucket create bepro-files

# 5. Generar y aplicar migraciones
cd packages/db
pnpm db:generate
pnpm db:push

# 6. Aplicar RLS policies (manual)
# Ejecutar el SQL de RLS para las nuevas tablas (clients, client_assignments,
# client_contacts, client_positions, client_documents)

# 7. Iniciar dev servers
pnpm dev  # Desde la raíz — turbo ejecuta web + api en paralelo
```

## Verificación rápida

```bash
# API health check
curl http://localhost:8787/health

# Crear un cliente (requiere JWT de admin)
curl -X POST http://localhost:8787/api/clients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Empresa Test", "contactInfo": "test@test.com"}'

# Listar clientes
curl http://localhost:8787/api/clients \
  -H "Authorization: Bearer $TOKEN"
```

## Estructura de archivos a crear

```
packages/db/src/schema/
├── clients.ts              # Tabla clients
├── client-assignments.ts   # Tabla client_assignments
├── client-contacts.ts      # Tabla client_contacts
├── client-positions.ts     # Tabla client_positions
└── client-documents.ts     # Tabla client_documents

apps/api/src/modules/clients/
├── routes.ts               # Endpoints Hono (CRUD + sub-recursos)
├── service.ts              # Lógica de negocio
└── types.ts                # Tipos del módulo

packages/shared/src/
├── types/client.ts          # Actualizar DTOs existentes
└── schemas/client.ts        # Actualizar Zod schemas

apps/web/src/modules/clients/
├── components/
│   ├── ClientForm.tsx       # Formulario de creación/edición
│   ├── ClientList.tsx       # Lista con búsqueda y paginación
│   ├── ClientDetail.tsx     # Vista detalle con tabs
│   ├── FormConfigEditor.tsx # Editor de configuración de formulario
│   ├── ContactDirectory.tsx # CRUD de contactos
│   ├── PositionList.tsx     # CRUD de puestos
│   ├── LocationMap.tsx      # Mapa interactivo con autocompletado
│   └── DocumentManager.tsx  # Carga y lista de documentos
├── hooks/
│   └── useClients.ts        # TanStack Query hooks
├── services/
│   └── clientService.ts     # API client functions
└── pages/
    ├── ClientsPage.tsx      # Lista de clientes
    └── ClientDetailPage.tsx # Detalle con tabs
```

## Orden de implementación sugerido

1. Schema DB + migraciones + RLS
2. API: CRUD clientes (routes + service)
3. API: Asignaciones
4. API: Contactos, Puestos
5. API: Documentos (R2)
6. Frontend: Lista + formulario de clientes
7. Frontend: Detalle con tabs (config, contactos, puestos, asignaciones)
8. Frontend: Mapa interactivo
9. Frontend: Gestión de documentos
