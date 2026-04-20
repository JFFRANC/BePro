# API Contracts: Módulo de Clientes

**Feature**: 005-clients-module  
**Date**: 2026-04-15  
**Base path**: `/api/clients`

All endpoints require `Authorization: Bearer {token}` header.  
All responses are JSON. All tenant-scoped via RLS.

## Clients CRUD

### POST /api/clients
Create a new client.

**Roles**: `admin`

**Request body**:
```json
{
  "name": "Empresa ABC",
  "contactInfo": "info@empresa.com",
  "address": "Av. Reforma 123, CDMX",
  "latitude": 19.4326077,
  "longitude": -99.1332080,
  "formConfig": {
    "showInterviewTime": true,
    "showPosition": true,
    "showMunicipality": false,
    "showAge": false,
    "showShift": true,
    "showPlant": true,
    "showInterviewPoint": false,
    "showComments": false
  }
}
```

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Empresa ABC",
    "contactInfo": "info@empresa.com",
    "address": "Av. Reforma 123, CDMX",
    "latitude": 19.4326077,
    "longitude": -99.1332080,
    "isActive": true,
    "formConfig": { ... },
    "createdAt": "2026-04-15T00:00:00Z",
    "updatedAt": "2026-04-15T00:00:00Z"
  }
}
```

**Errors**: 400 (validation), 403 (not admin)

---

### GET /api/clients
List clients (role-filtered, paginated, searchable).

**Roles**: `admin`, `manager`, `account_executive`, `recruiter`

**Query params**:
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `search` (optional, partial name match, case-insensitive)
- `isActive` (optional, boolean filter)

**Response 200**:
```json
{
  "data": [ { ...IClientDto } ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

**Note**: `account_executive` and `recruiter` see only assigned clients.

---

### GET /api/clients/:id
Get client detail.

**Roles**: `admin`, `manager`, `account_executive` (assigned), `recruiter` (assigned)

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Empresa ABC",
    "contactInfo": "...",
    "address": "...",
    "latitude": 19.4326077,
    "longitude": -99.1332080,
    "isActive": true,
    "formConfig": { ... },
    "contacts": [ { ...IClientContactDto } ],
    "positions": [ { ...IClientPositionDto } ],
    "assignments": [ { ...IClientAssignmentDto } ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### PATCH /api/clients/:id
Update client.

**Roles**: `admin`

**Request body** (all fields optional):
```json
{
  "name": "Nuevo nombre",
  "contactInfo": "...",
  "address": "...",
  "latitude": 19.43,
  "longitude": -99.13,
  "isActive": false,
  "formConfig": { ... }
}
```

**Response 200**: Updated client DTO.

---

## Client Assignments

### POST /api/clients/:clientId/assignments
Assign a user to a client.

**Roles**: `admin`

**Request body**:
```json
{
  "userId": "uuid",
  "accountExecutiveId": "uuid (optional)"
}
```

**Response 201**: Created assignment DTO.  
**Errors**: 400 (user inactive), 409 (already assigned)

---

### GET /api/clients/:clientId/assignments
List assignments for a client.

**Roles**: `admin`, `manager`, `account_executive` (assigned), `recruiter` (assigned)

**Response 200**: `{ "data": [ { ...IClientAssignmentDto } ] }`

---

### DELETE /api/clients/:clientId/assignments/:id
Remove an assignment.

**Roles**: `admin`

**Response 204**: No content.  
**Note**: Cascade deletes recruiter assignments linked to this AE on this client.

---

## Client Contacts

### POST /api/clients/:clientId/contacts
Create a contact.

**Roles**: `admin`, `account_executive` (assigned)

**Request body**:
```json
{
  "name": "María López",
  "phone": "5512345678",
  "email": "maria@empresa.com"
}
```

**Response 201**: Created contact DTO.  
**Errors**: 400 (validation), 409 (duplicate email in client)

---

### GET /api/clients/:clientId/contacts
List contacts for a client.

**Roles**: `admin`, `manager`, `account_executive` (assigned), `recruiter` (assigned)

**Response 200**: `{ "data": [ { ...IClientContactDto } ] }`

---

### PATCH /api/clients/:clientId/contacts/:id
Update a contact.

**Roles**: `admin`, `account_executive` (assigned)

**Request body** (all optional):
```json
{
  "name": "María López García",
  "phone": "5512345679",
  "email": "maria.lopez@empresa.com"
}
```

**Response 200**: Updated contact DTO.

---

### DELETE /api/clients/:clientId/contacts/:id
Delete a contact (hard delete).

**Roles**: `admin`, `account_executive` (assigned)

**Response 204**: No content.

---

## Client Positions

### POST /api/clients/:clientId/positions
Create a position.

**Roles**: `admin`, `account_executive` (assigned)

**Request body**:
```json
{
  "name": "Ayudante General"
}
```

**Response 201**: Created position DTO.  
**Errors**: 409 (duplicate name in client)

---

### GET /api/clients/:clientId/positions
List positions for a client.

**Roles**: `admin`, `manager`, `account_executive` (assigned), `recruiter` (assigned)

**Query params**:
- `includeInactive` (optional, boolean, default: false)

**Response 200**: `{ "data": [ { ...IClientPositionDto } ] }`

---

### PATCH /api/clients/:clientId/positions/:id
Update a position.

**Roles**: `admin`, `account_executive` (assigned)

**Request body**:
```json
{
  "name": "Operador de Montacargas"
}
```

**Response 200**: Updated position DTO.

---

### DELETE /api/clients/:clientId/positions/:id
Delete a position (hard delete if no candidates, soft delete if candidates exist).

**Roles**: `admin`, `account_executive` (assigned)

**Response 204**: No content.

---

## Client Documents

### POST /api/clients/:clientId/documents
Upload a document (multipart/form-data).

**Roles**: `admin`, `account_executive` (assigned)

**Request body** (multipart):
- `file`: File (PDF, PNG, or XLSX, max 10 MB)
- `documentType`: string ('quotation' | 'interview_pass' | 'position_description')

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "originalName": "cotizacion-2026.pdf",
    "documentType": "quotation",
    "mimeType": "application/pdf",
    "sizeBytes": 2048000,
    "uploadedBy": "uuid",
    "createdAt": "2026-04-15T00:00:00Z"
  }
}
```

**Errors**: 413 (file too large), 415 (unsupported type)

---

### GET /api/clients/:clientId/documents
List documents for a client.

**Roles**: `admin`, `manager`, `account_executive` (assigned), `recruiter` (assigned)

**Response 200**: `{ "data": [ { ...IClientDocumentDto } ] }`

---

### GET /api/clients/:clientId/documents/:id/download
Download a document file.

**Roles**: `admin`, `manager`, `account_executive` (assigned), `recruiter` (assigned)

**Response 200**: Binary stream with `Content-Type` and `Content-Disposition` headers.

---

### DELETE /api/clients/:clientId/documents/:id
Delete a document (hard delete from DB + R2).

**Roles**: `admin`, `account_executive` (assigned)

**Response 204**: No content.

---

## DTOs Summary

### IClientDto (extended)
```typescript
{
  id: string;
  name: string;
  contactInfo?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  formConfig: IClientFormConfig;
  createdAt: string;
  updatedAt: string;
}
```

### IClientContactDto
```typescript
{
  id: string;
  clientId: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}
```

### IClientPositionDto
```typescript
{
  id: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### IClientDocumentDto
```typescript
{
  id: string;
  clientId: string;
  originalName: string;
  documentType: 'quotation' | 'interview_pass' | 'position_description';
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}
```
