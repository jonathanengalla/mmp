# BKS-04 — Billing/payments persistence and PAN/CVC removal
Status: Done

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

## Scope (Implementation Notes)
- IN scope: Prisma-backed persistence for invoices, payments, and payment methods (token/last4/brand/expiry only) for non-event billing flows. Admin/officer can create manual invoices; invoices can be listed per member or tenant; payments can be recorded; payment methods can be saved/listed. All queries are tenant-scoped via `tenantId` from auth.
- OUT of scope: Event billing/linkage (BKS-05), PDFs/emails/external gateways, dunning/recurring jobs. PAN/CVC are not accepted or stored; only gateway tokens + safe metadata are persisted.

## Implementation Notes
- Billing store implemented with tenant-scoped Prisma operations: list/get invoices, create manual invoice, record payments (UNPAID→PAID), list/save payment methods (token/last4/brand/expiry; no PAN/CVC).
- Billing routes now call real handlers with RBAC (admin/officer vs member) and tenant scoping; out-of-scope endpoints remain 501 stubs.
- No PAN/CVC accepted or stored; logs remain free of sensitive card data.

## QA Notes
- BKS-04 QA Gate set to PASS. Smoke tests cover health/auth, login token claims, tenant-scoped invoice listing, manual invoice creation (UNPAID), payment recording (creates Payment and sets invoice PAID), payment method save/list (token/last4/brand/exp only), RBAC enforcement, and confirmation that no PAN/CVC is stored or logged. Advanced flows (dues/jobs/PDFs/events) remain stubbed.

