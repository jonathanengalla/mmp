# BKS-01 — Multi-tenant Prisma schema baseline

- **Problem summary**: Current schema is minimal and single-tenant; membership, billing, events, roles, and audit data are missing, leaving core flows in memory and blocking persistence.
- **Goal**: Define and migrate a multi-tenant Prisma schema that covers members, users, roles, invoices/payments, events/registrations, audit logs, and config seeds with `tenant_id` on all rows.
- **Scope**
  - Add Prisma models for user, member, role grants, membership types, invoices, payments, events, registrations, audit_log, org_profile, feature_flags with `tenant_id`.
  - Add indexes/unique constraints for email, invoice numbers, event slugs, and composite tenant keys; store monetary fields in cents.
  - Generate forward-only migration SQL and update Prisma client.
- **Out of scope**
  - Business logic rewrites (handled by later stories).
  - Data backfill from legacy sources.
- **Acceptance criteria**
  - Prisma schema committed with tenant-scoped models and cents-based monetary fields.
  - Migration applies cleanly to empty DB and passes `prisma migrate diff` for idempotence.
  - Prisma client builds without errors; `prisma generate` succeeds.
- **Dependencies**: None. Blocks BKS-03/04/05/06/07 and DPL-01.


