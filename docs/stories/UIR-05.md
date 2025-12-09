# UIR-05 — Admin visibility and role-guarded UI

- **Problem summary**: Admin-only controls rely on weak client checks; UI may expose admin actions to non-admin roles.
- **Goal**: Align UI visibility with server RBAC, hiding or disabling actions when roles are insufficient.
- **Scope**
  - Centralize role checks using session roles; guard admin/event_manager/finance_manager views and buttons.
  - Add graceful “not authorized” states and redirects for blocked routes.
  - Ensure tenant header and role checks are applied on API calls before rendering protected UI.
- **Out of scope**
  - Server RBAC itself (BKS-02 covers enforcement).
- **Acceptance criteria**
  - Non-admin users cannot see admin navigation/actions; receive friendly unauthorized messaging.
  - Routes requiring roles redirect appropriately; smoke tests cover each role.
  - UI role checks match server requirements to prevent false positives/negatives.
- **Dependencies**: BKS-02; ties into THE-02 for tenant context.


