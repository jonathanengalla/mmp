## Communications 1: Admin drafts a broadcast email

- [ ] Admin with valid auth and role can create a new broadcast draft with subject and body.
- [ ] New draft is persisted and appears in the draft list for that tenant.
- [ ] Unauthenticated or non-admin users receive 401/403 and no draft is created or listed.
- [ ] Cross-tenant access to drafts is blocked (no leakage of other tenants’ broadcasts).
- [ ] Validation errors (missing subject/body) return 400 with the standard error envelope.
- [ ] UI shows clear success and error toasts and disables the submit button while saving.

## Communications 2: Admin selects audience segment

- [ ] Admin can view tenant-scoped segments.
- [ ] Admin can select an audience segment and save the draft.
- [ ] Draft reload shows the selected segment.
- [ ] Unauthorized or cross-tenant segment access is blocked.
- [ ] UI shows errors via toast or inline message.

## Communications 3: Admin edits an existing broadcast draft

- [ ] Admin can load an existing draft (tenant-scoped) and see subject, body, and segment prefilled.
- [ ] Admin can update subject/body/segment for drafts only; non-drafts are rejected.
- [ ] Invalid/missing subject/body or invalid segment returns 400 with standard error envelope.
- [ ] Unauthorized or cross-tenant access is blocked (401/403/404).
- [ ] UI shows success/error toasts and disables submit while saving.

## Communications 4: Admin previews a broadcast email

- [ ] Admin can fetch a preview for a draft via GET /broadcasts/:id/preview.
- [ ] Preview returns subject, body, audience_segment_id/name, and renderedPreview.
- [ ] Non-drafts are rejected (409); unauthorized/non-admin blocked.
- [ ] Cross-tenant access blocked (404/403 per conventions).
- [ ] UI shows preview inline/panel with loading and error toasts.

## Communications X6: System sends payment reminder email

- [ ] Given an unpaid/overdue invoice due today (or earlier) with no previous reminder, when the reminder job runs, a single reminder event is emitted and the invoice is marked as reminded.
- [ ] The communications outbox stores a payment reminder entry with invoice/member details.
- [ ] Paid or already-reminded invoices do not emit/store reminders.
- [ ] Re-running the job does not duplicate reminders for the same invoice (idempotent).

