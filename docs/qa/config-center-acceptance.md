## Config Center 1: Admin updates organization profile

- [ ] Admin-only access enforced for /config/org-profile.
- [ ] Profile loads successfully for current tenant.
- [ ] Update requires name and validates optional fields; returns updated profile.
- [ ] Tenant isolation enforced; other tenants not accessible.
- [ ] Audit event captured for updates.

## Config Center 2: Admin sets tenant timezone and locale

- [ ] Admin can update timezone (valid IANA).
- [ ] Admin can update locale (xx or xx-XX).
- [ ] Invalid timezone rejected (400).
- [ ] Invalid locale rejected (400).
- [ ] Audit entry captured.
- [ ] Tenant isolation enforced.

## Config Center 3: Admin creates membership type

- [ ] Admin-only create/list membership types.
- [ ] Duplicate name rejected (409).
- [ ] Invalid price/period rejected (400).
- [ ] Tenant isolation enforced for listing.
- [ ] Audit entry captured on create.

## Config Center 4: Admin configures approval workflow

- [ ] Admin can load workflow configuration.
- [ ] Admin can enable/disable approval requirement.
- [ ] Approver roles validated when approval is required.
- [ ] Non-admin rejected.
- [ ] Audit entry captured.

## Config Center 6: Admin defines payment categories

- [ ] Admin can view list of payment categories for current tenant.
- [ ] Admin can create a new payment category with valid code/name/type.
- [ ] Duplicate codes are rejected with a clear error.
- [ ] Admin can edit an existing category’s name/description/type/active.
- [ ] Non-admins and unauthenticated users cannot access payment category endpoints or UI.
- [ ] Audit entries recorded for create and update actions.

## Config Center 7: Admin edits invoice template

- [ ] Admin can load existing invoice template.
- [ ] Admin can update subject/body.
- [ ] Empty subject/body rejected.
- [ ] Unchanged payload returns clear error.
- [ ] Audit logs captured for updates.
- [ ] Non-admin access blocked.

## Config Center 9: Admin enables/disables modules via feature flags

- [ ] Admin can load current feature flags.
- [ ] Admin can toggle and save updates.
- [ ] Invalid flags rejected.
- [ ] Unchanged update produces clear error.
- [ ] Tenant-scoped behavior confirmed.
- [ ] Audit logs captured.

