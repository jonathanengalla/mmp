# SYS-AUDIT-2025 — Brownfield vs Greenfield Alignment

## SECTION 1 — Summary
- The front-end PWA has broad screen coverage (registration, login, directory, events, invoices, admin dashboards), but most data flows are mocked or in-memory; persistence, tenant isolation, and RBAC are not wired to the database.
- Backend deviates from the planned microservice + Prisma/Postgres architecture: only `auth-service` uses Prisma (minimal schema), while membership, billing, and events run on in-memory stores. Config Center, Communications, Reporting, and audit logging are effectively absent.
- Deployment alignment is fragile: Render deploy targets only `auth-service` without `DATABASE_URL`/migrations, and Vercel has no API base/env wiring; node versions are unpinned across environments.
- The theming system (token aliases + tenant CSS) exists but adoption is uneven: some pages still hardcode colors/gradients, and tenant/dark-mode selection is frontend-only with no persisted tenant context.
- High-risk gaps: missing database wiring for core flows, weak auth/RBAC (dev token grants admin), PCI-incomplete payments handling, and migration/seed safety for Render.

## SECTION 2 — Functional Coverage Table
| Module / Capability | Status | Notes |
| --- | --- | --- |
| Tenant & theme engine | PARTIAL | Tenant CSS tokens (RCME, Bellagio, Royal Palm) and switcher exist; no backend tenant config, no persistence of tenant selection, some hardcoded hex (#111) and gradients remain; dark-mode relies on CSS only. |
| Member management | PARTIAL | Registration/verify/pending/admin create/roles/custom-fields flows exist, but membership store is in-memory JSON; no Prisma persistence, no email delivery, no true approvals. |
| Profile & directory | PARTIAL | Directory/search and profile edit implemented; directory requires a query string and returns 400 otherwise; avatars and custom fields are in-memory; no tenant scoping beyond headers. |
| Events workflow (dashboard/detail/attendance/checkout) | PARTIAL/BROKEN | Events API is in-memory; publish/register/check-in exist but no DB, no real payments link, and reporting endpoints are stubbed. |
| Invoices & finance dashboard | PARTIAL/BROKEN | Finance dashboard calls dues summary/reporting endpoints; billing service uses in-memory invoices; Prisma Invoice model differs (`amount` vs `amountCents`), risking UI mismatch. |
| Payment methods | PARTIAL | In-memory card capture with full PAN/CVC (non-PCI), no gateway/tokenization; member payment methods not persisted. |
| Roles/permissions & admin-only controls | BROKEN | Auth middleware fabricates a dev user for any bearer token; admin checks are client-side/role-array only; no MFA or tenant-aware RBAC enforcement. |
| Audit logs / reporting | MISSING | No durable audit logging; reporting routes pulled from `services/reporting-service` but not wired to data. |
| Backend API completeness | BROKEN | Config Center, Communications, Notifications, and true API Gateway behavior are absent; services not isolated; event bus not present. |
| Deployment flow alignment (local → Render/Vercel) | BROKEN | Render deploy builds `auth-service` only, omits migrations and DB env; Vercel lacks API base env; node versions not aligned; no safe migration gating. |

## SECTION 3 — Backend Findings
- Prisma schema: minimal (`Member`, `Event`, `Invoice`, `User`), single tenant default `t1`; no feature-flag/config tables; no multi-tenant constraints; `amount` stored as int cents but UI expects `amountCents`.
- Prisma usage: only `auth-service` uses Prisma; membership/billing/events handlers use in-memory arrays and file persistence; renders data non-durable and non-tenant-isolated.
- Prisma client lifecycle: singleton with logging in dev is present; however, other services bypass DB entirely.
- Migrations: two migrations only; no shadow DB config; no safe migration gating or seed strategy for Demo/Prod.
- Environment loading: requires `DATABASE_URL` (and `SHADOW_DATABASE_URL` for dev) but Render config provides none; likely Prisma engine init failure at runtime.
- Build/start scripts: `npm run build` → `prisma generate && tsc -b`; `npm start` runs compiled server but never runs `prisma migrate deploy` or seed; risk of missing tables on Render.
- Cross-service imports: `auth-service` server imports membership/payments/events handlers from sibling services; they remain in-memory and are not exposed as separate deployables, breaking the planned gateway/service boundary.
- Required rewiring to stabilize backend:
  - Introduce real Prisma models for membership, payments/invoices, events, roles, audit logs with `tenant_id` enforcement.
  - Move membership/payments/events handlers to DB-backed repositories and remove in-memory stores.
  - Add per-tenant RBAC middleware and JWT validation (replace dev stub).
  - Gate migrations and seeds by environment (local/dev/demo/prod) with idempotent seeds.
  - Provide `/health` and `/status` per service with DB connectivity checks.

## SECTION 4 — Deployment Findings
- Render (`render.yaml`): builds only `auth-service`, no `DATABASE_URL`, no `prisma migrate deploy`, no seed step; node version comment-out; start command assumes DB exists.
- Prisma on Render: engines version 5.22.0; without `DATABASE_URL` or SSL options, Prisma will fail to connect; free plan ephemeral FS means in-memory services lose data on restart.
- Vercel (`frontend/pwa-app/vercel.json`): only a rewrite; no envs for `VITE_API_BASE_URL`, dark/light defaults, or tenant defaults; risk of pointing to `/api` with no proxy in prod.
- Node versions: root package lacks engines; `auth-service` pins 20.x; Vercel default may differ → potential build drift.
- Migration safety: no gating or ordered pipeline (build→migrate→start) for Render; no rollback plan; seeds not invoked in deploy flow.

## SECTION 5 — Theming / Tokens / Tenants
- Token layers: `app-theme-aliases.css` maps app tokens to RCME tokens; tenant overrides exist for RCME/Bellagio/RoyalPalm light/dark; ThemeProvider injects CSS variables.
- Gaps:
  - Hardcoded colors remain (`RegisterPage` gradient, `#111` text, login button fallback), bypassing tokens.
  - Base fallbacks in `base.css` include legacy colors not aligned to `app-*` aliases; some components still rely on legacy `--color-*` instead of `--app-color-*`.
  - Tenant selection is frontend-only (`TenantThemeSwitcher`); no persisted tenant identity or server-driven branding.
  - Dark mode relies on CSS tokens only; no verification that all surfaces/tables/cards use `app-color-surface-*` (risk of light cards in dark mode).
  - Admin-only visibility is enforced client-side; theming does not alter admin affordances per role.

## SECTION 6 — UI/UX Findings
- Tables (member roster, finance dashboard, events) share `ui/Table` but some inline styles still use raw colors and font sizes; contrast in dark mode depends on CSS vars but hardcoded `#111`/gradients can break.
- Finance dashboard expects `amountCents`/`paidAt` fields that backend does not populate consistently; empty states and error copy exist but no loading skeletons for all sections.
- Buttons: primitives exist, yet pages mix `primitives/Button` and inline styles; hover/focus uses `color-mix`, which lacks full browser support.
- Page titles/subtitles: rely on `var(--app-color-text-muted)` but some text uses default browser color; risk of low contrast in dark mode.
- White/light surfaces may appear in dark mode where components use legacy `--color-surface` instead of `--app-color-surface-*`.
- Event and invoice tables duplicate card shells; could be standardized via shared `TableCard` + header components.

## SECTION 7 — Risks & Dependencies
- Highest risk: lack of DB-backed membership/payments/events → data loss, inconsistent UX, and inability to meet PRD audit/compliance needs.
- Auth/RBAC is non-functional (dev token grants admin); cannot safely expose to tenants; must be fixed before any production use.
- Payments handling stores PAN/CVC in memory; non-PCI compliant; must be addressed before enabling real payments.
- Render deploy will fail without `DATABASE_URL`/migrations; Vercel frontend will 404 APIs without a configured base URL.
- Theme/token inconsistencies can cause brand/dark-mode regressions; hardcoded colors will block tenant theming.
- Reporting/finance dashboards rely on nonexistent data; changes to backend models will cascade to UI/table formats.

**Path A Decision (DB Reset)**
- We will abandon the legacy database and provision a new clean Render Postgres for the multi-tenant baseline.
- All environments (local + Render) will point to this new DB via `DATABASE_URL`; migrations will run on this clean instance.
- Old DB connection strings should no longer be used once the new instance is live.

## SECTION 8 — Proposed Story Backlog (BMad Format)

### Epic: Backend-Stabilization
- BKS-01 — "Prisma Schema Expansion" — Model members, users, roles, invoices, payments, events with `tenant_id`; add migrations. Dependencies: Database URL & migration pipeline. Notes: include indexes and foreign keys; align amounts to cents.
- BKS-02 — "DB-Backed Membership & Auth" — Replace in-memory membership with Prisma; implement JWT verification + tenant-scoped RBAC middleware. Dependencies: BKS-01. Notes: migrate existing seed member into DB; enforce admin/role checks server-side.
- BKS-03 — "Billing & Payments Persistence" — Move invoices/payments/dues jobs to Prisma; remove PAN/CVC handling; stub gateway tokenization. Dependencies: BKS-01. Notes: normalize `amountCents` vs UI expectations.
- BKS-04 — "Events Persistence & Checkout" — Persist events/registrations; link to invoices/payments; implement attendance reports. Dependencies: BKS-01, BKS-03. Notes: add status transitions and capacity checks in DB.
- BKS-05 — "Audit & Reporting Services" — Add audit log table and reporting queries; wire reporting routes to DB. Dependencies: BKS-01. Notes: include per-tenant filters.

### Epic: Deployment-Alignment
- DPL-01 — "Render Env & Migrations" — Add `DATABASE_URL`/`SHADOW_DATABASE_URL`, run `prisma migrate deploy` pre-start, and pin Node version. Dependencies: BKS-01. Notes: switch to `npm ci` and add health checks.
- DPL-02 — "Vercel API Wiring" — Set `VITE_API_BASE_URL` per env; document local→Render→Vercel flow. Dependencies: DPL-01. Notes: add preview/stage environment mapping.
- DPL-03 — "Seed & Reset Safety" — Implement env-aware seeds (dev/demo only) and remove destructive resets from deploy. Dependencies: BKS-01. Notes: align with `env-rules.md`.

### Epic: Theme-Engine
- THE-01 — "Token Adoption Sweep" — Replace hardcoded hex/gradients (#111, register/login) with `app-color-*` tokens; ensure `app-theme-aliases` used everywhere. Dependencies: none. Notes: add lint/checklist for new components.
- THE-02 — "Tenant Persistence" — Persist tenant selection (localStorage + server echo) and ensure API calls carry tenant header consistently. Dependencies: THE-01. Notes: provide default tenant per env.
- THE-03 — "Dark Mode QA Pass" — Audit surfaces/tables/cards for `app-color-surface-*`; fix legacy `--color-*` fallbacks that break dark mode. Dependencies: THE-01.

### Epic: UI-Refinement
- UIR-01 — "Table Pattern Unification" — Standardize roster/finance/event/invoice tables on shared `TableCard` + header/footer; align spacing and typography tokens. Dependencies: THE-01.
- UIR-02 — "Role/Admin Visibility Hardening" — Ensure admin-only controls hide for non-admin roles and match backend RBAC; adjust copy/empty states. Dependencies: BKS-02.
- UIR-03 — "Finance Dashboard Data Contract" — Align UI fields to backend schema (`amountCents`, `paidAt`, `source`); add loading/skeletons. Dependencies: BKS-03.
- UIR-04 — "Events Checkout UX" — Confirm RSVP vs pay-now flows and tie to payments; add error states and receipt confirmations. Dependencies: BKS-04.


