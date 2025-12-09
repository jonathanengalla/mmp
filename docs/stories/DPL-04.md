# DPL-04 — Environment-safe seeds/fixtures

- **Problem summary**: Seeds/reset scripts are unsafe for Demo/Render; no deterministic fixtures per environment.
- **Goal**: Provide env-aware seed scripts and guardrails to prevent destructive resets on shared/demo environments.
- **Scope**
  - Add seed script that is idempotent and keyed by environment (dev/demo/test), using Prisma.
  - Block destructive reset commands in Demo/Prod; require explicit flag for local/test only.
  - Document seed data set and how to run it in CI/local.
- **Out of scope**
  - Large demo datasets or production migrations/backfills.
- **Acceptance criteria**
  - Running seeds twice is safe (no duplicate roles/members).
  - Demo/Render deploy does not execute destructive resets; CI/test can still reset DB.
  - Documentation calls out allowed commands per environment.
- **Dependencies**: BKS-01 schema; aligns with DPL-01 pipeline.


