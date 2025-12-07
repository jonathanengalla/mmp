# Auth & Session API (Cross-Cutting)

Base: `/api/auth` (tenant-scoped JWT with tenant claim). Auth header: `Authorization: Bearer <token>` for protected endpoints (change password, logout, session, admin reset). Public: login, refresh, password reset request/confirm. All services expose `/health` and `/status` as lightweight probes. Use shared error envelope below.

Auth header example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Endpoints
- **POST /login** — Authenticate user  
  Request: `{ email, password, mfa_code? }`  
  Example request:
  ```json
  { "email": "admin@rotary.example", "password": "P@ssw0rd!", "mfa_code": "123456" }
  ```
  Example response:
  ```json
  { "access_token": "jwt", "refresh_token": "rjwt", "expires_in": 3600 }
  ```
  Responses: `200`, `400` validation, `401` invalid, `403` mfa_required.

- **POST /refresh** — Refresh access token  
  Request: `{ refresh_token }`  
  Example request:
  ```json
  { "refresh_token": "rjwt" }
  ```
  Example response:
  ```json
  { "access_token": "jwt", "refresh_token": "new-rjwt", "expires_in": 3600 }
  ```
  Responses: `200`, `400` validation, `401/403` invalid/expired.

- **POST /password/change** — Change password (self)  
  Request: `{ current_password, new_password }`  
  Example request:
  ```json
  { "current_password": "old", "new_password": "newStrong1!" }
  ```
  Responses: `200`, `400` validation, `401`.

- **POST /password/reset/request** — Request reset email  
  Request: `{ email }`  
  Example request:
  ```json
  { "email": "user@example.com" }
  ```
  Responses: `202` (always), rate-limited.

- **POST /password/reset/confirm** — Complete reset with token  
  Request: `{ token, new_password }`  
  Example request:
  ```json
  { "token": "reset-token", "new_password": "NewStrong1!" }
  ```
  Responses: `200`, `400/410` invalid/expired.

- **POST /users/{id}/password/reset** — Admin-triggered reset email  
  Request: `{ }`  
  Example response: `202` with empty body.
  Responses: `202`, `404`, `403` if not admin.

- **POST /logout** — Invalidate refresh token/session  
  Request: `{ refresh_token }`  
  Example request:
  ```json
  { "refresh_token": "rjwt" }
  ```
  Responses: `204`.

- **GET /session** — Session introspection  
  Example response:
  ```json
  { "user_id": "u1", "tenant_id": "t1", "roles": ["admin"], "expires_at": "2025-01-01T00:00:00Z", "mfa_enabled": true }
  ```
  Responses: `200 { user_id, tenant_id, roles, expires_at, mfa_enabled }`, `401` if invalid.

## Health & Status (per service)
- **GET /health** — Liveness (no downstreams). Returns `200 { status: "ok" }`.
- **GET /status** — Readiness (may check DB/cache). Returns `200 { status: "ok", deps: {...} }` or `503`.

## Shared Conventions
### Pagination (query params)
- `page` (default 1), `page_size` (default 20, max 100)
- `sort` (e.g., `sort=created_at:desc`)
- Responses include: `items`, `page`, `page_size`, `total_items`, `total_pages`

### Error Format
```
{
  "error": {
    "code": "string",          // short machine code
    "message": "human readable",
    "details": [ { "field": "email", "issue": "required" } ] // optional
  },
  "trace_id": "uuid"           // for support/tracing
}
```

### Pagination
Not typically used in Auth; if needed, follow shared pattern: query `page`, `page_size`, `sort`; response includes `items`, `page`, `page_size`, `total_items`, `total_pages`.

### Auth
- Bearer JWT on all protected endpoints; includes `tenant_id`, `sub`, `roles`.
- Tenant isolation enforced per request.

