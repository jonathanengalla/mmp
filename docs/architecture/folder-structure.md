# OneLedger Folder & Project Structure (MVP Microservices + PWA)

Proposed layout to support independently deployable services, a shared library, and a PWA frontend that talks only to the APIs.

```
/services/
  auth-service/                 # Auth & session (login, refresh, password flows, JWT issuance)
  membership-service/           # Member lifecycle, profiles, directory
  payments-billing-service/     # Payments, invoices, receipts, schedules
  events-service/               # Events, registrations, attendance
  communications-service/       # Broadcasts, reminders, templates (email/push)
  config-center-service/        # Tenant config, feature flags, branding, membership/payment config

/gateway/                       # API gateway/ingress config and routing

/libs/shared/                   # Shared models/types, error handling, auth & tenant middleware, tracing helpers

/frontend/pwa-app/              # Installable PWA that calls APIs via gateway only

/docs/architecture/             # Architecture docs (PRD-aligned)
/docs/stories/                  # User stories per module
/docs/scope/                    # MVP scope selections
```

Notes:
- Services expose REST APIs (see `docs/architecture/api-specs/`) and publish/consume events via the event bus.
- Shared library holds domain DTOs, validation, error/envelope format, auth middleware, logging/tracing helpers.
- The PWA uses route-level lazy loading and service-worker caching; it never calls services directly—only via the API gateway/base URL.
- Multi-tenancy is enforced in services; shared lib provides tenant-aware middleware and error format.

