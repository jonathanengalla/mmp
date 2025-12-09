# QA Gate — BKS-02 (JWT + Tenant RBAC)

Decision: PASS

## Context
- BKS-02 replaces dev-mode permissive auth with JWT-based auth and tenant-scoped RBAC in `auth-service`. Public routes remain limited to `/health`, `/auth/health`, `/auth/login`, `/auth/register`.

## Preconditions
- `DATABASE_URL` configured to the new Render Postgres instance.
- All Prisma migrations applied successfully (per BKS-01).
- `JWT_SECRET` set in:
  - Local `.env` for `auth-service`.
  - Render `OneLedger` service environment.
- Optional: `JWT_ALGORITHM=HS256` present or defaulted.

## Smoke Test Checklist (Local or Render)
- **Health endpoints**
  - `GET /health` → 200 JSON `{"status":"ok","service":"auth-service"}` with log `[health] Basic health check hit`.
  - `GET /auth/health` → 200 JSON `{"status":"ok","service":"auth-service","scope":"auth"}` with log `[auth-health] Auth namespace health check hit`.

- **Login & token issuance**
  - `POST /auth/login` with `{ "email": "<seeded admin email>", "password": "<seeded password>", "tenantId": "t1" }` returns 200 with `token`, `userId`, `tenantId`, `roles` (includes `admin`). Decoded JWT contains `userId`, `tenantId`, `roles`, `exp`.

- **Protected route requires Bearer token**
  - `GET /membership/members` without `Authorization` → 401/403.
  - `GET /membership/members` with `Authorization: Bearer <token>` (admin) → 501 `{"error":"Membership not implemented yet"}` confirming auth/RBAC wiring while membership remains stubbed.

- **Tenant isolation sanity**
  - If a second tenant/user exists, login as that tenant and verify requests cannot see or access other tenant data. Deeper isolation tests deferred to later BKS stories.

## RBAC Behavior Notes
- Admin-only routes (membership/billing admin endpoints) return 401/403 when unauthenticated or missing roles; return 501 when called with valid admin token (expected while underlying logic is stubbed).
- Focus is auth/RBAC enforcement; domain functionality may remain stubbed (501) at this stage.

## Decision
- PASS: JWT issuance/verification works; global auth middleware enforced; public routes remain accessible; protected routes require Bearer token and honor roles/tenant.

