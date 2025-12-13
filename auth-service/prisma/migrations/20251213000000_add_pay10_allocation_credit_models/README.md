# PAY-10 Migration: Add Allocation, Credit, and PaymentAuditLog Models

**Migration Name:** `20251213000000_add_pay10_allocation_credit_models`

## What This Migration Does

1. **Creates new enums:**
   - `PaymentChannel` (SIMULATED, TRAXION, MANUAL_CASH, MANUAL_BANK, MANUAL_OTHER)
   - `PaymentVerificationStatus` (NOT_REQUIRED, PENDING_VERIFICATION, APPROVED, REJECTED)
   - `CreditStatus` (AVAILABLE, APPLIED, VOIDED)
   - `PaymentAuditAction` (CREATED, SUBMITTED, VERIFIED, APPROVED, REJECTED, ALLOCATED, REVERSED, REFUNDED, STATUS_CHANGED)

2. **Extends PaymentStatus enum:**
   - Adds INITIATED, REVERSED, REFUNDED

3. **Updates Payment table:**
   - Makes `invoiceId` nullable
   - Adds `channel` (PaymentChannel, default: SIMULATED)
   - Adds `verificationStatus` (PaymentVerificationStatus, default: NOT_REQUIRED)
   - Adds `externalReference`, `idempotencyKey`, `proofUrl`, `verifiedBy`, `verifiedAt`, `createdBy`
   - Changes `status` default to INITIATED
   - Sets `currency` default to PHP

4. **Creates new tables:**
   - `Allocation` (links Payment to Invoice with amountCents)
   - `Credit` (for overpayments, v1: single invoice only)
   - `PaymentAuditLog` (audit trail for payment events)

5. **Adds indexes and foreign keys:**
   - Proper tenant scoping
   - Composite foreign keys for multi-tenant safety

## Important Notes

⚠️ **This migration file was created manually.** When the database is available, you should:

1. **Verify the migration SQL is correct:**
   ```bash
   cd auth-service
   npm run migrate:dev -- --name add_pay10_allocation_credit_models
   ```
   
   This will:
   - Compare the schema to current database state
   - Generate the correct migration SQL
   - Apply it to the database

2. **If the migration file already exists** (as it does now), Prisma will:
   - Use this file if it matches what it would generate
   - Or regenerate if there are differences

3. **After migration is applied:**
   - Run the backfill script: `npm run migrate:pay10-backfill`
   - Verify FIN-01/FIN-02 totals match

## Rollback

If you need to rollback this migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS "PaymentAuditLog";
DROP TABLE IF EXISTS "Credit";
DROP TABLE IF EXISTS "Allocation";

-- Remove new columns from Payment
ALTER TABLE "Payment" 
  DROP COLUMN IF EXISTS "channel",
  DROP COLUMN IF EXISTS "verificationStatus",
  DROP COLUMN IF EXISTS "externalReference",
  DROP COLUMN IF EXISTS "idempotencyKey",
  DROP COLUMN IF EXISTS "proofUrl",
  DROP COLUMN IF EXISTS "verifiedBy",
  DROP COLUMN IF EXISTS "verifiedAt",
  DROP COLUMN IF EXISTS "createdBy";

-- Make invoiceId NOT NULL again (if no null values exist)
ALTER TABLE "Payment" ALTER COLUMN "invoiceId" SET NOT NULL;

-- Note: Enum values cannot be easily removed, but new values won't break existing code
```

---

**Created:** 2025-12-13  
**Status:** Ready to apply when database is available
