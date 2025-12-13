# PAY-10 Next Steps Checklist

**Status:** Implementation Complete - Ready for Testing & Migration  
**Date:** 2025-12-13

## ✅ What's Complete

All core implementation for PAY-10 is complete:

- ✅ Prisma schema updated (Payment, Allocation, Credit, PaymentAuditLog)
- ✅ Invoice status engine implemented (`computeInvoiceStatus`)
- ✅ Balance helpers using Allocations
- ✅ FIN-01 refactored to use Allocations
- ✅ FIN-02 refactored to use Allocations (admin + member)
- ✅ Migration script created
- ✅ Unit tests for status engine and balance helpers
- ✅ Regression tests for FIN-01/FIN-02

## 📋 Immediate Next Steps

### 1. Generate Prisma Client

```bash
cd auth-service
npm run prisma:generate
```

This generates the Prisma client with the new models (Allocation, Credit, PaymentAuditLog).

### 2. Create Database Migration

```bash
npm run migrate:dev
```

This will:
- Create a migration file in `prisma/migrations/`
- Apply the migration to your dev database
- Generate the new tables and update Payment model

**Review the migration file** before applying to ensure it matches expectations.

### 3. Run Unit Tests

```bash
# Test status engine
npm run test:pay10-status

# Test balance helpers  
npm run test:pay10-balance

# Test regression (creates test data)
npm run test:pay10-regression
```

All tests should pass. If any fail, fix issues before proceeding.

### 4. Test on rcme-dev

**Before running migration script:**

```bash
# Capture baseline FIN-01 summary
curl -H "Authorization: Bearer $TOKEN" \
  "https://rcme-dev/api/billing/admin/finance/summary?period=ALL_TIME" \
  > /tmp/fin01-before.json

# Capture baseline FIN-02 sample
curl -H "Authorization: Bearer $TOKEN" \
  "https://rcme-dev/api/billing/invoices/tenant?page=1&pageSize=50" \
  > /tmp/fin02-before.json
```

**Run migration script:**

```bash
npm run migrate:pay10-backfill
```

**After migration, verify:**

```bash
# Capture after state
curl -H "Authorization: Bearer $TOKEN" \
  "https://rcme-dev/api/billing/admin/finance/summary?period=ALL_TIME" \
  > /tmp/fin01-after.json

# Compare totals (should match)
diff /tmp/fin01-before.json /tmp/fin01-after.json
```

### 5. Verify Individual Invoices

1. Open admin UI on rcme-dev
2. Check Finance Dashboard - totals should match baseline
3. Check Invoice List - balances should be correct
4. Spot-check 10 invoices:
   - Status is correct
   - Balance = amountCents - sum(allocations)
   - No negative balances

### 6. Run Existing Tests

```bash
# Ensure existing tests still pass
npm run test:fin-01
npm run test:fin02
npm run test:evt02-registration
npm run test:bks05-events-billing
```

## 🚨 Known Issues to Watch For

1. **Migration script assumes existing Payment records** for PARTIALLY_PAID invoices. If no payments exist, it will skip allocation creation.

2. **Legacy `calculateInvoiceBalance` function** is kept for backward compatibility but should not be used in new code.

3. **Test tenant ID** in regression tests uses `"test-tenant-pay10"` - update if your test setup uses different tenant IDs.

## 📝 Production Migration Checklist

Before running on production:

- [ ] rcme-dev migration successful
- [ ] FIN-01 totals match before/after on rcme-dev
- [ ] FIN-02 balances correct on rcme-dev
- [ ] All unit tests pass
- [ ] All regression tests pass
- [ ] Database backup taken
- [ ] Maintenance window scheduled
- [ ] Stakeholders notified

See `auth-service/scripts/PAY-10-migration-guide.md` for detailed production migration steps.

## 🔍 Verification Queries

After migration, run these to verify data integrity:

```sql
-- Check for orphaned allocations
SELECT COUNT(*) 
FROM "Allocation" a
WHERE a."invoiceId" NOT IN (SELECT id FROM "Invoice")
   OR a."paymentId" NOT IN (SELECT id FROM "Payment");

-- Verify no negative balances
SELECT 
  i.id,
  i."invoiceNumber",
  i."amountCents",
  COALESCE(SUM(a."amountCents"), 0) as allocated,
  i."amountCents" - COALESCE(SUM(a."amountCents"), 0) as balance
FROM "Invoice" i
LEFT JOIN "Allocation" a ON a."invoiceId" = i.id
WHERE i."tenantId" = 'rcme-dev'
GROUP BY i.id, i."invoiceNumber", i."amountCents"
HAVING balance < 0;

-- Verify allocation totals match payment amounts
SELECT 
  p.id,
  p."amountCents" as payment_amount,
  COALESCE(SUM(a."amountCents"), 0) as allocated_total
FROM "Payment" p
LEFT JOIN "Allocation" a ON a."paymentId" = p.id
WHERE p."tenantId" = 'rcme-dev'
GROUP BY p.id, p."amountCents"
HAVING p."amountCents" != COALESCE(SUM(a."amountCents"), 0);
```

All should return 0 rows or expected values.

## 📚 Documentation

- **Spec:** `docs/specs/payments/PAY-10-core-schema-and-status-engine.md`
- **Migration Guide:** `auth-service/scripts/PAY-10-migration-guide.md`
- **Implementation Summary:** `docs/specs/payments/PAY-10-implementation-summary.md`

## 🎯 Success Criteria

PAY-10 is complete when:

1. ✅ Schema migration applied successfully
2. ✅ Migration script run on rcme-dev
3. ✅ FIN-01 totals match before/after
4. ✅ FIN-02 balances correct
5. ✅ All tests pass
6. ✅ No orphaned allocations
7. ✅ No negative balances

---

**Ready for:** Testing and rcme-dev migration  
**Blocked on:** None - all code complete
