# MVP User Stories – Phase 1 (Rotary Club of Manila Expats)

Thin-sliced, independently testable stories required to onboard members, manage profiles, collect dues and event payments, issue invoices/receipts, run basic events, send core communications, and generate basic reports.

---

**MVP Phase 1 – Status Snapshot**

- Membership: 5 fully / 0 partial / 1 not started
- Payments Hub: 1 fully / 0 partial / 3 not started
- Billing: 0 fully / 0 partial / 6 not started
- Events: 0 fully / 5 partial / 2 not started
- Communications: 0 fully / 4 partial / 2 not started
- Reporting: 0 fully / 3 partial / 0 not started
- Config Center: 0 fully / 7 partial / 0 not started

**Key gaps before declaring MVP “dev-complete”:**

- No automated tests identified; all test checkboxes remain unchecked.
- Several backend/API flows not verified or absent (payments, billing, reminders, directory search, manual member admin actions, receipts).
- Member-facing billing/payment UIs and download/receipt flows not present.

---

## Membership

- [x] 1: Member submits self-registration form  
  - [x] API + service logic implemented (including optional LinkedIn URL and otherSocials)  
  - [x] Frontend flow implemented (page + routing + validation + success state)  
  - [x] Minimal tests exist (service + UI)  
  - [ ] Edge/error states fully covered

- [x] 2: Member verifies email via link  
  - [x] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [x] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [x] 3: Admin creates a member manually  
  - [x] API + service logic implemented (POST /members/admin with email duplicate check, LinkedIn URL validation)  
  - [x] Frontend flow implemented (AdminCreateMemberPage + /admin/members/new route + validation)  
  - [x] Minimal tests exist (unit/integration for handlers + frontend page)  
  - [x] Edge/error states fully covered (duplicate email 409, validation errors, invalid LinkedIn URL)

- [x] 4: Admin approves pending member  
  - [x] API + service logic implemented (GET /members/pending, POST /members/:id/approve, POST /members/:id/reject)  
  - [x] Frontend flow implemented (admin page + routing + approval/rejection with modal)  
  - [x] Minimal tests exist (unit/integration for handlers + frontend page)  
  - [x] Edge/error states fully covered

- [x] 6: Member updates profile contact info  
  - [x] API + service logic implemented (GET/PATCH /members/me with LinkedIn URL validation)  
  - [x] Frontend flow implemented (page + routing + validation for phone/address/linkedinUrl/otherSocials)  
  - [x] Minimal tests exist (unit/integration for handlers + frontend page)  
  - [x] Edge/error states fully covered (load error with retry, validation errors, save errors)

- [x] 12: Member searches directory by name/email  
  - [x] API + service logic implemented (GET /members/search with limit/offset pagination)  
  - [x] Frontend flow implemented (DirectoryPage + routing + debounced search + pagination)  
  - [x] Minimal tests exist (unit/integration for handlers + frontend page)  
  - [x] Edge/error states fully covered (empty results, error with retry, status filtering)

- [x] 13: Admin manages member roles (member, admin, event_manager, finance_manager, communications_manager)  
  - [x] API + service logic implemented (PUT /members/:id/roles with role validation)  
  - [x] Frontend flow implemented (AdminMemberReportPage + Edit Roles modal + role checkboxes)  
  - [x] Minimal tests exist (unit/integration for handlers + frontend page)  
  - [x] Edge/error states fully covered (empty roles, invalid roles, 404 member not found)

- [x] 14: Member uploads a profile photo from the Profile page  
  - [x] API + service logic implemented (PATCH /members/me/avatar with base64 data URL)  
  - [x] Frontend flow implemented (ProfilePage + file input + preview + save/remove buttons)  
  - [ ] Minimal tests exist (unit/integration)  
  - [x] Edge/error states fully covered (file size limit, save/remove errors)

- [x] 15: Admin updates or removes a member's profile photo  
  - [x] API + service logic implemented (PATCH /members/:id/avatar admin endpoint)  
  - [x] Frontend flow implemented (AdminMemberReportPage + Edit Avatar modal)  
  - [ ] Minimal tests exist (unit/integration)  
  - [x] Edge/error states fully covered (member not found, save errors)

- [x] 16: Member avatars appear in directory and event-related lists  
  - [x] API + service logic implemented (avatarUrl included in member DTOs)  
  - [x] Frontend flow implemented (DirectoryPage + AdminMemberReportPage show avatars)  
  - [ ] Minimal tests exist (unit/integration)  
  - [x] Edge/error states fully covered (fallback to initials)

- [x] 17: Admin defines custom profile fields (text/select/date)  
  - [x] API + service logic implemented (GET/PUT /custom-fields/profile-schema with validation)  
  - [x] Frontend flow implemented (AdminProfileCustomFieldsPage + groups + fields + options + conditions)  
  - [ ] Minimal tests exist (unit/integration)  
  - [x] Edge/error states fully covered (duplicate IDs, invalid references, validation errors)

