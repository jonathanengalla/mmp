# Events API (MVP)

Base: `/api/events` (tenant-scoped via JWT `tenant_id`; header `Authorization: Bearer <token>`). Use shared pagination and error format (see `auth-api.md`). Health: `/health`, `/status`.

## Conventions
- Auth: Bearer JWT with tenant claim required.
- Pagination: `page`, `page_size`, `sort`; responses return `items`, `page`, `page_size`, `total_items`, `total_pages`.
- Errors: standardized envelope per `auth-api.md`.

Auth header example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Event Management
- **POST /** — Create event draft  
  Request: `{ title, start_at, end_at, location?, virtual_link?, is_virtual?, capacity?, waitlist_enabled?, price_amount?, currency?, description? }`  
  Example request:
  ```json
  { "title": "Weekly Meeting", "start_at": "2025-02-01T18:00:00Z", "end_at": "2025-02-01T19:00:00Z", "location": "Club House", "capacity": 50 }
  ```
  Responses: `201`, `400`.

- **POST /{id}/publish** — Publish event  
  Example response: `{ "status": "published" }`
  Responses: `200`, `404`, `409` if already published.

- **PATCH /{id}** — Update event draft/published (allowed fields)  
  Request: partial update; pricing allowed while published; core changes may be limited.  
  Example request:
  ```json
  { "description": "Updated agenda", "price_amount": 1500 }
  ```
  Responses: `200`, `404`, `409` for disallowed changes.

- **POST /{id}/agenda** — Attach/replace agenda (text or file ref)  
  Example response: `{ "agenda_ref": "s3://..." }`
  Responses: `200`, `400`, `404`.

- **GET /upcoming** — List upcoming events (member-facing)  
  Query: pagination params, `search?`, `date_from?`, `date_to?`.  
  Example response:
  ```json
  {
    "items": [ { "id": "e1", "title": "Weekly Meeting", "start_at": "2025-02-01T18:00:00Z", "status": "published" } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` paginated list.

- **GET /** — List events (admin)  
  Query: pagination params, `status?`, `search?`, `date_from?`, `date_to?`.  
  Example response: same pagination envelope as above.
  Responses: `200` paginated list.

## Registration
- **POST /{id}/register** — Member registration  
  Request: `{ payment_method_id?, metadata? }` (payment only if paid event).  
  Example response:
  ```json
  { "registration_id": "r1", "status": "registered" }
  ```
  Responses: `201`, `400`, `404`, `409` (capacity reached).

- **POST /{id}/cancel-registration** — Member cancels registration  
  Example response: `{ "status": "cancelled" }`
  Responses: `200`, `404`, `409` if past cutoff.

- **POST /{id}/promote-waitlist** — Promote next waitlisted member (admin or system)  
  Example response: `{ "status": "confirmed", "member_id": "m2" }`
  Responses: `200`, `404`, `409` if none waiting.

- **POST /{id}/check-in** — Check-in attendee (admin)  
  Request: `{ member_id }`  
  Example response: `{ "status": "present", "member_id": "m1" }`
  Responses: `200`, `404`.

- **GET /{id}/attendees** — List attendees/registrations  
  Query: `status?`, pagination params.  
  Example response:
  ```json
  {
    "items": [ { "member_id": "m1", "status": "present", "checked_in_at": "2025-02-01T18:05:00Z" } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200` paginated list.

## Events (publish)
- `EventCreated`, `EventPublished`, `EventRegistrationCreated`, `EventRegistrationCancelled`, `EventRegistrationPromoted`, `EventCheckedIn`.

## Error format example
```json
{
  "error": { "code": "validation_failed", "message": "capacity reached", "details": [ { "field": "event_id", "issue": "full" } ] },
  "trace_id": "abc-123"
}
```

