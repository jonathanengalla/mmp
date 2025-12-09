# UIR-01 — Shared table component rollout

- **Problem summary**: Tables across roster/finance/events use mixed patterns and inline styles, causing inconsistency and dark-mode issues.
- **Goal**: Standardize on a shared table component (Table + TableCard) with tokens for spacing, text, borders, and states.
- **Scope**
  - Define table variants (default, card-wrapped) using `ui/Table` primitives and app tokens.
  - Migrate roster, finance dashboard, events, invoices pages to the shared component.
  - Add empty/loading/error row patterns consistent across pages.
- **Out of scope**
  - New data columns or analytics visualizations.
- **Acceptance criteria**
  - All targeted pages render using the shared table component; no inline color overrides.
  - Hover/striping/borders use tokenized values; works in light/dark and all tenants.
  - Loading/empty/error states consistent across pages.
- **Dependencies**: THE-01/03 (token fixes), BKS contracts for data fields.


