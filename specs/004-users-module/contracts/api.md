# API Contracts: Users Module (004)

**Base Path**: `/api/users`
**Auth**: All endpoints require `Authorization: Bearer <JWT>` + tenant middleware (`SET LOCAL app.tenant_id`)

## Endpoints

### GET /api/users — List Users

**Middleware**: authMiddleware → tenantMiddleware → requireRole("admin", "manager", "account_executive", "recruiter")
**Role scoping**: Admin/Manager see all users. AE sees all recruiters (MVP). Recruiter sees only self.

**Query Parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max 100) |
| `search` | string | — | Partial match on first_name, last_name, or email (ILIKE) |
| `role` | string | — | Filter by role (admin, manager, account_executive, recruiter) |
| `isActive` | boolean | true | Filter by active status |
| `isFreelancer` | boolean | — | Filter by freelancer flag |

**Response 200**:

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "role": "recruiter",
      "isFreelancer": true,
      "isActive": true,
      "mustChangePassword": false,
      "lastLoginAt": "2026-04-13T10:00:00Z",
      "createdAt": "2026-04-01T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Response 401**: `{ "error": "Unauthorized" }`
**Response 403**: `{ "error": "Forbidden" }`

---

### GET /api/users/:id — Get User Detail

**Middleware**: authMiddleware → tenantMiddleware
**Role scoping**: Admin/Manager see any user. AE sees recruiters only (MVP). Recruiter sees only self.

