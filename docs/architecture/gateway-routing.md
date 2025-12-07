# OneLedger API Gateway Routing Plan (MVP)

## Route Prefixes (path → service)
- `/api/auth/**` → auth-service
- `/api/membership/**` → membership-service
- `/api/payments/**` → payments-billing-service (payments)
- `/api/billing/**` → payments-billing-service (billing/invoices/schedules)
- `/api/events/**` → events-service
- `/api/communications/**` → communications-service
- `/api/config/**` → config-center-service
- `/api/health` and `/api/status` (gateway-level) → optional consolidated probes or per-service passthrough
- Service-local `/health` and `/status` remain exposed directly for k8s probes (not tenant-scoped, no auth)

## Auth Enforcement
- Default: require `Authorization: Bearer <JWT>` with `tenant_id` claim on all `/api/**` except:
  - `/api/auth/login`, `/api/auth/refresh`, `/api/auth/password/reset/request`, `/api/auth/password/reset/confirm`
  - `/health` and `/status` (gateway and per-service)
- Gateway validates JWT signature/expiry and forwards user/tenant context headers to services.
- Optional: enforce admin-only routes via role claims at gateway (or let services handle finer RBAC).

## Tenant Resolution
- Primary: from JWT claim `tenant_id`.
- Gateway injects `X-Tenant-Id` header from validated JWT into upstream requests.
- No query/path tenant selection for MVP; cross-tenant access is rejected.

## Rate Limiting (basic MVP)
- Authenticated: per-tenant + per-user bucket (e.g., 100 req/min/user, 500 req/min/tenant) adjustable per env.
- Unauthenticated/public endpoints (login/reset): lower/global bucket (e.g., 20 req/min/IP) with CAPTCHA/backoff if abused.
- Exclude `/health` and `/status` from rate limits.

## Health & Status Exposure
- Gateway-level: `/api/health` (liveness), `/api/status` (readiness of gateway only). No auth.
- Service probes: each service exposes `/health` and `/status` directly; used by Kubernetes; not tenant-scoped; no auth.
- Optional aggregated status endpoint can proxy to services in the future (not required for MVP).

## Notes
- Enforce HTTPS at edge; terminate TLS at gateway.
- Include CORS policy for PWA origin(s).
- Forward correlation IDs (e.g., `X-Request-ID`) and propagate tracing headers (e.g., W3C traceparent). 

