# FIN-01 — Event Finance Integration

**Status:** Draft  
**Related:**  
- Events: EVT-01–EVT-04  
- Backend: BKS-05 (Events persistence with billing linkage), BKS-04 (Billing/payments)  
- UI/Reporting: UIR-03 (Finance dashboard data contract alignment), BKS-06 (Audit & reporting data store, future)

## 1. Goals

- Ensure that event invoices (source = EVT) appear correctly segmented from Dues and Donations in Finance, and that free events never pollute revenue metrics. This ticket is the bridge between EVT-01–EVT-04 and the Treasurer's daily view of the numbers.
- Connect event invoices (source = EVT) cleanly into Finance views so the treasurer can see Dues / Donations / Events as separate slices.
- Align Finance dashboard and reporting with the Events stack (EVT-01–EVT-04) without rewriting existing invoice/payment infrastructure.

## 2. Business Context

- RCME and future tenants need clear financial visibility across all revenue sources: Dues, Donations, and Events.
- Today, event invoices exist (from EVT-04) but may not be cleanly separated in Finance views, making it hard for treasurers to understand the full picture.
- Free events (RSVP-only, no invoices) should never appear in revenue calculations, but paid events (PAY_NOW mode) create invoices that must be visible.
- This builds on the Events stack rather than rewriting it—we are making Events visible in Finance, not changing how Events work.

## 3. Scope (This Ticket)

- **In scope:**
  - Finance dashboard updates to show Events as a distinct category alongside Dues and Donations.
  - Invoice filtering and grouping by source (DUES, DONATION, EVT) in Finance views.
  - Revenue breakdowns that correctly exclude free events and include paid event invoices.
  - Data contract alignment so Finance endpoints can query event invoices (source = EVT) cleanly.
- **UI changes:**
  - Finance dashboard tiles/summary strips updated to include Events category.
  - Invoice lists and filters support source-based segmentation.
- **Data contracts:**
  - Finance summary endpoints return Events as a separate slice.
  - Invoice queries support source filtering for EVT invoices.

## 4. Out of Scope (For Now)

- Deep analytics, multi-year trend visualizations, or full BI layer.
- Cross-tenant rollups (BKS-06 territory).
- New payment rails or PSP integrations.
- Changes to how Events create invoices (that is EVT-04 scope).
- Member-facing Finance views (that is FIN-02 scope).

## 5. Business Rules & Behaviors (High Level)

- **Event invoices (source = EVT) should:**
  - Appear as a distinct category in Finance summaries, separate from Dues and Donations.
  - Be included in revenue totals only when paid (status = PAID).
  - Be excluded from revenue if the event was free (priceCents = 0) or if no invoice was created (RSVP mode for paid events).
- **Free events should:**
  - Never create invoices (already enforced by EVT-02/EVT-04).
  - Never appear in Finance revenue metrics.
- **Finance views should:**
  - Show Events as a clear, separate slice so treasurers can explain "we collected X from dues, Y from donations, Z from events."
  - Allow filtering by source so treasurers can drill into Events-only invoices.
  - Maintain existing Dues and Donations behavior—this ticket adds Events, it does not change existing Finance flows.

## 6. Success Criteria

- Treasurer can see Events as a distinct category in Finance dashboard summaries.
- Treasurer can filter invoices by source (DUES / DONATION / EVT) and see correct counts and totals.
- Revenue breakdowns correctly show Dues / Donations / Events as separate slices.
- Free events never appear in revenue calculations.
- Finance views remain stable for Dues and Donations (no regressions).

## 7. Risks & Dependencies

- **Dependencies:**
  - BKS-05 (Events persistence with billing linkage) must be complete so event invoices are properly linked.
  - EVT-04 (Event Invoicing) must be complete so event invoices exist in the system.
  - BKS-04 (Billing/payments persistence) provides the invoice/payment foundation.
- **Risks:**
  - Breaking existing Finance views if we change data contracts too broadly.
  - Free events accidentally included in revenue if filtering logic is incorrect.
  - Performance if Finance queries become too complex with Events added.

## 8. Open Questions

- Level of breakdown: per-event detail in Finance views, or aggregate Events total only?
- How far back should we support historical event invoice data in Finance views?
- Should Events appear in the same Finance dashboard tiles as Dues/Donations, or in a separate section?
