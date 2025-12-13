# PAY-10 — Core Payments Schema and Invoice Status Engine (Phase 1)

**Status:** Ready for Implementation  
**Related:**
- Planning: PAY-00 (Payments-First Alignment Plan)
- Finance: FIN-01, FIN-02
- Backend: BKS-04, BKS-05
- Events: EVT-01–EVT-04

## Executive Summary

This ticket implements the foundational schema and logic for the payments-first model. It establishes Allocations as the single source of truth for invoice balances and status, introduces Credit model for overpayments, and refactors FIN-01/FIN-02 to use the new model—all without changing UI or introducing Traxion.

**Key Principle:** All future balance and status logic must use Allocations, not Payment.invoiceId. This ticket enforces that invariant.

---

## I. Prisma Schema Changes

### A) Payment Model Alignment

**Goal:** Evolve Payment to support allocations, channels, and manual verification while maintaining backward compatibility.

#### Changes

1. **Make `Payment.invoiceId` nullable**
   ```prisma
   invoiceId String?  // Changed from required to optional
   ```
   - Keep foreign key relation to Invoice for backward compatibility
   - This allows payments not tied to a single invoice

2. **Add new Payment fields**
   ```prisma
   enum PaymentChannel {
     SIMULATED
     TRAXION
     MANUAL_CASH
     MANUAL_BANK
     MANUAL_OTHER
   }

   enum PaymentStatus {
     INITIATED
     PENDING
     SUCCEEDED
     FAILED
     REVERSED
     REFUNDED
   }

   enum PaymentVerificationStatus {
     NOT_REQUIRED
     PENDING_VERIFICATION
     APPROVED
     REJECTED
   }

   model Payment {
     // ... existing fields ...
     invoiceId         String?                    // Now nullable
     
     // New fields
     channel           PaymentChannel
     status            PaymentStatus              @default(INITIATED)
     verificationStatus PaymentVerificationStatus @default(NOT_REQUIRED)
     externalReference String?                    // For Traxion transaction ID
     idempotencyKey    String?                    @unique // For webhook deduplication
     proofUrl          String?                    // Storage key, not public URL
     verifiedBy        String?                    // User ID
     verifiedAt        DateTime?
     createdBy         String?                    // User ID
     processedAt       DateTime?
     
     // Relations
     allocations       Allocation[]                // New: allocations link payments to invoices
     
     // Indexes
     @@index([tenantId, status])
     @@index([tenantId, memberId])
     @@index([tenantId, channel])
     @@index([externalReference])
     // Note: Remove redundant @@unique([id, tenantId]) if id is already PK
   }
   ```

**TCP Note:** From this ticket forward, all new balance and status logic must treat Payments as "money movement records", not as the direct link to a single invoice. Allocation will become the only source of truth for how that money is applied.

### B) Allocation Model (New)

**Goal:** Enable many-to-many between payments and invoices. Allocations are the single source of truth for balances.

```prisma
model Allocation {
  id          String   @id @default(cuid())
  tenantId    String
  invoiceId   String
  paymentId   String
  amountCents Int
  createdAt   DateTime @default(now())
  createdBy   String?  // User ID who created allocation
  
  // Relations
  invoice     Invoice  @relation(fields: [invoiceId, tenantId], references: [id, tenantId])
  payment     Payment  @relation(fields: [paymentId, tenantId], references: [id, tenantId])
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  // Indexes
  @@index([tenantId, invoiceId])
  @@index([tenantId, paymentId])
  @@index([invoiceId, paymentId]) // Composite for common queries
}

// Add to Invoice model
model Invoice {
  // ... existing fields ...
  allocations Allocation[] // New relation
}
```

**Business Rules (enforced in code):**
- `amountCents > 0` (no negative allocations)
- Allocation must always match `tenantId` of both invoice and payment
- Invoice balance = `invoice.amountCents - SUM(allocations.amountCents WHERE invoiceId = invoice.id)`

### C) Credit Model (New, v1 Constraint)

**Goal:** Capture overpayments as credits. v1 constraint: credit can only be fully applied to one invoice (no splitting).

