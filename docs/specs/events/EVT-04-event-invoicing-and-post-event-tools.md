# EVT-04 — Event Invoicing and Post-Event Tools
**Status:** Draft  
**Scope:** Bulk/individual invoicing for paid RSVP events; post-event comms (future)

## Goals
- Allow admins to generate invoices after registration for paid RSVP events.
- Support individual invoice creation for specific registrations.
- Prep for thank-you/communications flows.

## Links
- Master Plan: `oneledger-events-master-plan.md`

## Requirements
- Block bulk invoicing for free events.
- Bulk generation: create invoices for registrations without event invoices; amount = event price; source=EVT; status=ISSUED.
- Individual generation: per-registration action to create/link one invoice.
- Respect existing delete/cancel rules; no hard delete of events with invoices.
- Comms (future): thank-you messaging based on attendance/paid status.

## Success Criteria
- Paid RSVP events: bulk/individual invoice creation works; free events blocked.
- Invoices follow numbering and source rules; appear in finance dashboards.
- No duplicate invoices for already-invoiced registrations.

## QA Checklist
- [ ] Bulk invoicing skips free events and already-invoiced registrations.
- [ ] Individual invoicing creates one invoice and links it.
- [ ] Finance metrics reflect new invoices; zero-amount never created.
- [ ] Delete/cancel rules remain enforced with invoices present.


