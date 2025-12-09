# THE-04 — Theme token lint/check guardrail

- **Problem summary**: No guardrails prevent reintroducing hardcoded colors or legacy tokens.
- **Goal**: Add automated checks to enforce token usage for colors and surfaces.
- **Scope**
  - Add lint rule/scripts to flag hardcoded color literals and disallowed token prefixes in CSS/TSX.
  - Provide allowlist for necessary exceptions (images, charts).
  - Document the rule and how to suppress with justification.
- **Out of scope**
  - Design review of colors themselves.
- **Acceptance criteria**
  - CI fails when new hardcoded colors/legacy `--color-*` (without mapping) are added.
  - Existing codebase passes after THE-01 fixes.
  - Documentation explains remediation and suppression process.
- **Dependencies**: THE-01 (to reduce initial violations).


