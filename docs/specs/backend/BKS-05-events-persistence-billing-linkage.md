# BKS-05: Events Persistence with Billing Linkage

**Status:** ✅ Complete  
**Date:** 2025-01-14  
**Purpose:** Backend stabilization and documentation of event ↔ registration ↔ invoice relationships

## Overview

This document audits and locks in the relationships between Events, EventRegistrations, and Invoices, ensuring all event-related billing flows are tenant-safe, aligned with FIN-01/FIN-02 contracts, and protected by regression tests.

## Relationship Map

```
Tenant
  └── Event (tenantId)
        ├── priceCents, registrationMode (RSVP | PAY_NOW), status
        ├── invoices[] ──► Invoice (eventId, source = 'EVT')
        │                      ├── amountCents, status
        │                      └── tenantId
        └── registrations[] ──► EventRegistration (eventId)
                                  ├── memberId, checkedInAt
                                  └── invoiceId? ──► Invoice (bidirectional link)
```

### Key Relationships

1. **Event → Invoice (Direct)**
   - `Invoice.eventId` → `Event.id` (nullable FK)
   - All event invoices have `source = 'EVT'`
   - Enforced at application level (not DB constraint)

2. **EventRegistration → Invoice (Bidirectional)**
   - `EventRegistration.invoiceId` → `Invoice.id` (nullable FK)
   - `Invoice.eventRegistrations[]` (inverse relation)
   - Every event invoice should have at least one registration reference

3. **Linkage Completeness**
   - Event invoice MUST have:
     - `source = 'EVT'` (hardcoded in `createEventInvoice`)
     - `eventId` (direct link to event)
     - At least one `EventRegistration` with `invoiceId` pointing to it (enforced by business logic)

## Event Invoice Creation Matrix

| Path | Trigger | Source | Registration Link | Event Link | Zero-Amount Guard | Free Event Guard |
|------|---------|--------|-------------------|------------|-------------------|------------------|
| PAY_NOW registration | `POST /events/:id/register` | EVT (hardcoded) | Yes (created atomically) | Via `eventId` param | `amount > 0` check | `priceCents > 0` check |
| Bulk invoice gen | `POST /admin/events/:id/invoices/generate` | EVT (hardcoded) | Yes (existing regs) | Via `eventId` param | `event.priceCents > 0` | `priceCents <= 0` → 400 |
| Individual invoice gen | `POST /admin/registrations/:id/invoice` | EVT (hardcoded) | Yes (specific reg) | Via registration.eventId | `event.priceCents > 0` | `priceCents <= 0` → 400 |
| Event checkout (legacy) | `POST /events/:id/checkout` | EVT (hardcoded) | Yes (via `linkInvoiceToRegistration`) | Via `eventId` param | `amount > 0` check | `amount <= 0` → no invoice |

### Code Path Verification

**All paths verified:**
- ✅ `source` is hardcoded to `'EVT'` in `createEventInvoice()` (billingStore.ts:82)
- ✅ Tenant is derived from auth context, never from request body
- ✅ Event and registration IDs are validated before invoice creation
- ✅ Free event guards exist in all three creation paths

## Invariants

### 1. Free Event Protection
- **Rule:** `event.priceCents === 0` → invoice creation rejected at service layer
- **Enforcement:** Guards in:
  - PAY_NOW registration: `if (regMode === "pay_now" && amount > 0)` (eventsHandlers.ts:661)
  - Bulk generation: `if (!event.priceCents || event.priceCents <= 0)` (eventInvoiceHandlers.ts:26)
  - Individual generation: `if (!registration.event.priceCents || registration.event.priceCents <= 0)` (eventInvoiceHandlers.ts:167)

### 2. RSVP Registration Behavior
- **Rule:** `registrationMode === 'RSVP'` → registration handler does NOT call invoice service
- **Enforcement:** `registerEventHandler` only creates invoice when `regMode === "pay_now" && amount > 0` (eventsHandlers.ts:661)
- **Invoice creation:** Only via EVT-04 endpoints (bulk/individual generation)

### 3. PAY_NOW Registration Behavior
- **Rule:** `registrationMode === 'PAY_NOW'` → registration handler creates invoice atomically
- **Enforcement:** Invoice created before registration is persisted (eventsHandlers.ts:663-671)
- **Transaction safety:** If registration fails, invoice is orphaned (acceptable trade-off for simplicity)
- **Duplicate prevention:** Existing registration check prevents double-billing (eventsHandlers.ts:652)

### 4. Duplicate Prevention
- **Rule:** Registration with existing `invoiceId` → individual generation rejected
- **Enforcement:** `if (registration.invoice)` check returns 409 (eventInvoiceHandlers.ts:177)
- **Bulk generation:** Skips registrations with `invoiceId: { not: null }` (eventInvoiceHandlers.ts:40, 74-84)

### 5. Linkage Completeness
- **Rule:** Every invoice with `source = 'EVT'` has:
  - Non-null `eventId`
  - At least one `EventRegistration` with `invoiceId` pointing to it
- **Enforcement:** 
  - `createEventInvoice` requires `eventId` (billingStore.ts:67)
  - Registration linking happens immediately after invoice creation in all paths

### 6. Source Field Integrity
- **Rule:** All event invoices have `source = 'EVT'` (hardcoded, never parameterized)
- **Enforcement:** `createEventInvoice` sets `source: "EVT"` (billingStore.ts:82)

### 7. Tenant Isolation
- **Rule:** All queries include tenant filter; cross-tenant ID access returns 404
- **Enforcement:** 
  - All Prisma queries use `tenantId` in where clause
  - `applyTenantScope` utility used where applicable
  - Cross-tenant access returns 404 (not 403) to avoid leaking existence

