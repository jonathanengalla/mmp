# DPL-01 — Render DATABASE_URL + migrate deploy pipeline

- **Problem summary**: Render deploy lacks `DATABASE_URL` and does not run migrations, causing runtime failures and schema drift.
- **Goal**: Configure Render with required DB env vars and execute `prisma migrate deploy` before start.
- **Scope**
  - Provision a new Render Postgres DB for MMP (clean, not reusing old DB). Recommended name: `mmp_multitenant_dev`; use the Internal Connection String as `DATABASE_URL`.
  - Add Render env vars: `DATABASE_URL`, `SHADOW_DATABASE_URL` (if needed), `NODE_ENV=production`.
  - Ensure all backend services point to the same `DATABASE_URL`.
  - Update render.yaml to run `npm ci`, `prisma migrate deploy`, then start.
  - Document minimal manual fallback for migration failure.
  - Local/CI migrate dev example (auth-service root):
    - `export DATABASE_URL="<render-internal-connection-string>"`
    - `npx prisma migrate dev --schema prisma/schema.prisma --skip-seed` (local DB only, not Render)
  - Render deploy migrate command: `npx prisma migrate deploy`.
- **Out of scope**
  - Database provisioning itself.
  - Seed data (covered in DPL-04).
- **Acceptance criteria**
  - New Render Postgres DB exists (named per recommendation) and `DATABASE_URL` points to it in Render.
  - Local migrations run cleanly against a local DB using `migrate dev` (separate from Render).
  - Render deployment successfully applies migrations with `prisma migrate deploy` against the Render DB.
  - Old DB connection strings removed from env/doc references.
  - Clear scripts exist: `migrate:dev` (local) and `migrate:deploy` (Render).
- **Dependencies**: BKS-01 (schema available).
# DPL-01 — Render DATABASE_URL + migrate deploy pipeline

- **Problem summary**: Render deploy lacks `DATABASE_URL` and does not run migrations, causing runtime failures and schema drift.
- **Goal**: Configure Render with required DB env vars and execute `prisma migrate deploy` before start.
- **Scope**
  - Provision a new Render Postgres DB for MMP (clean, not reusing old DB). Recommended name: `mmp_multitenant_dev`; use the Internal Connection String as `DATABASE_URL`.
  - Add Render env vars: `DATABASE_URL` (new DB), `SHADOW_DATABASE_URL` (if needed), `NODE_ENV=production`.
  - Ensure all backend services point to the same `DATABASE_URL`.
  - Update render.yaml to run `npm ci`, `prisma migrate deploy`, then start.
  - Document minimal manual fallback for migration failure.
- **Out of scope**
  - Database provisioning itself.
  - Seed data (covered in DPL-04).
- **Acceptance criteria**
  - Render build logs show migrate deploy executed successfully.
  - Service boot succeeds with Prisma connecting to DB; no “missing relation” errors.
  - Runbook entry documents migration failure handling.
- **Dependencies**: BKS-01 (schema available).
- **Out of scope**
  - Database provisioning itself.
  - Seed data (covered in DPL-04).
- **Acceptance criteria**
  - Render build logs show migrate deploy executed successfully.
  - Service boot succeeds with Prisma connecting to DB; no “missing relation” errors.
  - Runbook entry documents migration failure handling.
- **Dependencies**: BKS-01 (schema available).


