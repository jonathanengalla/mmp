# Communications API (MVP)

Base: `/api/communications` (tenant-scoped via JWT `tenant_id`; header `Authorization: Bearer <token>`). Use shared pagination and error format (see `auth-api.md`). Health: `/health`, `/status`.

## Conventions
- Auth: Bearer JWT with tenant claim required for protected endpoints.
- Pagination: `page`, `page_size`, `sort`; responses return `items`, `page`, `page_size`, `total_items`, `total_pages`.
- Errors: standardized envelope per `auth-api.md`.

Auth header example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Broadcasts & Campaigns
- **POST /broadcasts** — Create draft broadcast  
  Request: `{ subject, body, audience_filter?, template_id?, status? (draft|send|schedule), scheduled_at? }`  
  Example request:
  ```json
  { "subject": "Weekly bulletin", "body": "Hello members", "status": "draft" }
  ```
  Responses: `201`, `400`.

- **POST /broadcasts/{id}/send** — Send now  
  Example response: `{ "status": "sent" }`
  Responses: `200`, `404`, `409` if already sent.

- **POST /broadcasts/{id}/schedule** — Schedule send  
  Request: `{ scheduled_at }`  
  Example request:
  ```json
  { "scheduled_at": "2025-02-01T10:00:00Z" }
  ```
  Responses: `200`, `404`, `409`.

- **POST /broadcasts/{id}/pause** — Pause scheduled campaign  
  Example response: `{ "status": "paused" }`
  Responses: `200`, `404`, `409`.

- **POST /broadcasts/{id}/resume** — Resume paused campaign  
  Example response: `{ "status": "scheduled" }`
  Responses: `200`, `404`, `409`.

- **GET /broadcasts** — List broadcasts  
  Query: `status?`, pagination params.  
  Example response:
  ```json
  {
    "items": [ { "id": "b1", "subject": "Weekly bulletin", "status": "sent" } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` paginated list.

- **GET /broadcasts/{id}** — Get broadcast detail  
  Example response:
  ```json
  { "id": "b1", "subject": "Weekly bulletin", "body": "Hello members", "status": "sent" }
  ```
  Responses: `200`, `404`.

## Templates
- **POST /templates** — Create template  
  Request: `{ name, category, subject_tpl, body_tpl }`  
  Example request:
  ```json
  { "name": "payment-receipt", "category": "receipt", "subject_tpl": "Your payment", "body_tpl": "Hi {{name}}, thanks." }
  ```
  Responses: `201`, `400`.

- **PATCH /templates/{id}** — Update template  
  Example response: `{ "status": "updated" }`
  Responses: `200`, `404`.

- **GET /templates** — List templates  
  Query: pagination params optional.  
  Example response:
  ```json
  {
    "items": [ { "id": "t1", "name": "payment-receipt", "category": "receipt" } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` (paginated if provided).

## Reminders (payments/events)
- **POST /reminders/payments** — Trigger payment reminder  
  Request: `{ invoice_id, member_id, template_id?, send_at? }`  
  Example response: `202` (queued)
  Responses: `202`.

- **POST /reminders/events** — Trigger event reminder  
  Request: `{ event_id, member_ids?, template_id?, send_at? }`  
  Example response: `202` (queued)
  Responses: `202`.

## Communications (publish)
- `BroadcastSent`, `ReminderSent`, `TemplateCreated/Updated`.

## Health
- **GET /health** — Liveness  
- **GET /status** — Readiness (may check downstreams)

## Error format example
```json
{
  "error": { "code": "validation_failed", "message": "missing subject", "details": [ { "field": "subject", "issue": "required" } ] },
  "trace_id": "abc-123"
}
```

