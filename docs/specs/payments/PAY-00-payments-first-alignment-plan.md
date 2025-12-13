# PAY-00 — Payments-First Alignment Plan

**Status:** Implementation Ready  
**Version:** 1.1  
**Related:**
- Finance: FIN-01, FIN-02
- Backend: BKS-04, BKS-05
- Events: EVT-01–EVT-04
- UI: UIR-03

## Executive Summary

This document provides the technical delta plan and implementation proposals for aligning OneLedger with a **payments-first** pathway where OneLedger is the default place to settle all dues and billables, Traxion is the primary payment rail, and off-platform payments are controlled exceptions with proof, approval, and audit trail.

**Key Principle:** Build the full Payment → Allocation → Invoice flow with simulated/manual channels first, integrate Traxion as the final layer. This enables core payment logic to be built and tested without external dependencies.

---

## A) Delta Plan — Technical Assessment

### What Must Change (Breaking or Essential)

#### 1. **Payment Model Restructuring** (Breaking)
**Current State:**
- `Payment` model has required `invoiceId` field (one-to-one relationship)
- Payment directly linked to single invoice
- Balance calculated by summing all payments for an invoice
- No support for partial payments across multiple invoices
- No allocation layer

**Required Changes:**
- Make `Payment.invoiceId` nullable (payment can exist without direct invoice link)
- **CRITICAL RULE:** Allocations are the single source of truth for payment-to-invoice linkage. `Payment.invoiceId` is convenience metadata only and must never be used for balance calculations or status derivation. All new code must query Allocations, not `Payment.invoiceId`.
- Add `Payment.channel` enum (SIMULATED, TRAXION, MANUAL_CASH, MANUAL_BANK, MANUAL_OTHER)
- Add `Payment.status` enum values: INITIATED, PENDING, SUCCEEDED, FAILED, REVERSED, REFUNDED
- Add `Payment.verificationStatus` enum (NOT_REQUIRED, PENDING_VERIFICATION, APPROVED, REJECTED)
- Add `Payment.externalReference` (for Traxion transaction ID)
- Add `Payment.idempotencyKey` (for webhook deduplication)
- Add `Payment.proofUrl` (for manual payment attachments - stored in restricted bucket, RBAC enforced)
- Add `Payment.verifiedBy`, `Payment.verifiedAt` (for approval workflow)
- Add `Payment.createdBy` (audit trail)

#### 2. **Allocation Model** (New, Essential)
**Current State:**
- No allocation model exists
- Payments directly linked to invoices

**Required Changes:**
- Create new `Allocation` model:
  - `id`, `paymentId` (FK), `invoiceId` (FK), `amountCents`
  - Enables one payment to many invoices (multi-invoice payment)
  - Enables one invoice to many payments (partial payments over time)
  - Invoice balance = `invoice.amountCents` minus sum of allocations

#### 3. **Credit Model** (New, Essential)
**Current State:**
- No credit model exists
- Overpayments have no place to go

**Required Changes:**
- Create new `Credit` model:
  - `id`, `tenantId`, `memberId`, `amountCents`
  - `sourcePaymentId` (FK nullable)
  - `status` enum (AVAILABLE, APPLIED, VOIDED)
  - `appliedToInvoiceId` (when credit is used - v1 constraint: full application to single invoice only)
  - `appliedAt`, `notes`, `createdBy`
- **v1 CONSTRAINT:** In v1, a Credit can only be fully applied to a single invoice. Multi-invoice credit splitting and partial credit application are explicitly out of scope. `appliedToAllocationId` is not needed for v1.

#### 4. **Invoice Status Derivation** (Breaking)
**Current State:**
- Invoice status directly set (DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, VOID, FAILED)
- Status manually updated when payments succeed

**Required Changes:**
- Invoice status must be **derived from allocations** rather than directly set
- **NON-NEGOTIABLE INVARIANT:** There is a single helper function `computeAndSetInvoiceStatus(invoiceId)` that computes and sets Invoice.status from Allocations and dueAt. No other code path is allowed to update status directly.
- Function location: `auth-service/src/services/invoice/computeInvoiceStatus.ts`
- Function logic:
  - No allocations and not past due → ISSUED
  - No allocations and past due → OVERDUE
  - Partial allocations → PARTIALLY_PAID
  - Full allocations → PAID
  - Manually voided → VOID (separate admin action)
- Status updated automatically when allocations change by calling this function
- FIN-01 and FIN-02 must use Allocations as the source of truth for balance and status calculations, not Payment records directly

#### 5. **Invoice Reference Code** (Additive)
**Current State:**
- Invoice has `invoiceNumber` (unique per tenant)
- Used for display but not as primary matching key

**Required Changes:**
- Add `Invoice.referenceCode` field (or use `invoiceNumber` as reference code)
- Ensure it's the primary matching key for:
  - Support inquiries
  - Reports and exports
  - Traxion reconciliation

#### 6. **Balance Calculation Refactor** (Breaking)
**Current State:**
- `calculateInvoiceBalance` sums payments directly
- Assumes payments are one-to-one with invoices

**Required Changes:**
- Refactor to sum allocations instead of payments
- `balanceCents = invoice.amountCents - sum(allocation.amountCents where allocation.invoiceId = invoice.id)`
- Update all call sites (FIN-01, FIN-02 queries)

