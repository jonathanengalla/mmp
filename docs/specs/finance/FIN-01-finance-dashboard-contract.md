# FIN-01 — Finance Dashboard Contract & Metrics Alignment

**Status:** 🟢 Complete  
**Related:**
- Events: EVT-01–EVT-04 (Events stack with invoice creation)
- Backend: BKS-04 (Billing/payments persistence), BKS-05 (Events persistence with billing linkage)
- UI: UIR-03 (Finance dashboard data contract alignment)

## 1. Goals

Establish a **single source of truth** for finance dashboard metrics with:
- Clear data contract (request/response shape)
- Consistent breakdown by invoice source (DUES, DONATION, EVENT)
- Explicit time window awareness
- Zero-amount invoice exclusion (enforced at query level)
- Status mapping to business reporting buckets (OUTSTANDING, PAID, CANCELLED)
- Tenant safety (all queries scoped)

This ticket ensures the Finance dashboard has reliable, predictable numbers that align with Events stack rules (EVT-01–EVT-04) and won't break when invoice sources or statuses change.

## 2. Business Context

The Finance dashboard currently exists but was built before Events stack rules were fully locked. Issues observed:
- Zero-amount or "fake" invoices polluting totals
- Event-related invoices not clearly separated from Dues/Donations
- No explicit time window contract (unclear what period is shown)
- Inconsistent status handling across different views

FIN-01 establishes a **data contract** that:
- Excludes zero-amount invoices at the database query level
- Groups revenue by source (DUES, DONATION, EVENT) with separate totals
- Makes time windows explicit (e.g., "Year to Date", "All Time")
- Maps invoice statuses to business reporting categories
- Ensures tenant isolation

## 3. Scope (This Ticket)

### In Scope
- **Backend finance summary endpoint(s)** with documented JSON contract
- **Metrics v1:**
  - Total outstanding balance (all sources)
  - Total collected (within chosen time window)
  - Breakdown by source:
    - DUES: outstanding, collected
    - DONATION: collected
    - EVENT: outstanding, collected
  - Count of invoices by status (OUTSTANDING, PAID, CANCELLED/VOID)
- **Exclusion rules:**
  - Zero-amount invoices **never** counted
  - Cancelled/void invoices excluded from revenue but visible for audit
- **Time window support:**
  - Default: **Calendar year to date** (or Rotary year if configured)
  - Optional presets: ALL_TIME, LAST_12_MONTHS, CURRENT_MONTH
  - Custom date range via `from`/`to` query params
- **Documentation:**
  - Spec document (this file)
  - API contract details and test commands
- **Regression tests:**
  - Zero-amount exclusion
  - Source breakdown correctness
  - Status mapping
  - Time window filtering
  - Tenant isolation

### Out of Scope
- UI polish (colors, layout) — UIR-03
- CSV/PDF exports — FIN-04
- Deep analytics or multi-year trends
- Changes to how payments are created or captured
- Complex accounting concepts (deferred revenue, accruals)

## 4. API Contract

### Endpoint

**GET** `/api/billing/admin/finance/summary`

**Authentication:** Required (Bearer JWT with tenant claim)  
**Authorization:** ADMIN, OFFICER, or FINANCE_MANAGER role required

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | No | `YEAR_TO_DATE` | Time window preset: `YEAR_TO_DATE`, `ALL_TIME`, `LAST_12_MONTHS`, `CURRENT_MONTH` |
| `from` | ISO 8601 date | No | - | Custom range start (overrides `period` if provided) |
| `to` | ISO 8601 date | No | - | Custom range end (overrides `period` if provided) |

**Note:** If both `from` and `to` are provided, `period` is ignored. If only one is provided, the request is invalid (400).

### Response Shape

