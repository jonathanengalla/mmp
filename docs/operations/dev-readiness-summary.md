# OneLedger MVP – Dev Readiness Summary

## 1) Artifact Checklist
- PRD: `docs/epics/one-ledger-prd.md` (present) — note: legacy path `member-management-portal-prd.md` is missing (superseded).
- User stories: `docs/stories/` (present: membership, payments-hub, billing, events, communications, reporting, config-center).
- MVP scope: `docs/scope/mvp-stories-phase-1.md` (present).
- Golden Path: `docs/scope/golden-path-slice-1.md` (present).
- API specs: `docs/architecture/api-specs/` (present: auth, membership, payments-billing, events, communications, config-center, health-status).
- Architecture overview: `docs/architecture/oneledger-architecture-overview.md` (present).
- Data model: `docs/architecture/data-model-mvp.md` (present).
- OpenAPI stubs: `docs/architecture/openapi/` (present for core services).
- CI/CD & environments: `docs/operations/ci-cd-and-environments.md` (present).
- Engineering conventions: `docs/engineering/conventions.md` (present).
- Folder structure: `docs/architecture/folder-structure.md` (present).

## 2) Critical Gaps to Address Before Implementation
- PRD reference mismatch: update links/processes to use `docs/epics/one-ledger-prd.md` (legacy file path no longer exists).
- API specs: no shared schemas/examples; add request/response schemas and standard pagination/error envelopes per endpoint; ensure auth header explicitly stated in each spec.
- OpenAPI: stubs exist but lack schemas/examples; generate unified gateway OpenAPI with components for common envelopes.
- Config/gateway: gateway routing/rate-limit/WAF rules not yet defined beyond folder stub.
- Testing: expand smoke/API test list per service; define minimal contract tests for shared envelopes (pagination/error).
- Migration/seed: no DB migration/seed plan documented (especially for tenant bootstrap and roles).

## 3) Recommended Starting Point (Golden Path Slice 1)
Implement in this order (from `golden-path-slice-1.md`):
1) Config Center: org profile, timezone/locale, payment categories (optional), feature flags on for Membership.
2) Admin auth/login (auth service + gateway wiring).
3) Config Center: create membership type.
4) Membership: admin creates member (invite) and approves if manual.
5) Membership: member self-registers (if invite/self-serve), verifies email, logs in, and updates profile contact info.