**Response 200**:

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "recruiter",
    "isFreelancer": true,
    "isActive": true,
    "mustChangePassword": false,
    "lastLoginAt": "2026-04-13T10:00:00Z",
    "createdAt": "2026-04-01T08:00:00Z",
    "updatedAt": "2026-04-10T15:30:00Z"
  }
}
```

**Response 401**: `{ "error": "Unauthorized" }`
**Response 403**: `{ "error": "Forbidden" }`
**Response 404**: `{ "error": "User not found" }`

---

### POST /api/users — Create User

**Middleware**: authMiddleware → tenantMiddleware → requireRole("admin")

**Request Body** (JSON):

```json
{
  "email": "nuevo@empresa.com",
  "password": "MiPassword123",
  "firstName": "María",
  "lastName": "García",
  "role": "recruiter",
  "isFreelancer": false
}
```

**Validation** (Zod — `createUserSchema`):
- `email`: valid email format, required
- `password`: min 8 chars, 1 uppercase, 1 lowercase, 1 number, required
- `firstName`: min 1, max 100, required
- `lastName`: min 1, max 100, required
- `role`: one of UserRole enum, required
- `isFreelancer`: boolean, required

**Response 201**:

```json
{
  "data": {
    "id": "uuid",
    "email": "nuevo@empresa.com",
    "firstName": "María",
    "lastName": "García",
    "role": "recruiter",
    "isFreelancer": false,
    "isActive": true,
    "mustChangePassword": true,
    "createdAt": "2026-04-13T12:00:00Z"
  }
}
```

**Response 409**: `{ "error": "El correo electrónico ya está registrado en esta organización" }`
**Response 422**: `{ "error": "Validation failed", "details": [...] }`

---

### PATCH /api/users/:id — Update User

**Middleware**: authMiddleware → tenantMiddleware
**Access**: Admin can update any user. Non-admin can update only own firstName/lastName.

**Request Body** (JSON — all fields optional):

```json
{
  "firstName": "María José",
  "lastName": "García López",
  "role": "account_executive",
  "isFreelancer": false
}
```

**Validation** (Zod — `updateUserSchema`):
- `firstName`: min 1, max 100, optional
- `lastName`: min 1, max 100, optional
- `role`: one of UserRole enum, optional (admin only — rejected if non-admin attempts)
- `isFreelancer`: boolean, optional (admin only)

**Business Rules**:
- Non-admin users can only update their own `firstName` and `lastName`. Attempts to change `role` or `isFreelancer` return 403.
- Changing role of last admin is blocked (FR-012).
- Audit event records old/new values for each changed field.

**Response 200**: `{ "data": { ...updatedUser } }`
**Response 403**: `{ "error": "Forbidden" }` or `{ "error": "No se puede cambiar el rol del último administrador" }`
**Response 404**: `{ "error": "User not found" }`
**Response 422**: `{ "error": "Validation failed", "details": [...] }`

---

### PATCH /api/users/:id/deactivate — Deactivate User

**Middleware**: authMiddleware → tenantMiddleware → requireRole("admin")

**Request Body**: None

**Business Rules**:
- Cannot deactivate self (FR-011)
- Cannot deactivate last active admin (FR-012)
- Revokes all refresh tokens for the user
- Records audit event

**Response 200**: `{ "data": { ...deactivatedUser } }`
**Response 400**: `{ "error": "No puedes desactivar tu propia cuenta" }` or `{ "error": "No se puede desactivar al último administrador activo" }`
**Response 404**: `{ "error": "User not found" }`

---

### PATCH /api/users/:id/reactivate — Reactivate User

**Middleware**: authMiddleware → tenantMiddleware → requireRole("admin")

**Request Body**: None

**Response 200**: `{ "data": { ...reactivatedUser } }`
**Response 404**: `{ "error": "User not found" }`

---

### POST /api/users/:id/change-password — Self-Service Password Change

**Middleware**: authMiddleware → tenantMiddleware
**Access**: User can only change their own password (`:id` must match JWT `sub`).

**Request Body** (JSON):

```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecure456"
}
```

**Validation** (Zod — `changePasswordSchema`):
- `currentPassword`: min 1, required
- `newPassword`: min 8 chars, 1 uppercase, 1 lowercase, 1 number, required

**Business Rules**:
- Verifies current password via bcrypt compare
- Hashes new password with bcrypt (cost >= 12)
- Revokes all other refresh tokens for the user (preserves current session)
- Sets `mustChangePassword = false`
- Records audit event (without password values)

**Response 200**: `{ "success": true }`
**Response 400**: `{ "error": "La contraseña actual es incorrecta" }`
**Response 403**: `{ "error": "Forbidden" }` (if `:id` != JWT sub)
**Response 422**: `{ "error": "Validation failed", "details": [...] }`

---

### POST /api/users/:id/reset-password — Admin Password Reset

**Middleware**: authMiddleware → tenantMiddleware → requireRole("admin")

**Request Body** (JSON):

```json
{
  "newPassword": "TempPassword789"
}
```

**Validation** (Zod — `resetPasswordSchema`):
- `newPassword`: min 8 chars, 1 uppercase, 1 lowercase, 1 number, required

**Business Rules**:
- Admin cannot reset their own password via this endpoint (use change-password instead)
- Hashes password with bcrypt (cost >= 12)
- Sets `mustChangePassword = true`
- Revokes all refresh tokens for the target user
- Records audit event (without password value)

**Response 200**: `{ "success": true }`
**Response 403**: `{ "error": "Forbidden" }`
**Response 404**: `{ "error": "User not found" }`
**Response 422**: `{ "error": "Validation failed", "details": [...] }`

---

### POST /api/users/import — Bulk Import Users

**Middleware**: authMiddleware → tenantMiddleware → requireRole("admin")

**Request Body**: `multipart/form-data` with a `file` field containing a CSV file.

**CSV Format** (header row required):

```csv
email,firstName,lastName,role,isFreelancer
maria@empresa.com,María,García,recruiter,false
juan@empresa.com,Juan,Pérez,recruiter,true
```

**Validation**:
- File must be present and non-empty
- Header row must contain exactly: email, firstName, lastName, role, isFreelancer
- Max 100 data rows
- Each row validated independently (same rules as createUser, minus password)
- Duplicate emails within file: first wins, subsequent rejected

**Response 200** (partial success allowed):

```json
{
  "data": {
    "totalRows": 10,
    "successCount": 8,
    "errorCount": 2,
    "results": [
      {
        "row": 1,
        "status": "success",
        "email": "maria@empresa.com",
        "temporaryPassword": "Bp!a1b2c3d4-e5f"
      },
      {
        "row": 2,
        "status": "error",
        "email": "existing@empresa.com",
        "error": "El correo electrónico ya está registrado"
      }
    ]
  }
}
```

**Response 400**: `{ "error": "El archivo CSV está vacío" }` or `{ "error": "El formato del encabezado es inválido" }` or `{ "error": "El archivo excede el máximo de 100 filas" }`
**Response 422**: `{ "error": "Validation failed", "details": [...] }`

---

## Common Error Responses

| Status | Meaning | When |
|--------|---------|------|
| 401 | Unauthorized | Missing/invalid JWT |
| 403 | Forbidden | Role insufficient for operation |
| 404 | Not Found | User ID not found in tenant |
| 409 | Conflict | Email already exists in tenant |
| 422 | Unprocessable Entity | Request body fails Zod validation |
| 429 | Too Many Requests | Cloudflare rate limiting |

## JWT Payload Extension

The `mustChangePassword` flag must be included in the JWT payload so the frontend can check it:

```typescript
interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId: string;
  isFreelancer: boolean;
  mustChangePassword: boolean; // NEW
  iat: number;
  exp: number;
}
```

This requires updating the auth service's `login()` function to include this field when signing the JWT.
