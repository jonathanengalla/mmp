# BKS-07 — Config Center baseline (org profile, feature flags)

- **Problem summary**: Config Center is absent; tenant branding and feature toggles are not stored or served by backend.
- **Goal**: Provide tenant-scoped org profile and feature flags endpoints backed by Prisma.
- **Scope**
  - Add models for org_profile and feature_flags keyed by `tenant_id`.
  - Implement GET/PATCH for org profile (name, logoUrl, timezone, locale) and feature flags (payments, events, communications, reporting).
  - Ensure responses are cached minimally and tenant-scoped via RBAC middleware.
- **Out of scope**
  - Advanced schema-driven config or dynamic custom fields.
  - Upload handling for logos (stub URL only).
- **Acceptance criteria**
  - `/config/org-profile` and `/config/feature-flags` read/write from DB and survive restart.
  - Tenant mismatch denied; RBAC enforces admin-only writes.
  - UI can fetch defaults without in-memory fallbacks.
- **Dependencies**: BKS-01, BKS-02.