### 8. Delete/Cancel Behavior
- **Delete:** Blocked when `invoiceCount > 0` OR `registrationCount > 0` (eventsHandlers.ts:454-466)
- **Cancel:** Sets `event.status = 'CANCELLED'`, does NOT modify invoices or registrations (eventsHandlers.ts:479)

## Test Coverage

**Test File:** `auth-service/tests/bks05-events-billing-linkage.test.ts`

**Test Command:**
```bash
cd auth-service
npm run test:bks05-events-billing
```

### Test Cases

1. **Free Event Protection**
   - ✅ PAY_NOW registration on free event → rejected
   - ✅ Bulk invoice gen on free event → rejected (400 FREE_EVENT_NO_INVOICES)
   - ✅ Individual invoice gen for free event registration → rejected (400 FREE_EVENT_NO_INVOICES)

2. **RSVP Registration Behavior**
   - ✅ Registration does not create invoice
   - ✅ Invoice only via EVT-04 paths (bulk/individual)

3. **PAY_NOW Registration Behavior**
   - ✅ Creates invoice atomically
   - ✅ Duplicate registration does not double-bill
   - ✅ Invoice has correct source, eventId, and registration link

4. **Invoice Linkage Integrity**
   - ✅ All EVT invoices have registration reference
   - ✅ Source is always 'EVT'
   - ✅ EventId is always set for event invoices

5. **Delete/Cancel Behavior**
   - ✅ Event with invoices cannot be deleted (400 EVENT_HAS_ACTIVITY)
   - ✅ Event with registrations cannot be deleted (400 EVENT_HAS_ACTIVITY)
   - ✅ Cancelled event preserves invoices (no modification)

6. **Tenant Isolation**
   - ✅ Cross-tenant event access rejected (404)
   - ✅ Cross-tenant registration access rejected (404)
   - ✅ Cross-tenant invoice access rejected (404)

7. **Duplicate Prevention**
   - ✅ Individual generation fails if invoice exists (409 INVOICE_ALREADY_EXISTS)
   - ✅ Bulk generation skips registrations with existing invoices

8. **Finance Alignment**
   - ✅ Event invoices appear in FIN-01 EVENT source bucket
   - ✅ Amounts match between invoice creation and finance summary

**Test Status:** ✅ All tests passing

## Known Limitations

### Intentionally Deferred
- **Refunds:** No refund flow for event invoices (future ticket)
- **Partial Credits:** No partial credit system (future ticket)
- **Discounts:** No discount/coupon system (future ticket)
- **Invoice Modifications:** Event invoices cannot be modified after creation (by design)

### Transaction Safety Trade-offs
- **PAY_NOW registration:** If invoice creation succeeds but registration fails, invoice is orphaned. This is acceptable because:
  - Registration failure is rare (DB constraint violations)
  - Orphaned invoices can be manually cleaned up
  - Full transaction wrapping would add complexity

### Legacy Fields
- **Invoice.eventId:** Direct link to event (denormalized for performance)
- **EventRegistration.invoiceId:** Bidirectional link (allows querying from either direction)
- Both fields are used and maintained, no ambiguity

## QA/Gate Checklist

### Manual Verification (rcme-dev)

1. **Free Event Protection**
   - [ ] Create free event, attempt PAY_NOW registration → no invoice created
   - [ ] Attempt bulk invoice generation for free event → 400 error
   - [ ] Attempt individual invoice generation for free event registration → 400 error

2. **RSVP Flow**
   - [ ] Register for paid RSVP event → no invoice at registration
   - [ ] Generate invoices via bulk tool → invoices created
   - [ ] Attempt duplicate generation → skipped/errors handled

3. **PAY_NOW Flow**
   - [ ] Register for paid PAY_NOW event → invoice created immediately
   - [ ] Verify invoice has `source = 'EVT'`, `eventId`, and registration link
   - [ ] Attempt duplicate registration → prevented

4. **Delete/Cancel**
   - [ ] Attempt to delete event with invoices → 400 EVENT_HAS_ACTIVITY
   - [ ] Cancel event with invoices → invoices preserved, event status = CANCELLED

5. **Tenant Isolation**
   - [ ] Attempt cross-tenant event access → 404
   - [ ] Attempt cross-tenant invoice generation → 404

6. **Finance Alignment**
   - [ ] Create event invoices via EVT-04
   - [ ] Query FIN-01 summary → event invoices appear in EVENT bucket
   - [ ] Verify amounts match

## Implementation Notes

### Code Locations

- **Invoice Creation:** `auth-service/src/billingStore.ts::createEventInvoice()`
- **PAY_NOW Registration:** `auth-service/src/eventsHandlers.ts::registerEventHandler()` (lines 656-717)
- **Bulk Invoice Generation:** `auth-service/src/eventInvoiceHandlers.ts::bulkGenerateEventInvoices()`
- **Individual Invoice Generation:** `auth-service/src/eventInvoiceHandlers.ts::generateRegistrationInvoice()`
- **Delete Guard:** `auth-service/src/eventsHandlers.ts::deleteEventHandler()` (lines 454-466)
- **Cancel Handler:** `auth-service/src/eventsHandlers.ts::cancelEventHandler()` (line 479)

### Database Schema

- **Event.invoices:** One-to-many relation via `Invoice.eventId`
- **Event.registrations:** One-to-many relation via `EventRegistration.eventId`
- **EventRegistration.invoice:** Optional one-to-one relation via `EventRegistration.invoiceId`
- **Invoice.eventRegistrations:** One-to-many relation (inverse of `EventRegistration.invoiceId`)

All relations are tenant-scoped via composite keys.

---

**Last Updated:** 2025-01-14  
**Related Tickets:** EVT-01, EVT-02, EVT-04, FIN-01, FIN-02

