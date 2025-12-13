# PAY-10 Migration Guide

**Purpose:** Step-by-step guide for migrating to the Allocation-based payment model

## Prerequisites

1. Database backup or snapshot
2. Access to rcme-dev environment
3. All code changes from PAY-10 are deployed

## Migration Steps

### Step 1: Run Prisma Migration

```bash
cd auth-service

# Generate Prisma client with new schema
npm run prisma:generate

# Create and apply migration
npm run migrate:dev
# Or for production:
# npm run migrate:deploy
```

**Expected:** Migration file created in `prisma/migrations/` with Allocation, Credit, PaymentAuditLog tables and Payment model updates.

### Step 2: Verify Schema Migration

```bash
# Check that new tables exist
psql $DATABASE_URL -c "\dt" | grep -E "(Allocation|Credit|PaymentAuditLog)"

# Verify Payment model has new fields
psql $DATABASE_URL -c "\d \"Payment\"" | grep -E "(channel|verificationStatus|idempotencyKey)"
```

### Step 3: Run Unit Tests

```bash
# Test status engine
npm run test:pay10-status

# Test balance helpers
npm run test:pay10-balance

# Test regression (requires test data)
npm run test:pay10-regression
```

All tests should pass.

### Step 4: Capture Baseline (rcme-dev)

**Before running migration script, capture current state:**

```bash
# Export FIN-01 summary
curl -H "Authorization: Bearer $TOKEN" \
  "https://rcme-dev/api/billing/admin/finance/summary?period=ALL_TIME" \
  > fin01-before.json

# Export FIN-02 sample (first 50 invoices)
curl -H "Authorization: Bearer $TOKEN" \
  "https://rcme-dev/api/billing/invoices/tenant?page=1&pageSize=50" \
  > fin02-before.json

# Count invoices by status
psql $DATABASE_URL -c "
  SELECT status, COUNT(*), SUM(amountCents) 
  FROM \"Invoice\" 
  WHERE \"tenantId\" = 'rcme-dev' 
  GROUP BY status;
" > invoice-status-before.txt
```

### Step 5: Run Backfill Migration Script

```bash
# Run migration script on rcme-dev
npm run migrate:pay10-backfill
```

**Expected output:**
```
Starting PAY-10 migration: Backfilling Payments and Allocations
============================================================
Found X total invoices
  Backfilling PAID invoice ...
  Backfilling PARTIALLY_PAID invoice ...
  ...
============================================================
Migration complete!
  PAID invoices backfilled: X
  PARTIALLY_PAID invoices backfilled: Y
  Unpaid invoices status recomputed: Z
  Total processed: X+Y+Z
✓ No orphaned allocations found
```

### Step 6: Verify Migration Results

```bash
# Export FIN-01 summary after migration
curl -H "Authorization: Bearer $TOKEN" \
  "https://rcme-dev/api/billing/admin/finance/summary?period=ALL_TIME" \
  > fin01-after.json

# Compare totals
diff fin01-before.json fin01-after.json

# Export FIN-02 sample after migration
curl -H "Authorization: Bearer $TOKEN" \
  "https://rcme-dev/api/billing/invoices/tenant?page=1&pageSize=50" \
  > fin02-after.json

# Verify allocation totals match invoice balances
psql $DATABASE_URL -c "
  SELECT 
    i.id,
    i.\"invoiceNumber\",
    i.\"amountCents\",
    COALESCE(SUM(a.\"amountCents\"), 0) as allocated,
    i.\"amountCents\" - COALESCE(SUM(a.\"amountCents\"), 0) as balance
  FROM \"Invoice\" i
  LEFT JOIN \"Allocation\" a ON a.\"invoiceId\" = i.id
  WHERE i.\"tenantId\" = 'rcme-dev'
  GROUP BY i.id, i.\"invoiceNumber\", i.\"amountCents\"
  HAVING balance < 0
  LIMIT 10;
" 
# Should return 0 rows (no negative balances)

# Check for orphaned allocations
psql $DATABASE_URL -c "
  SELECT COUNT(*) 
  FROM \"Allocation\" a
  WHERE a.\"invoiceId\" NOT IN (SELECT id FROM \"Invoice\")
     OR a.\"paymentId\" NOT IN (SELECT id FROM \"Payment\");
"
# Should return 0
```

### Step 7: Spot Check Individual Invoices

1. Open admin UI on rcme-dev
2. Navigate to Finance Dashboard (FIN-01)
3. Verify totals match expectations
4. Navigate to Invoice List (FIN-02)
5. Check 10 invoices:
   - Status is correct
   - Balance matches allocation-based calculation
   - Payment history shows allocations correctly

### Step 8: Run Regression Tests

```bash
# Run full regression test suite
npm run test:pay10-regression
npm run test:fin-01
npm run test:fin02
```

All tests should pass.

## Production Migration

**Only proceed after successful rcme-dev migration and verification.**

### Pre-Migration Checklist

- [ ] rcme-dev migration successful
- [ ] FIN-01/FIN-02 totals match before/after
- [ ] No orphaned allocations found
- [ ] All unit tests pass
- [ ] Database backup/snapshot taken
- [ ] Maintenance window scheduled
- [ ] Stakeholders notified

### Production Steps

1. **Freeze writes** (if possible) or use transaction window
2. **Run Prisma migration:**
   ```bash
   npm run migrate:deploy
   ```
3. **Run backfill script:**
   ```bash
   npm run migrate:pay10-backfill
   ```
4. **Verify:**
   - FIN-01 totals match baseline
   - Spot-check 10 invoices
   - No errors in logs
5. **Resume normal operations**

## Rollback Plan

If migration fails:

1. **Do not delete new tables** (Allocation, Credit, PaymentAuditLog) - they're empty initially
2. **Revert code** to previous version
3. **Restore database** from backup if needed
4. **Investigate** root cause before retrying

## Troubleshooting

### Issue: Migration script fails with "Invoice not found"
- **Cause:** Tenant ID mismatch
- **Fix:** Verify `TEST_TENANT_ID` or ensure script uses correct tenant context

### Issue: FIN-01 totals don't match
- **Cause:** Allocation backfill incomplete or incorrect
- **Fix:** Check migration script logs, verify allocations were created correctly

### Issue: Negative balances
- **Cause:** Allocation amount exceeds invoice amount (shouldn't happen in migration)
- **Fix:** Review migration script logic, check for data inconsistencies

### Issue: Orphaned allocations
- **Cause:** Invoice or Payment deleted after allocation created
- **Fix:** Run cleanup query to remove orphaned records

## Post-Migration

1. Monitor error logs for allocation-related queries
2. Verify FIN-01/FIN-02 endpoints respond correctly
3. Update documentation if needed
4. Mark PAY-10 as complete in master checklist

---

**Last updated:** 2025-12-13