```prisma
enum CreditStatus {
  AVAILABLE
  APPLIED
  VOIDED
}

model Credit {
  id                String        @id @default(cuid())
  tenantId          String
  memberId          String
  amountCents       Int
  sourcePaymentId   String?       // Payment that created this credit (overpayment)
  status            CreditStatus  @default(AVAILABLE)
  appliedToInvoiceId String?      // v1: Only single invoice, full amount application
  appliedAt         DateTime?
  notes             String?
  createdBy         String?       // User ID
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  
  // Relations
  sourcePayment     Payment?      @relation(fields: [sourcePaymentId, tenantId], references: [id, tenantId])
  member            Member        @relation(fields: [memberId, tenantId], references: [id, tenantId])
  tenant            Tenant        @relation(fields: [tenantId], references: [id])
  appliedToInvoice  Invoice?      @relation(fields: [appliedToInvoiceId, tenantId], references: [id, tenantId])
  
  // Indexes
  @@index([tenantId, memberId])
  @@index([tenantId, status])
  @@index([tenantId, appliedToInvoiceId])
}
```

**v1 Guardrail (enforced in code):**
- When applying credit: only full amount to single invoice, status = APPLIED
- No partial application or multi-invoice splitting in v1

### D) PaymentAuditLog (Minimal Stub)

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
  
  @@index([tenantId, paymentId])
  @@index([tenantId, timestamp])
}
```

**Note:** This is a minimal stub for v1. Behavior can be expanded in later tickets.

### E) Schema Hygiene

- Remove redundant `@@unique([id, tenantId])` where `id` is already PK
- Ensure all new models include `tenantId` and appropriate indexes
- Keep existing tenant scoping guarantees intact

---

## II. Core Helpers and Backend Logic

### A) Allocation-Based Balance Helper

**Location:** `auth-service/src/services/invoice/balance.ts`

```typescript
/**
 * Get total allocated amount for an invoice
 * @param invoiceId - Invoice ID
 * @param tenantId - Tenant ID (for scoping)
 * @returns Total allocated amount in cents
 */
export async function getInvoiceAllocationsTotalCents(
  invoiceId: string,
  tenantId: string
): Promise<number> {
  const result = await prisma.allocation.aggregate({
    where: {
      invoiceId,
      tenantId,
    },
    _sum: {
      amountCents: true,
    },
  });
  return result._sum.amountCents ?? 0;
}

/**
 * Compute invoice balance from amount and allocations
 * @param invoice - Invoice object with amountCents
 * @param allocationsTotalCents - Sum of all allocations for this invoice
 * @returns Remaining balance in cents (never negative)
 */
export function computeInvoiceBalanceCents(
  invoice: { amountCents: number },
  allocationsTotalCents: number
): number {
  return Math.max(invoice.amountCents - allocationsTotalCents, 0);
}
```

**Usage:** Use this helper wherever we compute:
- Outstanding amounts
- Collected amounts
- Per-invoice balances

### B) Invoice Status Engine (NON-NEGOTIABLE INVARIANT)

**Location:** `auth-service/src/services/invoice/computeInvoiceStatus.ts`

This is the **only allowed path** to change `Invoice.status`. No direct status mutations anywhere else.

```typescript
import { InvoiceStatus } from "@prisma/client";

/**
 * Compute invoice status from allocations and due date
 * This is the single source of truth for invoice status computation
 * 
 * @param invoice - Invoice object with amountCents, dueAt, status
 * @param allocationsTotalCents - Sum of all allocations for this invoice
 * @param now - Current date/time (defaults to new Date())
 * @returns Computed InvoiceStatus
 */
export function computeInvoiceStatus(
  invoice: {
    amountCents: number;
    dueAt: Date | null;
    status: InvoiceStatus; // Current stored status
  },
  allocationsTotalCents: number,
  now: Date = new Date()
): InvoiceStatus {
  // If manually voided, keep VOID (separate admin action)
  if (invoice.status === InvoiceStatus.VOID) {
    return InvoiceStatus.VOID;
  }

  const allocated = allocationsTotalCents;
  const due = invoice.dueAt;

  // No allocations
  if (allocated <= 0) {
    if (due && due < now) {
      return InvoiceStatus.OVERDUE;
    }
    return InvoiceStatus.ISSUED;
  }

  // Partial allocations
  if (allocated > 0 && allocated < invoice.amountCents) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  // Full or over-allocated
  if (allocated >= invoice.amountCents) {
    return InvoiceStatus.PAID;
  }

  // Fallback (should not reach here)
  return InvoiceStatus.ISSUED;
}

