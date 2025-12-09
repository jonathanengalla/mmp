# THE-03 — Dark-mode surface/contrast QA

- **Problem summary**: Some surfaces/cards/tables may render light in dark mode due to legacy tokens and hardcoded colors.
- **Goal**: Audit and fix dark-mode rendering for surfaces, tables, cards, headings, and inputs using `app` tokens.
- **Scope**
  - Verify pages (roster, finance dashboard, events, invoices, auth) for surface/background/heading contrast in dark mode.
  - Update components to use `--app-color-surface-*`, `--app-color-text-*`, and `--app-color-border-*`.
  - Add snapshot checklist for dark-mode regressions.
- **Out of scope**
  - New visual variants; only correctness and contrast.
- **Acceptance criteria**
  - No light-on-light or dark-on-dark contrast failures in audited pages.
  - Tables/cards/backgrounds use tokenized surfaces; hover/active states stay themed.
  - QA checklist recorded with before/after screenshots or notes.
- **Dependencies**: THE-01 token sweep.


