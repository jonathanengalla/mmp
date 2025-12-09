# DPL-05 — Health/readiness probes per service

- **Problem summary**: No health/readiness endpoints; deploys cannot detect DB connectivity or degraded dependencies.
- **Goal**: Expose `/health` (liveness) and `/status` (readiness) per service with DB checks and return appropriate HTTP codes.
- **Scope**
  - Implement liveness endpoint returning 200 when process is up.
  - Implement readiness endpoint verifying DB connectivity (Prisma) and key dependencies; return non-200 on failure.
  - Update Render/Vercel/K8s configs (where applicable) to use readiness for rollout gates.
- **Out of scope**
  - Deep synthetic transaction tests.
- **Acceptance criteria**
  - `/health` returns 200 regardless of DB state; `/status` fails when DB unreachable or migrations pending.
  - Deploy pipeline can gate rollout on readiness success.
  - Basic automated test hitting both endpoints passes.
- **Dependencies**: BKS-01; DPL-01 for DB availability.


