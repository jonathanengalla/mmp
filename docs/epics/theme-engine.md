# Epic: Theme-Engine

## Objective
Harden tenant theming by eliminating hardcoded colors, ensuring token adoption (light/dark), and persisting tenant selection so branding is consistent across tenants and environments.

## Scope
- Token adoption sweep and linting
- Tenant/theme persistence and header propagation
- Dark-mode and surface audits
- Alias/bridge normalization between legacy and app tokens

## Stories
- THE-01 — Token adoption sweep (remove hardcoded colors/gradients)
- THE-02 — Tenant selection persistence + API header propagation
- THE-03 — Dark-mode surface/contrast QA
- THE-04 — Theme token lint/check guardrail
- THE-05 — Token alias bridge hardening (legacy → app)

## Dependencies/Notes
- Coordinates with UI-Refinement for shared components.
- Depends on Deployment-Alignment for env defaults per tenant (optional).

