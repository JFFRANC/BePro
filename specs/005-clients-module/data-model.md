# Data Model: Módulo de Clientes

**Feature**: 005-clients-module  
**Date**: 2026-04-15

## Entities

### clients

Empresa cliente que contrata servicios de reclutamiento.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default random | |
| tenant_id | uuid | FK → tenants.id, NOT NULL | RLS-scoped |
| name | varchar(200) | NOT NULL | |
| contact_info | varchar(500) | nullable | Info general de contacto |
| address | varchar(500) | nullable | Dirección textual |
| latitude | numeric(10,7) | nullable | Coordenada geográfica |
| longitude | numeric(10,7) | nullable | Coordenada geográfica |
| form_config | jsonb | NOT NULL, default `{}` | IClientFormConfig toggles |
| is_active | boolean | NOT NULL, default true | Soft delete flag |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

**Indexes**:
- `clients_tenant_id_idx` on (tenant_id)
- `clients_tenant_name_idx` on (tenant_id, name) — para búsqueda y detección de duplicados

**RLS**: SELECT, INSERT, UPDATE scoped por tenant_id. DELETE blocked (soft delete only).

---

### client_assignments

Relación entre un usuario y un cliente. Vincula ejecutivos de cuenta y reclutadores a clientes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default random | |
| tenant_id | uuid | FK → tenants.id, NOT NULL | RLS-scoped |
| client_id | uuid | FK → clients.id, NOT NULL | |
| user_id | uuid | FK → users.id, NOT NULL | Ejecutivo o reclutador |
| account_executive_id | uuid | FK → users.id, nullable | Vincula reclutador a su AE |
| created_at | timestamptz | NOT NULL, default now() | |

**Unique constraint**: `(tenant_id, client_id, user_id)` — un usuario solo puede estar asignado una vez a cada cliente.

**Indexes**:
- `client_assignments_tenant_id_idx` on (tenant_id)
- `client_assignments_client_id_idx` on (client_id)
- `client_assignments_user_id_idx` on (user_id)

**RLS**: SELECT, INSERT scoped por tenant_id. DELETE allowed (hard delete). UPDATE blocked.

---

### client_contacts

Personas de contacto de la empresa cliente (RRHH, jefes de planta, etc.).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default random | |
| tenant_id | uuid | FK → tenants.id, NOT NULL | RLS-scoped |
| client_id | uuid | FK → clients.id, NOT NULL | |
| name | varchar(200) | NOT NULL | Nombre del contacto |
| phone | varchar(20) | NOT NULL | Teléfono celular |
| email | varchar(255) | NOT NULL | Correo electrónico |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

**Unique constraint**: `(tenant_id, client_id, email)` — email único por cliente dentro del tenant.

**Indexes**:
- `client_contacts_tenant_id_idx` on (tenant_id)
- `client_contacts_client_id_idx` on (client_id)

**RLS**: SELECT, INSERT, UPDATE, DELETE scoped por tenant_id. DELETE allowed (hard delete — contactos comerciales, no PII protegido).

---

### client_positions

Puestos que el cliente recluta.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default random | |
| tenant_id | uuid | FK → tenants.id, NOT NULL | RLS-scoped |
| client_id | uuid | FK → clients.id, NOT NULL | |
| name | varchar(200) | NOT NULL | Nombre del puesto |
| is_active | boolean | NOT NULL, default true | Soft delete cuando tiene candidatos |
| created_at | timestamptz | NOT NULL, default now() | |
| updated_at | timestamptz | NOT NULL, default now() | |

**Unique constraint**: `(tenant_id, client_id, name)` — nombre único por cliente dentro del tenant (solo entre activos; considerar partial unique index WHERE is_active = true).

**Indexes**:
- `client_positions_tenant_id_idx` on (tenant_id)
- `client_positions_client_id_idx` on (client_id)

**RLS**: SELECT, INSERT, UPDATE scoped por tenant_id. DELETE allowed para hard delete (sin candidatos) o soft delete (con candidatos vía UPDATE is_active = false).

---

### client_documents

Archivos asociados a un cliente, almacenados en Cloudflare R2.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default random | |
| tenant_id | uuid | FK → tenants.id, NOT NULL | RLS-scoped |
| client_id | uuid | FK → clients.id, NOT NULL | |
| original_name | varchar(255) | NOT NULL | Nombre original del archivo |
| document_type | varchar(30) | NOT NULL | 'quotation' / 'interview_pass' / 'position_description' |
| mime_type | varchar(100) | NOT NULL | e.g. application/pdf |
| size_bytes | integer | NOT NULL | Tamaño en bytes |
| storage_key | varchar(500) | NOT NULL | Key en R2: {tenant_id}/clients/{client_id}/documents/{uuid}.{ext} |
| uploaded_by | uuid | FK → users.id, NOT NULL | Usuario que cargó el archivo |
| created_at | timestamptz | NOT NULL, default now() | Fecha de carga |

**Indexes**:
- `client_documents_tenant_id_idx` on (tenant_id)
- `client_documents_client_id_idx` on (client_id)

**RLS**: SELECT, INSERT scoped por tenant_id. DELETE allowed (hard delete — se elimina también el archivo en R2). UPDATE blocked.

---

## Relationships

```
tenants
  └── clients (tenant_id → tenants.id)
        ├── client_assignments (client_id → clients.id)
        │     ├── user_id → users.id
        │     └── account_executive_id → users.id (nullable)
        ├── client_contacts (client_id → clients.id)
        ├── client_positions (client_id → clients.id)
        └── client_documents (client_id → clients.id)
              └── uploaded_by → users.id
```

## Form Config JSON Structure

Almacenado como JSONB en `clients.form_config`:

```json
{
  "showInterviewTime": false,
  "showPosition": false,
  "showMunicipality": false,
  "showAge": false,
  "showShift": false,
  "showPlant": false,
  "showInterviewPoint": false,
  "showComments": false
}
```

Todos los campos son booleanos. Default: todos `false`.

## Document Types Enum

| Value | MIME Type | Extension | Descripción |
|-------|-----------|-----------|-------------|
| `quotation` | application/pdf | .pdf | Cotización |
| `interview_pass` | image/png | .png | Pase de entrevista |
| `position_description` | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx | Descripción de puestos |