- [x] 18: Member edits custom profile fields on their Profile  
  - [x] API + service logic implemented (GET/PATCH /members/me/custom-fields with validation)  
  - [x] Frontend flow implemented (ProfilePage + Additional Information section + conditional visibility)  
  - [ ] Minimal tests exist (unit/integration)  
  - [x] Edge/error states fully covered (required fields, min/max validation, pattern validation)

- [x] 19: Admin views custom profile fields in reports  
  - [x] API + service logic implemented (customFields included in member DTOs)  
  - [x] Frontend flow implemented (AdminMemberReportPage + Custom Fields column)  
  - [ ] Minimal tests exist (unit/integration)  
  - [x] Edge/error states fully covered (handles missing/empty fields gracefully)

- [x] 20: Admin marks profile fields as required or optional  
  - [x] API + service logic implemented (validation.required in schema + enforced on save)  
  - [x] Frontend flow implemented (AdminProfileCustomFieldsPage + Required checkbox in field editor)  
  - [ ] Minimal tests exist (unit/integration)  
  - [x] Edge/error states fully covered (required field validation on member save)

## Payments Hub

- [x] 1: Member saves a payment method (card)  
  - [x] API + service logic implemented (GET/POST /members/me/payment-methods with validation, isDefault logic)  
  - [x] Frontend flow implemented (PaymentMethodsPage + routing + form validation for brand/last4/expiration)  
  - [x] Minimal tests exist (unit/integration for handlers + frontend page)  
  - [x] Edge/error states fully covered (load error with retry, validation errors, create errors)

- [ ] 4: Member makes one-time payment for dues  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 6: Member pays event fee at checkout  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 11: System sends payment receipt email  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

## Billing

- [ ] 1: Admin creates a manual invoice  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 2: System auto-generates recurring dues invoice  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 4: Admin sends invoice to member  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [x] 6: Member views outstanding invoices  
  - [x] API + service logic implemented (member invoices endpoint + event-linked invoices)  
  - [x] Frontend flow implemented (Invoices page shows event invoices and links)  
  - [x] Minimal tests exist (InvoicesPage renders event context)  
  - [ ] Edge/error states fully covered

- [ ] 7: Member downloads invoice PDF  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 12: System marks invoice Paid after full settlement  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

## Events

- [ ] 1: Admin creates a new event draft  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 2: Admin publishes an event  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 3: Admin sets event capacity  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 4: Member registers for an event  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 5: Member cancels event registration  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 10: Member views upcoming events list  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 12: Admin sets event pricing  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [x] Member registers for pay-now event and system generates an invoice  
  - [x] API + service logic implemented (POST /events/:id/checkout creates invoice-first registration)  
  - [x] Frontend flow implemented (EventCheckoutPage + detail/upcoming CTAs)  
  - [x] Minimal tests exist (checkout + detail/upcoming flow tests)  
  - [ ] Edge/error states fully covered

- [x] Admin sees basic invoice/payment status in event attendance report  
  - [x] API + service logic implemented (attendance DTO includes invoice/payment counts)  
  - [ ] Frontend flow implemented  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

## Communications

- [ ] 1: Admin drafts a broadcast email  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 2: Admin selects audience segment  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 3: Admin edits an existing broadcast draft  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 4: Admin previews a broadcast email  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 6: System sends payment reminder email  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 7: System sends event reminder email  
  - [ ] API + service logic implemented  
  - [ ] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

## Reporting

- [ ] 1: Admin views member roster report  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 2: Admin views dues collection summary  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 4: Admin views event attendance report  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

---

### Events vs. Billing alignment (MVP)

- RSVP events remain registration-only (no invoice created at checkout).
- Pay-now events now use an invoice-first checkout at `/events/:id/checkout`; payment happens after invoice issuance.
- Members can see event-linked invoices on the Invoices page (with event context).
- Admin attendance reporting now carries invoice/payment context for basic reporting.

## Config Center

- [ ] 1: Admin updates organization profile  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 2: Admin sets tenant timezone and locale  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 3: Admin creates membership type  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 4: Admin configures approval workflow  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 6: Admin defines payment categories  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 7: Admin edits invoice template  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

- [ ] 9: Admin enables/disables modules via feature flags  
  - [ ] API + service logic implemented  
  - [x] Frontend flow implemented (page + routing + basic validation)  
  - [ ] Minimal tests exist (unit/integration)  
  - [ ] Edge/error states fully covered

---

## Membership – MVP Checklist

- [x] 1: Member submits self-registration form
- [x] 2: Member verifies email via link
- [x] 3: Admin creates a member manually
- [x] 4: Admin approves pending member
- [ ] 5: (intentionally unused in MVP)
- [x] 6: Member updates profile contact info
- [ ] 7–11: (intentionally unused in MVP)
- [x] 12: Member searches directory by name/email
- [x] 13: Admin manages member roles (member, admin, event_manager, finance_manager, communications_manager)
- [x] 14: Member uploads a profile photo from the Profile page
- [x] 15: Admin updates or removes a member's profile photo
- [x] 16: Member avatars appear in directory and event-related lists
- [x] 17: Admin defines custom profile fields (text/select/date)
- [x] 18: Member edits custom profile fields on their Profile
- [x] 19: Admin views custom profile fields in reports
- [x] 20: Admin marks profile fields as required or optional

