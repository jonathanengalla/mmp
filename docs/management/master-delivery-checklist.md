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

## Events
| Code | Name | Status | Notes |
| --- | --- | --- | --- |
| EVT-01 | Schema and Clean Slate | 🟢 | Schema migrated (registrationMode, checkedInAt); rcme-dev events/registrations = 0 |
| EVT-02 | Event Creation and Registration | 🟡 | In progress; Admin Event Creation form refactor (Free vs Paid toggle, RSVP vs Pay now, PHP-only currency, dev tools section) plus Event Type (IN_PERSON vs ONLINE) capture driving labels ("Check in" vs "Mark attended") and location display. Backend PAY_NOW invoice wiring in place; see [EVT-02 spec](../specs/events/EVT-02-event-creation-and-registration.md). |
| EVT-03 | Attendance and Reporting | 🟢 | Complete: Attendance tracking (mark/undo/bulk) with event type-aware labels (Check in vs Mark attended), server-side filtering/search/export, payment status filter for paid events, invoice context display. See [EVT-03 spec](../specs/events/EVT-03-attendance-and-reporting.md) |
| EVT-04 | Event Invoicing and Post Event Features | ⚪ | See [oneledger-events-master-plan.md](../specs/events/oneledger-events-master-plan.md) |
| EVT-05A | Admin Events Dashboard Micro UI Polish | 🟢 | Title/sublabel layout, capacity two-line display with color semantics, action icon alignment & tooltips. No backend changes. See [EVT-05A spec](../specs/events/EVT-05-admin-events-dashboard-micro-ui-polish.md) |

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
Last updated: 2025-12-12 17:00 (local)

