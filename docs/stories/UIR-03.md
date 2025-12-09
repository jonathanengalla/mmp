# UIR-03 — Finance dashboard data contract alignment

- **Problem summary**: Finance dashboard expects `amountCents`, `paidAt`, `source`, and other fields not consistently provided by backend.
- **Goal**: Align UI data contracts with stabilized billing endpoints and handle errors/loading gracefully.
- **Scope**
  - Update client models and fetchers to match BKS-04/06 fields (amountCents, currency, paidAt, source, paymentMethod).
  - Add loading/error states for dues, invoices, events panels; remove assumptions on mock data.
  - Adjust rendering for statuses and money formatting based on returned data.
- **Out of scope**
  - New analytics or charts.
- **Acceptance criteria**
  - Finance dashboard loads from live API without mock fallbacks; handles empty/error states.
  - Field names/types match backend; no runtime errors when fields are missing/null.
  - Snapshot/QA confirms values display correctly post-BKS alignment.
- **Dependencies**: BKS-04, BKS-06.


