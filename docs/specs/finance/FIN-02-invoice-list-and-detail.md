# FIN-02 — Invoice List & Detail Experience

**Status:** In Progress  
**Related:**
- Backend: FIN-01 (Finance Summary Contract)
- UI: UIR-03 (Finance Dashboard Alignment)
- Events: EVT-04 (Event Invoice Generation)

## 1. Goals

Make invoice list and detail views truly usable for admins and members by:

- Aligning with FIN-01 contract and business rules
- Making it easy to understand what is owed, what is paid, and where it came from
- Avoiding noise from zero-amount or legacy invoices
- Providing clear source context (dues, donations, events)

## 2. Business Rules (Reused from FIN-01)

- **Zero-amount invoices:** Excluded from all list views (enforced at query level)
- **Free events:** Never generate invoices, so event invoices always have `amountCents > 0`
- **Status mapping:** Collapse raw statuses into FIN-01 groups:
  - `OUTSTANDING`: ISSUED, PARTIALLY_PAID, OVERDUE
  - `PAID`: PAID (fully paid)
  - `CANCELLED`: VOID, FAILED, DRAFT
- **Source types:** DUES, DONATION, EVENT, OTHER (same enum as FIN-01)
- **Tenant scoping:** All queries scoped to authenticated user's tenant
- **Member scoping:** Member views only show own invoices (enforced at backend)

## 3. Backend API Contracts

### 3.1 Admin Invoice List

**Endpoint:** `GET /api/billing/admin/invoices`  
**Auth:** Requires ADMIN, OFFICER, or FINANCE_MANAGER role  
**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string or string[] | No | Filter by collapsed status: `OUTSTANDING`, `PAID`, `CANCELLED`. Supports array for multi-select (e.g., `?status=OUTSTANDING&status=PAID`) |
| `source` | string or string[] | No | Filter by source: `DUES`, `DONATION`, `EVENT`, `OTHER`. Supports array for multi-select |
| `period` | string | No | Time window preset: `YEAR_TO_DATE`, `CURRENT_MONTH`, `LAST_12_MONTHS`, `ALL_TIME`. Defaults to `ALL_TIME` if not specified |
| `from` | string (ISO 8601) | No | Custom start date (requires `to`) |
| `to` | string (ISO 8601) | No | Custom end date (requires `from`) |
| `search` | string | No | Search by invoice number, member name, member email (partial match, case-insensitive) |
| `sortBy` | string | No | Sort field: `issuedAt` (default), `dueAt`, `amountCents`, `memberName` |
| `sortOrder` | string | No | Sort direction: `ASC`, `DESC` (default: `DESC` for dates, `DESC` for amounts) |
| `page` | number | No | Page number (default: 1) |
| `pageSize` | number | No | Items per page (default: 50, max: 200) |

**Response:**

```typescript
{
  invoices: InvoiceListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  memberId: string;
  member: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  source: "DUES" | "DONATION" | "EVENT" | "OTHER";
  status: "OUTSTANDING" | "PAID" | "CANCELLED"; // Collapsed status
  rawStatus: "ISSUED" | "PARTIALLY_PAID" | "OVERDUE" | "PAID" | "VOID" | "FAILED" | "DRAFT"; // Raw status for detail
  amountCents: number;
  balanceCents: number; // Original amount minus sum of payments
  currency: string;
  issuedAt: string; // ISO 8601
  dueAt: string | null; // ISO 8601
  paidAt: string | null; // ISO 8601
  // Source context
  eventId: string | null;
  event: {
    id: string;
    title: string;
  } | null;
  description: string | null;
}
```

**Behavior:**
- Zero-amount invoices excluded (`amountCents > 0` filter)
- Period filtering uses `issuedAt` date by default
- Search matches across invoice number, member first/last name, member email
- Status filter maps raw statuses to collapsed groups server-side
- Default sort: `issuedAt DESC` (newest first)

### 3.2 Admin Invoice Detail

