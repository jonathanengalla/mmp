# THE-01 — Token adoption sweep (remove hardcoded colors/gradients)

- **Problem summary**: Hardcoded colors/gradients (#111, register/login) bypass theme tokens; tenant/dark-mode consistency breaks.
- **Goal**: Replace hardcoded colors/gradients with `app-*` tokens across pages and components.
- **Scope**
  - Identify and replace hardcoded color/gradient values in pages/components with tokenized vars.
  - Align legacy `--color-*` usage to `--app-color-*` where present.
  - Add a brief checklist for future additions to prevent regressions.
- **Out of scope**
  - New visual redesign; only token wiring.
- **Acceptance criteria**
  - No remaining hardcoded hex/rgba in React/CSS (except intentional images); uses `--app-color-*`.
  - Register/Login and other flagged pages render correctly in light/dark and all tenants.
  - Lint/checklist updated to enforce token usage.
- **Dependencies**: None; informs UIR stories.


