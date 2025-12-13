# FIN-05 — Donations & Fundraising Reporting

**Status:** Draft  
**Related:**  
- Events: EVT-01–EVT-04  
- Backend: BKS-05 (Events persistence with billing linkage), BKS-04 (Billing/payments)  
- UI/Reporting: UIR-03 (Finance dashboard data contract alignment), BKS-06 (Audit & reporting data store, future)

## 1. Goals

- Give a clear view of donations and fundraising: who gave, to what campaign, and how it ties into overall revenue.
- Enable treasurers and board members to understand donation patterns and fundraising effectiveness.
- Provide simpler slice than full analytics, but enough for board reporting and donor recognition.

## 2. Business Context

- RCME and future tenants rely on donations and fundraising as a revenue source alongside Dues and Events.
- Board reporting requires clear visibility into donations: "We received X donations totaling Y amount this year."
- Donor recognition and stewardship require understanding who gave and when.
- Today, donation invoices exist (source = DONATION) but may not be clearly separated or analyzed in Finance views.
- This builds on FIN-01 (Event Finance Integration) by adding donation-specific reporting, not just invoice lists.

## 3. Scope (This Ticket)

- **In scope:**
  - Donation reporting views showing who gave, when, and how much.
  - Donation summaries (total donations, count, average donation amount).
  - Basic campaign or period grouping (if donation invoices include campaign metadata).
  - Donation trends (this month vs last month, this year vs last year).
  - Donor list or summary showing top donors or recent donations.
- **UI changes:**
  - Donation reporting page or section in Finance dashboard.
  - Donation summary tiles showing key metrics.
  - Donor list or table showing donation history.
- **Data contracts:**
  - Donation reporting endpoints return donation-specific data (who, when, how much, campaign if available).
  - Donation summaries support time-based filtering and grouping.

## 4. Out of Scope (For Now)

- Deep analytics, multi-year trend visualizations, or full BI layer.
- Complex fundraising campaign management or donor relationship management (CRM).
- Cross-tenant rollups (BKS-06 territory).
- Member-facing donation views (that is FIN-02 scope if needed).
- Automated donor recognition or thank-you workflows (may be future scope).

## 5. Business Rules & Behaviors (High Level)

- **Donation reporting should:**
  - Show donations (source = DONATION) as a distinct category from Dues and Events.
  - Include who gave (member information if available), when (donation date), and how much (amount).
  - Support basic campaign or period grouping if donation invoices include campaign metadata.
- **Donation summaries should:**
  - Show total donations, count of donations, and average donation amount.
  - Support time-based filtering (this month, this year, last 30 days).
  - Show trends (this month vs last month) if data is available.
- **Donor visibility should:**
  - Show top donors or recent donations for recognition purposes.
  - Help treasurers understand donation patterns (who gives regularly, who gives large amounts).
  - Respect privacy—donor information should only be visible to authorized roles (treasurer, admin).

## 6. Success Criteria

- Treasurer can see total donations, count, and average donation amount.
- Treasurer can see who gave, when, and how much (donor list or summary).
- Treasurer can filter donations by time period (this month, this year, last 30 days).
- Treasurer can explain donation patterns to the board: "We received X donations totaling Y amount this year."
- Donation reporting ties into overall revenue view (Dues / Donations / Events breakdown).

## 7. Risks & Dependencies

- **Dependencies:**
  - FIN-01 (Event Finance Integration) provides the Finance integration pattern that donations can follow.
  - BKS-04 (Billing/payments persistence) provides donation invoice/payment data.
  - Donation invoices must be properly tagged (source = DONATION) and include necessary metadata (campaign if applicable).
- **Risks:**
  - Privacy concerns if donor information is visible to unauthorized roles.
  - Performance if donation queries become too complex with grouping/filtering.
  - Data quality if donation invoices lack necessary metadata (campaign, donor information).

## 8. Open Questions

- How detailed should donor information be (name, email, donation history)?
- Should donations be grouped by campaign or period, or just shown as a list?
- How far back should we support historical donation data?
- Should donation reporting include donor recognition features (top donors, recent donors), or just financial summaries?
- Should donation reporting tie into member profiles, or be separate?
