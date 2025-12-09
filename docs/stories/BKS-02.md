# BKS-02 — JWT + tenant-scoped RBAC enforcement

- **Problem summary**: Auth middleware trusts any bearer token and fakes an admin user; no tenant claim or RBAC enforcement, allowing unrestricted access.
- **Goal**: Implement JWT verification with tenant claims and server-side RBAC checks for all protected routes.
- **Scope**
  - Add JWT verification using configured secrets; reject invalid/expired tokens.
  - Require `tenant_id` in token claims and enforce tenant match on all DB queries.
  - Centralize RBAC middleware (admin, event_manager, finance_manager, communications_manager) and apply to routes.
- **Out of scope**
  - MFA flows and token issuance UI (future story).
  - OAuth/OIDC providers.
- **Acceptance criteria**
  - Protected routes fail with 401/403 when token invalid/missing role; success when valid.
  - Tenant leakage tests confirm cross-tenant access is blocked.
  - Integration harness shows membership/billing/events routes honoring RBAC middleware.
- **Dependencies**: BKS-01 (schema for users/roles/tenants).


