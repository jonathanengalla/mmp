# QA Gate — BKS-04 (Billing/payments persistence + PAN/CVC removal)

Decision: PASS

## Context
- Invoices, payments, and payment methods are persisted via Prisma with tenant scoping and RBAC. PAN/CVC are not accepted or stored; only token/last4/brand/expMonth/expYear metadata are kept. Event billing and advanced finance flows remain out of scope (BKS-05+).

## Preconditions
- Multitenant schema/migrations applied (BKS-01 PASS).
- JWT + tenant RBAC working (BKS-02 PASS).
- `DATABASE_URL` and `JWT_SECRET` configured in local `.env` and Render auth-service env.
- Seeded admin/officer user and member for at least one tenant.

## Smoke Tests Run (Local/Render)
- Health/Auth: `GET /health` and `GET /auth/health` → 200.
- Login: `POST /auth/login` with tenantId → JWT containing `userId`, `tenantId`, `roles`.
- Invoice list (RBAC/tenant): admin/officer token `GET /billing/invoices` → 200, tenant-scoped; no token → 401/403.
- Manual invoice: admin/officer `POST /billing/invoices` (member, amount, currency) → 201 UNPAID invoice with tenantId from token and generated invoiceNumber.
- Record payment: admin/officer `POST /billing/invoices/:id/mark-paid` → Payment row created (SUCCEEDED), invoice status → PAID, tenantId scoped.
- Payment methods: member/admin `POST /billing/payment-methods` with token/last4/brand/exp → stored and `GET /billing/payment-methods` returns only safe fields; no PAN/CVC.
- RBAC: member calling admin-only endpoints (e.g., create manual invoice) → 403.
- PII: verified responses/logs/DB contain no PAN/CVC; only tokenized metadata is stored.

## Known Limitations / TODOs
- Dues jobs, PDFs, emails, dunning, external gateway integrations are 501 stubs.
- Event billing/linkage is out of scope (BKS-05).
- Additional QA for idempotency/double-pay and cross-tenant leakage recommended.