#### 7. **FIN-01/FIN-02 Query Updates** (Breaking)
**Current State:**
- FIN-01 summary queries assume direct payment-to-invoice relationship
- FIN-02 invoice list queries use `calculateInvoiceBalance` with payments array

**Required Changes:**
- Update FIN-01 queries to use allocations for balance calculations
- Update FIN-02 queries to join allocations instead of payments
- Ensure zero-amount exclusion and status grouping still work correctly

### What Can Stay As-Is

- **Event stack (EVT-01–EVT-04):** Registration and invoice creation flows remain valid
- **Invoice creation logic:** How invoices are generated unchanged
- **Attendance logic:** Fully independent from payments
- **Tenant scoping patterns:** Reuse existing approach
- **RBAC patterns:** Existing role guards remain valid
- **AuditLog model:** Can be extended for payment audit trail

### Defer to Post-v1

- **Refund initiation from OneLedger:** Capture status only if Traxion sends it
- **Automated credit application suggestions:** Manual application only in v1
- **Advanced reconciliation dashboard:** v1 = job flags issues, post-v1 = admin UI to resolve
- **Multi-currency support:** PHP-only for v1
- **Payment plans / installment schedules:** Out of scope
- **Traxion integration:** Schema includes it, handlers built when ready (Phase 5)

---

## B) Proposed Schema Changes

### Prisma Models/Enums/Relations

#### 1. Payment Model Updates

```prisma
enum PaymentChannel {
  SIMULATED      // For testing/development
  TRAXION        // Traxion payment rail
  MANUAL_CASH    // Cash payment
  MANUAL_BANK    // Bank transfer
  MANUAL_OTHER   // Other manual payment
}

enum PaymentStatus {
  INITIATED      // Payment created, awaiting processing
  PENDING        // Payment in progress
  SUCCEEDED      // Payment completed successfully
  FAILED         // Payment failed
  REVERSED       // Payment reversed
  REFUNDED       // Payment refunded
}

enum PaymentVerificationStatus {
  NOT_REQUIRED           // No verification needed (auto-approved)
  PENDING_VERIFICATION   // Awaiting admin approval
  APPROVED              // Approved by admin
  REJECTED              // Rejected by admin
}

model Payment {
  id                String                    @id @default(cuid())
  tenantId          String
  invoiceId         String?                   // Nullable: payment can exist before allocation
  memberId          String
  paymentMethodId   String?
  amountCents       Int
  currency          String                    @default("PHP")
  channel           PaymentChannel
  status            PaymentStatus             @default(INITIATED)
  verificationStatus PaymentVerificationStatus @default(NOT_REQUIRED)
  
  // External integration
  externalReference String?                   // Traxion transaction ID
  idempotencyKey    String?                   @unique // For webhook deduplication
  
  // Manual payment workflow
  proofUrl          String?                   // Uploaded proof attachment (stored in restricted bucket, RBAC enforced - see Security section)
  notes             String?
  verifiedBy        String?                   // User ID who approved/rejected
  verifiedAt        DateTime?
  createdBy         String                    // User ID who created payment
  
  // Timestamps
  processedAt       DateTime?
  createdAt         DateTime                  @default(now())
  updatedAt         DateTime                  @updatedAt
  
  // Relations
  invoice           Invoice?                  @relation(fields: [invoiceId, tenantId], references: [id, tenantId])
  member            Member                    @relation(fields: [memberId, tenantId], references: [id, tenantId])
  paymentMethod     PaymentMethod?            @relation(fields: [paymentMethodId, tenantId], references: [id, tenantId])
  tenant            Tenant                    @relation(fields: [tenantId], references: [id])
  allocations       Allocation[]
  credits           Credit[]                  // Credits created from overpayments
  auditLogs         PaymentAuditLog[]
  
  @@index([tenantId, invoiceId], map: "Payment_tenant_invoice_idx")
  @@index([tenantId, memberId], map: "Payment_tenant_member_idx")
  @@index([tenantId, status], map: "Payment_tenant_status_idx")
  @@index([tenantId, verificationStatus], map: "Payment_tenant_verification_idx")
  @@index([externalReference], map: "Payment_external_ref_idx")
  @@index([idempotencyKey], map: "Payment_idempotency_key_idx")
  // Note: @@unique([id, tenantId]) is redundant since id is already PK - simplify during implementation
}
```

#### 2. Allocation Model (New)

```prisma
model Allocation {
  id          String   @id @default(cuid())
  paymentId   String
  invoiceId   String
  tenantId    String
  amountCents Int
  createdAt   DateTime @default(now())
  
  payment     Payment  @relation(fields: [paymentId, tenantId], references: [id, tenantId])
  invoice     Invoice  @relation(fields: [invoiceId, tenantId], references: [id, tenantId])
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId, invoiceId], map: "Allocation_tenant_invoice_idx")
  @@index([tenantId, paymentId], map: "Allocation_tenant_payment_idx")
  @@index([invoiceId, paymentId], map: "Allocation_invoice_payment_idx") // Composite for common queries
  // Note: @@unique([id, tenantId]) is redundant since id is already PK - simplify during implementation
}
```

