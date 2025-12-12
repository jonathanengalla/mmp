# Story: EVT-02 Paid Event Pay Now Flow
**Purpose:** Validate pay-now registration creates an invoice immediately.

## Scenario
- Event: Masterclass (price > 0, PAY_NOW)
- User: Member

## Steps (Member)
1) Open Events page; locate Masterclass.
2) Click Register (Pay now mode).
3) Confirm registration success and invoice created (status ISSUED).
4) Verify invoice appears in My Invoices with source=EVT, correct amount.

## Steps (Admin)
1) Admin events dashboard: verify registration count increments.
2) Invoice list: confirm new event invoice exists, amount > 0.
3) Finance summary/revenue mix: paid when settled; issued when outstanding.

## Expected
- Registration created.
- Invoice created immediately, correct numbering/source/amount.
- Zero-amount invoices never created.


