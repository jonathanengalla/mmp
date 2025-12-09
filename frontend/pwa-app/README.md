# OneLedger PWA
Purpose: installable PWA that consumes service APIs via the API gateway; uses route-level lazy-loading, service worker caching, and tenant-aware theming/branding.

## Dev quickstart (login/tenant-aware)
- Already configured: `.env.development` (checked in) sets `VITE_API_BASE_URL` and `VITE_DEFAULT_TENANT_ID` for local dev.
- Optional overrides: create `.env.local` if you need to change tenant/API locally (not required).
- Steps:
  1) From `frontend/pwa-app`: `npm install`
  2) `npm run dev`
  3) Login with seeded credentials; `/auth/login` sends `{ email, password, tenantId }` using `VITE_DEFAULT_TENANT_ID`.

Note: run `npm run dev` from `frontend/pwa-app` so Vite picks up `.env.development` / `.env.local`.

