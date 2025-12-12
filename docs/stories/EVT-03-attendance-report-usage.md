# Story: EVT-03 Attendance Report Usage
**Purpose:** Validate attendance tracking and reporting for paid and free events.

## Scenario
- Paid RSVP event (Workshop, price > 0)
- Free event (Webinar, price = 0)

## Steps (Admin)
1) Open attendance report for Workshop.
2) Check in a member; verify `checkedInAt` is set and displayed.
3) Ensure invoice column shows invoice status for paid event.
4) Generate invoice for an RSVP registration without invoice (if applicable).
5) Toggle attendance off; verify it clears.
6) Open attendance report for Webinar (free).
7) Verify invoice column is hidden/not applicable.
8) Mark attended; confirm it saves.

## Expected
- Attendance toggle works independently of invoice status.
- Paid event report shows invoice linkage; free event hides invoices.
- No invoices are generated for free events through attendance actions.


