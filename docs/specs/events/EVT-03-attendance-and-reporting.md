# EVT-03 — Attendance and Reporting
**Status:** Draft  
**Scope:** Manual attendance (check in / mark attended) and reporting

## Goals
- Track actual participation independently of invoices.
- Provide attendance report with summary + detail.

## Links
- Master Plan: `oneledger-events-master-plan.md`

## Requirements
- Registration gains `checkedInAt` timestamp toggle.
- Labels: “Check in” (in person), “Mark attended” (online); same endpoint.
- Attendance does not create/update invoices.
- Report:
  - Summary: event info, capacity, registrations, attended count/rate, paid/unpaid counts (if paid event).
  - Detail: member/guest, email, reg time, attendance time, invoice number/status (if any), actions (check in/undo, generate invoice for RSVP paid events).
- Free events: hide invoice columns.

## Success Criteria
- Attendance can be set/cleared without touching invoices.
- Report reflects attendance and invoice linkage for paid events; hides invoices for free events.

## QA Checklist
- [ ] Check in / undo works for in-person label.
- [ ] Mark attended / undo works for online label.
- [ ] Attendance persists and is independent of invoice status.
- [ ] Report shows correct counts and invoice links where applicable.


