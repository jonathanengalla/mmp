# UIR-03 — Finance Dashboard Data Contract Alignment

**Status:** In Progress  
**Related:**
- Backend: FIN-01 (Event Finance Integration)
- UI Refinement: UIR-03 (this ticket)
- Events: EVT-01–EVT-04

## 1. Goals

Align the Admin Finance Dashboard UI with the FIN-01 backend contract so that:

1. All top-level numbers come directly from `/api/billing/admin/finance/summary`
2. The displayed time range is explicit and matches what the API is using
3. Zero-amount invoices and free events never "pollute" the dashboard
4. The dashboard is easier to read for non-technical Treasurers

## 2. API Contract (FIN-01)

### Endpoint
```
GET /api/billing/admin/finance/summary?period={PERIOD}&from={ISO_DATE}&to={ISO_DATE}
```

### Query Parameters
- `period` (optional): One of `YEAR_TO_DATE`, `ALL_TIME`, `LAST_12_MONTHS`, `CURRENT_MONTH`. Defaults to `YEAR_TO_DATE`
- `from` (optional): Custom start date (ISO 8601). Requires `to`.
- `to` (optional): Custom end date (ISO 8601). Requires `from`.

### Response Structure
```typescript
{
  range: {
    type: "YEAR_TO_DATE" | "ALL_TIME" | "LAST_12_MONTHS" | "CURRENT_MONTH" | "CUSTOM",
    from: string, // ISO 8601 date
    to: string,   // ISO 8601 date
    label: string // Human-readable label, e.g., "Year to Date (Jan 1, 2025 - Dec 13, 2025)"
  },
  totals: {
    outstanding: { count: number; totalCents: number },
    collected: { count: number; totalCents: number },
    cancelled: { count: number; totalCents: number }
  },
  bySource: {
    DUES: {
      outstanding: { count: number; totalCents: number },
      collected: { count: number; totalCents: number }
    },
    DONATION: {
      collected: { count: number; totalCents: number }
      // Note: Donations don't have outstanding in business model
    },
    EVENT: {
      outstanding: { count: number; totalCents: number },
      collected: { count: number; totalCents: number }
    },
    OTHER: {
      outstanding: { count: number; totalCents: number },
      collected: { count: number; totalCents: number }
    }
  },
  byStatus: {
    OUTSTANDING: { count: number; totalCents: number },
    PAID: { count: number; totalCents: number },
    CANCELLED: { count: number; totalCents: number }
  }
}
```

### Business Rules (Already Enforced by Backend)
- Zero-amount invoices (`amountCents <= 0`) are excluded from all totals
- Free events never generate invoices, so they never appear in finance totals
- Event revenue is only counted when `source = "EVT"` and `amountCents > 0`
- Outstanding = invoices with status ISSUED, PARTIALLY_PAID, or OVERDUE (amount minus payments)
- Collected = money actually received (PAID invoices + payments on PARTIALLY_PAID)
- Cancelled = VOID, FAILED, DRAFT statuses (visible but not revenue)

## 3. UI Mapping

### Header Section
- **Title**: "Finance Overview"
- **Subtitle**: Use `range.label` from API response (e.g., "Year to Date: Jan 1 – Dec 13, 2025")
- **Period Selector**: Dropdown/segmented control with presets:
  - Year to Date
  - Current Month
  - Last 12 Months
  - All Time

### Headline Cards (3 cards)
1. **Total Outstanding**
   - Amount: `totals.outstanding.totalCents`
   - Count: `totals.outstanding.count`
   - Label: "X invoices"

2. **Total Collected**
   - Amount: `totals.collected.totalCents`
   - Count: `totals.collected.count`
   - Label: "X invoices"

3. **Total Cancelled** (optional, visually de-emphasized if zero)
   - Amount: `totals.cancelled.totalCents`
   - Count: `totals.cancelled.count`
   - Label: "X invoices"

### Source Breakdown Section
Four rows/cards showing breakdown by source:

1. **Dues**
   - Outstanding: `bySource.DUES.outstanding`
   - Collected: `bySource.DUES.collected`

2. **Donations**
   - Collected: `bySource.DONATION.collected`
   - Note: Donations don't show outstanding (business rule)

3. **Events**
   - Outstanding: `bySource.EVENT.outstanding`
   - Collected: `bySource.EVENT.collected`

4. **Other**
   - Outstanding: `bySource.OTHER.outstanding`
   - Collected: `bySource.OTHER.collected`

Each source row shows both outstanding and collected (where applicable). If a bucket has zero invoices, it's still visible but visually muted.

### Status Breakdown Section (Optional)
Simple table showing:
- OUTSTANDING: count and total from `byStatus.OUTSTANDING`
- PAID: count and total from `byStatus.PAID`
- CANCELLED: count and total from `byStatus.CANCELLED`

## 4. Implementation Files

- `frontend/pwa-app/src/api/client.ts` - Update `getFinanceSummary` to accept period parameter
- `frontend/pwa-app/src/pages/AdminFinanceDashboardPage.tsx` - Refactor to use new contract
- `frontend/pwa-app/src/components/FinancePeriodSelector.tsx` (new) - Period selector component
- `frontend/pwa-app/src/utils/financeHelpers.ts` (new) - Mapping layer and helpers

## 5. Testing

### Unit Tests
- Test response-to-UI mapping function with mock API responses
- Verify zero-amount scenarios are handled gracefully
- Verify all period types render correct labels
- Verify currency formatting (PHP with peso sign)

### Regression Tests
- Ensure zero-amount invoices never appear in totals
- Ensure free events never contribute to revenue
- Verify that period changes update displayed data correctly

### Test File
- `frontend/pwa-app/src/tests/admin-finance-dashboard.test.tsx`

## 6. QA Scenarios

### Scenario 1: Mixed Invoice Types (Year to Date)
**Setup:**
- Create mix of dues, donations, and event invoices with different statuses
- Include some PAID, some ISSUED, some OVERDUE

**Verification:**
- Outstanding + Collected amounts make sense
- Source breakdown shows correct totals for each category
- Status breakdown shows correct counts

### Scenario 2: Period Filtering (Current Month)
**Setup:**
- Same data as Scenario 1

**Verification:**
- Switch to "Current Month" period
- Numbers change to reflect only invoices issued in current month
- Range label updates to show current month dates

### Scenario 3: Free Events Exclusion
**Setup:**
- Create free events with registrations (no invoices)
- Create paid events with invoices

**Verification:**
- Free events never appear in any finance totals
- Paid events show correctly in EVENT source breakdown

### Scenario 4: Cancelled Invoices
**Setup:**
- Create mix of PAID, ISSUED, and VOID invoices

**Verification:**
- Cancelled invoices appear in cancelled bucket
- Cancelled invoices do NOT add to Collected total
- Cancelled amounts are visible but clearly separated

## 7. Currency Formatting

Use existing `formatCurrency` utility from `frontend/pwa-app/src/utils/formatters.ts`:
- Format: `₱X,XXX.XX`
- No hardcoded currency symbols in new code
- Currency should come from invoice data (default to PHP)

## 8. Success Criteria

✅ All dashboard metrics come from FIN-01 `/finance/summary` endpoint  
✅ Period selector works and updates displayed data  
✅ Range label clearly shows current time window  
✅ Zero-amount invoices never appear in totals  
✅ Free events never contribute to revenue  
✅ Source breakdown shows Dues / Donations / Events / Other correctly  
✅ Status breakdown shows OUTSTANDING / PAID / CANCELLED correctly  
✅ UI is readable for non-technical Treasurers  
✅ No regressions in existing finance views

---

**Last Updated:** 2025-01-14