#### 3. Credit Model (New)

```prisma
enum CreditStatus {
  AVAILABLE   // Credit available for use
  APPLIED    // Credit has been applied to an invoice
  VOIDED     // Credit voided/cancelled
}

model Credit {
  id                  String        @id @default(cuid())
  tenantId            String
  memberId            String
  amountCents         Int
  sourcePaymentId     String?       // Payment that created this credit (overpayment)
  status              CreditStatus  @default(AVAILABLE)
  appliedToInvoiceId  String?  // v1: Only single invoice, full amount application
  appliedAt           DateTime?
  notes               String?
  createdBy           String        // User ID who created credit
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  
  sourcePayment       Payment?      @relation(fields: [sourcePaymentId, tenantId], references: [id, tenantId])
  member              Member        @relation(fields: [memberId, tenantId], references: [id, tenantId])
  tenant              Tenant        @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId, memberId], map: "Credit_tenant_member_idx")
  @@index([tenantId, status], map: "Credit_tenant_status_idx")
  // Note: @@unique([id, tenantId]) is redundant since id is already PK - simplify during implementation
}
```

#### 4. Invoice Model Updates

```prisma
model Invoice {
  // ... existing fields ...
  
  // Add reference code (or use invoiceNumber as reference)
  // referenceCode String? // Optional: if we want separate from invoiceNumber
  
  // Ensure dueAt is required for reminder engine
  dueAt         DateTime?  // Should be set for reminder engine
  
  // Relations
  payments      Payment[]   // Keep for backward compatibility, but allocations are source of truth
  allocations   Allocation[] // New: allocations determine balance
  credits       Credit[]    // Credits applied to this invoice
  
  // ... rest of existing fields ...
}
```

#### 5. PaymentAuditLog Model (New)

```prisma
enum PaymentAuditAction {
  CREATED
  SUBMITTED
  VERIFIED
  APPROVED
  REJECTED
  ALLOCATED
  REVERSED
  REFUNDED
  STATUS_CHANGED
}

model PaymentAuditLog {
  id            String              @id @default(cuid())
  tenantId      String
  paymentId     String
  action        PaymentAuditAction
  performedBy   String              // User ID
  timestamp     DateTime            @default(now())
  previousState Json?               // Previous payment state
  newState      Json?               // New payment state
  notes         String?
  
  payment       Payment             @relation(fields: [paymentId, tenantId], references: [id, tenantId])
  tenant        Tenant              @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId, paymentId], map: "PaymentAuditLog_tenant_payment_idx")
  @@index([tenantId, timestamp], map: "PaymentAuditLog_tenant_timestamp_idx")
}
```

#### 6. Tenant Settings Extension

Add to `FeatureFlags` or create new `TenantSettings` model:

```prisma
model TenantSettings {
  id                              String   @id @default(cuid())
  tenantId                        String   @unique
  requiresManualPaymentVerification Boolean @default(false)
  reminderEngineEnabled           Boolean  @default(true)
  reminderIntervals               Json?    // Custom reminder timing config
  createdAt                       DateTime  @default(now())
  updatedAt                       DateTime  @updatedAt
  
  tenant                          Tenant   @relation(fields: [tenantId], references: [id])
}
```

### Index Hygiene Note

**During Implementation:** TCP/Dev should simplify redundant indexes while preserving:
- Tenant scoping (all queries filter by tenantId)
- IdempotencyKey uniqueness guarantee (`@unique` on idempotencyKey)
- Fast queries for: tenant + status, tenant + member, tenant + channel

**Redundant patterns to remove:**
- `@@unique([id, tenantId])` when `id` is already PK
- Duplicate indexes that serve the same query pattern

Keep indexes intentional and documented. The schema examples above show some redundant patterns that should be cleaned up during implementation.

### Migration Impact

**Breaking Changes:**
1. `Payment.invoiceId` becomes nullable (requires migration)
2. Existing paid invoices need backfilled Payment and Allocation records
3. Invoice status derivation logic changes (computed vs stored)

**Migration Script Requirements:**
1. For each existing invoice with `status = PAID`:
   - Create Payment record (channel = LEGACY or MANUAL_OTHER, status = SUCCEEDED)
   - Create Allocation record linking payment to invoice for full amount
   - Call `computeAndSetInvoiceStatus` to set correct status
   - Set `invoice.paidAt` if not already set
2. For each existing invoice with `status = PARTIALLY_PAID`:
   - Create Payment record with partial amount
   - Create Allocation record
   - Call `computeAndSetInvoiceStatus` to recalculate status
3. For existing unpaid invoices:
   - No Payment or Allocation records needed
   - Call `computeAndSetInvoiceStatus` to ensure status is correct based on dueDate
4. Verify FIN-01 totals match before and after migration
5. Verify FIN-02 invoice list shows correct balances and statuses
6. Run on rcme-dev first, verify all queries still work

**Operational Guardrails (NON-NEGOTIABLE):**

Production migration only after:
1. Migration script is run and validated on rcme-dev
2. FIN-01 totals match before and after migration
3. FIN-02 invoice list shows correct balances and statuses
4. Backup/snapshot of Invoice, Payment (if exists), and related tables is taken

