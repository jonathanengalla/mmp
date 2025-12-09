# Epic: Deployment-Alignment

## Objective
Align environments (local, Render, Vercel) with predictable builds, migrations, and health checks so services can deploy safely with Prisma and consistent tooling.

## Scope
- Render env wiring and migration execution
- Node/toolchain version pinning
- Vercel API base and routing alignment
- Seed/fixtures strategy per environment
- Health/readiness endpoints and rollout/rollback guardrails

## Stories
- DPL-01 — Render DATABASE_URL + migrate deploy pipeline
- DPL-02 — Node/tooling version pin and lockstep install
- DPL-03 — Vercel API base config and routing
- DPL-04 — Environment-safe seeds/fixtures
- DPL-05 — Health/readiness probes per service
- DPL-06 — Deploy order + rollback playbook

## Dependencies/Notes
- Depends on Backend-Stabilization schema decisions (BKS-01).
- Unblocks frontend pointing to stable API base URLs.
- Path A: use a new dedicated Render Postgres instance for MMP (clean DB); all backend services point to the same `DATABASE_URL`.

See also: `docs/architecture/deployment-checklist.md`.

