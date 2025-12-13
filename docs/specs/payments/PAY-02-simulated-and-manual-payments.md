# PAY-02 – Simulated & Manual Payment Flow

**Status:** In Progress  
**Related:**
- PAY-10: Core Payments Schema and Invoice Status Engine (foundation)
- FIN-01, FIN-02: Finance summary and invoice list/detail
- EVT-01–EVT-04: Events and event billing

## Executive Summary

PAY-02 implements simulated and manual payment flows on top of the PAY-10 payments engine. This enables:
1. **Simulated payments** (admin-only testing tool) to validate the full invoice → payment → allocation → status engine
2. **Manual payment workflow** (off-platform payments) with proof upload, approval/rejection, and audit trail
3. **Credit handling** for overpayments
4. **UI extensions** to existing invoice detail screens

**Key Principle:** All payment flows use Allocations as the single source of truth. Manual payments do not affect balances until approved.

---

## I. PAY-02A: Simulated Payments

### Backend Implementation

**Endpoint:** `POST /api/billing/admin/invoices/:invoiceId/simulate-payment`

**Authorization:** ADMIN, OFFICER, or FINANCE_MANAGER only

**Environment Guard:**
- In production: Require `ENABLE_SIMULATED_PAYMENTS=true` env var or reject with 403
- In rcme-dev and dev: Allowed by default

**Request Body:**
```typescript
{
  amountCents?: number  // Optional: defaults to invoice outstanding balance
}
```

**Behavior:**
1. Load invoice by ID and tenant, ensure status is not VOID
2. Compute outstanding balance: `outstanding = invoice.amountCents - sum(allocations.amountCents)`
3. Determine payment amount:
   - If `amountCents` provided: `paymentAmount = amountCents`
   - Else: `paymentAmount = outstanding`
4. In a DB transaction:
   - Create Payment with:
     - `channel = SIMULATED`
     - `status = SUCCEEDED`
     - `verificationStatus = NOT_REQUIRED`
     - `createdBy = current admin user`
     - `processedAt = now`
   - Create Allocation:
     - `amountCents = min(paymentAmount, outstanding)`
   - If overpayment: Create Credit for remainder
   - Call `recomputeAndPersistInvoiceStatus` to update invoice status
5. Create PaymentAuditLog entry: `CREATED` action

**Response:** Updated invoice detail DTO (same shape as FIN-02)

### Frontend Implementation

**Location:** Admin invoice detail page (`AdminInvoiceDetailPage.tsx`)

**UI:**
- Show "Simulate payment" button for ADMIN/OFFICER/FINANCE_MANAGER roles
- Only show when:
  - Env flag `VITE_ENABLE_SIMULATED_PAYMENTS` is enabled (or dev)
  - Invoice is not VOID
- On click: Show confirmation modal
- In payments list: Label simulated payments as "Simulated payment (admin tool)"

---

## II. PAY-02B: Manual Payment Creation

### Backend Implementation

**Endpoint:** `POST /api/billing/admin/payments/manual`

**Authorization:** ADMIN, OFFICER, or FINANCE_MANAGER only

**Request (multipart form):**
```typescript
{
  memberId?: string       // Optional: inferred from invoice if single invoice
  invoiceIds: string[]    // v1: length must be 1
  amountCents: number
  paidAt: string          // ISO date
  channelLabel: string    // "Bank transfer" | "Cash" | "Check" | "GCash" | "Other"
  notes?: string
  proofFile: File         // Image (JPG/PNG) or PDF
}
```

**Behavior:**
1. Resolve tenant and invoice by ID, ensure invoice belongs to tenant
2. If `memberId` absent, infer from invoice.memberId
3. Store file and obtain `proofUrl`
4. In transaction:
   - Create Payment with:
     - `channel = MANUAL_CASH | MANUAL_BANK | MANUAL_OTHER` (map from channelLabel)
     - `status = PENDING`
     - `verificationStatus = PENDING_VERIFICATION`
     - `proofUrl = stored file URL`
     - `createdBy = current admin`
     - `processedAt = null`
   - **No Allocations created yet**
5. Create PaymentAuditLog: `CREATED` action

**Response:** Payment DTO with proofUrl link

### Frontend Implementation

**Location:** Admin invoice detail page

**UI:**
- "Record manual payment" button
- Modal with fields:
  - Amount (required)
  - Date (default: today)
  - Channel (select: Bank transfer, Cash, Check, GCash, Other)
  - Notes (optional)
  - Proof upload (required, accept image/PDF)
- On submit: Call endpoint, refetch invoice detail
- In payments list: Show pending payment with "Pending verification" status and proof link

---

## III. PAY-02C: Manual Payment Approval/Rejection

### Backend Implementation

**Endpoints:**
- `POST /api/billing/admin/payments/:paymentId/approve`
- `POST /api/billing/admin/payments/:paymentId/reject`

**Authorization:** ADMIN, OFFICER, or FINANCE_MANAGER only

**Approve Request Body:**
```typescript
{
  invoiceId?: string              // Optional: inferred from payment context for v1
  allocationAmountCents?: number  // Optional: defaults to min(payment.amountCents, invoice outstanding)
}
```

