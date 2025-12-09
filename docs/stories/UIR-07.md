# UIR-07 — Login form ↔ JWT + tenant contract alignment
Status: Done

## Problem summary
- Backend `/auth/login` requires `email`, `password`, and `tenantId`. The current login UI only sends email/password, leading to 400 errors and blocking sign-in on local and Render.

## Goal
- Ensure the login form sends `{ email, password, tenantId }` so seeded users can authenticate and access protected routes.

## Scope (IN)
- Add `VITE_DEFAULT_TENANT_ID` (frontend env) used by the login flow.
- Update login API client to post `tenantId` to `/auth/login`, failing fast if no tenantId is configured.
- Wire the login form to include `tenantId` and handle 400/401 errors with clear user messages.
- Document a simple login smoke test.

## Scope (OUT / future)
- Tenant switching UI or org selector UX.
- Changes to membership endpoints or public registration.
- Event billing or other domain changes.

## Acceptance criteria
- Given valid email/password and tenantId, login succeeds and returns a JWT; a protected API call succeeds with that token.
- Wrong credentials/tenant return a clear error without crashing the UI.
- Login always sends `tenantId` (from env or explicit param); fails fast if missing.

## Implementation Notes / QA
- Login API posts `{ email, password, tenantId }` to `/auth/login`, using `VITE_DEFAULT_TENANT_ID` when not provided.
- Login form uses the default tenantId and surfaces friendly messages for 400 (config) and 401 (invalid credentials/tenant).
- Smoke: health/auth OK (backend), login succeeds with seeded tenant, protected route accessible; incorrect tenant/creds show errors.

