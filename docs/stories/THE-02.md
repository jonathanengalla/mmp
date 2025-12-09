# THE-02 — Tenant selection persistence + API header propagation

- **Problem summary**: Tenant selection is frontend-only; not persisted or enforced in API calls, risking cross-tenant mix-ups.
- **Goal**: Persist tenant selection and propagate tenant headers consistently to backend.
- **Scope**
  - Persist selected tenant in local storage and initialize ThemeProvider + API client from it.
  - Ensure all API calls send `X-Tenant-Id` derived from current tenant.
  - Provide per-env default tenant and reset control.
- **Out of scope**
  - Server-side tenant negotiation or SSO-based tenant mapping.
- **Acceptance criteria**
  - Tenant choice survives reload; API calls include correct header.
  - Switching tenant updates theme and request headers without restart.
  - Default tenant per env documented; no API calls emitted without a tenant header.
- **Dependencies**: BKS-02 (tenant enforcement server-side).


