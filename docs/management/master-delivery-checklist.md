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
| BKS-05 | Events persistence with billing linkage | 🟢 | **Complete:** Events ↔ registrations ↔ invoices linkage audited and documented. Invariants enforced via regression tests (`npm run test:bks05-events-billing`). Free events blocked from invoicing; event invoices use `source=EVT` with tenant-safe paths only. Delete/cancel behavior protected. All creation paths verified (PAY_NOW registration, EVT-04 bulk/individual). See [BKS-05 spec](../specs/backend/BKS-05-events-persistence-billing-linkage.md). |
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
| UIR-03 | Finance dashboard data contract alignment | 🟢 | Finance dashboard refactored to use FIN-01 contract. Period selector added (Year to Date, Current Month, Last 12 Months, All Time). All metrics now sourced from `/finance/summary` endpoint. Headline cards show Total Outstanding, Total Collected, and Cancelled (when > 0). Source breakdown shows Dues/Donations/Events/Other with outstanding and collected. Status breakdown shows OUTSTANDING/PAID/CANCELLED. **Regression tests:** Unit tests for mapping helper (`npm test finance-helpers`) + integration tests for dashboard (`npm test admin-finance-dashboard`). See [UIR-03 spec](../specs/finance/UIR-03-finance-dashboard-data-contract.md). |
| UIR-04 | Events checkout UX and error states | ⚪ | Not started |
| UIR-05 | Admin visibility and role-guarded UI | ⚪ | Not started |
| UIR-06 | Heading/contrast accessibility pass | ⚪ | Not started |
| UIR-07 | Login form ↔ JWT + tenant contract alignment | 🟢 | Login calls /auth/login with email/password/tenantId; uses VITE_DEFAULT_TENANT_ID; basic 400/401 handling |

## Events
| Code | Name | Status | Notes |
| --- | --- | --- | --- |
| EVT-01 | Schema and Clean Slate | 🟢 | Schema migrated (registrationMode, checkedInAt, eventType); rcme-dev events/registrations = 0. **Schema guard in place:** Type-safe structural tests (`npm run test:evt01-schema`) verify critical fields exist - catches accidental schema changes. See [EVT-01 spec](../specs/events/EVT-01-schema-and-clean-slate.md). |
| EVT-02 | Event Creation and Registration | 🟢 | Admin Event Creation form fully refactored: Free vs Paid toggle, PHP-only pricing, RSVP vs Pay-now registration modes enforced by business rules, and Event Type (IN_PERSON vs ONLINE) captured to drive labels and location display. Backend PAY_NOW invoice creation wired via `createEventInvoice`. **Backend regression tests:** 6 tests (`npm run test:evt02-registration`) enforce core rules - free events no invoices, paid RSVP no invoices at registration, paid PAY_NOW creates invoices, tenant safety. See [EVT-02 spec](../specs/events/EVT-02-event-creation-and-registration.md). |
| EVT-03 | Attendance and Reporting | 🟢 | Complete: Attendance tracking (mark/undo/bulk) with event type-aware labels (Check in vs Mark attended), server-side filtering/search/export, payment status filter for paid events, invoice context display. **Regression test suite:** backend attendance tests (`npm run test:attendance`) + frontend attendance report tests (`npm test admin-event-attendance-report`). **Guarded by CI:** `.github/workflows/evt-03-regression-tests.yml` runs these suites on PRs that touch attendance handlers, event handlers, or the Admin Event Attendance Report page. See `docs/operations/ci-cd-and-environments.md` (EVT-03 Regression Test Suite) for details. |
| EVT-04 | Event Invoicing and Post Event Features | 🟢 | **Invoicing tools complete (feature-complete):** Bulk and individual invoice generation for paid RSVP events. Free events blocked (UI + API); duplicate prevention; uses existing invoice numbering (`EVT` source). UI actions in attendance report with conditional visibility (free/paid, RSVP/PAY_NOW). **QA:** 6 manual QA scenarios documented in EVT-04 spec for rcme-dev verification (primary gate). **Automation:** Test file `auth-service/tests/eventInvoiceHandlers.test.ts` exists with 7 guardrail tests (`npm run test:event-invoices`), but module mocking still needs refinement and is **not yet CI-enforced**. Manual QA scenarios are the primary regression guard until automation is stabilized. See [EVT-04 spec](../specs/events/EVT-04-event-invoicing-and-post-event-tools.md). **Post-event comms (thank-you emails) deferred to future ticket.** |
| EVT-05A | Admin Events Dashboard Micro UI Polish | 🟢 | Title/sublabel layout, capacity two-line display with color semantics, action icon alignment & tooltips. No backend changes. See [EVT-05A spec](../specs/events/EVT-05-admin-events-dashboard-micro-ui-polish.md) |