```typescript
{
  // Time window metadata (self-describing)
  range: {
    type: "YEAR_TO_DATE" | "ALL_TIME" | "LAST_12_MONTHS" | "CURRENT_MONTH" | "CUSTOM",
    from: string, // ISO 8601 date
    to: string,   // ISO 8601 date (or current date for open-ended ranges)
    label: string // Human-readable label, e.g., "Year to Date (Jan 1, 2025 - Dec 12, 2025)"
  },
  
  // Totals across all sources
  totals: {
    outstanding: {
      count: number,
      totalCents: number
    },
    collected: {
      count: number,
      totalCents: number
    },
    cancelled: {
      count: number,
      totalCents: number  // Excluded from revenue, shown for audit
    }
  },
  
  // Breakdown by source
  bySource: {
    DUES: {
      outstanding: {
        count: number,
        totalCents: number
      },
      collected: {
        count: number,
        totalCents: number
      }
    },
    DONATION: {
      collected: {
        count: number,
        totalCents: number
      }
      // Donations don't have "outstanding" in business model
    },
    EVENT: {
      outstanding: {
        count: number,
        totalCents: number
      },
      collected: {
        count: number,
        totalCents: number
      }
    },
    OTHER: {
      outstanding: {
        count: number,
        totalCents: number
      },
      collected: {
        count: number,
        totalCents: number
      }
    }
  },
  
  // Status breakdown (for audit visibility)
  byStatus: {
    OUTSTANDING: {
      count: number,
      totalCents: number
    },
    PAID: {
      count: number,
      totalCents: number
    },
    CANCELLED: {
      count: number,
      totalCents: number
    }
  }
}
```

### Status Mapping

Invoice statuses from database (`InvoiceStatus` enum) map to reporting buckets:

| Database Status | Reporting Bucket | Revenue Calculation |
|----------------|------------------|---------------------|
| `ISSUED` | OUTSTANDING | Included in outstanding totals |
| `PARTIALLY_PAID` | OUTSTANDING | Included in outstanding totals (remaining balance) |
| `OVERDUE` | OUTSTANDING | Included in outstanding totals |
| `PAID` | PAID | Included in collected totals |
| `VOID` | CANCELLED | Excluded from revenue, counted separately |
| `FAILED` | CANCELLED | Excluded from revenue, counted separately |
| `DRAFT` | CANCELLED | Excluded from revenue, counted separately |

**Note:** For `PARTIALLY_PAID`, outstanding amount = `amountCents - sum(payments.amountCents)`. Collected amount = `sum(payments.amountCents)`.

### Time Window Logic

**Default:** Calendar year to date (January 1 of current year to today)

**Presets:**
- `YEAR_TO_DATE`: January 1 of current year to today
- `ALL_TIME`: No date filter (all invoices)
- `LAST_12_MONTHS`: 12 months ago to today
- `CURRENT_MONTH`: First day of current month to today

**Custom range:** `from` and `to` must both be provided as ISO 8601 dates (YYYY-MM-DD).

**Date field used:** `issuedAt` (invoice creation/issue date) for period filtering.

### Zero-Amount Exclusion

**Enforced at query level:** All queries include `amountCents: { gt: 0 }` filter. Zero-amount invoices are never counted in any metric.

### Tenant Scoping

All queries are tenant-scoped via `tenantId` from authenticated user context. No cross-tenant data leakage.

## 5. Business Rules

1. **Zero-amount invoices:** Never counted in any metric (enforced at DB query level)
2. **Free events:** Never create invoices (enforced by EVT-02/EVT-04), so they never appear in finance metrics
3. **Event invoices:** Only counted when `source = 'EVT'` and `amountCents > 0`
4. **Cancelled/void invoices:** Excluded from revenue totals but visible in `byStatus.CANCELLED` for audit
5. **Partially paid invoices:** Outstanding = remaining balance; collected = sum of payments
6. **Donations:** Business model assumes donations are paid in full (no outstanding concept)

## 6. Implementation Notes

### Current State Audit

**Existing endpoint:** `/api/billing/admin/finance/summary` (line 379-532 in `billingHandlers.ts`)

**What works:**
- Zero-amount exclusion (`amountCents: { gt: 0 }`)
- Source breakdown (DUES, EVT, DONATION, OTHER)
- Tenant scoping
- Basic status aggregation

**What needs improvement:**
- No time window support (hardcoded "last 30 days" for some metrics)
- Status mapping not explicit (uses database statuses directly)
- Response shape not self-describing (no range metadata)
- Mixed date fields (`updatedAt` for paid, `issuedAt` not consistently used)

### Refactoring Plan

1. **Create time window resolver utility** (`utils/financePeriod.ts`)
   - Accept period enum or custom dates
   - Return resolved `from`/`to` dates and label
   - Testable with injected "now" date

2. **Create status mapper utility** (`utils/invoiceStatusMapper.ts`)
   - Map `InvoiceStatus` enum to reporting buckets (OUTSTANDING, PAID, CANCELLED)
   - Calculate outstanding amount for partially paid invoices

3. **Refactor `getFinanceSummaryHandler`**
   - Accept `period`, `from`, `to` query params
   - Use time window resolver
   - Apply date filter to `issuedAt` field consistently
   - Use status mapper for consistent reporting buckets
   - Return self-describing response with `range` metadata

