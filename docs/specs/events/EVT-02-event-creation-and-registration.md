# EVT-02 — Event Creation and Registration
**Status:** In Progress  
**Scope:** Free vs paid events; RSVP vs Pay Now flows

## Goals
- Enforce free events = RSVP-only (no invoices).
- Enable paid events with admin-selected registration mode (RSVP or PAY_NOW).
- Prevent invoice creation for free/sponsored events.

## Links
- Master Plan: `oneledger-events-master-plan.md`
- Reference: Invoice creation rules (in master plan)

## Requirements
- UI: Event form locks registrationMode to RSVP when price = 0; shows choice when price > 0.
- Backend: Validation rejects PAY_NOW if price = 0.
- Registration flows:
  - Free: create registration only, no invoice.
  - Paid + RSVP: registration only; invoices can be generated later.
  - Paid + PAY_NOW: registration + issued invoice immediately.
- Keep tenant-safety and role guards intact.

## Success Criteria
- Free event registration never creates invoices.
- Paid events respect selected mode.
- Member sees invoices only for paid PAY_NOW (or later bulk generation, Phase 4).

## QA Checklist
- [ ] Free event: registration works, no invoice created.
- [ ] Paid RSVP: registration works, no invoice created; status allows later invoicing.
- [ ] Paid PAY_NOW: registration creates issued invoice with source=EVT, correct amount.
- [ ] Validation blocks PAY_NOW on price=0.


