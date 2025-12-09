# BKS-04 — Billing/payments persistence and PAN/CVC removal

- **Problem summary**: Billing and payment flows store PAN/CVC in memory, lack PCI-safe handling, and are not persisted.
- **Goal**: Persist invoices/payments in Prisma, remove PAN/CVC handling, and introduce a tokenized/stub gateway path.
- **Scope**
  - Persist invoices, payments, payment methods with token references only; drop PAN/CVC capture endpoints.
  - Align fields to cents, currency, status transitions (`unpaid/paid/overdue/cancelled`), and dues/event sources.
  - Add idempotency checks and audit entries for invoice creation, payment, reminders.
- **Out of scope**
  - Real gateway integration (use stub/token placeholder).
  - Recurring billing engine scheduling (future).
- **Acceptance criteria**
  - Payments cannot accept raw PAN/CVC; API rejects such payloads.
  - Invoices and payments survive restarts and are tenant-scoped; idempotency keys prevent double-charge.
  - UI contract fields (`amountCents`, `paidAt`, `source`, `paymentMethod`) returned from DB-backed handlers.
- **Dependencies**: BKS-01, BKS-02.


