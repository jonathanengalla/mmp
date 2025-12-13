# FIN-04 — Treasurer Exports & Audit Trail

**Status:** Draft  
**Related:**  
- Events: EVT-01–EVT-04  
- Backend: BKS-05 (Events persistence with billing linkage), BKS-04 (Billing/payments)  
- UI/Reporting: UIR-03 (Finance dashboard data contract alignment), BKS-06 (Audit & reporting data store, future)

## 1. Goals

- Provide CSV/Excel exports and a basic audit trail that finance can use for reconciliation and annual reporting.
- Enable treasurers to export financial data for external tools (accounting software, spreadsheets).
- Give treasurers confidence that they can trace what happened and when for financial records.

## 2. Business Context

- Treasurers need to reconcile financial records with bank statements and accounting systems.
- Annual reporting requires detailed financial data that can be exported and analyzed.
- Without exports, treasurers must manually copy data, which is error-prone and time-consuming.
- Audit trails help treasurers answer questions like "when was this invoice paid?" or "who marked this attendance?"
- This builds on FIN-01 and FIN-03 by providing the data export and audit capabilities that treasurers need for real-world finance work.

## 3. Scope (This Ticket)

- **In scope:**
  - CSV/Excel export functionality for invoices, payments, and financial summaries.
  - Basic audit trail showing key financial events (invoice created, payment recorded, invoice status changed).
  - Export filters matching Finance dashboard filters (by source, time period, status).
  - Audit trail views showing who did what and when for financial records.
- **UI changes:**
  - Export buttons/actions in Finance dashboard and invoice lists.
  - Audit trail page or section showing financial event history.
  - Export format selection (CSV vs Excel if both supported).
- **Data contracts:**
  - Export endpoints return properly formatted CSV/Excel data.
  - Audit trail endpoints return financial event history with timestamps and actor information.

## 4. Out of Scope (For Now)

- Deep analytics or complex data visualizations in exports.
- Custom export templates or formatting beyond standard CSV/Excel.
- Full audit trail for all system events (that is BKS-06 territory).
- Member-facing exports (that is FIN-02 scope if needed).
- Automated reconciliation with external accounting systems.

## 5. Business Rules & Behaviors (High Level)

- **Exports should:**
  - Include all data visible in the current Finance view (respecting filters).
  - Use standard formats (CSV for simple data, Excel for formatted reports).
  - Include proper headers and date formatting for external tools.
  - Support filtering by source (DUES / DONATION / EVT), time period, and status.
- **Audit trail should:**
  - Show key financial events: invoice created, payment recorded, invoice status changed, attendance marked (if it affects invoices).
  - Include timestamps and actor information (who did what, when).
  - Be filterable by date range and event type.
  - Help treasurers trace financial records for reconciliation.
- **Export data should:**
  - Match what treasurers see in Finance views (no surprises).
  - Be reliable and consistent (same query logic as Finance views).
  - Include all necessary fields for reconciliation (invoice numbers, amounts, dates, statuses).

## 6. Success Criteria

- Treasurer can export invoices, payments, and financial summaries to CSV/Excel.
- Exports include all data visible in current Finance view (respecting filters).
- Exports are properly formatted for external tools (accounting software, spreadsheets).
- Treasurer can view audit trail showing key financial events with timestamps and actors.
- Audit trail helps treasurer trace financial records for reconciliation and reporting.

## 7. Risks & Dependencies

- **Dependencies:**
  - FIN-01 (Event Finance Integration) must be complete so Events are visible in exports.
  - FIN-03 (Treasurer Finance Dashboard & KPIs) provides the Finance views that exports mirror.
  - BKS-04 (Billing/payments persistence) provides invoice/payment data for exports.
  - BKS-06 (Audit & reporting data store) may provide audit trail infrastructure when available.
- **Risks:**
  - Performance if exports query large datasets without proper pagination or limits.
  - Data consistency if export queries differ from Finance view queries.
  - Export format issues if CSV/Excel formatting is not compatible with external tools.

## 8. Open Questions

- How detailed should exports be (invoice-level detail, or aggregate summaries)?
- Should exports include payment method information, or just payment amounts and dates?
- How far back should we support historical data in exports?
- Should audit trail show all financial events, or only key events (invoice created, payment recorded)?
- Should exports be downloadable immediately, or queued for large datasets?