/**
 * Recompute and persist invoice status
 * This function must be called whenever allocations change
 * 
 * @param invoiceId - Invoice ID
 * @param tenantId - Tenant ID (for scoping)
 * @param now - Current date/time (defaults to new Date())
 * @returns Updated invoice status
 */
export async function recomputeAndPersistInvoiceStatus(
  invoiceId: string,
  tenantId: string,
  now: Date = new Date()
): Promise<InvoiceStatus> {
  // Load invoice and allocations in transaction
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const allocationsTotalCents = await getInvoiceAllocationsTotalCents(
    invoiceId,
    tenantId
  );

  const newStatus = computeInvoiceStatus(
    invoice,
    allocationsTotalCents,
    now
  );

  // Only update if status changed
  if (newStatus !== invoice.status) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus },
    });
  }

  return newStatus;
}
```

**Guardrail:** All code paths that change allocations must call `recomputeAndPersistInvoiceStatus` inside the same transaction.

### C) Integration Points for Status Engine

**Transaction Pattern:**

Any place we modify allocations (create, update, delete) must:

1. Run inside a DB transaction (Prisma `$transaction`)
2. After allocation changes, call `recomputeAndPersistInvoiceStatus` for affected invoices

**Example:**

```typescript
await prisma.$transaction(async (tx) => {
  // Create allocation
  const allocation = await tx.allocation.create({
    data: {
      tenantId,
      invoiceId,
      paymentId,
      amountCents,
    },
  });

  // Recompute invoice status
  await recomputeAndPersistInvoiceStatus(invoiceId, tenantId);
});
```

**For PAY-10:**
- We only need to support allocations created during migration
- Any existing payment flows that we refactor to use allocations (if applicable)
- We do not change UI behavior yet, but ensure any status writes go through this engine

---

## III. FIN-01 and FIN-02 Refactor

### A) Replace Direct Payment Sums with Allocation Sums

**Current Pattern (to replace):**
```typescript
// OLD: Direct payment sum
const paidAmount = await prisma.payment.aggregate({
  where: {
    invoiceId: invoice.id,
    status: PaymentStatus.SUCCEEDED,
  },
  _sum: { amountCents: true },
});
```

**New Pattern:**
```typescript
// NEW: Allocation sum
const paidAmount = await prisma.allocation.aggregate({
  where: {
    invoiceId: invoice.id,
    tenantId,
    payment: {
      status: PaymentStatus.SUCCEEDED, // Filter by payment status if needed
    },
  },
  _sum: { amountCents: true },
});
```

### B) Balance and Outstanding Logic

**Balance Calculation:**
```typescript
// Use allocation-based balance helper
const allocationsTotal = await getInvoiceAllocationsTotalCents(invoiceId, tenantId);
const balanceCents = computeInvoiceBalanceCents(invoice, allocationsTotal);
```

**Status Grouping (must align with status engine):**
- **OUTSTANDING:** `ISSUED`, `PARTIALLY_PAID`, `OVERDUE`
- **PAID:** `PAID`
- **CANCELLED:** `VOID`, `FAILED`, `DRAFT`

**Status grouping rules must match what FIN-01/02 already expect.**

### C) Source Breakdown

- Keep using `invoice.source` (DUES, EVT, DONATION, OTHER)
- Do not change existing rules for:
  - Zero-amount invoice exclusion
  - On-platform vs off-platform (if already implemented)

### D) Regression Expectation

**After refactor, running FIN-01/02 on the same dataset should yield identical totals to the previous behavior**, except where old logic was already wrong (e.g., missing multi-invoice allocations which did not exist yet).

**Verification:**
- Capture FIN-01/FIN-02 results before refactor (JSON/CSV export)
- Capture results after refactor
- Compare totals (outstanding, collected, by source)
- Spot-check individual invoices for status and balance correctness

---

## IV. Migration Plan and Sequencing

### Suggested PR Structure

#### PR 1: Schema and Models (No Behavioral Changes)

**Changes:**
- Add Allocation, Credit, PaymentAuditLog models to Prisma schema
- Extend Payment model fields (channel, status, verificationStatus, etc.)
- Make Payment.invoiceId nullable
- Add indexes and remove redundant `@@unique([id, tenantId])`
- Run Prisma migration

**Testing:**
- Schema migration succeeds
- Existing queries still work (even if they don't use new fields yet)

**Deployment:**
- Run on dev and rcme-dev first
- No production deployment until PR 2 is ready

#### PR 2: Status Engine and Helpers

**Changes:**
- Implement `computeInvoiceStatus` function
- Implement `recomputeAndPersistInvoiceStatus` function
- Implement allocation-based balance helpers
- Add unit tests for status computation
- Wire any existing internal services that recompute status to use this engine
- **Keep existing FIN-01/02 behavior temporarily using Payments** (will refactor in PR 3)

**Testing:**
- Unit tests for status computation (all scenarios)
- Unit tests for balance calculation
- Integration tests verify status engine works with real Prisma queries

**Deployment:**
- Deploy to rcme-dev
- Verify no regressions in existing behavior

#### PR 3: Backfill Allocations and Refactor FIN-01/02

**Changes:**
- Migration script to backfill Payments and Allocations from existing invoices
- Refactor FIN-01 queries to use Allocations
- Refactor FIN-02 queries to use Allocations
- Add regression tests

**Migration Script Logic:**

```typescript
// For each invoice with status = PAID
async function backfillPaidInvoice(invoice: Invoice) {
  await prisma.$transaction(async (tx) => {
    // Create synthetic Payment
    const payment = await tx.payment.create({
      data: {
        tenantId: invoice.tenantId,
        memberId: invoice.memberId,
        invoiceId: invoice.id, // Keep for backward compatibility
        amountCents: invoice.amountCents,
        currency: invoice.currency,
        channel: PaymentChannel.SIMULATED, // Legacy marker
        status: PaymentStatus.SUCCEEDED,
        verificationStatus: PaymentVerificationStatus.NOT_REQUIRED,
        createdAt: invoice.paidAt || invoice.updatedAt,
      },
    });

    // Create Allocation
    await tx.allocation.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        amountCents: invoice.amountCents,
      },
    });

    // Recompute status (should remain PAID)
    await recomputeAndPersistInvoiceStatus(invoice.id, invoice.tenantId);
  });
}

