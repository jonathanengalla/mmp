# Master Delivery Checklist

## Legend
- 🟢 Done
- 🟡 In Progress
- 🔴 Blocked / Needs Attention
- ⚪ Not Started

## Deployment Pipeline (DPL)
| Code | Name | Status | Notes |
| --- | --- | --- | --- |
| DPL-01 | Render DATABASE_URL + migrate deploy pipeline | 🟢 | New Render Postgres, migrate deploy in build, start path `dist/auth-service/src/server.js`, health endpoints live |
| DPL-02 | Node/tooling version pin and lockstep install | ⚪ | Not started |
| DPL-03 | Vercel API base config and routing | ⚪ | Not started |
| DPL-04 | Environment-safe seeds/fixtures | ⚪ | Not started |
| DPL-05 | Health/readiness probes per service | 🟡 | Health endpoints added to auth-service; full probe/rollout not completed |
| DPL-06 | Deploy order + rollback playbook | ⚪ | Not started |

## Backend Stabilization (BKS)
| Code | Name | Status | Notes |
| --- | --- | --- | --- |
| BKS-01 | Multi-tenant Prisma schema baseline | 🟢 | Schema/migrations applied to new Render DB |
| BKS-02 | JWT + tenant-scoped RBAC enforcement | 🟢 | JWT + tenant RBAC implemented; requires `JWT_SECRET` in local `.env` and Render env; QA Gate PASS with auth/JWT smoke tests |
| BKS-03 | Membership + verification persistence | 🟢 | Membership register/list/approve/search/me now persisted via Prisma with tenant + RBAC; non-scope routes remain stubbed |
| BKS-04 | Billing/payments persistence and PAN/CVC removal | 🟢 | Billing/payments via Prisma; tenant-scoped invoices/payments/payment methods with RBAC; PAN/CVC not stored; advanced flows remain stubbed |
| BKS-05 | Events persistence with billing linkage | ⚪ | Not started |
| BKS-06 | Audit & reporting data store | ⚪ | Not started |
| BKS-07 | Config Center baseline (org profile, feature flags) | ⚪ | Not started |

## Theme Engine (THE)
| Code | Name | Status | Notes |
| --- | --- | --- | --- |
| THE-01 | Token adoption sweep (remove hardcoded colors/gradients) | ⚪ | Not started |
| THE-02 | Tenant selection persistence + API header propagation | ⚪ | Not started |
| THE-03 | Dark-mode surface/contrast QA | ⚪ | Not started |
| THE-04 | Theme token lint/check guardrail | ⚪ | Not started |
| THE-05 | Token alias bridge hardening (legacy → app) | ⚪ | Not started |

## UI Refinement (UIR)
| Code | Name | Status | Notes |
| --- | --- | --- | --- |
| UIR-01 | Shared table component rollout | ⚪ | Not started |
| UIR-02 | Global typography token adoption | ⚪ | Not started |
| UIR-03 | Finance dashboard data contract alignment | ⚪ | Not started |
| UIR-04 | Events checkout UX and error states | ⚪ | Not started |
| UIR-05 | Admin visibility and role-guarded UI | ⚪ | Not started |
| UIR-06 | Heading/contrast accessibility pass | ⚪ | Not started |
| UIR-07 | Login form ↔ JWT + tenant contract alignment | 🟢 | Login calls /auth/login with email/password/tenantId; uses VITE_DEFAULT_TENANT_ID; basic 400/401 handling |

## QA / Gates
| Code | Status | Notes |
| --- | --- | --- |
| DPL-01 | PASS | Render pipeline validated; health endpoints available |
| BKS-01 | PASS | Multitenant schema/migrations applied; stubs in place |
| BKS-02 | PASS | JWT + tenant RBAC gate passed; health/login/protected route smoke tests documented |
| BKS-03 | PASS | Membership persistence + verification gate passed; core flows smoke-tested with tenant + RBAC; advanced flows documented as stubs |
| BKS-04 | PASS | Billing/payments persistence + PAN/CVC removal gate passed; core invoice/payment/payment-method flows smoke-tested with tenant + RBAC; advanced flows remain stubbed |
| UIR-07 | PASS | Login UX aligned with backend: /auth/login requires email/password/tenantId; smoke-tested happy path and basic error handling |

---
Last updated: 2025-12-09 00:00 (local)

