# Payments Hub User Stories (Thin-Sliced)

1. **Story:** Member saves a payment method (card).  
   **Acceptance Criteria:**  
   - Form captures card details via PCI-compliant widget.  
   - Token stored; no PAN saved.  
   - Success confirmation displayed.

2. **Story:** Member deletes a saved payment method.  
   **Acceptance Criteria:**  
   - Delete confirmation required.  
   - Token removed from vault mapping.  
   - Payment method no longer selectable.

3. **Story:** Admin enables a payment gateway for tenant.  
   **Acceptance Criteria:**  
   - Gateway toggle per tenant.  
   - Credentials validated before activation.  
   - Status visible in config summary.

4. **Story:** Member makes one-time payment for dues.  
   **Acceptance Criteria:**  
   - Selects invoice; chooses saved/new payment method.  
   - Payment processes and returns success/failure.  
   - Receipt triggered on success.

5. **Story:** Member schedules recurring payment for dues.  
   **Acceptance Criteria:**  
   - Frequency options shown (e.g., monthly/annual).  
   - Next charge date displayed.  
   - Member can cancel schedule.

6. **Story:** Member pays event fee at checkout.  
   **Acceptance Criteria:**  
   - Event fee auto-added to cart/checkout.  
   - Confirmation ties payment to event registration.  
   - Payment status visible in event attendance list.

7. **Story:** System retries failed payment automatically.  
   **Acceptance Criteria:**  
   - Retry schedule configurable (e.g., 3 attempts).  
   - Member notified after each failure.  
   - Successful retry updates invoice to Paid.

8. **Story:** Admin views payment transaction detail.  
   **Acceptance Criteria:**  
   - Shows amount, status, gateway response, timestamps.  
   - Linked invoice and member shown.  
   - Export/print option available.

9. **Story:** Admin refunds a payment (full).  
   **Acceptance Criteria:**  
   - Refund action available when status is Paid.  
   - Gateway response captured.  
   - Refund entry appears in transaction history.

10. **Story:** Admin refunds a payment (partial).  
    **Acceptance Criteria:**  
    - Partial amount validated against paid total.  
    - Remaining balance updated accordingly.  
    - Member notified of partial refund.

11. **Story:** System sends payment receipt email.  
    **Acceptance Criteria:**  
    - Triggered on successful payment.  
    - Includes amount, date, invoice reference.  
    - Uses tenant branding.

12. **Story:** Admin filters transactions by status/date.  
    **Acceptance Criteria:**  
    - Filters: status, date range, member, gateway.  
    - Results paginated.  
    - Export respects applied filters.