**Endpoint:** `GET /api/billing/admin/invoices/:id`  
**Auth:** Requires ADMIN, OFFICER, or FINANCE_MANAGER role

**Response:**

```typescript
interface InvoiceDetail {
  // All fields from InvoiceListItem plus:
  payments: PaymentRecord[];
  sourceContext: SourceContext;
}

interface PaymentRecord {
  id: string;
  amountCents: number;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  reference: string | null;
  processedAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  paymentMethod: {
    id: string;
    brand: string;
    last4: string;
  } | null;
}

interface SourceContext {
  type: "DUES" | "DONATION" | "EVENT" | "OTHER";
  // For EVENT invoices:
  event?: {
    id: string;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
  };
  // For DUES invoices:
  membershipYear?: string; // e.g., "2025"
  duesPeriod?: string; // e.g., "Annual"
  // For DONATION invoices:
  campaignName?: string | null;
}
```

**Behavior:**
- Returns all payments associated with the invoice (ordered by `createdAt DESC`)
- Includes source-specific context for rendering links or labels
- Returns 404 if invoice not found or not in user's tenant

### 3.3 Member Invoice List

**Endpoint:** `GET /api/billing/invoices/me`  
**Auth:** Requires authenticated member  
**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter: `OUTSTANDING` (default for Outstanding tab), `HISTORY` (for History tab, which maps to `PAID,CANCELLED`), or specific status |
| `period` | string | No | Time window: `YEAR_TO_DATE`, `CURRENT_MONTH`, `LAST_12_MONTHS`, `ALL_TIME` (default: `ALL_TIME`) |
| `page` | number | No | Page number (default: 1) |
| `pageSize` | number | No | Items per page (default: 50) |

**Response:**

Same structure as Admin Invoice List, but:
- Only returns invoices for the authenticated member
- No search parameter (member only sees own invoices)
- No sortBy (defaults to `issuedAt DESC`)

**Behavior:**
- Backend derives `memberId` from auth context (enforced, not from query param)
- `status=HISTORY` is interpreted as `status=PAID,CANCELLED` (array filter)
- Zero-amount invoices excluded

### 3.4 Member Invoice Detail

**Endpoint:** `GET /api/billing/invoices/me/:id`  
**Auth:** Requires authenticated member  
**Response:** Same as Admin Invoice Detail

**Behavior:**
- Returns 404 if invoice belongs to different member or different tenant
- All payment history included

## 4. Frontend UI Contracts

### 4.1 Admin Invoice List

**Page:** `/admin/invoices` (or existing route)  
**Components:**

1. **Filter Bar:**
   - Status filter: Multi-select dropdown (Outstanding, Paid, Cancelled) - defaults to all
   - Source filter: Multi-select dropdown (Dues, Donations, Events, Other) - defaults to all
   - Period selector: Dropdown with presets (Year to Date, Current Month, Last 12 Months, All Time) - defaults to All Time
   - Search input: Free-text search (debounced, 300ms)
   - Sort dropdown: Sort by (Issued Date, Due Date, Amount, Member Name) + Order (Newest First / Oldest First, Highest / Lowest)

2. **Invoice Table:**
   - Columns:
     - Invoice Number (link to detail)
     - Member Name (firstName + lastName, link to member profile if available)
     - Source (badge: Dues / Donation / Event / Other)
     - Status (badge with color: Outstanding / Paid / Cancelled)
     - Amount (formatted currency, e.g., ₱1,500.00)
     - Balance (formatted currency, only shown if status is OUTSTANDING)
     - Issued Date (formatted, e.g., "Jan 14, 2025")
     - Due Date (formatted, or "—" if none)
   - Row click: Navigate to invoice detail

3. **Pagination:**
   - Shows "Page X of Y" and total count
   - Previous/Next buttons
   - Optional: Page size selector

4. **Empty States:**
   - No invoices: "No invoices found"
   - Filtered results empty: "No invoices match your filters. Try adjusting your search criteria."

