# Schema Notes — BKS-01 Multi-tenant Baseline

Summary of schema decisions introduced in BKS-01 to support multi-tenant, DB-backed flows and upcoming RBAC work.

## Tenancy
- New `Tenant` model with `slug` unique; all tenant-owned tables carry `tenantId` FK to `Tenant`.
- Composite uniques for isolation/perf:
  - `User` (`tenantId`, `email`)
  - `Member` (`tenantId`, `email`)
  - `Invoice` (`tenantId`, `invoiceNumber`)
  - `Event` (`tenantId`, `slug`)
  - `EventRegistration` (`tenantId`, `eventId`, `memberId`)
  - `RoleAssignment` (`tenantId`, `userId`, `role`)
- Helper uniques (`id`, `tenantId`) on key tables to back composite FKs.

## Core models
- Membership: `MembershipType` with cents-based pricing, period enum; `Member` links via composite FK to enforce same-tenant membership types.
- Billing: `Invoice` uses `amountCents` (int), status enum widened (`UNPAID`, `VOID`), defaults to `UNPAID`; sources keep `eventId` composite FK.
- Payments: `PaymentMethod` (token/last4 only, no PAN/CVC) and `Payment` (cents, currency, status) referencing invoices/members; payment method FK is token-id based (id unique).
- Events: `Event` has per-tenant `slug`, `priceCents`, statuses include `CANCELLED`/`COMPLETED`.
- Registrations: `EventRegistration` ties event/member/invoice per tenant with status enum and optional check-in code.
- Config: `OrgProfile` and `FeatureFlags` per tenant for branding/feature toggles.
- RBAC prep: `RoleAssignment` per-tenant per-user role records (supports future RBAC).
- Audit: `AuditLog` per tenant with action/entity metadata (JSONB).

## Enums
- Member status now includes `PENDING_VERIFICATION`, `PENDING_APPROVAL`, `REJECTED`.
- Invoice status supports `UNPAID`, `VOID`; default set to `UNPAID`.
- Event status adds `CANCELLED`, `COMPLETED`; legacy `ARCHIVED` retained.
- New enums: `PaymentStatus`, `PaymentMethodStatus`, `MembershipPeriod`, `EventRegistrationStatus`.

## Indices (performance hotspots)
- Tenant+email (user/member), tenant+invoiceNumber, tenant+slug, tenant+status for events/invoices/members/registrations.

Notes:
- Existing global email uniques remain for backward compatibility; future RBAC/story work may tighten finder patterns to composite keys.
- Payment methods are token-only; PAN/CVC capture is intentionally absent.

