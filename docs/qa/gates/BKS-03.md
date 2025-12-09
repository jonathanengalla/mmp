# QA Gate — BKS-03 (Membership + Verification Persistence)

Decision: PASS

## Context
- BKS-03 wires membership persistence into auth-service using Prisma with tenant-scoped RBAC.
- Implemented flows: register/create (pending), list by tenant, approve/reject, verification token set/verify, “me” lookup, and directory search.
- Advanced membership features (custom fields, payment methods, avatars, imports) remain 501 and are out of scope.

## Preconditions
- Multitenant schema/migrations applied (BKS-01 PASS) to `mmp_multitenant_dev`.
- JWT + tenant RBAC working (BKS-02 PASS).
- `DATABASE_URL` and `JWT_SECRET` configured in local `.env` and Render auth-service env.
- At least one admin/officer user seeded for a tenant (e.g., tenant `t1`) with known credentials.

## Smoke Test Checklist (Local or Render)
- **Health & Auth baseline**
  - `GET /health` → 200 `{ "status": "ok", "service": "auth-service" }`
  - `GET /auth/health` → 200 `{ "status": "ok", "service": "auth-service", "scope": "auth" }`
  - `POST /auth/login` (admin/officer, includes `tenantId`) → 200 with `token`, `userId`, `tenantId`, `roles`; JWT decodes with those claims.

- **Membership list**
  - `GET /membership/members` without token → 401/403.
  - `GET /membership/members` with admin/officer token → 200 list for caller’s `tenantId` only. Optional: another tenant’s token shows only that tenant’s members.

- **Member registration**
  - `POST /membership/members` (allowed role) with minimal payload → 201/200 member created with `tenantId` from token and `status = PENDING_VERIFICATION`. Missing required fields → 400.

- **Approve / reject**
  - `POST /membership/members/:id/approve` with admin/officer token → 200; status moves to `ACTIVE`.
  - Same call with non-admin/officer → 403; cross-tenant IDs → 404.
  - Reject (if invoked) sets status to inactive for in-tenant member.

- **Me / directory**
  - `GET /membership/members/me` with linked member token → 200 for that member; 404 if no member linked.
  - Directory/search (if used) returns only members in `req.user.tenantId`; no cross-tenant leakage.

- **Protected route check**
  - Membership routes called without Bearer token → 401/403.

## Known Limitations / TODOs
- No email delivery for verification tokens (stored-only).
- Custom fields, payment methods, avatars, imports remain 501 stubs.
- Deeper tenant-leakage automated tests recommended in later stories.

## Decision
- PASS: Membership core flows persist with Prisma; RBAC + tenant isolation enforced; stubs outside scope documented.