### 4.2 Admin Invoice Detail

**Page:** `/admin/invoices/:id`  
**Layout:**

1. **Header Section:**
   - Invoice Number (large, prominent)
   - Status badge (Outstanding / Paid / Cancelled)
   - Member name and email (link to member profile)

2. **Source Context Section:**
   - For Event invoices: "Event: [Event Title]" (link to event detail page)
   - For Dues invoices: "Membership: [Year]" or "Dues: [Period]"
   - For Donation invoices: "Donation" or "Campaign: [Name]" if available

3. **Amount Section:**
   - Original Amount: ₱X,XXX.XX
   - Payments Applied: List of payments with date, amount, status, reference
   - Remaining Balance: ₱X,XXX.XX (only if balance > 0)

4. **Meta Section:**
   - Issued Date
   - Due Date (or "No due date" if null)
   - Description / Notes (if any)

5. **Actions (if applicable):**
   - "Record Payment" button (if balance > 0)
   - "Void Invoice" button (if cancellable)
   - "Download PDF" button

### 4.3 Member Invoice List

**Page:** `/invoices` (existing route)  
**Components:**

1. **Tabs:**
   - Outstanding (default) - shows `status=OUTSTANDING`
   - History - shows `status=HISTORY` (backend interprets as PAID,CANCELLED)

2. **Period Filter (optional, in tab bar or separate dropdown):**
   - This Year (default for Outstanding)
   - All Time
   - Last 12 Months

3. **Invoice Table (simplified):**
   - Columns:
     - Invoice Number (link to detail)
     - Source (badge)
     - Amount (formatted)
     - Status (badge)
     - Due Date (formatted, or "—")
   - Row click: Navigate to invoice detail

4. **Empty States:**
   - Outstanding tab: "You have no outstanding invoices"
   - History tab: "You have no invoice history"

### 4.4 Member Invoice Detail

**Page:** `/invoices/:id`  
**Layout:**

Simplified version of Admin Detail:

1. **Header:**
   - Invoice Number
   - Status badge
   - Source label

2. **Amount Section:**
   - Original Amount
   - Payments Applied (list)
   - **Amount Due** (prominent callout if balance > 0)

3. **Dates:**
   - Issued Date
   - Due Date

4. **Actions:**
   - "Pay Now" button (if balance > 0) - links to payment flow

## 5. Implementation Notes

### 5.1 Backend Changes

**New/Modified Endpoints:**

1. **Admin Invoice List** (`listTenantInvoicesPaginatedHandler`):
   - Add period filtering using `resolveFinancePeriod` utility
   - Map raw statuses to collapsed FIN-01 statuses in response
   - Add `sortBy` and `sortOrder` parameters
   - Add `balanceCents` calculation (amountCents minus sum of payments)
   - Support array values for `status` and `source` filters
   - Ensure zero-amount exclusion is enforced

2. **Admin Invoice Detail** (`getInvoiceById` or new handler):
   - Include payment history (all payments for invoice)
   - Include source context (event details, membership year, etc.)
   - Calculate balance

3. **Member Invoice List** (`listMyInvoicesHandler`):
   - Add period filtering
   - Add status filtering (with `HISTORY` interpretation)
   - Map statuses to collapsed groups
   - Add pagination if not present

4. **Member Invoice Detail**:
   - Reuse Admin Detail handler but add member ownership check
   - Return 403/404 if invoice belongs to different member

### 5.2 Frontend Changes

1. **Refactor Admin Invoice List:**
   - Replace existing filters with new filter bar component
   - Update table columns to match spec
   - Integrate period selector (reuse from Finance Dashboard)
   - Add sort controls

2. **Create/Update Admin Invoice Detail:**
   - New page or refactor existing
   - Render all sections per spec
   - Add source context display with links

3. **Refactor Member Invoice List:**
   - Add Outstanding/History tabs
   - Simplify table columns
   - Add period filter