4. **Add regression tests** (`tests/financeSummary.test.ts`)
   - Zero-amount exclusion
   - Source breakdown
   - Status mapping
   - Time window filtering
   - Tenant isolation

## 7. Test Commands

```bash
# Run FIN-01 regression tests
cd auth-service
npm run test:fin-01

# Or run specific test file
npm test -- tests/financeSummary.test.ts
```

## 8. Acceptance Criteria

1. ✅ **Stable contract:** Documented API contract exists and frontend can consume single JSON payload
2. ✅ **Correctness:** Zero-amount invoices never affect totals; free events never appear; source breakdown correct
3. ✅ **Time window clarity:** Response includes `range` object indicating which period was used
4. ✅ **Tenant safety:** All queries tenant-scoped; tests verify cross-tenant isolation
5. ✅ **Regression protection:** Test suite exists and will fail if business rules are violated

## 9. Frontend Impact Assessment

**Current frontend:** `AdminFinanceDashboardPage.tsx` calls `getFinanceSummary(token)`

**Changes required:**
- Update API client to accept optional `period`, `from`, `to` params
- Update dashboard to display `range.label` (e.g., "Finance Overview – Year to Date")
- Update metric display to use new response shape (`totals`, `bySource`, `byStatus`)
- Add period selector UI (optional for FIN-01, can be UIR-03)

**Estimated effort:** Low (response shape is additive, existing metrics map cleanly)

## 10. Open Questions

1. **Rotary year vs calendar year:** Does RCME use Rotary year (July 1 - June 30) or calendar year? **Assumption:** Calendar year for FIN-01; can be made configurable per tenant later.
2. **Date field for period filtering:** Use `issuedAt` (invoice creation) or `paidAt` (payment date)? **Decision:** `issuedAt` for period filtering (when invoice was created/issued). Collected totals still use `paidAt` for payment date filtering if needed.
3. **Legacy invoices with NULL source:** How to handle? **Decision:** Group under `OTHER` for now; backfill migration can be separate ticket.

## 11. Success Criteria

- Finance dashboard shows reliable, predictable numbers
- Zero-amount invoices never pollute totals
- Event invoices clearly separated from Dues/Donations
- Time window is explicit and user-visible
- Tests prevent regression when invoice sources or statuses change

## 12. Post-Implementation Fixes (2025-12-13)

### Issue: Revenue Breakdown Invoice Count Mismatch

**Problem:** Revenue Breakdown by Source showed 12 invoices while Status Breakdown and top totals showed 14 invoices. Two outstanding invoices were missing from the Revenue Breakdown.

**Root Causes Identified:**
1. **Source normalization incomplete:** Some invoice source values (e.g., "DON", "OTH", null/empty) were not being normalized correctly to match `bySource` keys (DUES, DONATION, EVENT, OTHER).
2. **Double-counting of partially paid invoices:** Partially paid invoices were being counted in both `totalOutstanding.count` and `totalCollected.count`, causing discrepancies.

**Fixes Applied:**
1. **Enhanced source normalization:**
   - Handles all source variations: `EVT`/`EVENT`, `DUES`/`DUE`, `DONATION`/`DON`, `OTHER`/`OTH`
   - Properly handles null, undefined, empty strings, and whitespace
   - All invoices now correctly mapped to source buckets

2. **Fixed double-counting:**
   - Partially paid invoices (OUTSTANDING status with collected amount > 0) are now counted only in `totalOutstanding.count`
   - Collected amount is added to `totalCollected.totalCents` but invoice is not double-counted
   - Matches Revenue Breakdown logic where partially paid invoices are counted once in outstanding

3. **Added validation and debug logging:**
   - Comprehensive logging for all outstanding invoices with source values
   - Validation checks that compare Revenue Breakdown totals to top-level totals
   - Error logging when mismatches are detected, including breakdown by source
   - Debug logs show which invoices are mapped to which source buckets

**Implementation Details:**
- Source normalization now handles: `null`, `undefined`, empty strings, whitespace, and all known variations
- Partially paid invoice counting logic aligned between top totals and Revenue Breakdown
- Validation ensures `bySource` outstanding/collected counts match `totals` counts
- All outstanding invoices are logged with their source values for debugging

**Verification:**
- Revenue Breakdown invoice count now matches Status Breakdown (excluding cancelled invoices)
- Top totals (outstanding + collected) match Revenue Breakdown totals
- All invoices correctly categorized by source regardless of source value format

---

**Last updated:** 2025-12-13