During production migration:
- Option A: Freeze writes to invoices and payments during migration window
- Option B: Run migration in transaction with row-level locking
- Communicate maintenance window to stakeholders

Post-migration validation:
- Run FIN-01 summary, compare to pre-migration baseline
- Spot-check 10 invoices across different statuses
- Verify no orphaned Allocations or Payments

**How to Keep rcme-dev Safe:**
- Migration script with dry-run mode
- Pre-migration backup of invoice/payment data
- Post-migration verification queries
- Rollback script if needed

---

## C) Proposed Backend Routes and Webhooks

### Payment Simulation (Development/Testing)

**POST /admin/payments/simulate**
- **Input:** `{ memberId, invoiceIds[], amountCents }`
- **Behavior:**
  - Creates Payment with `channel = SIMULATED`, `status = SUCCEEDED`
  - Creates Allocations for specified invoices
  - Updates Invoice statuses based on new balances
  - Handles overpayment: creates Credit if amount exceeds invoice totals
- **Response:** Payment details with allocations
- **RBAC:** ADMIN, FINANCE_MANAGER

### Member Payment Flow (Traxion, when integrated)

**POST /payments/checkout**
- **Input:** `{ invoiceIds[], returnUrl }`
- **Behavior:**
  - Creates Payment with `channel = TRAXION`, `status = INITIATED`
  - Generates `idempotencyKey`
  - Calls Traxion API to create payment request
  - Returns redirect URL to Traxion checkout
- **Response:** `{ paymentId, checkoutUrl }`
- **RBAC:** MEMBER (own invoices only)

**GET /payments/:id**
- **Response:** Payment status and details
- **RBAC:** MEMBER (own payments), ADMIN (all)

**GET /member/payments**
- **Query:** `page`, `pageSize`, `status`, `dateRange`
- **Response:** Paginated list of member's payments
- **RBAC:** MEMBER

**GET /member/invoices/:id/payments**
- **Response:** Payments for specific invoice
- **RBAC:** MEMBER (own invoice)

### Traxion Webhook Handler (when integrated)

**POST /webhooks/traxion/payment**
- **Headers:** Webhook signature verification
- **Input:** Traxion webhook payload
- **Behavior:**
  - Extract `externalReference` and `idempotencyKey`
  - Check for existing Payment with this reference (idempotency)
  - Map Traxion status to Payment status:
    - `success` → `SUCCEEDED` → create Allocations → update Invoice statuses
    - `failed` → `FAILED` → no allocation changes
    - `refunded` → `REFUNDED` → reverse allocations, update Invoice statuses, potentially create Credit
    - `reversed` → `REVERSED` → same as refunded
  - Log webhook receipt
- **Response:** 200 OK (acknowledge receipt)
- **RBAC:** Internal only (webhook signature required)

**Idempotency Approach:**
- Generate `idempotencyKey` on checkout initiation
- Store on Payment record
- On webhook: check if Payment with this `externalReference` already processed to final state
- If duplicate, acknowledge but skip reprocessing

### Manual Payment Flow

