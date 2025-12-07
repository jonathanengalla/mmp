# Payments & Billing API (MVP)

Base: `/api/payments` and `/api/billing` (tenant-scoped via JWT `tenant_id`; header `Authorization: Bearer <token>`). Use shared pagination and error format (see `auth-api.md`). Health: `/health`, `/status`. Note: tenant gateway enablement/config is handled in Config Center.

## Conventions
- Auth: Bearer JWT with tenant claim required on all protected endpoints.
- Pagination: `page`, `page_size`, `sort`; responses return `items`, `page`, `page_size`, `total_items`, `total_pages`.
- Errors: standardized envelope per `auth-api.md`.

Auth header example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Payments
- **POST /payment-methods** — Save payment method (tokenized)  
  Request: `{ provider, token_ref, brand?, last4?, exp_month?, exp_year? }`  
  Example request:
  ```json
  { "provider": "stripe", "token_ref": "tok_123", "brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030 }
  ```
  Responses: `201`, `400`.

- **GET /payment-methods** — List payment methods  
  Example response:
  ```json
  {
    "items": [ { "id": "pm1", "provider": "stripe", "brand": "visa", "last4": "4242", "status": "active" } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` paginated list.

- **DELETE /payment-methods/{id}** — Remove payment method  
  Responses: `204`, `404`.

- **POST /payments** — One-time payment (dues/event)  
  Request: `{ invoice_id?, amount, currency, payment_method_id?, provider?, metadata? }`  
  Example request:
  ```json
  { "invoice_id": "inv1", "amount": 1000, "currency": "USD", "payment_method_id": "pm1" }
  ```
  Example response:
  ```json
  { "payment_id": "pay1", "status": "succeeded", "amount": 1000, "currency": "USD" }
  ```
  Responses: `201` (status pending/succeeded), `400`, `409` (already paid).  
  Behavior: if tenant retry policy is configured, failed payments are retried asynchronously and emit events.

- **GET /payments/{id}** — Payment detail  
  Example response:
  ```json
  { "id": "pay1", "status": "succeeded", "amount": 1000, "currency": "USD", "invoice_id": "inv1" }
  ```
  Responses: `200`, `404`.

- **POST /payments/{id}/resend-receipt** — Resend receipt  
  Example response: `202` (empty body)
  Responses: `202`, `404`, `409` if payment not successful.

- **POST /payments/{id}/refund** — Refund (full/partial)  
  Request: `{ amount? }`  
  Example request:
  ```json
  { "amount": 500 }
  ```
  Example response:
  ```json
  { "refund_id": "ref1", "status": "succeeded", "amount": 500 }
  ```
  Responses: `200`, `400`, `404`, `409`.

- **GET /transactions** — List transactions  
  Query: `status?`, `member_id?`, `date_from?`, `date_to?`, `gateway?`, pagination params.  
  Example response:
  ```json
  {
    "items": [ { "id": "tx1", "amount": 1000, "status": "succeeded", "member_id": "m1" } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` paginated list.

## Billing / Invoicing
- **POST /invoices** — Create manual invoice  
  Request: `{ member_id, due_date, currency, lines: [{ description, quantity, unit_amount, tax_amount?, category }], status? (draft|sent) }`  
  Example request:
  ```json
  {
    "member_id": "m1",
    "due_date": "2025-01-31",
    "currency": "USD",
    "lines": [ { "description": "Annual dues", "quantity": 1, "unit_amount": 20000, "category": "dues" } ],
    "status": "sent"
  }
  ```
  Example response:
  ```json
  { "invoice_id": "inv1", "status": "sent", "total_amount": 20000, "currency": "USD" }
  ```
  Responses: `201`, `400`.

- **POST /invoices/{id}/send** — Send invoice  
  Example response: `{ "status": "sent" }`
  Responses: `200`, `404`, `409` if already sent.

- **GET /invoices** — List invoices  
  Query: `member_id?`, `status?`, `date_from?`, `date_to?`, pagination params.  
  Example response:
  ```json
  {
    "items": [ { "id": "inv1", "member_id": "m1", "status": "sent", "total_amount": 20000 } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` paginated list.

- **GET /invoices/{id}** — Invoice detail (with lines, payments)  
  Example response:
  ```json
  { "id": "inv1", "member_id": "m1", "status": "sent", "lines": [ { "description": "Annual dues", "quantity":1, "unit_amount":20000 } ], "payments": [] }
  ```
  Responses: `200`, `404`.

- **POST /invoices/{id}/void** — Void invoice (no payments yet)  
  Example response: `{ "status": "voided" }`
  Responses: `200`, `404`, `409`.

- **GET /invoices/{id}/pdf** — Download invoice PDF  
  Example: binary/PDF response.
  Responses: `200` (file), `404`.

## Recurring / Schedules (MVP)
- **POST /schedules/dues** — Create recurring dues schedule  
  Request: `{ member_id, frequency, start_date, payment_method_id?, membership_type_id? }`  
  Example response:
  ```json
  { "schedule_id": "sch1", "status": "active", "frequency": "monthly", "next_run_at": "2025-02-01" }
  ```
  Responses: `201`, `400`.

- **GET /schedules/dues** — List recurring dues schedules (tenant/member scoped)  
  Query: `member_id?`, pagination params.  
  Example response:
  ```json
  {
    "items": [ { "id": "sch1", "member_id": "m1", "frequency": "monthly", "status": "active" } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` paginated list.

- **DELETE /schedules/dues/{id}** — Cancel schedule  
  Responses: `204`, `404`.

## Events (publish)
- `InvoiceCreated`, `InvoiceSent`, `PaymentSucceeded`, `PaymentFailed`, `PaymentRetried`, `InvoicePaid`, `RefundProcessed`.

## Error format example
```json
{
  "error": { "code": "validation_failed", "message": "invalid payment method", "details": [ { "field": "payment_method_id", "issue": "not_found" } ] },
  "trace_id": "abc-123"
}
```

