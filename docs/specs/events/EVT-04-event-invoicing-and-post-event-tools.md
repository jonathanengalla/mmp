# EVT-04 — Event Invoicing and Post-Event Tools

**Status:** 🟢 Done (Invoicing tools)  
**Owner:** Backend + Frontend  
**Related:** [oneledger-events-master-plan.md](./oneledger-events-master-plan.md), EVT-02, EVT-03  

---

## Goal

Enable admins to generate invoices for paid RSVP events after registrations have been collected. This closes the gap where RSVP events intentionally don't create invoices at registration time, allowing finance to properly track and collect event revenue.

---

## Business Requirements

### 1. Invoice Generation Eligibility

**Free events (`price = 0`):**
- Cannot generate invoices, ever
- Invoice actions must:
  - Not appear in the UI
  - Be blocked at the backend if called directly

**Paid events (`price > 0`):**
- **RSVP mode:**
  - Eligible for bulk and individual invoice generation
- **PAY_NOW mode:**
  - Invoices are already created at registration
  - Invoice generation tools must skip these registrations and avoid duplicates

### 2. Bulk Invoice Generation

**Business expectation:**
- Admin sees summary like: "X registrations, Y already invoiced, Z not yet invoiced"
- When they click "Generate invoices":
  - System creates one invoice per registration that:
    - Belongs to this event
    - Has no existing event invoice
    - Belongs to the current tenant
  - Each invoice:
    - Has `source = EVT`
    - Uses the event price as the invoice amount (source of truth)
    - Follows existing numbering scheme (`TENANT-YEAR-EVT-SEQ`)
  - Summary feedback confirms:
    - How many invoices were created
    - How many registrations were skipped (already invoiced)

**Guardrails:**
- Block entirely if event is free
- Do not create any zero-amount invoices
- Do not create multiple invoices for the same registration
- Respect existing rules that prevent hard-deleting events with invoices

### 3. Individual Invoice Generation

**Business expectation:**
- From the attendance report, admin can:
  - See a registration that has no invoice
  - Click action like "Generate invoice"
- System creates exactly one invoice for that registration:
  - Same rules as bulk:
    - `source = EVT`
    - Amount = event price
    - Follows existing numbering scheme
    - Linked to that registration
- After creation:
  - Registration shows that an invoice exists
  - Invoice appears in:
    - Member's invoice list
    - Finance dashboards

**Guardrails:**
- If invoice already exists, reject with clear message
- Same free/paid rules as above

---

## Technical Implementation

### Backend Endpoints

1. **POST `/admin/events/:eventId/invoices/generate`**
   - Bulk invoice generation for a paid RSVP event
   - Creates invoices for all registrations without invoices
   - Response:
     ```typescript
     {
       created: number;
       skipped: number;
       errors?: Array<{ registrationId: string; error: string }>;
       message: string;
     }
     ```

2. **POST `/admin/registrations/:registrationId/invoice`**
   - Individual invoice generation for a single registration
   - Response:
     ```typescript
     {
       invoice: {
         id: string;
         invoiceNumber: string;
         amountCents: number;
         status: string;
       };
       message: string;
     }
     ```

### Backend Logic

- Uses existing `createEventInvoice` from `billingStore.ts`
- Validates event price > 0 before allowing invoice generation
- Checks for existing invoices to prevent duplicates
- Links invoices to registrations via `EventRegistration.invoiceId`

### Frontend Integration

**Location:** `AdminEventAttendanceReportPage.tsx`

**Bulk action:**
- Button shown only for paid RSVP events
- Shows count of registrations without invoices
- Confirmation dialog before generation
- Success/error feedback via alert

**Individual action:**
- "Generate Invoice" button in Actions column
- Shown only for:
  - Paid events
  - RSVP mode
  - Registrations without invoices
- Confirmation dialog before generation
- Success/error feedback via alert

---

## UX Expectations

**Where actions live:**
- Bulk: Attendance report filters/actions bar
- Individual: Attendance report Actions column per row

