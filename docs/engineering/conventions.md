# OneLedger Engineering Conventions (MVP)

## Naming
- Services: `auth-service`, `membership-service`, `payments-billing-service`, `events-service`, `communications-service`, `config-center-service`, `gateway`.
- Endpoints: plural nouns, hyphen-less paths (`/members`, `/payments`, `/invoices/{id}`); actions as subpaths (`/approve`, `/reject`, `/send`, `/void`).
- Entities/DTOs: PascalCase types, snake_case DB columns; IDs as UUIDs; `tenant_id` on all multi-tenant tables.

## API Formats
- Auth: `Authorization: Bearer <token>`; JWT carries `tenant_id`, `sub`, `roles`.
- Pagination: query params `page`, `page_size`, `sort`; responses include `items`, `page`, `page_size`, `total_items`, `total_pages`.
- Errors (standard envelope):
  ```json
  {
    "error": { "code": "string", "message": "human readable", "details": [ { "field": "email", "issue": "required" } ] },
    "trace_id": "uuid"
  }
  ```

## Tenant Scoping
- Tenant inferred from JWT `tenant_id`; no cross-tenant data access.
- All service handlers enforce tenant scoping in queries; gateway passes through JWT.
- Config endpoints are tenant-specific; health/status endpoints are not tenant-scoped.

## Frontend Patterns (PWA)
- Forms: client-side validation, inline errors, disable submit on in-flight, show success toast.
- Tables: server-side pagination using shared format; include loading/skeleton states; preserve filters in URL query params.
- Loading states: skeletons for lists, spinners for actions; optimistic UI only when safe (e.g., list filters, not payments).
- API access only via gateway/base client; include auth header; handle 401/403 with reauth/redirect.

## Testing Expectations (MVP focus)
- Unit: services/business logic, validators, mappers, error handling; target critical paths (auth, payments, invoicing, registrations).
- Integration: API-layer happy/error paths for key flows (register/verify/approve member; create/send invoice; take payment; register/cancel event; send reminders).
- Include contract tests for shared error and pagination envelopes.

## Branch & Commit Guidelines
- Branch naming: `feature/<short-desc>`, `bugfix/<short-desc>`, `chore/<short-desc>`.
- Commits: small, focused, present tense (e.g., “add member approval endpoint”); keep diffs minimal.
- PRs: include what/why, testing notes; keep scope tight for fast review.***

