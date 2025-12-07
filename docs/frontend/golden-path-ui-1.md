# Golden Path UI Spec – OneLedger (Registration → Verification → Login → Profile)

## Routes
- `/register`
- `/verify/:token`
- `/login`
- `/profile`

## Screens & Components
### /register
- Form: email, password (strength hint), first name, last name, phone (optional), address (optional).
- Actions: Submit (disabled when invalid/submitting), link to login.
- Validation: required email/password/first_name/last_name; email format; password min length.
- Feedback: inline errors; success panel “Check your email to verify” + link to `/login`; API errors via standard envelope.

### /verify/:token
- Auto-call verification on mount.
- States: verifying (spinner), success (CTA to `/login`), error (invalid/expired with link to resend/register).

### /login
- Form: email, password (MFA code if prompted).
- Actions: Submit (disabled when invalid/submitting), links to register/forgot password.
- Feedback: inline errors; API errors; success redirects to `/profile`.

### /profile
- View: name, email, membership status/type (read-only).
- Edit: contact info (phone, address), save button; optional photo upload.
- States: loading skeleton, loaded, saving with success/error toasts.
- Actions: PATCH contact info; upload photo (optional).

## States & Feedback Patterns
- Buttons disabled + spinner while submitting.
- Inline validation errors per field.
- Global toast/snackbar for success/error on API calls.
- Skeletons for loading (`/profile`).
- Offline banner; disable actions when offline.

## Step-by-Step Flows
### Registration
1. User opens `/register`.
2. Client validates required fields.
3. POST `/api/membership/registrations` with email/password/profile; include auth headers if needed; tenant via JWT/X-Tenant-Id.
4. On 201: show success “Check your email to verify” + link to `/login`.
5. On 4xx: show inline/API error from envelope.

### Email Verification
1. User clicks email link → `/verify/:token`.
2. On mount: POST `/api/membership/registrations/{token}/verify`.
3. On 200: show success + “Go to Login”.
4. On 410/400: show “Link invalid or expired” + link to resend/register.

### Login
1. User opens `/login`.
2. Submit to `/api/auth/login`; on success, store tokens; redirect to `/profile`.
3. On 401/403: show error; if `mfa_required`, show MFA field and retry.

### Profile View/Edit
1. On load: GET `/api/membership/members/{id}` (or via session lookup).
2. Display name/email/status/type; contact fields editable.
3. Save: PATCH `/api/membership/members/{id}`; toast on success/error.
4. Optional: POST `/api/membership/members/{id}/photo` for uploads.

## PWA Considerations
- Cache app shell via service worker; keep bundles small; route-level lazy loading.
- Offline handling: show banner; disable submit; allow cached `/profile` read-only.
- Tenant branding: fetch once (logo/colors) from config; apply theme.
- Include `Authorization: Bearer <token>` and `X-Tenant-Id` on API calls.
- Preserve redirect (`?redirect=/profile`) for post-login navigation.

