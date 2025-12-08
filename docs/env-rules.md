# Environment Rules

This project uses three main environments: Local Dev, Demo (Render), and Test.

## 1. Local Dev
Purpose
- Day-to-day development on each engineer's machine.
- Data should persist between runs so you can build on existing entities.

Rules
- Do **not** run destructive resets on every start.
- Use:
  - `npm run db:migrate`
  - `npm run db:seed:base` (idempotent, insert-if-missing)
- Only run `db:reset:test` locally if you intentionally want a clean slate.

## 2. Demo (Render)
Purpose
- Persistent online demo for stakeholders (treat like prod-lite).
- Must not lose data on deploy.

Rules
- Deploy pipeline may run:
  - `npm run build`
  - `npm run db:migrate`
- Deploy pipeline must **not** run:
  - `db:reset:test`
  - `demo:reset`
  - any script that drops or truncates tables.
- To hard reset the demo, run `npm run demo:reset` manually and announce it to the team.

## 3. Test
Purpose
- Automated tests / CI jobs.

Rules
- It is safe to wipe the DB per run.
- `db:reset:test` can drop/recreate and seed deterministic test data.

General
- Seeds must be **idempotent**:
  - Insert base data only if it does not exist.
  - Never overwrite user roles or live configuration in Local Dev or Demo.
- If in doubt, treat Demo like production, not like a disposable sandbox.

