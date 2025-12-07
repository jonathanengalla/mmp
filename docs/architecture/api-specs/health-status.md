# Health & Status Endpoints (Cross-Cutting)

Applies to all services: Membership, Payments & Billing, Events, Communications, Config Center, Reporting, Identity/Auth. Intended for Kubernetes probes, uptime checks, and monitoring.

## Conventions
- No auth required; no tenant scoping (global to the service instance).
- Stable paths: `/health` (liveness), `/status` (readiness).
- Responses are lightweight JSON; readiness may include dependency details. Errors use simple bodies; standardized error envelope is not required for probes.

## Endpoints
- **GET /health** — Liveness (no downstream checks).  
  Responses:  
  - `200 { "status": "ok" }`

- **GET /status** — Readiness (may check DB/cache/queue).  
  Responses:  
  - `200 { "status": "ok", "deps": { "db": "ok", "cache": "ok" } }`  
  - `503 { "status": "degraded"|"down", "deps": { ... }, "message": "reason" }`