**Visibility based on event type:**
- **Free event:**
  - No invoice generation actions in UI
- **Paid RSVP event:**
  - Bulk + per-registration actions visible
- **Paid PAY_NOW event:**
  - Bulk action hidden (all registrations already invoiced)
  - Per-registration "Generate invoice" hidden for already-invoiced entries

**Feedback:**
- Success toasts/alerts: "Created N invoices; skipped M already invoiced registrations"
- Error messages:
  - "Cannot generate invoices for free events"
  - "Invoice already exists for this registration"

---

## Acceptance Criteria

1. **Free events are fully protected**
   - ✅ No way for admin to generate invoices for free event via UI
   - ✅ Direct backend attempt is rejected (400 with `FREE_EVENT_NO_INVOICES`)

2. **Paid RSVP bulk generation works**
   - ✅ Given paid RSVP event with N registrations and 0 invoices:
     - Bulk action creates N invoices, each linked to registration
   - ✅ Given mix of invoiced and non-invoiced registrations:
     - Bulk action creates invoices only for non-invoiced ones
   - ✅ Finance dashboards reflect new invoices correctly

3. **Paid RSVP individual generation works**
   - ✅ For single registration without invoice:
     - "Generate invoice" creates exactly one invoice
     - Correct amount and numbering
     - Links back to registration
   - ✅ If invoice already exists:
     - Action returns 409 Conflict
     - Clear message that invoice already exists

4. **PAY_NOW events are respected**
   - ✅ Bulk and individual generation never create duplicate invoices
   - ✅ Helper messaging makes it clear that invoices already exist

5. **No regressions in existing flows**
   - ✅ Dues and donation invoices behave as before
   - ✅ Attendance marking remains independent from invoicing

---

## Automated Tests

### Backend Tests ✅

**Location:** `auth-service/tests/eventInvoiceHandlers.test.ts`

**Coverage:** 7 tests

**Test categories:**
1. **Bulk invoice generation (3 tests)**
   - ✅ Rejects free events
   - ✅ Creates invoices for registrations without invoices
   - ✅ Skips registrations that already have invoices

2. **Individual invoice generation (4 tests)**
   - ✅ Rejects free events
   - ✅ Creates invoice for registration without invoice
   - ✅ Rejects registration that already has invoice
   - ✅ Returns 404 for non-existent registration

**Run tests:**
```bash
cd auth-service
npm test eventInvoiceHandlers
```

**Note:** Tests require mocking `createEventInvoice` from `billingStore.ts`.

---

## Out of Scope (Future Work)

- **Thank-you/communications flows** (EVT-04B - separate ticket)
- Email notifications when invoices are generated
- Redesign of attendance report or admin events dashboard (beyond invoice actions)
- Changes to dues/donation invoice logic
- Automated "mark as attended when paid" behavior

---

## Implementation Notes

### Files Changed

**Backend:**
- `auth-service/src/eventInvoiceHandlers.ts` (new) - Bulk and individual invoice generation handlers
- `auth-service/src/server.ts` - Routes for invoice generation endpoints
- `auth-service/src/attendanceHandlers.ts` - Added `registrationMode` to attendance report response

**Frontend:**
- `frontend/pwa-app/src/api/client.ts` - API functions for invoice generation
- `frontend/pwa-app/src/pages/AdminEventAttendanceReportPage.tsx` - UI actions for bulk and individual generation

**Tests:**
- `auth-service/tests/eventInvoiceHandlers.test.ts` (new) - Backend test suite

### Invoice Numbering

- Uses existing `generateInvoiceNumber(tenantId, "EVT")` helper
- Format: `{TENANT}-{YEAR}-EVT-{SEQ}`
- Sequence maintained per tenant, per year

### Finance Integration

- New invoices use `source = "EVT"`
- Appear in existing finance dashboards and invoice lists
- Respect existing finance summary calculations

---

**Last Updated:** 2025-01-13