4. **Create/Update Member Invoice Detail:**
   - Simplified detail view
   - Prominent "Amount Due" callout

### 5.3 Status Mapping Function

Reuse status mapping logic from FIN-01:

```typescript
function mapInvoiceStatusToDisplayStatus(status: InvoiceStatus): "OUTSTANDING" | "PAID" | "CANCELLED" {
  if (status === "PAID") return "PAID";
  if (["VOID", "FAILED", "DRAFT"].includes(status)) return "CANCELLED";
  return "OUTSTANDING"; // ISSUED, PARTIALLY_PAID, OVERDUE
}
```

This should be shared between FIN-01 summary and FIN-02 list endpoints.

## 6. QA Scenarios

### Scenario 1: Admin Filtering and Search
**Steps:**
1. Navigate to Admin Invoice List
2. Set Status filter to "Outstanding"
3. Set Source filter to "Events"
4. Set Period to "Year to Date"
5. Enter search term: "RCME"

**Expected:**
- Only event invoices with OUTSTANDING status issued in current year matching "RCME" appear
- Zero-amount invoices excluded
- Table shows all required columns
- Pagination reflects filtered results

### Scenario 2: Source/Status Combinations
**Steps:**
1. Filter by Source: "Donations"
2. Filter by Status: "Paid"
3. Verify results

**Expected:**
- Only paid donation invoices appear
- Status badges show "Paid" (green)
- Source badges show "Donation"

### Scenario 3: Partially Paid Invoices
**Steps:**
1. Find an invoice with PARTIALLY_PAID raw status
2. View in list (should show as OUTSTANDING)
3. View detail page

**Expected:**
- List shows status badge: "Outstanding"
- Detail shows original amount, list of payments, remaining balance > 0
- Balance correctly calculated (original - sum of payments)

### Scenario 4: Event Invoices vs Dues vs Donations
**Steps:**
1. View invoice detail for:
   - An event invoice
   - A dues invoice
   - A donation invoice

**Expected:**
- Event invoice shows "Event: [Event Title]" with link to event
- Dues invoice shows membership year or period
- Donation invoice shows "Donation" or campaign name
- All show correct source badge

### Scenario 5: Member Outstanding vs History Tabs
**Steps:**
1. As a member, navigate to `/invoices`
2. Verify Outstanding tab shows only unpaid invoices
3. Switch to History tab

**Expected:**
- Outstanding tab shows invoices with status OUTSTANDING
- History tab shows invoices with status PAID or CANCELLED
- No invoices appear in both tabs
- Empty states show appropriate messages

## 7. Test Coverage

### Backend Tests

**File:** `auth-service/tests/fin02-invoice-list.test.ts`

**Test Cases:**
1. Filter by collapsed status (OUTSTANDING, PAID, CANCELLED) returns only matching invoices
2. Filter by source (DUES, DONATION, EVENT, OTHER) returns only matching invoices
3. Period filtering respects date boundaries (YTD, Current Month, etc.)
4. Zero-amount invoices excluded from all queries
5. Search matches on invoice number, member name, member email
6. SortBy and sortOrder work correctly
7. Pagination returns correct slices and total count
8. Tenant isolation (tenant A cannot see tenant B invoices)
9. Member endpoint only returns own invoices
10. Status mapping: raw statuses correctly map to collapsed groups
11. Balance calculation: balanceCents = amountCents - sum of payments
12. Detail endpoint includes payment history and source context

### Frontend Tests

**Files:**
- `frontend/pwa-app/src/tests/admin-invoice-list.test.tsx`
- `frontend/pwa-app/src/tests/member-invoice-list.test.tsx`

**Test Cases:**
1. Filters update query params and trigger refetch
2. Tab switching (member view) changes status filter
3. Empty state displays correctly
4. Pagination controls work
5. Detail view renders all sections
6. Source context links render correctly

### Test Commands

