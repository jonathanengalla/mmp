# OneLedger PWA
Purpose: installable PWA that consumes service APIs via the API gateway; uses route-level lazy-loading, service worker caching, and tenant-aware theming/branding.

## Dev quickstart (login/tenant-aware)
1) Copy env template: `cp .env.development.example .env.local`
2) Set `VITE_DEFAULT_TENANT_ID` in `.env.local` to a valid tenant key in your dev DB (e.g., rcme-dev). Do not hardcode tenant IDs in code; always use env or runtime config.
3) Ensure `VITE_API_BASE_URL` points to your backend (default in the example: http://localhost:3000).
4) Install deps: `npm install`
5) Run dev server: `npm run dev`
6) Login: use seeded credentials; `/auth/login` expects `{ email, password, tenantId }`.

