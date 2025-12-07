# Billing User Stories (Thin-Sliced)

1. **Story:** Admin creates a manual invoice.  
   **Acceptance Criteria:**  
   - Select member and amount.  
   - Due date required.  
   - Invoice status starts as Sent/Draft per selection.

2. **Story:** System auto-generates recurring dues invoice.  
   **Acceptance Criteria:**  
   - Triggered on configured schedule.  
   - Uses tenant invoice template.  
   - Invoice appears in member account.

3. **Story:** Admin edits draft invoice line items.  
   **Acceptance Criteria:**  
   - Add/remove line items before send.  
   - Totals update instantly.  
   - Cannot edit after marking as Sent.

4. **Story:** Admin sends invoice to member.  
   **Acceptance Criteria:**  
   - Send action emails member with link.  
   - Status changes to Sent.  
   - Timestamp recorded.

5. **Story:** System applies late fee after due date.  
   **Acceptance Criteria:**  
   - Late fee rule configurable per tenant.  
   - Applied once per cycle.  
   - Fee appears as separate line item.

6. **Story:** Member views outstanding invoices.  
   **Acceptance Criteria:**  
   - List shows amount, due date, status.  
   - Sorted with newest first.  
   - Pay action available for unpaid.

7. **Story:** Member downloads invoice PDF.  
   **Acceptance Criteria:**  
   - PDF uses tenant template and branding.  
   - Includes line items, taxes, totals.  
   - Download link available from invoice view.

8. **Story:** Admin voids an invoice.  
   **Acceptance Criteria:**  
   - Allowed only before any payment received.  
   - Status set to Voided.  
   - Voided invoices excluded from balances.

9. **Story:** Admin issues credit note against invoice.  
   **Acceptance Criteria:**  
   - Credit amount cannot exceed balance.  
   - Credit note linked to original invoice.  
   - Balance updated accordingly.

10. **Story:** Member views payment history per invoice.  
    **Acceptance Criteria:**  
    - Shows each payment/refund with timestamp.  
    - Displays remaining balance.  
    - Read-only view.

11. **Story:** Admin exports billing list to CSV.  
    **Acceptance Criteria:**  
    - Filters apply to export.  
    - Columns include member, amount, status, due date.  
    - File downloads successfully.

12. **Story:** System marks invoice Paid after full settlement.  
    **Acceptance Criteria:**  
    - Triggered when payments + credits equal total.  
    - Status updates to Paid.  
    - Paid timestamp recorded.

