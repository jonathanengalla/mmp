# Epic: Backend-Stabilization

## Objective
Stabilize core services with multi-tenant, DB-backed flows, enforce JWT-based RBAC, and retire in-memory storage so membership, billing, and events align to the architecture and QA-blocking risks are removed.

## Scope
- Prisma schema expansion for tenancy and core domains
- Auth/RBAC with tenant claims
- DB-backed membership, billing, events, audit, and config center
- Removal of in-memory/payment PAN handling

## Stories
- BKS-01 — Multi-tenant Prisma schema baseline
- BKS-02 — JWT + tenant-scoped RBAC enforcement
- BKS-03 — Membership + verification persistence
- BKS-04 — Billing/payments persistence and PAN/CVC removal
- BKS-05 — Events persistence with billing linkage
- BKS-06 — Audit & reporting data store
- BKS-07 — Config Center baseline (org profile, feature flags)

## Dependencies/Notes
- Blocks Deployment-Alignment work that runs migrations.
- Requires coordination with Theme/UI for contract changes (amountCents, statuses, tenant headers).

