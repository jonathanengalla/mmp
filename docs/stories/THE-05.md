# THE-05 — Token alias bridge hardening (legacy → app)

- **Problem summary**: Mixed use of legacy `--color-*` and new `--app-*`/tenant tokens causes inconsistencies.
- **Goal**: Normalize alias mappings so legacy variables consistently resolve through `app` tokens and tenant themes.
- **Scope**
  - Audit alias files (`app-theme-aliases.css`, base/tenant CSS) to ensure all legacy tokens map to `app` tokens.
  - Remove redundant/unused aliases and document the mapping table.
  - Ensure tenant CSS overrides set both app and legacy bridges where needed.
- **Out of scope**
  - New theme palettes.
- **Acceptance criteria**
  - Single source of truth for color variables; no unmapped `--color-*` usages remain.
  - Tenant themes override app tokens correctly in light/dark.
  - Mapping table documented for future component work.
- **Dependencies**: THE-01, THE-02 (for tenant context).