**Approve Behavior:**
1. Load Payment, ensure `channel = MANUAL`, `status = PENDING`, `verificationStatus = PENDING_VERIFICATION`
2. Resolve target invoice and compute outstanding
3. Determine allocation amount: `min(payment.amountCents, outstanding)` unless explicitly provided
4. In transaction:
   - Create Allocation with determined amount
   - If overpayment: Create Credit for remainder
   - Update Payment:
     - `status = SUCCEEDED`
     - `verificationStatus = APPROVED`
     - `verifiedBy = current user`
     - `verifiedAt = now`
     - `processedAt = now`
   - Call `recomputeAndPersistInvoiceStatus`
5. Create PaymentAuditLog: `APPROVED` action

**Reject Request Body:**
```typescript
{
  reason?: string
}
```

**Reject Behavior:**
1. Load Payment, ensure PENDING status
2. Update Payment:
   - `status = FAILED`
   - `verificationStatus = REJECTED`
3. Create PaymentAuditLog: `REJECTED` action with reason

**Response:** Updated invoice detail DTO (for approve) or Payment DTO (for reject)

### Frontend Implementation

**Location:** Admin invoice detail page payments panel

**UI:**
- For pending manual payments: Show "Approve" and "Reject" buttons
- Approve: Confirmation modal, then call endpoint
- Reject: Modal asking for optional reason
- After decision: Refetch invoice detail
- Display: "Approved manual payment" or "Rejected manual payment" with audit info

---

## IV. PAY-02D: Overpayment Credits

### Backend Implementation

**Credit Creation:**
- Centralized helper: `createCreditIfOverpaid(payment, totalAllocated)`
- Called from PAY-02A (simulate) and PAY-02C (approve) when `payment.amountCents > totalAllocated`
- Creates Credit with:
  - `status = AVAILABLE`
  - `sourcePaymentId = payment.id`
  - `amountCents = payment.amountCents - totalAllocated`

**Endpoint:** `GET /api/billing/admin/credits`

**Query Params:**
- `memberId?: string` (optional filter)

**Response:** List of credits with id, memberId, amountCents, status, sourcePaymentId, appliedToInvoiceId, createdAt

### Frontend Implementation

**Location:**
- Invoice detail: Show "Overpayment: ₱X recorded as credit" notice in payment row when credit created
- Admin credits view: Basic table showing member, amount, status, source payment, applied invoice (if any)

---

## V. PAY-02E: Payments Panel and Pending List

### Backend Implementation

**Endpoint:** `GET /api/billing/admin/payments/manual/pending`

**Authorization:** ADMIN, OFFICER, or FINANCE_MANAGER only

**Response:** List of pending manual payments with:
- id
- member summary
- total amountCents
- createdAt / paidAt
- linked invoice(s)
- proofUrl

**Invoice Detail Enhancement:**
- Ensure `getAdminInvoiceDetailHandler` returns payments array with:
  - id, amountCents, status, verificationStatus, channel
  - createdAt, processedAt
  - proofUrl
  - allocations summary (allocatedToThisInvoiceCents, totalAllocatedCents)

### Frontend Implementation

**Admin Invoice Detail Payments Panel:**
- Standardized panel showing:
  - Amount, Channel, Status label, Date
  - Allocated vs payment amount
  - Proof link (if exists)
  - Approve/Reject buttons for pending manual payments

**Pending Manual Payments List:**
- New admin view (tab on Finance dashboard or separate page)
- Table: Member, Invoice number, Amount, Date, Channel
- Link: "Open invoice" → navigates to invoice detail

---

## VI. PAY-02F: Tests and QA

### Test Coverage

**Backend Tests:**
- Simulated full payment → invoice PAID
- Simulated partial payment → invoice PARTIALLY_PAID
- Manual payment creation → PENDING, no allocations
- Manual payment approval → allocations created, status updated
- Manual payment rejection → no allocations, status unchanged
- Overpayment → credit created
- FIN-01/FIN-02 regression: totals remain correct

**Frontend Tests:**
- Simulate payment button visibility
- Manual payment modal submission
- Approve/Reject actions
- Payments panel display

### QA Script

See `docs/qa/PAY-02-qa-verification.md` for manual QA scenarios.

---

## VII. Acceptance Criteria

PAY-02 is **Done** when:

1. ✅ Admin can simulate payments on outstanding invoices
2. ✅ Simulated payments update invoice status and balances correctly
3. ✅ Admin can record manual payments with proof upload
4. ✅ Manual payments remain pending until approval
5. ✅ Admin can approve/reject manual payments
6. ✅ Approved manual payments create allocations and update invoice status
7. ✅ Rejected manual payments do not affect balances
8. ✅ Overpayments create Credits correctly
9. ✅ Credits are visible to admins
10. ✅ FIN-01 and FIN-02 metrics remain correct
11. ✅ All tests passing
12. ✅ QA script documented and verified in rcme-dev

---

**Last updated:** 2025-01-XX  
**Status:** Implementation in progress

