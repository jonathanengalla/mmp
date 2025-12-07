# Config Center API (MVP)

Base: `/api/config` (tenant-scoped via JWT `tenant_id`; header `Authorization: Bearer <token>`, admin required). Use shared pagination and error format (see `auth-api.md`). Health: `/health`, `/status`.

## Conventions
- Auth: Bearer JWT with tenant claim; admin-only endpoints.
- Pagination: `page`, `page_size`, `sort`; responses return `items`, `page`, `page_size`, `total_items`, `total_pages`.
- Errors: standardized envelope per `auth-api.md`.

Auth header example:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Organization Profile & Branding
- **GET /org-profile** — Get org profile  
  Example response:
  ```json
  { "name": "Rotary Club of Manila Expats", "timezone": "Asia/Manila", "locale": "en-PH", "logo_url": "https://cdn/logo.png" }
  ```
  Responses: `200`.
- **PATCH /org-profile** — Update name, logo, colors, contact info, timezone, locale  
  Request: partial update  
  Example request:
  ```json
  { "name": "Rotary Club", "timezone": "Asia/Manila" }
  ```
  Responses: `200`, `400`.

## Membership Configuration
- **POST /membership-types** — Create membership type  
  Request: `{ name, description?, category?, is_default? }`  
  Example request:
  ```json
  { "name": "Active", "description": "Standard member", "is_default": true }
  ```
  Responses: `201`, `400`.
- **GET /membership-types** — List types  
  Query: pagination params optional.  
  Example response:
  ```json
  {
    "items": [ { "id": "mt1", "name": "Active", "is_default": true } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200`.
- **PATCH /membership-types/{id}** — Update/activate/deactivate  
  Responses: `200`, `404`.

- **POST /approval-workflow** — Set member approval mode  
  Request: `{ mode: "auto"|"manual", rules? }`  
  Responses: `200`.

- **POST /profile-fields** — Add custom profile field  
  Request: `{ field_key, field_type, required?, options?, visibility? }`  
  Example request:
  ```json
  { "field_key": "sponsor", "field_type": "text", "required": false, "visibility": "admin_only" }
  ```
  Responses: `201`, `400`.
- **GET /profile-fields** — List fields  
  Query: pagination params optional.  
  Example response:
  ```json
  {
    "items": [ { "field_key": "sponsor", "field_type": "text", "required": false } ],
    "page":1,"page_size":20,"total_items":1,"total_pages":1
  }
  ```
  Responses: `200`.

## Payments & Billing Configuration
- **POST /payment-categories** — Define payment categories  
  Request: `{ name, code?, applies_to? }`  
  Example request:
  ```json
  { "name": "dues", "code": "DUES" }
  ```
  Responses: `201`, `400`.
- **GET /payment-categories** — List categories  
  Query: pagination params optional.  
  Example response:
  ```json
  { "items": [ { "name": "dues", "code": "DUES" } ], "page":1,"page_size":20,"total_items":1,"total_pages":1 }
  ```
  Responses: `200`.

- **POST /invoice-templates** — Set invoice template values  
  Request: `{ template_ref?, tax_fields?, footer_text? }`  
  Example request:
  ```json
  { "template_ref": "default", "tax_fields": [ { "label": "VAT", "rate": 0.12 } ], "footer_text": "Thank you" }
  ```
  Responses: `201/200`, `400`.
- **POST /dues-rules** — Configure recurring dues rules  
  Request: `{ frequency, penalties?, grace_days? }`  
  Example request:
  ```json
  { "frequency": "monthly", "penalties": { "type": "fixed", "amount": 500 }, "grace_days": 5 }
  ```
  Responses: `200`.

- **POST /payment-gateways** — Enable/configure gateway  
  Request: `{ gateway, credentials, enabled }` (credential refs, not raw secrets)  
  Example request:
  ```json
  { "gateway": "stripe", "credentials": { "secret_ref": "kv/stripe" }, "enabled": true }
  ```
  Responses: `201`, `400`.

## Feature Flags & Advanced Toggles
- **POST /feature-flags** — Set flags (covers module toggles and advanced payment features like recurring/installments/directories)  
  Request: `{ flag_key, enabled }`  
  Example request:
  ```json
  { "flag_key": "events_enabled", "enabled": true }
  ```
  Responses: `200/201`.
- **GET /feature-flags** — List flags  
  Responses: `200`.

## Communications Settings
- **POST /email-senders** — Configure sender identities  
  Request: `{ name, email }`  
  Responses: `201`, `400`.
- **POST /reminder-schedules** — Configure reminder offsets  
  Request: `{ type, offsets: [days_before], channel, template_id? }`  
  Example request:
  ```json
  { "type": "payment_due", "offsets": [7,1], "channel": "email", "template_id": "t1" }
  ```
  Responses: `201`, `400`.
- **POST /email-templates** — Create/update email templates (admin-configured)  
  Request: `{ name, category, subject_tpl, body_tpl }`  
  Example request:
  ```json
  { "name": "reminder", "category": "reminder", "subject_tpl": "Reminder", "body_tpl": "Please pay." }
  ```
  Responses: `201/200`, `400`.
- **GET /email-templates** — List templates  
  Query: pagination params optional.  
  Responses: `200`.

## Events & Projects Defaults (MVP events)
- **POST /event-defaults** — Set defaults (types, capacity rules, attendance options)  
  Example request:
  ```json
  { "default_capacity": 100, "waitlist_enabled": true }
  ```
  Responses: `200`.
- **POST /project-templates** — Create project templates (for NGOs/HOAs/schools)  
  Request: `{ name, category?, default_fields? }`  
  Example request:
  ```json
  { "name": "Community Project", "category": "NGO", "default_fields": { "lead": "", "budget": "" } }
  ```
  Responses: `201`, `400`.
- **GET /project-templates** — List project templates  
  Query: pagination params optional.  
  Responses: `200`.

## Directory Visibility & Security
- **POST /directory-visibility** — Set directory visibility and field-level rules  
  Request: `{ visible_to_members: boolean, field_visibility: { field_key: visibility } }`  
  Example request:
  ```json
  { "visible_to_members": true, "field_visibility": { "email": "members", "phone": "admins" } }
  ```
  Responses: `200`.

## Roles & MFA Policy
- **POST /roles** — Create role definition (config-level)  
  Request: `{ name, description?, permissions: [] }`  
  Example request:
  ```json
  { "name": "admin", "permissions": ["manage_members", "manage_config"] }
  ```
  Responses: `201`, `400`.
- **PATCH /roles/{id}** — Update role definition  
  Responses: `200`, `404`.
- **GET /roles** — List roles  
  Query: pagination params optional.  
  Responses: `200`.
- **POST /mfa-policy** — Set MFA requirement for admin roles  
  Request: `{ admin_mfa_required: boolean }`  
  Example request:
  ```json
  { "admin_mfa_required": true }
  ```
  Responses: `200`.

## Config (publish)
- `ConfigUpdated`, `FeatureFlagUpdated`, `MembershipTypeUpdated`, `ProfileFieldUpdated`, `GatewayConfigUpdated`, `ReminderScheduleUpdated`, `EmailTemplateUpdated`, `ProjectTemplateUpdated`, `RoleUpdated`, `MfaPolicyUpdated`.

## Error format example
```json
{
  "error": { "code": "validation_failed", "message": "name is required", "details": [ { "field": "name", "issue": "required" } ] },
  "trace_id": "abc-123"
}
```