**POST /admin/payments/manual**
- **Input:** `{ memberId, invoiceIds[], amountCents, channel, paymentDate, notes, proofFile }`
- **Validation:** Channel must be MANUAL_CASH, MANUAL_BANK, or MANUAL_OTHER. Proof file required for manual channels.
- **Behavior:**
  - Upload proof file to restricted storage bucket (not public)
  - Store proofUrl as storage key (not public URL)
  - If `tenantSettings.requiresManualPaymentVerification = true`:
    - Create Payment with `status = PENDING`, `verificationStatus = PENDING_VERIFICATION`
    - Do not create Allocations yet
    - Invoice balances unchanged (call `computeAndSetInvoiceStatus` but status won't change)
  - If verification not required:
    - Create Payment with `status = SUCCEEDED`, `verificationStatus = NOT_REQUIRED`
    - Create Allocations immediately
    - Call `computeAndSetInvoiceStatus` for each invoice
  - Handle overpayment: if `amountCents > sum(invoice balances)`, create Credit for difference
- **Response:** Payment details
- **RBAC:** ADMIN, FINANCE_MANAGER

**POST /admin/payments/:id/approve**
- **Validation:** Payment must have `verificationStatus = PENDING_VERIFICATION`
- **Behavior:**
  - Update Payment: `status = SUCCEEDED`, `verificationStatus = APPROVED`, `verifiedBy`, `verifiedAt`
  - Create Allocations for invoices specified at creation
  - Call `computeAndSetInvoiceStatus` for each invoice
  - Handle overpayment: create Credit if applicable
  - Create audit log entry
- **Response:** Updated payment details
- **RBAC:** ADMIN, FINANCE_MANAGER

**POST /admin/payments/:id/reject**
- **Input:** `{ reason }` (optional)
- **Validation:** Payment must have `verificationStatus = PENDING_VERIFICATION`
- **Behavior:**
  - Update Payment: `status = FAILED`, `verificationStatus = REJECTED`, `verifiedBy`, `verifiedAt`
  - No Allocations created
  - Invoice balances unchanged
  - Create audit log entry with rejection reason
- **Response:** Updated payment details
- **RBAC:** ADMIN, FINANCE_MANAGER

### Admin Payment Queries

**GET /admin/payments**
- **Query:** `status`, `verificationStatus`, `channel`, `memberId`, `dateRange`, `invoiceId`, `page`, `pageSize`, `sortBy`, `sortOrder`
- **Response:** Paginated list of payments with member info and allocation summaries
- **RBAC:** ADMIN, FINANCE_MANAGER

**GET /admin/payments/:id**
- **Response:** Full payment detail with allocations and audit trail
- **RBAC:** ADMIN, FINANCE_MANAGER

**GET /admin/payments/:id/proof**
- **Response:** Signed URL for proof file download (short expiry, e.g., 5 minutes)
- **Security:** RBAC check - only Admin/Finance roles for tenant can access. Audit log when proof is accessed.
- **RBAC:** ADMIN, FINANCE_MANAGER (tenant-scoped)

**GET /admin/payments/pending-verification**
- **Response:** Shortcut endpoint for payments awaiting approval
- **RBAC:** ADMIN, FINANCE_MANAGER

### Credit Management

**GET /admin/members/:id/credits**
- **Response:** List credits for a member
- **RBAC:** ADMIN, FINANCE_MANAGER

**GET /member/credits**
- **Response:** Member's own credits
- **RBAC:** MEMBER

**POST /admin/credits/:id/apply**
- **Input:** `{ invoiceId }` (v1: full credit amount applied to single invoice)
- **Validation:** Credit must be AVAILABLE
- **Behavior (v1 constraint):**
  - Applies full credit amount to single invoice
  - Creates Allocation linking credit to invoice (or equivalent mechanism)
  - Updates Credit: `status = APPLIED`, `appliedToInvoiceId`, `appliedAt`
  - Calls `computeAndSetInvoiceStatus` for invoice
- **Response:** Updated credit and invoice details
- **RBAC:** ADMIN, FINANCE_MANAGER
- **Note:** Partial application and multi-invoice splitting are out of scope for v1

### Receipts

**GET /payments/:id/receipt**
- **Query:** `format=json|pdf` (default: json)
- **Response:** Receipt data as JSON or generates PDF
- **Fields:** date, amount, method/channel, OneLedger reference, Traxion reference (if applicable), invoice references, member info
- **RBAC:** MEMBER (own payments), ADMIN (all)

### Reconciliation Job (when Traxion integrated)

**Scheduled task** (configurable frequency, daily default):
- Query Traxion API for recent transactions (last 48 hours)
- Compare against Payment records
- Flag discrepancies:
  - Payments in Traxion not in OneLedger (missed webhook)
  - Payments stuck in INITIATED or PENDING beyond threshold (e.g., 1 hour)
  - Amount mismatches
- Create ReconciliationFlag records or send admin notification
- **v1:** Flag only, admin resolves manually

---

## D) On-Platform vs Off-Platform Classification

**Definition:**

- **On-platform:** Payments processed through integrated payment rails
  - Channels: `SIMULATED`, `TRAXION`
- **Off-platform:** Payments processed outside OneLedger, manually recorded
  - Channels: `MANUAL_CASH`, `MANUAL_BANK`, `MANUAL_OTHER`

**Reporting Implications:**

- All exports must include:
  - Invoice reference code (invoiceNumber)
  - Payment channel
  - Derived on/off-platform flag based on channel classification
- FIN-01 summary can optionally break down by on-platform vs off-platform
- FIN-02 list and detail must show channel clearly
- Collections report: filters to on-platform by default
- Exceptions report: filters to off-platform, includes proof links and verification status

---

## E) Proof Upload Security

**Requirements (NON-NEGOTIABLE):**

- Proof files (bank screenshots, deposit slips) contain sensitive information
- **Storage:** Restricted bucket or storage location, not public
- **Access Control:**
  - Only Admin and Finance roles for the tenant can view or download proof
  - Members cannot see proof (not even their own manual payments)
  - Cross-tenant access is blocked
- **Implementation:**
  - `proofUrl` stores the storage key, not a public URL
  - Access is mediated through `GET /admin/payments/:id/proof` endpoint
  - Endpoint generates signed URLs with short expiry (e.g., 5 minutes)
  - RBAC check before generating signed URL
  - Audit log entry when proof is accessed (who, when)

---

## F) Proposed UI Page Updates

### Member Portal

#### Must (v1 Required)

**Outstanding Invoices with Pay Now**
- **Location:** Existing FIN-02 invoices page (`/invoices` or `/member/invoices`)
- **Enhancements:**
  - "Pay Now" button (enabled when Traxion ready)
  - Support selecting multiple invoices for single payment
  - Show per-invoice balance (computed from Allocations, not just amount)
  - Indicate if partial payment has been made
- **Priority:** Must have

**Basic Payment History**
- **Location:** Can be combined with invoice history if simpler, or separate `/member/payments`
- **Content:**
  - List of member's payments
  - Columns: date, amount, channel/method, status, invoices paid (via Allocations), receipt link
  - Filters: status, date range
  - Pagination
- **Priority:** Must have

**Basic Deadlines View**
- **Location:** Dashboard widget or section on invoices page
- **Content:**
  - Upcoming invoice due dates sorted by date
  - Event payment deadlines (from event invoices)
  - Each row: description, due date, amount, "Pay Now" shortcut
  - Visual indicator for overdue items
- **Priority:** Must have

#### Should (Include if Time Allows)

**Dedicated Payment History Page**
- Separate from invoice history if not combined above
- **Priority:** Should have

**Credit Balance Display**
- **Location:** Invoices page or balance summary
- **Content:** Simple text display for v1, no self-serve application
- **Priority:** Should have

#### Nice (Defer if Needed)

**Dedicated Deadline Center Page**
- Standalone page `/member/deadlines` with enhanced features
- **Priority:** Nice to have

### Admin/Treasurer Portal

#### Must (v1 Required)

**Payments Inbox with Pending Verification**
- **Location:** `/admin/payments` or `/admin/payments/inbox`
- **Content:**
  - Tabs or filters: All, Pending Verification, Succeeded, Failed
  - Columns: date, member, amount, channel, status, verification status, actions
  - Actions: View details, Approve, Reject (for pending verification)
  - Quick stats at top: count pending verification, today's collections
- **Priority:** Must have

**Manual Payment Entry**
- **Location:** `/admin/payments/manual` or modal from payments inbox
- **Content:**
  - Member selector with search
  - Invoice selector: multi-select showing invoice reference, description, balance
  - Auto-calculate total of selected invoices
  - Amount input (can exceed total for overpayment scenarios)
  - Channel dropdown: Cash, Bank Transfer, Other
  - Payment date picker
  - Notes field
  - Proof upload (required for manual channels, stored securely)
  - Submit button
  - If amount exceeds invoice total, show note that credit will be created
- **Priority:** Must have

**Payment Detail View**
- **Location:** `/admin/payments/:id`
- **Content:**
  - Header: amount, date, channel, status, verification status
  - Member info
  - Allocations table: which invoices, how much each (source of truth)
  - Audit trail: all state changes with who and when
  - Receipt download link
  - Proof download link (RBAC enforced)
  - For pending: Approve/Reject actions
- **Priority:** Must have

**At Least One Export View**
- **Collections Report:** On-platform payments within date range
  - Columns: date, member, amount, channel, invoice reference codes, receipt reference, on/off-platform flag
  - Export as CSV
- **Priority:** Must have

#### Should (Include if Time Allows)

**Reject Reason Capture**
- Capture and display rejection reason on rejection
- **Priority:** Should have

**Exceptions Report**
- Off-platform payments with proof links and verification status
  - Columns: date, member, amount, channel, status, verified by, proof link
  - Export as CSV
- **Priority:** Should have

**Enhanced Filters**
- Date range, member search, amount range filters for payments inbox
- **Priority:** Should have

#### Nice (Defer if Needed)

**Dedicated Credits Management Page**
- Standalone page for credit management with advanced features
- **Priority:** Nice to have

**Advanced Export Options**
- Multiple export formats, custom column selection
- **Priority:** Nice to have

**Bulk Approval for Manual Payments**
- Select multiple pending payments and approve in batch
- **Priority:** Nice to have

**Invoice List Enhancement (FIN-02)**
- Column or indicator for payment status (has pending payment, partially paid)
- Filter for invoices with pending payments
- **Priority:** Nice to have (can defer if FIN-02 already covers core needs)

### Navigation Updates

**Member Sidebar:**
- Add "Payments" or "Payment History" link
- Consider "Deadline Center" as dashboard widget or separate link

**Admin Sidebar:**
- Add "Payments" section with sub-items: Inbox, Manual Entry
- Keep existing Finance Dashboard (FIN-01) and Invoices (FIN-02)
- Credits can live under Members or Finance depending on preference

---

## G) Integration with Existing FIN/EVT Stacks

### FIN-01 (Finance Summary)

- **Must query Allocations** to compute collected totals (sum of allocations for invoices with status PAID)
- **Must use `computeAndSetInvoiceStatus` logic** (or equivalent query) for outstanding totals
- **No direct use of Payment.invoiceId** for balance calculations - Allocations are source of truth
- On-platform vs off-platform breakdown uses channel classification (SIMULATED/TRAXION = on-platform, MANUAL_* = off-platform)

### FIN-02 (Invoice List/Detail)

- Invoice balance comes from `amountCents - sum(allocations.amountCents)` where allocations are filtered by invoiceId
- Invoice status comes from stored status field (set only by `computeAndSetInvoiceStatus`)
- Payment history for invoice queries Allocations joined to Payments (not Payment.invoiceId directly)
- Detail view shows allocations and their source payments
- All exports must include invoice reference codes (invoiceNumber)

### EVT-01 to EVT-04 (Events Stack)

- **Event invoice creation unchanged:** EVT-02 and EVT-04 create invoices with `source = EVT` as before
- **Event invoices use same Invoice model:** No special handling needed, they are just invoices
- **Balance calculation:** Event invoice balances use Allocations, same as all other invoices
- **Status derivation:** Event invoice status uses same `computeAndSetInvoiceStatus` function
- **No breaking changes:** Event registration and invoice creation flows remain valid
- Event invoices appear in FIN-01 and FIN-02 with same behavior as other invoice sources

---

## H) Risks and Mitigations

### Data Migration Risk

**Risk:** Existing paid invoices need backfilled Payment and Allocation records. Incorrect migration logic could break balance calculations.

**Mitigation:**
- Write migration script with clear logic
- Run on rcme-dev first
- Verify FIN-01 totals match before and after migration
- Keep migration reversible if possible
- Test with realistic data volumes

### Allocation Complexity Risk

**Risk:** Multi-invoice payments and partial payments add query complexity. Balance calculations could become slow or incorrect at scale.

**Mitigation:**
- Consider denormalized `balanceCents` on Invoice, updated on allocation changes
- Or compute in service layer with clear single function
- Index Allocation table on `invoiceId` and `paymentId`
- Test with realistic data volumes
- Monitor query performance

### Invoice Status Derivation Risk

**Risk:** Status now derived from allocations rather than directly set. Risk of status getting out of sync.

**Mitigation:**
- **NON-NEGOTIABLE:** Single function `computeAndSetInvoiceStatus` is the only path to update status
- Call this function whenever allocations change
- No other code path allowed to update status directly
- Audit log tracks all status transitions
- Add regression tests for status derivation
- Consider database trigger or application-level hook as additional safeguard

### Manual Payment Abuse Risk

**Risk:** Admins creating manual payments without proper proof or bypassing verification.

**Mitigation:**
- Proof upload required for manual channels
- Verification workflow enabled per tenant setting
- Full audit trail visible to higher-level admins
- Verification status clearly visible in all reports
- RBAC enforcement on proof access (only Admin/Finance roles)
- Proof stored in restricted bucket, not public
- Audit log when proof is accessed

### Traxion Integration Unknowns Risk

**Risk:** Webhook reliability uncertain, API documentation timeline unknown.

**Mitigation:**
- Build with simulated payments first
- Design reconciliation job from day one
- Manual payment flow provides fallback
- Mock Traxion in tests
- Idempotency keys prevent duplicate processing

### Testing Regression Impact

**Risk:** FIN-01 and FIN-02 tests assume current Invoice model.

**Mitigation:**
- Update tests in same PR as schema changes
- Treat as deliberate refactor
- Verify all existing test scenarios still pass with new model
- Add new tests for allocation and partial payment scenarios
- Run full test suite before merging

### Overpayment Edge Cases Risk

**Risk:** Member pays more than owed, credit creation and application could be confusing.

**Mitigation:**
- Clear UI messaging when overpayment detected
- Credit created automatically, application is manual admin action in v1
- Credit balance visible to member
- Audit trail for all credit operations
- Document credit workflow clearly

---

## I) Scope Guardrail Confirmation

### v1 Includes

- Invoice, Payment, Allocation, Credit models with full lifecycle
- Simulated payment channel for testing and development
- Manual payment entry with proof upload
- Manual payment verification workflow (approve/reject) when tenant setting enabled
- Partial payment support with correct balance tracking
- Multi-invoice payment support with allocations
- Credit capture for overpayments
- Manual credit application by admin
- Member payment history and receipts
- Member deadline center (upcoming dues and event payments)
- Admin payments inbox
- Admin manual payment workflow (create, approve, reject)
- Payment audit trail
- Basic exports (collections report, manual payments report)
- Invoice status derivation from allocations
- Data migration for existing paid invoices
- Updated FIN-01 and FIN-02 to work with new model
- Reminder engine (minimal v1: scheduled job, basic triggers, logging)

### Included but Deferred Implementation Until Traxion Ready

- Traxion checkout flow
- Traxion webhook handling
- Reconciliation job
- TRAXION channel in enum (schema includes it, handlers built when ready)

### Explicitly Out of Scope for v1

- Refund initiation from OneLedger (capture status only if Traxion sends it)
- Automated credit application suggestions (manual application only in v1)
- Advanced reconciliation admin UI (v1 = job flags issues, admin resolves manually)
- Multi-currency support (PHP-only for v1)
- Payment plans and installment schedules
- Social feed, committees, website builder (explicitly out of scope)
- Full email marketing platform (reminder engine only, no template designer, drip campaigns)

### Proposed Follow-Up Tickets

- **PAY-01:** Traxion integration (checkout, webhooks, reconciliation)
- **FIN-03:** Refunds and reversals handling
- **FIN-04:** Automated credit application
- **FIN-05:** Reconciliation admin UI
- **COMMS-02:** Advanced reminder customization

---

## Reminder Engine (Minimal v1)

### Scope (v1 Only)

**v1 Success Criteria:**
- Reminder records are logged (ReminderLog model)
- Emails are queued via existing `sendEmail` infrastructure
- Admin can see "reminders sent" per invoice in invoice detail view

**Explicitly Out of Scope for v1:**
- Open tracking
- Bounce handling
- Custom template builder
- Advanced scheduling UI
- Delivery status tracking beyond "sent"

These features are deferred to COMMS-02 or later tickets.

### Triggers

- Invoice issued → schedule upcoming due reminders
- Due date approaching → 7 days before, 3 days before (configurable per tenant)
- Due date passed → Day 1, Day 7, Day 14 overdue reminders (configurable per tenant)
- Payment received → cancel pending reminders for that invoice

### Configuration per Tenant

- Enable/disable reminder engine (TenantSettings.reminderEngineEnabled)
- Customize timing (which intervals to use) via TenantSettings.reminderIntervals JSON
- Email template selection (from predefined set, not custom builder)

### Implementation Approach

- Scheduled job runs daily (or configurable frequency)
- Queries invoices with upcoming or passed due dates
- Checks ReminderLog to avoid duplicates
- Sends email via existing `sendEmail` function (`auth-service/src/notifications/emailSender.ts`)
- Creates ReminderLog record: `invoiceId`, `reminderType`, `sentAt`, `status` (QUEUED, SENT, FAILED)

### ReminderLog Model

```prisma
model ReminderLog {
  id          String   @id @default(cuid())
  invoiceId   String
  reminderType String  // DUE_SOON_7, DUE_SOON_3, OVERDUE_1, OVERDUE_7, OVERDUE_14
  sentAt      DateTime
  status      String   // QUEUED, SENT, FAILED
  createdAt   DateTime @default(now())
  
  invoice     Invoice  @relation(fields: [invoiceId, tenantId], references: [id, tenantId])
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  @@index([invoiceId])
  @@index([tenantId, sentAt])
}
```

### For Event Invoices

- Same engine, same reminders
- Event name included in email context
- Due date comes from invoice, which can be set based on event date

### Admin Visibility

- Reminder log viewable per invoice (query ReminderLog by invoiceId)
- Simple table in invoice detail: date, reminder type, status

---

## Implementation Sequence Recommendation

### Phase 1 — Schema and Core Logic
- Add Payment, Allocation, Credit models
- Add PaymentAuditLog, ReminderLog models
- Implement `computeAndSetInvoiceStatus` function
- Update Invoice with status enum and balance logic
- Write migration for existing data (with operational guardrails)
- Update FIN-01 and FIN-02 queries to use Allocations

### Phase 2 — Manual and Simulated Payments
- Build simulate payment endpoint
- Build manual payment create/approve/reject flow
- Build proof upload with secure storage and RBAC
- Build allocation logic (calls `computeAndSetInvoiceStatus`)
- Build credit capture on overpayment (v1: full application only)

### Phase 3 — Member and Admin UI (Must items)
- Member: outstanding invoices with Pay Now, basic payment history
- Member: basic deadlines view (dashboard widget or section)
- Admin: payments inbox with pending verification
- Admin: manual payment entry with proof upload
- Admin: payment detail view with allocations and audit trail
- Admin: at least one export (collections report with on/off-platform flag)

### Phase 4 — Reminders
- Reminder engine job (minimal v1: logging and email queuing only)
- Tenant configuration (TenantSettings model)
- ReminderLog model and admin visibility

### Phase 5 — Traxion Integration (when ready)
- Checkout flow
- Webhook handlers with idempotency
- Reconciliation job

### Phase 6 — Polish (Should/Nice items)
- Additional UI features based on time and priorities
- Advanced exports
- Credit management UI (if not in Phase 3)

---

## Questions for Dev to Flag Back

1. What is current Invoice status field type — enum or string? Need to plan migration to new status set.
   - **Answer:** Prisma enum `InvoiceStatus` with values: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, VOID, FAILED. Migration should be straightforward.

2. Is there any existing Payment model or are payments currently just status changes on Invoice?
   - **Answer:** Payment model exists with required `invoiceId` (one-to-one). Need to make nullable and add allocation layer.

3. What audit logging pattern exists today? Extend it or create payment-specific logging?
   - **Answer:** `AuditLog` model exists. Can extend it or create `PaymentAuditLog` for payment-specific events. Recommendation: create `PaymentAuditLog` for clearer separation.

4. Is there a tenant settings model where we can store `requiresManualPaymentVerification` flag?
   - **Answer:** `FeatureFlags` model exists. Can add flag there or create `TenantSettings` model. Recommendation: create `TenantSettings` for payment-specific config.

5. What is current file upload pattern for proof attachments?
   - **Answer:** Need to investigate. Likely need to add file upload endpoint or use existing pattern.

6. What email infrastructure exists for the reminder engine to use?
   - **Answer:** `sendEmail` function exists in `auth-service/src/notifications/emailSender.ts` (currently just logs). Can use this for reminder engine.

7. Do we have realistic data volume estimates for Allocation table indexing decisions?
   - **Answer:** No specific estimates. Recommendation: index on `invoiceId` and `paymentId` for common query patterns.

---

## Acceptance Criteria (Business)

At the end of this work, the plan and implementation should guarantee that:

1. ✅ A member can fully pay an invoice via the OneLedger → Traxion flow and the invoice transitions to **Paid** with correct balance and payment history.
2. ✅ A member can **partially pay** an invoice; the invoice shows **Partially Paid** and the remaining balance is correct.
3. ✅ An admin can allocate **one payment across multiple invoices** with correct balances and audit trail.
4. ✅ A **manual payment with proof** does not affect invoice balances until approved (when verification is enabled), and approval creates Payments/Allocations accordingly.
5. ✅ Every payment and adjustment has a clear **audit trail** (who, when, what) and can be exported.
6. ✅ Reports can clearly separate **on-platform vs off-platform** payments, and all exports include **invoice reference codes**.

---

**Last updated:** 2025-12-12 23:30 (local)  
**Revision:** TCP refinements based on BCP feedback - implementation ready
