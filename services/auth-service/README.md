# Auth Service
Purpose: authentication, session/refresh tokens, MFA, password change/reset, session introspection, health/status.

## Deployment (Render)

Recommended build and start commands for Render:

- Build: `npm install && npm run prisma:generate && npm run build`
- Start: `npm run start`

Notes:
- Ensure `DATABASE_URL` (and `SHADOW_DATABASE_URL` if used for migrations) are set in Render env vars.
- Prisma engines are explicitly pinned via `@prisma/engines` to avoid optional dependency omission.
- You can debug engine resolution after install with `npm run debug:prisma-engines`.

