# API Contract: Auth Module

**Feature**: 002-jwt-auth-module  
**Base Path**: `/api/auth`  
**Date**: 2026-04-01

---

## POST /api/auth/login

Authenticate a user and establish a session.

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "tenantSlug": "acme-corp"
}
```

| Field      | Type   | Required | Validation                           |
|------------|--------|----------|--------------------------------------|
| email      | string | yes      | Valid email format                   |
| password   | string | yes      | Non-empty                            |
| tenantSlug | string | yes      | Lowercase alphanumeric + hyphens     |

**Success Response** (200):
```json
{
  "accessToken": "eyJhbG...",
  "expiresAt": "2026-04-01T12:15:00.000Z",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
    "role": "admin",
    "isFreelancer": false
  }
}
```

**Cookie Set**: `refresh_token=<opaque_uuid>; Path=/api/auth; Secure; HttpOnly; SameSite=Strict; Max-Age=604800`

**Error Responses**:

| Status | Body                                                    | Condition                            |
|--------|---------------------------------------------------------|--------------------------------------|
| 401    | `{ "error": "Invalid credentials" }`                   | Wrong email, password, inactive user, or inactive tenant |
| 429    | `{ "error": "Too many attempts. Try again later." }`   | Account locked (5+ failures in 15 min) |

**Security Notes**:
- Response is identical for wrong email, wrong password, inactive user, and inactive tenant (prevents enumeration).
- Response time is constant regardless of whether the email exists (timing attack prevention).
- Password is validated using constant-time comparison (bcrypt's built-in).

---

## POST /api/auth/refresh

Renew the access token using the refresh token cookie.

**Authentication**: Refresh token cookie (automatic)

**Request Headers**:
```
Cookie: refresh_token=<opaque_uuid>  (automatic)
X-Requested-With: fetch              (CSRF protection)
```

**Request Body**: Empty

**Success Response** (200):
```json
{
  "accessToken": "eyJhbG...",
  "expiresAt": "2026-04-01T12:30:00.000Z",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
    "role": "admin",
    "isFreelancer": false
  }
}
```

**Cookie Set**: New `refresh_token` cookie (rotation — old token invalidated).

**Error Responses**:

| Status | Body                                                     | Condition                          |
|--------|----------------------------------------------------------|------------------------------------|
| 401    | `{ "error": "Invalid or expired refresh token" }`        | Missing, expired, or revoked token |
| 401    | `{ "error": "Invalid or expired refresh token" }`        | Reuse of rotated token (theft detected — all family tokens revoked) |
| 403    | `{ "error": "Missing required header" }`                 | Missing X-Requested-With header    |

**Security Notes**:
- Reuse of a previously rotated token triggers revocation of ALL tokens in the same family (theft detection per FR-006).
- A new refresh token cookie is always set on success (rotation per FR-005).
- The user object reflects the CURRENT role from the database (not the expired access token's claims).

---

## POST /api/auth/logout

End the current session by revoking the refresh token.

**Authentication**: Refresh token cookie (automatic)

**Request Headers**:
```
Cookie: refresh_token=<opaque_uuid>  (automatic)
X-Requested-With: fetch              (CSRF protection)
```

**Request Body**: Empty

**Success Response** (200):
```json
{
  "success": true
}
```

**Cookie Cleared**: `refresh_token=; Path=/api/auth; Secure; HttpOnly; SameSite=Strict; Max-Age=0`

**Error Responses**:

| Status | Body                                                     | Condition                     |
|--------|----------------------------------------------------------|-------------------------------|
| 401    | `{ "error": "Invalid or expired refresh token" }`        | Missing or invalid token      |
| 403    | `{ "error": "Missing required header" }`                 | Missing X-Requested-With header |

**Security Notes**:
- Only the current session's refresh token is revoked; other sessions remain active (per clarification).
- The access token remains valid until its natural expiry (max 15 minutes). This is expected — the client should discard it locally.

---

## GET /api/auth/me

Return the current authenticated user's information.

**Authentication**: Bearer token (access token in Authorization header)

**Request Headers**:
```
Authorization: Bearer <access_token>
```

**Success Response** (200):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Juan",
    "lastName": "Perez",
    "role": "admin",
    "isFreelancer": false,
    "tenantId": "uuid",
    "tenantName": "Acme Corp",
    "tenantSlug": "acme-corp"
  }
}
```

**Error Responses**:

| Status | Body                                       | Condition                 |
|--------|--------------------------------------------|---------------------------|
| 401    | `{ "error": "Unauthorized" }`              | Missing or invalid token  |

---

## Middleware Contracts

### Auth Middleware

Applied to all protected routes. Extracts and validates the JWT access token.

**Input**: `Authorization: Bearer <token>` header  
**Output on success**: Sets user context (`id`, `email`, `role`, `tenantId`, `isFreelancer`) on the request context  
**Output on failure**: 401 `{ "error": "Unauthorized" }`

### Tenant Middleware

Applied after auth middleware. Resolves tenant context and sets the database session variable.

**Input**: `tenantId` from the validated JWT payload  
**Output on success**: Tenant context set via `SET LOCAL app.tenant_id` in the database transaction  
**Output on failure**: 401 `{ "error": "Unauthorized" }` (if tenant is inactive or not found)

### Role Middleware (Factory)

Applied to specific routes that require certain roles.

**Usage**: `requireRole("admin", "manager")`  
**Input**: User's `role` from the authenticated context  
**Output on success**: Request proceeds  
**Output on failure**: 403 `{ "error": "Forbidden" }`

---

## JWT Access Token Claims

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "admin",
  "tenantId": "tenant-uuid",
  "isFreelancer": false,
  "iat": 1712000000,
  "exp": 1712000900
}
```

| Claim       | Type    | Description                        |
|-------------|---------|------------------------------------|
| sub         | string  | User ID (UUID)                     |
| email       | string  | User email                         |
| role        | string  | User role                          |
| tenantId    | string  | Tenant ID (UUID)                   |
| isFreelancer| boolean | Freelancer flag                    |
| iat         | number  | Issued at (Unix timestamp)         |
| exp         | number  | Expires at (Unix timestamp, +15m)  |