// For each invoice with status = PARTIALLY_PAID
async function backfillPartiallyPaidInvoice(invoice: Invoice) {
  // Use existing "paid amount" logic (whatever current code uses)
  // Create Payment + Allocation for partial amount
  // Recompute status to confirm PARTIALLY_PAID
}

// For ISSUED/OVERDUE invoices
async function backfillUnpaidInvoice(invoice: Invoice) {
  // No Payment or Allocation created
  // Recompute via status engine so status is consistent with dueAt
  await recomputeAndPersistInvoiceStatus(invoice.id, invoice.tenantId);
}
```

**Testing:**
- Run migration on rcme-dev
- Verify FIN-01 totals match before and after
- Verify FIN-02 balances and statuses are correct
- Spot-check 10 invoices across different statuses

**Deployment:**
- Run migration on rcme-dev first
- Capture before/after snapshots
- Deploy to production with operational guardrails (see below)

### Operational Guardrails for Production Migration

**Pre-Migration:**
1. Backup DB or use snapshot
2. Run migration on rcme-dev and verify:
   - FIN-01 totals match before and after
   - FIN-02 balances and statuses are correct
   - No orphaned Allocations or Payments
3. Document any assumptions or edge cases

**During Migration:**
- Option A: Freeze writes to invoices and payments during migration window
- Option B: Run migration in transaction with row-level locking
- Communicate maintenance window to stakeholders

**Post-Migration Validation:**
1. Run FIN-01 summary, compare to pre-migration baseline
2. Spot-check 10 invoices across different statuses
3. Verify no orphaned Allocations or Payments
4. Monitor error logs for any allocation-related queries

---

## V. Risk and Edge Case Notes

### 1. Race Conditions on Allocations and Status

**Risk:** Concurrent allocation changes could cause status to be computed incorrectly.

**Mitigation:**
- Use Prisma `$transaction` for all flows that:
  - Insert or update Allocations
  - Then recompute invoice status
- Ensure recomputation happens after all Allocation changes in that transaction
- For future online payment flows, use `idempotencyKey` at Payment + Allocation layer

**Example Transaction Pattern:**
```typescript
await prisma.$transaction(async (tx) => {
  // All allocation changes
  const allocation = await tx.allocation.create({ ... });
  
  // Then recompute status
  await recomputeAndPersistInvoiceStatus(invoiceId, tenantId);
});
```

### 2. Orphaned Allocations and Payments

**Risk:** Allocations or Payments without proper references.

**Mitigation:**
- Enforce referential integrity:
  - `Allocation.invoiceId` and `Allocation.paymentId` are non-null with foreign keys
- When deleting a Payment:
  - Either disallow deletion if allocations exist, or soft-delete in future tickets
- Migration script must always:
  - Create Payment first
  - Then create Allocation referencing it
- Do not delete invoices that have allocations

**Validation Query:**
```sql
-- Check for orphaned allocations
SELECT * FROM Allocation 
WHERE invoiceId NOT IN (SELECT id FROM Invoice)
   OR paymentId NOT IN (SELECT id FROM Payment);
