# QA Gate — BKS-01 (Multi-tenant Prisma schema baseline)

Decision: CONCERNS

Reasons
- Prisma schema validated; migrations split to avoid enum default hazards. However, migrations were not executed in this session against a live DB; requires verification on the new Render Postgres.
- Tenant isolation and composite uniques are defined, but no automated tests executed here.
- Billing helpers now stubbed with 501; ensures no real billing, but routes are not functionally tested.

What to verify on deploy
- `prisma migrate deploy` completes cleanly on the new DB (no P3006/P1001).
- Schema matches expected enums and composite uniques (tenant+email, tenant+invoiceNumber, tenant+slug, etc.).
- Basic tenant isolation smoke: creating data for tenant A is not visible to tenant B.
- Billing routes return 501 stubs (no PAN/CVC handling).
- Service boots without `MODULE_NOT_FOUND` for billing.

