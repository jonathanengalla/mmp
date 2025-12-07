# OneLedger MVP – DB Migration & Seed Plan

Scope: minimal bootstrapping for a single tenant (Rotary Club of Manila Expats), admin user, membership types, config defaults, and a few optional sample events/payments for testing.

## Migration Order (per service schema)
1) Identity/Auth: tenants, users, roles, user_roles, mfa_policy.
2) Config Center: feature_flags, payment_gateways (refs only), membership_types, profile_fields, approval_workflow, invoice_templates, reminder_schedules, payment_categories, event_defaults, project_templates, branding.
3) Membership: members, member_profile_field_values, member_status_changes.
4) Payments/Billing: payment_methods, invoices, invoice_lines, payments, refunds, payment_schedules, late_fee_rules.
5) Events: events, event_registrations, event_attendance.
6) Communications: email_templates, broadcasts, reminder_jobs, communication_logs.
7) Audit: audit_events (append-only).

## Seed Data (initial)

### Tenant
- `tenant`:
  - id: `t-rotary`
  - name: `Rotary Club of Manila Expats`
  - timezone: `Asia/Manila`
  - locale: `en-PH`
  - status: `active`

### Admin User
- `user`:
  - id: `u-admin`
  - email: `admin@rotary.example`
  - password_hash: `<hashed>` (set via secure process)
  - status: `active`
  - tenant_id: `t-rotary`
- `role`: `admin` (manage_members, manage_config, manage_payments, manage_events, manage_communications)
- `user_role`: link `u-admin` to `admin`
- `mfa_policy`: `admin_mfa_required = true`

### Membership Types
- `membership_type` rows:
  - `Active` (is_default = true)
  - `Honorary` (is_default = false)

### Config Defaults (minimal)
- Feature flags: enable `membership`, `payments`, `billing`, `events`, `communications`, `reporting`.
- Payment categories: `dues`, `events`, `donations` (for future use).
- Invoice template: `default` with footer “Thank you” and no taxes for MVP.
- Approval workflow: `manual` or `auto` (pick MVP default; recommend manual for Rotary).
- Profile fields: none required beyond core; optional `sponsor` (text, optional).
- Reminder schedules: payment_due offsets `[-7, -1]`, event_reminder offsets `[-2]`.
- Branding: placeholder logo URL (optional), colors default.

### Example Event (optional seed)
- `event`:
  - id: `e-rotary-1`
  - title: `Weekly Meeting`
  - start_at: next Tuesday 6pm Manila
  - end_at: next Tuesday 7pm Manila
  - location: `Clubhouse`
  - status: `published`
  - capacity: 50

### Example Invoice/Payment (optional seed)
- `invoice`:
  - id: `inv-demo-1`
  - member_id: placeholder member
  - total_amount: 20000 (e.g., dues)
  - status: `sent`
  - due_date: +30 days
- `payment`:
  - id: `pay-demo-1`
  - invoice_id: `inv-demo-1`
  - amount: 20000
  - status: `succeeded`

## Seeding Mechanics
- Use idempotent seed scripts per service; guard with unique keys.
- Apply seeds only in local/dev; staging/prod seed only tenant/admin/membership types/config (no sample events/payments).
- Hash admin password at runtime or inject via secret; never hardcode.
- Ensure all rows set `tenant_id`.

## Verification Checklist (post-seed)
- Admin can log in and see tenant-configured branding/timezone.
- Admin sees membership types (Active, Honorary).
- Feature flags show membership/payments/events/communications/reporting enabled.
- Approval workflow set as intended (manual/auto).
- Sample event (if seeded) appears in upcoming list.
- Sample invoice/payment (if seeded) visible to admin for testing.