```

### 3. Partial and Multi-Invoice Payments

**Risk:** Schema supports it, but v1 may not have full UI support yet.

**Mitigation:**
- Ensure schema supports:
  - One payment → many allocations (even though UI may still be one-to-one initially)
- Test data should include:
  - Payment allocated to two invoices (for future readiness)
  - Invoice with multiple payments (two allocations)

**Test Data Seed:**
```typescript
// Multi-invoice payment
const payment = await createPayment({ amountCents: 5000 });
await createAllocation({ paymentId: payment.id, invoiceId: invoice1.id, amountCents: 3000 });
await createAllocation({ paymentId: payment.id, invoiceId: invoice2.id, amountCents: 2000 });

// Multi-payment invoice
const invoice = await createInvoice({ amountCents: 5000 });
await createAllocation({ paymentId: payment1.id, invoiceId: invoice.id, amountCents: 2000 });
await createAllocation({ paymentId: payment2.id, invoiceId: invoice.id, amountCents: 3000 });
```

### 4. Credits v1 Constraint

**Risk:** Accidental partial application or multi-invoice use.

**Mitigation:**
- When applying credit, enforce:
  - If status = AVAILABLE, you may only set:
    - `status = APPLIED`
    - `appliedToInvoiceId` set
    - `appliedAt` set
  - Do not allow status transitions to "partially applied"
- This keeps v1 simple and avoids scope creep

**Validation in Code:**
```typescript
async function applyCredit(creditId: string, invoiceId: string, tenantId: string) {
  const credit = await prisma.credit.findFirst({
    where: { id: creditId, tenantId, status: CreditStatus.AVAILABLE },
  });
  
  if (!credit) {
    throw new Error("Credit not available");
  }
  
  // v1: Apply full amount only
  await prisma.$transaction(async (tx) => {
    // Create allocation from credit
    // Update credit status to APPLIED
    // Recompute invoice status
  });
}
```

### 5. Backfill Accuracy

**Risk:** Migration backfill may not match existing "paid amount" logic exactly.

**Mitigation:**
- The backfill for PAID/PARTIALLY_PAID invoices must:
  - Use the exact amount that existing FIN-01/FIN-02 logic considered "paid"
- If there is ambiguity, document any assumptions in comments and in the migration notes
- Capture before/after totals to verify equivalence

**Verification Query:**
```sql
-- Compare before/after totals
SELECT 
  source,
  COUNT(*) as invoice_count,
  SUM(amountCents) as total_amount,
  SUM(CASE WHEN status = 'PAID' THEN amountCents ELSE 0 END) as paid_amount
