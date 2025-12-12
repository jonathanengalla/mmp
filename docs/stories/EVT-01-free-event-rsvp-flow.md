# Story: EVT-01 Free Event RSVP Flow
**Purpose:** Validate free event registration has no invoices and supports attendance.

## Scenario
- Event: Coffee Meetup (price = 0, RSVP)
- User: Member

## Steps (Member)
1) Open Events page; locate Coffee Meetup.
2) Click Register.
3) Confirm registration success; no invoice created.
4) Verify My Events shows the registration.

## Steps (Admin)
1) Open admin events dashboard; open Coffee Meetup detail/report.
2) Verify registration count reflects the member.
3) Confirm invoice list has no invoices for this event.
4) Mark attendance (Check in / Mark attended); verify status toggles.

## Expected
- No invoices created (finance metrics unchanged).
- Registration present; attendance toggle works.
- Free event hidden from revenue mix/outstanding.


