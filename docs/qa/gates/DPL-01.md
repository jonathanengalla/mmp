# QA Gate — DPL-01 (Render DATABASE_URL + migrate deploy pipeline)

Decision: CONCERNS

Reasons
- Render-specific verification not executed here (no live Render access); requires on-environment confirmation.
- Success depends on newly created Render Postgres `DATABASE_URL` being set on the service and using `prisma migrate deploy`; unverified in this session.
- Health/readiness checks not yet exercised post-deploy; smoke tests pending.

What to verify on deploy
- Render env vars: `DATABASE_URL` (new Render DB), optional `SHADOW_DATABASE_URL`; Node version pinned.
- Build commands: `npm install && npm run build`; deploy step runs `npx prisma migrate deploy --schema prisma/schema.prisma`.
- Start command: `node dist/auth-service/src/server.js`.
- `prisma migrate deploy` succeeds against the new DB with no drift.
- Smoke: service boots, basic routes respond (e.g., `/health` or `/status` if available), no MODULE_NOT_FOUND errors.