## Finance (FIN)
| Code | Name | Status | Notes |
| --- | --- | --- | --- |
| FIN-01 | Finance Dashboard Contract & Metrics Alignment | 🟢 | **Complete end-to-end:** Finance summary endpoint (`/api/billing/admin/finance/summary`) with time window support, source breakdown (DUES/DONATION/EVENT/OTHER), status mapping (OUTSTANDING/PAID/CANCELLED), zero-amount exclusion, tenant scoping. Response includes self-describing range labels. Backend tests (`npm run test:fin-01`). Frontend aligned via UIR-03 with regression tests (`npm test finance-helpers`, `npm test admin-finance-dashboard`). Spec: `docs/specs/finance/FIN-01-event-finance-integration.md`. |
| FIN-02 | Invoice List & Detail Experience | 🟢 | **Complete & QA Verified:** Admin and member invoice list/detail implemented per FIN-02 spec. Backend: Enhanced list endpoints with period filtering, status mapping to FIN-01 groups, balance calculation, new detail endpoints. Frontend: Admin invoice list with filters (period, status, source, search, sort), admin detail page, member list with Outstanding/History tabs, member detail page. Tests: Unit tests for status mapping, balance calculation, period resolution (`npm run test:fin02` - all 11 tests passing). QA: Verified in rcme-dev - zero-amount exclusion, status grouping alignment with FIN-01, period filters, member isolation, balance calculations all working correctly. Pay Now button disabled with "Coming Soon" message (payment flow integration deferred). See [FIN-02 spec](../specs/finance/FIN-02-invoice-list-and-detail.md) and [QA report](../qa/FIN-02-qa-verification.md). |
| FIN-03 | Treasurer Finance Dashboard & KPIs | ⚪ | Define and surface core finance KPIs for the treasurer: totals and breakdowns for Dues / Donations / Events, paid vs outstanding, and simple trend or time filters. No deep analytics yet. |
| FIN-04 | Treasurer Exports & Audit Trail | ⚪ | Provide CSV/Excel exports and a basic audit trail that finance can use for reconciliation and annual reporting. Focus is on reliable data, not complex visualization. |
| FIN-05 | Donations & Fundraising Reporting | ⚪ | Give a clear view of donations and fundraising: who gave, to what campaign, and how it ties into overall revenue. Simpler slice than full analytics, but enough for board reporting. |

## QA / Gates
| Code | Status | Notes |
| --- | --- | --- |
| DPL-01 | PASS | Render pipeline validated; health endpoints available |
| BKS-01 | PASS | Multitenant schema/migrations applied; stubs in place |
| BKS-02 | PASS | JWT + tenant RBAC gate passed; health/login/protected route smoke tests documented |
| BKS-03 | PASS | Membership persistence + verification gate passed; core flows smoke-tested with tenant + RBAC; advanced flows documented as stubs |
| BKS-04 | PASS | Billing/payments persistence + PAN/CVC removal gate passed; core invoice/payment/payment-method flows smoke-tested with tenant + RBAC; advanced flows remain stubbed |
| UIR-07 | PASS | Login UX aligned with backend: /auth/login requires email/password/tenantId; smoke-tested happy path and basic error handling |
| EVT-03 | PASS | Attendance & reporting regression suite in place: backend (`npm run test:attendance`) + frontend (`npm test admin-event-attendance-report`) enforced via `.github/workflows/evt-03-regression-tests.yml` on relevant PRs. |
| EVT-04 | PARTIAL | Event invoicing tools (EVT-04) implemented and functionally complete. **Manual QA gate:** 6 QA scenarios documented in `EVT-04-event-invoicing-and-post-event-tools.md` for rcme-dev verification (treat as primary gate until automation stabilized). **Automation status:** Test file `eventInvoiceHandlers.test.ts` in place with 7 guardrail tests (`npm run test:event-invoices`), but module mocking not fully stabilized and **not wired to CI**. Manual QA scenarios are the current regression guard - automation needs refinement before CI enforcement. |
| FIN-02 | PASS | Invoice list & detail experience verified in rcme-dev. **Verified behaviors:** Zero-amount exclusion, status grouping alignment with FIN-01, period filters, member isolation (404 on unauthorized access), balance calculations, cross-view status consistency, FIN-01/FIN-02 totals alignment. **Automation:** Unit tests for status mapping, balance calculation, period resolution (`npm run test:fin02` - all 11 tests passing). **Known limitation:** Pay Now button disabled with "Coming Soon" message (payment flow integration deferred). Full QA report: `docs/qa/FIN-02-qa-verification.md`. |
| BKS-05 | PASS | Events persistence with billing linkage verified. **Invariants protected:** Free event protection (all paths), RSVP/PAY_NOW registration behavior, duplicate prevention, invoice linkage integrity (source=EVT, eventId, registration link), delete/cancel behavior, tenant isolation. **Automation:** Regression tests (`npm run test:bks05-events-billing`) covering all creation paths and invariants. See [BKS-05 spec](../specs/backend/BKS-05-events-persistence-billing-linkage.md). |

---
Last updated: 2025-01-14 21:00 (local)

