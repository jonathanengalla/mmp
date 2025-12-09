# DPL-03 — Vercel API base config and routing

- **Problem summary**: Vercel lacks `VITE_API_BASE_URL` and API routing alignment; frontend may call `/api` with no backend proxy.
- **Goal**: Configure Vercel envs and routing so the PWA targets the correct API base per environment.
- **Scope**
  - Add Vercel env vars (preview/prod) for `VITE_API_BASE_URL` pointing to Render backend/gateway.
  - Document local `.env` sample for the same variable.
  - Confirm rewrites/config support SPA routing without breaking API calls.
- **Out of scope**
  - Custom domain/SSL provisioning.
- **Acceptance criteria**
  - Deployed PWA calls correct API base in preview/prod; 200 responses observed for authenticated calls.
  - No 404/CSR mismatch for SPA routes.
  - README/ops note updated with env mapping matrix.
- **Dependencies**: DPL-01 (backend reachable), BKS stories for stable endpoints.


