# FIN-02 — Member Invoice & Receipts Experience

**Status:** Draft  
**Related:**  
- Events: EVT-01–EVT-04  
- Backend: BKS-05 (Events persistence with billing linkage), BKS-04 (Billing/payments)  
- UI/Reporting: UIR-03 (Finance dashboard data contract alignment), BKS-06 (Audit & reporting data store, future)

## 1. Goals

- Members should be able to log in and immediately understand which invoices are Dues, which are Donations, and which are Events, and easily see what is outstanding vs completed.
- Polish the member-facing invoice list with clearer labels, better grouping, and basic receipt visibility.
- Help members understand what they owe and what they have already paid across all invoice types.

## 2. Business Context

- Members today may see invoices but struggle to understand what each invoice is for (Dues vs Donations vs Events).
- Without clear labels and grouping, members may miss outstanding invoices or be confused about what they have already paid.
- This matters for member satisfaction and reduces support burden when members ask "what is this invoice for?"
- RCME and future tenants need members to have confidence in their financial relationship with the organization.

## 3. Scope (This Ticket)

- **In scope:**
  - Member invoice list page updates with clear source labels (Dues / Donations / Events).
  - Grouping or filtering by invoice source so members can see "all my dues" vs "all my event invoices."
  - Basic receipt visibility (what has been paid) with clear status indicators.
  - Improved invoice descriptions that explain what each invoice is for (e.g., "Annual Membership Dues 2024-2025" vs "Event: Spring Gala 2025").
- **UI changes:**
  - Member invoice list page (`/invoices` or similar) updated with source labels and grouping.
  - Status indicators (outstanding, paid, overdue) made more prominent.
  - Receipt/paid invoice section clearly separated from outstanding invoices.
- **Data contracts:**
  - Member invoice endpoints return source information clearly.
  - Invoice descriptions are human-readable and source-appropriate.

## 4. Out of Scope (For Now)

- Deep analytics or trend visualizations for members.
- Payment method management (that is separate scope).
- Invoice dispute or adjustment workflows.
- PDF receipt generation (may be future scope).
- Treasurer-facing Finance views (that is FIN-01, FIN-03 scope).

## 5. Business Rules & Behaviors (High Level)

- **Invoice labels should:**
  - Clearly indicate source: "Dues", "Donation", or "Event: [Event Title]."
  - Use consistent formatting so members can scan quickly.
- **Grouping should:**
  - Allow members to see all invoices of a type together (e.g., "All Dues" vs "All Events").
  - Default to showing outstanding invoices first, then paid invoices.
- **Status indicators should:**
  - Make it obvious what is outstanding vs paid.
  - Highlight overdue invoices clearly.
  - Show payment dates for paid invoices so members can see when they paid.
- **Receipt visibility should:**
  - Show what has been paid with clear confirmation (status = PAID, payment date visible).
  - Help members understand their payment history.

## 6. Success Criteria

- Members can immediately see which invoices are Dues, Donations, or Events.
- Members can group or filter invoices by source.
- Members can clearly see what is outstanding vs what has been paid.
- Members understand what each invoice is for without needing to contact support.
- Invoice list is scannable and not overwhelming.

## 7. Risks & Dependencies

- **Dependencies:**
  - BKS-04 (Billing/payments persistence) provides invoice/payment data.
  - EVT-04 (Event Invoicing) ensures event invoices have proper descriptions and source tags.
  - Existing member invoice endpoints must support source filtering and grouping.
- **Risks:**
  - Overwhelming members with too much information if grouping is not intuitive.
  - Breaking existing member invoice views if we change data contracts too broadly.
  - Performance if invoice queries become too complex with grouping/filtering.

## 8. Open Questions

- Should invoices be grouped by source by default, or should grouping be optional?
- How detailed should invoice descriptions be (e.g., include event date, location)?
- How far back should we show paid invoices in the receipt section?
- Should members be able to download or print receipts, or is on-screen visibility enough for now?
