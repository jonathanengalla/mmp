# Deployment Checklist (Path A — New Render Postgres)

## Local Dev
- Ensure `DATABASE_URL` points to the new Render Postgres (internal connection string) or a matching local DB.
- From `auth-service` root run:
  - `npx prisma migrate dev --schema prisma/schema.prisma --skip-seed`
- Optional: `npx prisma studio` to visually confirm schema.
- Copy `auth-service/.env.example` to `auth-service/.env` and replace `JWT_SECRET` with a strong local-only secret.

## Render Backend
- `DATABASE_URL` set to the new Render Postgres instance (same as local).
- Node version pinned per engines.
- Build/release runs:
  - `npm ci`
  - `npx prisma migrate deploy --schema prisma/schema.prisma`
  - start command
- Post-deploy smoke/health check passes (health/readiness or basic API smoke).
- Render env vars to set:
  - `DATABASE_URL=<Render_Postgres_Internal_URL>`
  - `JWT_SECRET=<long_random_string>` (must match across auth-service replicas)
  - `JWT_ALGORITHM=HS256` (optional; default HS256; change only if supported)
- Recommended Render build step:
  - `npx prisma migrate deploy --schema prisma/schema.prisma`
- Recommended start command (if not already set):
  - `npm start` (from `auth-service`, which runs `node dist/auth-service/src/server.js`)
- Do NOT run `prisma migrate dev` against Render DB (managed Postgres lacks SUPERUSER/shadow DB support).

### Smoke Test Endpoints (Required Post-Deploy)
After a Render deploy, run quick checks to ensure the backend is alive:

1. **Basic Service Health**
   - GET `<SERVICE_URL>/health`
   - Expected: `{ "status": "ok", "service": "auth-service" }`

2. **Auth Namespace Health**
   - GET `<SERVICE_URL>/auth/health`
   - Expected: `{ "status": "ok", "service": "auth-service", "scope": "auth" }`

3. Confirm logs show:
   - `[health] Basic health check hit` or
   - `[auth-health] Auth namespace health check hit`

If these fail, do not proceed to front-end integration.

## Vercel Frontend
- `VITE_API_BASE_URL` (or equivalent) points to the Render backend URL.
- Tenant defaults documented for the environment.

## Local Dev (Optional)
- `npm run migrate:dev` is for a local Postgres instance only (not Render DB).

