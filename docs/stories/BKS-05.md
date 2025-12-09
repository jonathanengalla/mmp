# BKS-05 — Events persistence with billing linkage

- **Problem summary**: Events, registrations, checkout, and attendance are in-memory; no linkage to invoices/payments or tenant isolation.
- **Goal**: Persist events and registrations in Prisma and link paid flows to invoices/payments with tenant-scoped access.
- **Scope**
  - Store events, registrations, capacity, pricing, status transitions in DB; enforce tenant filters.
  - Generate/associate event invoices on checkout/pay-now; update registration status on payment.
  - Persist attendance/check-in codes and basic attendance reporting data.
- **Out of scope**
  - Advanced ticketing tiers or seating.
  - Calendar integrations.
- **Acceptance criteria**
  - `/events` CRUD, publish, register, cancel, check-in operate on DB and survive restart.
  - Event pay-now flow issues invoice/payment and updates registration status.
  - Attendance report queries data from DB; in-memory event store removed.
- **Dependencies**: BKS-01, BKS-02, BKS-04.


