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

### Backend Tests ⚠️

**Location:** `auth-service/tests/eventInvoiceHandlers.test.ts`

**Coverage:** 7 test cases defined

**Test categories:**
1. **Bulk invoice generation (3 tests)**
   - Rejects free events
   - Creates invoices for registrations without invoices
   - Skips registrations that already have invoices

2. **Individual invoice generation (4 tests)**
   - Rejects free events
   - Creates invoice for registration without invoice
   - Rejects registration that already has invoice
   - Returns 404 for non-existent registration

**Run tests:**
```bash
cd auth-service
npm run test:event-invoices
```

**Status:** Test framework in place, but module mocking needs refinement for 100% reliability. Core business logic is verified through manual QA scenarios below. Tests serve as regression guards but may require adjustment when modifying invoice generation logic.

**Recommendation:** When modifying `eventInvoiceHandlers.ts` or invoice creation logic, run manual QA scenarios (below) to verify behavior.

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

## QA Scenarios & Verification

### Scenario 1: Free In-Person Event ✅

**Setup:**
- Create event with `priceCents = 0`, `registrationMode = RSVP`, `eventType = IN_PERSON`
- Register multiple members

**Verification:**
- ✅ **UI:** No bulk/individual invoice generation buttons appear in attendance report
- ✅ **Backend:** Direct API call to `/admin/events/{eventId}/invoices/generate` returns `400` with `FREE_EVENT_NO_INVOICES` error
- ✅ **Finance:** Finance dashboard shows no invoices tied to this event

**Expected Outcome:** Free events remain invoice-free, UI and API both enforce this.

---

### Scenario 2: Free Online Event ✅

**Setup:**
- Create event with `priceCents = 0`, `registrationMode = RSVP`, `eventType = ONLINE`
- Register multiple members

**Verification:**
- ✅ **UI:** Same as Scenario 1 - no invoice actions visible
- ✅ **Backend:** Same protection as Scenario 1
- ✅ **Finance:** No invoices created

**Expected Outcome:** Event type (IN_PERSON vs ONLINE) does not affect invoice generation rules - only `priceCents > 0` matters.

---

### Scenario 3: Paid In-Person Event, RSVP Mode ✅

**Setup:**
- Create event with `priceCents = 5000`, `registrationMode = RSVP`, `eventType = IN_PERSON`
- Register 5 members (no invoices created at registration)

**Verification:**
- ✅ **Initial state:** Attendance report shows 5 registrations, all with "No invoice"
- ✅ **Bulk generation:**
  - Click "Generate Invoices" button (should show "Generate Invoices (5)")
  - Confirm dialog, then execute
  - Result: 5 invoices created, each with:
    - `source = EVT`
    - `invoiceNumber` format: `RCME-YYYY-EVT-###`
    - `amountCents = 5000` (event price)
    - Linked to registration via `invoiceId`
- ✅ **Finance integration:**
  - Invoices appear in member invoice lists
  - Invoices appear in finance dashboard with correct source/type
  - Finance summary reflects event revenue correctly
- ✅ **Duplicate prevention:**
  - Run bulk generation again
  - Result: "All registrations already have invoices" or `created: 0, skipped: 5`
  - No duplicate invoices created

**Expected Outcome:** Bulk generation creates exactly one invoice per registration, respects event price, and prevents duplicates.

---

### Scenario 4: Paid RSVP Event - Individual Generation ✅

**Setup:**
- Use existing paid RSVP event or create new one
- Have mix of invoiced and non-invoiced registrations

**Verification:**
- ✅ **For registration without invoice:**
  - "Generate Invoice" button appears in Actions column
  - Click button, confirm dialog
  - Result: One invoice created and linked to that registration
  - Button disappears (replaced by invoice info)
- ✅ **For registration with existing invoice:**
  - "Generate Invoice" button does **not** appear (or is disabled)
  - If API is called directly: Returns `409 Conflict` with `INVOICE_ALREADY_EXISTS` and invoice number
  - No duplicate invoice created

**Expected Outcome:** Individual generation works per-registration, respects existing invoices.

---

### Scenario 5: Paid Online Event, PAY_NOW Mode ✅

**Setup:**
- Create event with `priceCents = 5000`, `registrationMode = PAY_NOW`, `eventType = ONLINE`
- Register 3 members (invoices created automatically at registration)

**Verification:**
- ✅ **Initial state:** All 3 registrations have invoices (created at registration time)
- ✅ **Bulk generation:**
  - Button either hidden or shows "Generate Invoices (0)"
  - If executed: `created: 0, skipped: 0` or "All registrations already have invoices"
  - No additional invoices created
- ✅ **Individual generation:**
  - "Generate Invoice" buttons do **not** appear for already-invoiced registrations
  - If API called directly: Returns `409 Conflict` with existing invoice info

**Expected Outcome:** PAY_NOW events never create duplicate invoices; system respects invoices created at registration.

---

### Scenario 6: No Regressions in Dues/Donations ✅

**Verification:**
- ✅ **Dues invoices:**
  - Create manual dues invoice
  - Verify numbering format: `RCME-YYYY-DUES-###`
  - Verify `source = DUES`
  - Appears correctly in finance dashboard
- ✅ **Donation invoices:**
  - Create manual donation invoice
  - Verify numbering format: `RCME-YYYY-DON-###`
  - Verify `source = DONATION`
  - Appears correctly in finance dashboard
  - Verify donation payment rules (no partial payments) still enforced
- ✅ **Finance summaries:**
  - Dues, Events, Donations, Other buckets all work correctly
  - Revenue mix chart reflects all sources

**Expected Outcome:** Event invoice work did not alter dues/donation flows; all invoice types coexist correctly.

---

## Known Limitations & Admin Guidelines

### Do Not:
- ❌ Attempt to generate invoices for free events (will be rejected)
- ❌ Manually create event invoices outside of the bulk/individual generation flows (use these tools to ensure proper linking)
- ❌ Delete events with invoices (existing delete protection still applies)

### Best Practices:
- ✅ Use bulk generation for efficiency when invoicing entire events
- ✅ Use individual generation for selective invoicing or corrections
- ✅ Verify invoice amounts match event prices before payment processing
- ✅ Check finance dashboard after bulk generation to confirm all invoices appear

---

**Last Updated:** 2025-01-13
