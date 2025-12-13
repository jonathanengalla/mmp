# EVT-03 — Attendance and Reporting

**Status:** 🟡 In Progress  
**Owner:** Backend + Frontend  
**Related:** [oneledger-events-master-plan.md](./oneledger-events-master-plan.md), EVT-01, EVT-02, EVT-04  

---

## Goal

Track actual participation for both in-person and online events, independent of invoices, with a comprehensive admin attendance report that provides summary metrics and detailed attendee information.

---

## Business Requirements

### 1. Attendance Model & Behaviors

- **Single source of truth:** `checkedInAt` timestamp on `EventRegistration`
- **Labels by event type:**
  - IN_PERSON → "Check in" / "Undo check-in"
  - ONLINE → "Mark attended" / "Undo attendance"
- **Business rules:**
  - Attendance never creates, updates, or cancels invoices
  - Attendance can be marked even if invoice is unpaid (especially for RSVP mode)
  - Undo must be possible to correct mistakes

### 2. Attendance Report — Summary Section

**Always shown:**
- Event basic info (title, type, when, location)
- Capacity (if set)
- Total registrations count
- Total attended count
- Attendance rate % (attended ÷ registrations)

**For paid events only:**
- Paid invoices count
- Unpaid invoices count
- Total collected (₱, formatted currency)

**For free events:**
- Invoice metrics hidden or neutralized

### 3. Attendance Report — Detail Table

**Columns:**
- Select checkbox
- Member name (firstName + lastName)
- Email
- Registration date/time
- Attendance status and timestamp (if attended)
- Invoice context (paid events only):
  - Invoice number (e.g., `RCME-YYYY-EVT-###`)
  - Invoice status (Paid, Issued/Unpaid)
  - Amount (₱)
- Actions:
  - Check in / Mark attended (based on event type)
  - Undo attendance
  - Generate invoice (EVT-04 scope, stub/hide if not ready)

### 4. Filters, Search, and Export

**Filters:**
- Attendance status: All / Attended / Not attended
- Payment status (paid events only): All / Paid / Unpaid / No invoice

**Search:**
- By member name or email (case-insensitive partial match)

**Bulk actions:**
- "Select all in current filtered view"
- "Mark all as attended" / "Check in all" (based on event type)

**Export:**
- CSV export of current filtered view
- Includes all visible columns
- Proper date formatting and currency formatting

### 5. Free vs Paid Behavior

**Free events (price = 0):**
- Registration + attendance only
- No invoices ever created or shown
- Attendance report hides/excludes invoice columns and metrics

**Paid events (price > 0):**
- Registration may or may not create invoices (depends on `registrationMode`)
- Attendance independent from payment
- Attendance report shows invoice context where available

---

## Technical Implementation

### Backend Endpoints

1. **GET `/admin/events/:eventId/attendance`**
   - Query params:
     - `attendanceStatus`: `all` | `attended` | `not-attended`
     - `paymentStatus`: `all` | `paid` | `unpaid` | `no-invoice` (paid events only)
     - `search`: string (member name or email)
     - `format`: `json` | `csv` (default: `json`)
   - Response:
     - `event`: event details including `eventType`, `priceCents`
     - `summary`: capacity, registrations, attended, attendance rate, paid/unpaid counts (if paid)
     - `attendees`: array of registration details with member, invoice info

2. **POST `/admin/attendance/:registrationId/mark`**
   - Sets `checkedInAt = now()`
   - Returns updated registration

3. **POST `/admin/attendance/:registrationId/undo`**
   - Sets `checkedInAt = null`
   - Returns updated registration

4. **POST `/admin/attendance/bulk-mark`**
   - Body: `{ registrationIds: string[] }`
   - Validates all IDs belong to same event
   - Sets `checkedInAt = now()` for all
   - Returns count of updated records

### Data Model

- `EventRegistration.checkedInAt: DateTime?` - nullable timestamp
- `EventRegistration.invoiceId: String?` - link to invoice (if exists)
- Invoice lookup: use `registration.invoiceId` (not `eventId + memberId`) for accuracy

### Frontend Components

- `AdminEventAttendanceReportPage.tsx`
  - Conditional rendering based on `event.eventType` and `event.priceCents`
  - Filters, search, bulk actions, CSV export
  - Styling aligned with EVT-05A dashboard polish

---

## Edge Cases & Constraints

1. **Invoice independence:** Attendance actions must never call invoice creation/update services
2. **Null handling:** `checkedInAt === null` means not attended
3. **Filter combinations:** Payment status filter hidden/disabled for free events
4. **Invoice lookup:** Use `registration.invoiceId` for accuracy (one registration = one invoice max)
5. **Bulk operations:** Idempotent (skipping already-marked registrations is acceptable)

---

## Success Criteria (QA Checklist)

### Free In-Person Event
- [ ] Registration creates no invoice
- [ ] "Check in" button works
- [ ] Attendance report shows registration and attendance only (no invoice columns)
- [ ] Finance dashboard does not reflect this event

### Free Online Event
- [ ] Registration creates no invoice
- [ ] "Mark attended" button works (not "Check in")
- [ ] Attendance report shows registration and attendance only
- [ ] Finance dashboard does not reflect this event

### Paid In-Person, RSVP Mode
- [ ] Registration creates no invoice
- [ ] "Check in" button works
- [ ] Attendance report shows invoice context (if invoices generated later via EVT-04)
- [ ] Attendance is tracked independently of invoice status

### Paid Online, PAY_NOW Mode
- [ ] Registration creates invoice immediately
- [ ] "Mark attended" button works
- [ ] Attendance report shows invoice context
- [ ] Attendance can be marked even if invoice is unpaid

### General
- [ ] Attendance can be set/cleared without touching invoices
- [ ] Filters work correctly (attendance status, payment status for paid events)
- [ ] Search works (member name, email)
- [ ] Bulk mark works for filtered selection
- [ ] CSV export includes all visible columns with proper formatting
- [ ] UI labels change correctly based on event type
- [ ] Invoice columns hidden for free events

---

## Follow-Up Work (EVT-04)

- Bulk invoice generation for RSVP events
- Individual invoice generation from attendance report
- "Generate invoice" button in actions column (currently stubbed/hidden)

---

## Implementation Notes

### Backend Changes

1. Update `getAttendanceReport` to accept query params and filter server-side
2. Fix invoice lookup to use `registration.invoiceId` instead of `eventId + memberId`
3. Add payment status filtering logic
4. Add CSV export endpoint (or query param `format=csv`)

### Frontend Changes

1. Add payment status filter dropdown (paid events only)
2. Update bulk action button label based on `event.eventType`
3. Change "Select All" to "Select All Filtered"
4. Improve CSV export formatting (dates, currency, null handling)
5. Polish UI to match EVT-05A dashboard styling (typography, spacing, colors)

---

## Testing Matrix

| Scenario | Registration | Invoice Created | Attendance | Invoice Column Visible |
|----------|-------------|----------------|------------|----------------------|
| Free IN_PERSON | Yes | No | Check in | No |
| Free ONLINE | Yes | No | Mark attended | No |
| Paid IN_PERSON RSVP | Yes | No (later via EVT-04) | Check in | Yes |
| Paid ONLINE PAY_NOW | Yes | Yes (immediate) | Mark attended | Yes |

---

**Last Updated:** 2025-01-12
