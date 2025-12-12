# EVT-01 — Schema and Clean Slate
**Status:** Done  
**Scope:** RCME tenant first; additive, non-breaking

## Goals
- Add required schema fields to support registration mode and attendance.
- Clean rcme-dev events/registrations so future work starts from a known-good state.

## Links
- Master Plan: `oneledger-events-master-plan.md`

## Requirements
- Event: add `registrationMode` enum (`RSVP` | `PAY_NOW`).
- EventRegistration: add `checkedInAt` DateTime?.
- Member/data safety: dues/donations untouched.
- rcme-dev: clear legacy events + registrations.

## Success Criteria
- Schema fields present and deployed.
- rcme-dev has zero legacy events/registrations after cleanup. ✅ Verified (events=0, registrations=0).
- Finance dashboards still correct for dues/donations.

## QA Results (2025-01-12)
- Migration applied to Render (registrationMode, checkedInAt).
- rcme-dev events count = 0; registrations count = 0 after scoped cleanup.
- No dues/donation data touched.

## Risks / Notes
- Ensure migrations are tenant-safe and additive.
- Cleanup confined to rcme-dev only.

## QA Checklist
- [ ] Migration applies cleanly to Render.
- [ ] rcme-dev events/registrations count = 0 post-cleanup.
- [ ] Dues/Donation invoices still present and unchanged.


