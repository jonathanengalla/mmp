# FIN-03 — Treasurer Finance Dashboard & KPIs

**Status:** Draft  
**Related:**  
- Events: EVT-01–EVT-04  
- Backend: BKS-05 (Events persistence with billing linkage), BKS-04 (Billing/payments)  
- UI/Reporting: UIR-03 (Finance dashboard data contract alignment), BKS-06 (Audit & reporting data store, future)

## 1. Goals

- Define and surface core finance KPIs for the treasurer: totals and breakdowns for Dues / Donations / Events, paid vs outstanding, and simple trend or time filters.
- Give treasurers a clear, at-a-glance view of the organization's financial health across all revenue sources.
- Enable treasurers to explain the numbers to the board without needing to dig through raw data.

## 2. Business Context

- Treasurers need to understand the organization's financial position quickly: how much is coming in from Dues, Donations, and Events.
- Board reporting requires clear breakdowns: "We collected X from dues, Y from donations, Z from events this year."
- Today, Finance views may exist but may not clearly separate Events from Dues/Donations, or may lack simple KPIs that treasurers can use.
- This builds on FIN-01 (Event Finance Integration) by adding KPI summaries and trend views, not just raw invoice lists.

## 3. Scope (This Ticket)

- **In scope:**
  - Finance dashboard with KPI tiles/summary strips showing totals for Dues / Donations / Events.
  - Paid vs outstanding breakdowns for each revenue source.
  - Simple time filters (this month, this year, last 30 days) for KPI calculations.
  - Revenue mix visualization (e.g., "Dues: 60%, Events: 30%, Donations: 10%").
- **UI changes:**
  - Finance dashboard page updated with KPI tiles.
  - Summary strips showing key metrics at a glance.
  - Time filter controls for adjusting KPI time windows.
- **Data contracts:**
  - Finance summary endpoints return KPI data (totals, breakdowns, trends).
  - KPI calculations support time-based filtering.

## 4. Out of Scope (For Now)

- Deep analytics, multi-year trend visualizations, or full BI layer.
- Complex forecasting or predictive analytics.
- Cross-tenant rollups (BKS-06 territory).
- Member-facing Finance views (that is FIN-02 scope).
- Detailed invoice-level drill-downs (that is FIN-01 scope for filtering).

## 5. Business Rules & Behaviors (High Level)

- **KPI tiles should show:**
  - Total collected (paid) for Dues / Donations / Events separately.
  - Outstanding (unpaid) totals for each source.
  - Simple percentages or ratios (e.g., "60% of revenue from Dues").
- **Time filters should:**
  - Allow treasurers to see "this month", "this year", "last 30 days" views.
  - Update all KPIs consistently when time window changes.
- **Revenue mix should:**
  - Show how Dues / Donations / Events contribute to total revenue.
  - Help treasurers understand which revenue sources are growing or shrinking.
- **Free events should:**
  - Never appear in revenue KPIs (already enforced by EVT-02/EVT-04).
  - Be excluded from all financial calculations.

## 6. Success Criteria

- Treasurer can see at a glance: total collected from Dues, Donations, and Events.
- Treasurer can see outstanding amounts for each revenue source.
- Treasurer can filter KPIs by time period (this month, this year, last 30 days).
- Treasurer can explain revenue mix to the board: "X% from dues, Y% from events, Z% from donations."
- KPIs update correctly when time filters change.

## 7. Risks & Dependencies

- **Dependencies:**
  - FIN-01 (Event Finance Integration) must be complete so Events are visible in Finance.
  - BKS-04 (Billing/payments persistence) provides invoice/payment data for KPI calculations.
  - EVT-04 (Event Invoicing) ensures event invoices are properly tagged and queryable.
- **Risks:**
  - Performance if KPI calculations are too heavy (aggregating many invoices).
  - Incorrect calculations if free events are accidentally included in revenue.
  - Breaking existing Finance views if we change data contracts too broadly.

## 8. Open Questions

- How detailed should KPI breakdowns be (per-event detail, or aggregate Events total only)?
- Should KPIs show trends (e.g., "up 10% from last month") or just current totals?
- How far back should we support historical KPI data?
- Should KPIs include projections or forecasts, or just actuals?