```bash
# Backend
cd auth-service
npm run test:fin02-invoice-list

# Frontend
cd frontend/pwa-app
npm test admin-invoice-list
npm test member-invoice-list
```

## 8. Migration Considerations

- Existing invoice list endpoints may have different response shapes
- Frontend may need to update TypeScript types
- Status badges in UI may need color/style updates
- Member views currently may not have Outstanding/History tabs

## 9. Dependencies

- FIN-01 status mapping function (reuse)
- FIN-01 period resolution utility (reuse)
- Existing invoice and payment models (Prisma schema)
- Event model for source context (already includes relation)

## 10. Backend Audit Summary

### Existing Endpoints

1. **Admin Invoice List** (`GET /api/billing/invoices/tenant`):
   - ✅ Basic filtering: `status`, `source`, `search`
   - ✅ Pagination: `page`, `pageSize`
   - ✅ Zero-amount exclusion: Already enforced (`amountCents: { gt: 0 }`)
   - ✅ Event context included in response
   - ❌ No period filtering (YTD, Current Month, etc.)
   - ❌ Status uses raw values, not collapsed FIN-01 groups
   - ❌ No `sortBy` / `sortOrder` parameters
   - ❌ No `balanceCents` calculation in response
   - ❌ Search includes event.title, but not member email properly

2. **Member Invoice List** (`GET /api/billing/invoices/me`):
   - ✅ Returns own invoices only (memberId from auth)
   - ✅ Includes event context
   - ❌ No filtering at all (status, period)
   - ❌ No pagination
   - ❌ Not aligned with FIN-01 status groups
   - ❌ Returns as `items` array, not paginated response

3. **Invoice Detail**:
   - ❌ **No endpoint exists** - only `getInvoiceById` in store (basic invoice only)
   - ❌ No payment history included
   - ❌ No source context expansion

### Required Changes

**New Endpoints:**
1. `GET /api/billing/admin/invoices/:id` - Admin invoice detail with payments and source context
2. `GET /api/billing/invoices/me/:id` - Member invoice detail (with member ownership check)

**Modified Endpoints:**
1. `GET /api/billing/invoices/tenant` - Add period filtering, status mapping, sortBy, balanceCents
2. `GET /api/billing/invoices/me` - Add filtering, pagination, status mapping

**Shared Utilities:**
1. Status mapping function (reuse from FIN-01 or create shared utility)
2. Period resolution (reuse from `financePeriod.ts`)
3. Balance calculation helper

### Data Model Observations

- ✅ Invoice model includes: `source`, `eventId`, `memberId`, `status`, `amountCents`, `issuedAt`, `dueAt`, `paidAt`
- ✅ Payment model includes: `invoiceId`, `amountCents`, `status`, `processedAt`, `paymentMethodId`
- ✅ Event relation exists on Invoice model
- ❓ Membership year / dues period: Not stored on Invoice - may need to derive from invoice number or add field
- ❓ Campaign names for donations: Not stored - may be null for now

### Indexes

- ✅ Existing indexes support filtering: `[tenantId, status]`, `[tenantId, source, status]`, `[tenantId, memberId]`
- ✅ Date indexes for period filtering: `[tenantId, status, updatedAt]`, `[source, status, updatedAt]`
- ⚠️ May need `[tenantId, issuedAt]` index for period filtering (check if `updatedAt` index is sufficient)

## 11. Open Questions / Decisions Needed

1. **Dues Period Labeling:** Do we have `membershipYear` or `duesPeriod` fields on invoices? If not, should we add them or derive from invoice number/description?

2. **Campaign Names for Donations:** Do donation invoices have campaign names? If not, is this a future enhancement?

3. **Payment Method Display:** Should we show full payment method details in detail view, or just brand/last4?

4. **Invoice PDF Download:** Is this out of scope for FIN-02, or should we include a basic download action?

5. **Sort Defaults:** Confirm default sort (currently `issuedAt DESC`). Should this be configurable per user preference?

---

**Last Updated:** 2025-01-14