FROM Invoice
WHERE tenantId = 'rcme-dev'
GROUP BY source;
```

---

## VI. Test Coverage Outline

### A) Unit Tests for Status Engine

**File:** `auth-service/tests/invoiceStatusEngine.test.ts`

**Test Cases:**
1. No allocations, due in future → `ISSUED`
2. No allocations, past due → `OVERDUE`
3. `allocationsTotalCents` between 1 and `amountCents - 1` → `PARTIALLY_PAID`
4. `allocationsTotalCents >= amountCents` → `PAID`
5. VOID invoices (manually set) stay `VOID` regardless of allocations
6. Edge case: `allocationsTotalCents = 0` with past due → `OVERDUE`
7. Edge case: `allocationsTotalCents > amountCents` (overpayment) → `PAID`

**Example:**
```typescript
describe("computeInvoiceStatus", () => {
  it("should return ISSUED when no allocations and not past due", () => {
    const invoice = { amountCents: 10000, dueAt: futureDate, status: InvoiceStatus.ISSUED };
    const status = computeInvoiceStatus(invoice, 0);
    expect(status).toBe(InvoiceStatus.ISSUED);
  });
  
  it("should return OVERDUE when no allocations and past due", () => {
    const invoice = { amountCents: 10000, dueAt: pastDate, status: InvoiceStatus.ISSUED };
    const status = computeInvoiceStatus(invoice, 0);
    expect(status).toBe(InvoiceStatus.OVERDUE);
  });
  
  // ... more test cases
});
```

### B) Unit Tests for Balance Helper

**File:** `auth-service/tests/invoiceBalance.test.ts`

**Test Cases:**
1. Invoice with no allocations → balance = `amountCents`
2. Invoice with partial allocations → balance = `amountCents - allocationsTotal`
3. Invoice with full allocations → balance = 0
4. Invoice with over-allocations → balance = 0 (never negative)
5. Edge case: `amountCents = 0` → balance = 0

### C) FIN-01 and FIN-02 Regression Tests

**File:** `auth-service/tests/fin01-fin02-regression.test.ts`

**Test Setup:**
1. Seed test dataset:
   - One fully paid invoice (DUES source)
   - One partially paid invoice (EVT source)
   - One overdue unpaid invoice (DONATION source)
   - One issued unpaid invoice (OTHER source)

2. **Before refactor (baseline):**
   - Run FIN-01 endpoint, capture results
   - Run FIN-02 endpoint, capture results
   - Store as JSON snapshots

3. **After refactor:**
   - Run same endpoints
   - Compare totals:
     - Total outstanding
     - Total collected
     - Per source breakdown (DUES, EVT, DONATION, OTHER)
   - Assert totals match (within tolerance for rounding)

**Example:**
```typescript
describe("FIN-01/FIN-02 Regression", () => {
  it("should return same totals after allocation refactor", async () => {
    // Seed test data
    await seedTestInvoices();
    
    // Capture baseline (if running before refactor)
    const baseline = await getFinanceSummary();
    
    // After refactor, run again
    const afterRefactor = await getFinanceSummary();
    
    // Compare
    expect(afterRefactor.totals.outstanding.totalCents).toBe(baseline.totals.outstanding.totalCents);
    expect(afterRefactor.totals.collected.totalCents).toBe(baseline.totals.collected.totalCents);
  });
});
```

### D) Migration Verification (rcme-dev)

**Manual Verification Steps:**

1. **Before Migration:**
   ```bash
   # Export FIN-01 results
   curl -H "Authorization: Bearer $TOKEN" \
     "https://rcme-dev/api/billing/admin/finance/summary" > fin01-before.json
   
   # Export FIN-02 sample
   curl -H "Authorization: Bearer $TOKEN" \
     "https://rcme-dev/api/billing/invoices/tenant?page=1&pageSize=50" > fin02-before.json
   ```

2. **Run Migration:**
   ```bash
   npm run migrate:pay10-backfill
   ```

3. **After Migration:**
   ```bash
   # Export FIN-01 results
   curl -H "Authorization: Bearer $TOKEN" \
     "https://rcme-dev/api/billing/admin/finance/summary" > fin01-after.json
   
   # Compare
   diff fin01-before.json fin01-after.json
   ```

4. **Spot Check:**
   - Open admin UI, check 10 invoices:
     - Status matches expectations
     - Balance matches allocation-based calculation
     - Payment history shows allocations correctly

5. **Validation Queries:**
   ```sql
   -- Check for orphaned allocations
   SELECT COUNT(*) FROM Allocation 
   WHERE invoiceId NOT IN (SELECT id FROM Invoice)
      OR paymentId NOT IN (SELECT id FROM Payment);
   
   -- Verify allocation totals match invoice balances
   SELECT 
     i.id,
     i.amountCents,
     COALESCE(SUM(a.amountCents), 0) as allocated,
     i.amountCents - COALESCE(SUM(a.amountCents), 0) as balance
   FROM Invoice i
   LEFT JOIN Allocation a ON a.invoiceId = i.id
   WHERE i.tenantId = 'rcme-dev'
   GROUP BY i.id, i.amountCents
   HAVING balance < 0; -- Should return 0 rows (no negative balances)
   ```

---

## VII. Scope Control

### In Scope for PAY-10

- ✅ Payment model alignment (nullable invoiceId, new fields)
- ✅ Allocation model introduction
- ✅ Credit model (v1: single invoice only)
- ✅ PaymentAuditLog stub
- ✅ Invoice status engine (single function)
- ✅ Allocation-based balance helpers
- ✅ FIN-01/FIN-02 refactor to use Allocations
- ✅ Migration script for existing invoices
- ✅ Schema hygiene (remove redundant indexes)

### Out of Scope for PAY-10

- ❌ UI changes (member or admin)
- ❌ Traxion integration or webhooks
- ❌ Manual payment flow, proof upload endpoints, approval screens
- ❌ Reconciliation job
- ❌ Reminder engine implementation (ReminderLog model can wait)
- ❌ Changes to events behavior beyond what is required for EVT-01 to EVT-04 to keep working

### Future Tickets

- **PAY-11:** Manual Payment Flow (create, approve, reject)
- **PAY-12:** Traxion Integration
- **PAY-13:** Member Payment UI
- **PAY-14:** Admin Payments Inbox

---

## VIII. Acceptance Criteria

At the end of this ticket:

1. ✅ Payment model supports channels, status, verification, and nullable invoiceId
2. ✅ Allocation model exists and is indexed for performance
3. ✅ Credit model exists with v1 constraint (single invoice only)
4. ✅ `computeInvoiceStatus` is the only path to update Invoice.status
5. ✅ Balance calculations use Allocations, not Payment.invoiceId
6. ✅ FIN-01 and FIN-02 use Allocations and return same totals as before (on same data)
7. ✅ Migration script backfills existing invoices with Payments and Allocations
8. ✅ All existing tests pass, new tests cover status engine and balance helpers
9. ✅ rcme-dev migration verified with before/after comparison

---

## IX. Implementation Checklist

### Phase 1: Schema
- [ ] Add Allocation model to Prisma schema
- [ ] Add Credit model to Prisma schema
- [ ] Add PaymentAuditLog model to Prisma schema
- [ ] Extend Payment model (nullable invoiceId, new fields)
- [ ] Add PaymentChannel, PaymentStatus, PaymentVerificationStatus, CreditStatus enums
- [ ] Remove redundant `@@unique([id, tenantId])` indexes
- [ ] Run Prisma migration on dev
- [ ] Verify schema migration succeeds

### Phase 2: Helpers
- [ ] Implement `getInvoiceAllocationsTotalCents`
- [ ] Implement `computeInvoiceBalanceCents`
- [ ] Implement `computeInvoiceStatus`
- [ ] Implement `recomputeAndPersistInvoiceStatus`
- [ ] Add unit tests for status engine
- [ ] Add unit tests for balance helpers
- [ ] Deploy to rcme-dev

### Phase 3: Migration and Refactor
- [ ] Write migration script for backfilling Payments and Allocations
- [ ] Test migration script on rcme-dev
- [ ] Capture FIN-01/FIN-02 baseline on rcme-dev
- [ ] Run migration on rcme-dev
- [ ] Refactor FIN-01 queries to use Allocations
- [ ] Refactor FIN-02 queries to use Allocations
- [ ] Add regression tests for FIN-01/FIN-02
- [ ] Verify FIN-01/FIN-02 totals match after refactor
- [ ] Document operational guardrails for production migration

---

**Last updated:** 2025-12-13 00:00 (local)  
**Status:** Ready for Engineering Implementation
