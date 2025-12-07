# Membership API (MVP)

Base: `/api/membership` (tenant-scoped via JWT `tenant_id`). Auth: `Authorization: Bearer <token>`. Use shared pagination and error format (see `auth-api.md`). Health: `/health`, `/status`.

Auth header example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Conventions
- All protected endpoints require Bearer JWT with tenant claim.
- Pagination query: `page`, `page_size`, `sort`; responses return `items`, `page`, `page_size`, `total_items`, `total_pages`.
- Errors follow the shared envelope from `auth-api.md`.

## Endpoints

- **POST /members/registrations** — Member self-registration (public)  
  Request body:
  ```json
  {
    "email": "new@rotary.example",
    "firstName": "Ann",
    "lastName": "Lee",
    "phone": "+15551234567",
    "address": "123 Main St",
    "linkedinUrl": "https://linkedin.com/in/example",
    "otherSocials": "@annlee on Threads"
  }
  ```
  Response `201`:
  ```json
  { "id": "reg_123", "email": "new@rotary.example", "status": "pending" }
  ```
  Errors:
  - `400` validation (missing required fields, invalid email, invalid linkedinUrl format)
  - `409` email already registered or pending

- **POST /registrations/{token}/verify** — Email verification  
  Request: none  
  Example response:
  ```json
  { "status": "verified" }
  ```
  Responses: `200` verified, `400/410` invalid/expired.

- **GET /members** — List members  
  Query: `status?`, `role?`, `q?`, pagination params.  
  Example response (paginated):
  ```json
  {
    "items": [ { "id": "m1", "email": "ann@example.com", "status": "active" } ],
    "page": 1, "page_size": 20, "total_items": 1, "total_pages": 1
  }
  ```
  Responses: `200` paginated list.

- **POST /members** — Admin create member  
  Request: `{ email, first_name, last_name, membership_type_id?, roles? }`  
  Example request:
  ```json
  { "email": "invitee@example.com", "first_name": "Sam", "last_name": "Doe", "membership_type_id": "basic" }
  ```
  Responses: `201`, `400`.

- **GET /members/{id}** — Get member detail  
  Example response:
  ```json
  { "id": "m1", "email": "ann@example.com", "status": "active", "membership_type_id": "basic" }
  ```
  Responses: `200`, `404`.

- **POST /members/{id}/approve** — Approve pending member  
  Request: `{ note? }`  
  Example response: `{ "status": "active" }`
  Responses: `200`, `404`, `409` if not pending.

- **POST /members/{id}/reject** — Reject pending member  
  Request: `{ reason? }`  
  Example response: `{ "status": "rejected" }`
  Responses: `200`, `404`, `409` if not pending.

- **PATCH /members/{id}** — Update profile (self or admin)  
  Request: partial profile fields; dynamic fields allowed via `profile_fields` map.  
  Example request:
  ```json
  { "phone": "+15557654321", "profile_fields": { "sponsor": "John" } }
  ```
  Responses: `200`, `400`, `404`, `403` if not allowed.

- **POST /members/{id}/photo** — Upload/replace profile photo  
  Request: `multipart/form-data` with image (JPEG/PNG); size limits apply.  
  Example response:
  ```json
  { "photo_url": "https://cdn.example.com/members/m1.jpg" }
  ```
  Responses: `200 { photo_url }`, `400` validation, `404`.

- **GET /members/search** — Search directory  
  Query: `q`, `status?`, `role?`, pagination params.  
  Example response: same pagination envelope as `/members`.
  Responses: `200` with list (paginated).

- **POST /members/{id}/deactivate** — Deactivate member  
  Request: `{ reason? }`  
  Example response: `{ "status": "inactive" }`
  Responses: `200`, `404`.

- **PUT /members/{id}/roles** — Replace member roles (admin-only; delegates to Identity)  
  Request: `{ role_ids: [] }`  
  Example request:
  ```json
  { "role_ids": ["admin", "member"] }
  ```
  Responses: `200`, `400`, `404`.

- **POST /members/import** — Bulk import members via CSV  
  Request: `multipart/form-data` with CSV (template-defined columns).  
  Example response:
  ```json
  { "job_id": "import-123" }
  ```
  Responses: `202 { job_id }`, `400` validation.  
  Notes: job status/errors available via background job endpoint (future).

- **GET /members/{id}/audit** — Audit log for member  
  Query: `action?`, `from?`, `to?`  
  Example response:
  ```json
  { "items": [ { "action": "approve", "actor": "admin1", "timestamp": "2025-01-01T00:00:00Z" } ], "page":1,"page_size":20,"total_items":1,"total_pages":1 }
  ```
  Responses: `200` with entries.

## Events (publish)
- `MemberRegistered`, `MemberVerified`, `MemberApproved`, `MemberRejected`, `MemberUpdated`, `MemberDeactivated`.

## Error format example
```json
{
  "error": { "code": "validation_failed", "message": "email is required", "details": [ { "field": "email", "issue": "required" } ] },
  "trace_id": "abc-123"
}
```

