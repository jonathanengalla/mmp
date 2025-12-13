/**
 * PAY-10 Migration Script: Backfill Payments and Allocations
 * 
 * This script migrates existing invoices to the new Allocation-based model:
 * - For PAID invoices: creates synthetic Payment and Allocation for full amount
 * - For PARTIALLY_PAID invoices: creates synthetic Payment and Allocation for partial amount
 * - For unpaid invoices: recomputes status via status engine
 * 
 * Usage:
 *   npm run migrate:pay10-backfill
 * 
 * Safety:
 *   - Run on rcme-dev first
 *   - Backup database before running
 *   - Verify FIN-01/FIN-02 totals before and after
 */

import { PrismaClient, InvoiceStatus, PaymentStatus, PaymentChannel, PaymentVerificationStatus } from "@prisma/client";
import { recomputeAndPersistInvoiceStatus } from "../src/services/invoice/computeInvoiceStatus";
import { getInvoiceAllocationsTotalCents } from "../src/services/invoice/balance";

const prisma = new PrismaClient();

async function backfillPaidInvoice(invoice: any) {
  console.log(`  Backfilling PAID invoice ${invoice.id} (${invoice.invoiceNumber})`);
  
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
        createdAt: invoice.paidAt || invoice.updatedAt || invoice.createdAt,
        processedAt: invoice.paidAt || invoice.updatedAt || invoice.createdAt,
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

async function backfillPartiallyPaidInvoice(invoice: any) {
  console.log(`  Backfilling PARTIALLY_PAID invoice ${invoice.id} (${invoice.invoiceNumber})`);
  
  // For partially paid, we need to determine the paid amount
  // Since we don't have historical payment data, we'll use a heuristic:
  // If paidAt is set, assume it was fully paid at that time
  // Otherwise, we'll need to check if there are existing Payment records
  
  const existingPayments = await prisma.payment.findMany({
    where: {
      invoiceId: invoice.id,
      tenantId: invoice.tenantId,
      status: PaymentStatus.SUCCEEDED,
    },
  });

  const paidAmount = existingPayments.reduce((sum, p) => sum + p.amountCents, 0);
  
  // If no existing payments, we can't determine partial amount accurately
  // In this case, we'll create a payment for the difference (amountCents - some estimate)
  // For now, let's use a conservative approach: if paidAt exists, treat as fully paid
  // Otherwise, skip and let status engine handle it
  
  if (paidAmount > 0 && paidAmount < invoice.amountCents) {
    await prisma.$transaction(async (tx) => {
      // Use existing payment if it exists
      let paymentId: string;
      
      if (existingPayments.length > 0) {
        paymentId = existingPayments[0].id;
      } else {
        // Create synthetic payment for partial amount
        const payment = await tx.payment.create({
          data: {
            tenantId: invoice.tenantId,
            memberId: invoice.memberId,
            invoiceId: invoice.id,
            amountCents: paidAmount,
            currency: invoice.currency,
            channel: PaymentChannel.SIMULATED,
            status: PaymentStatus.SUCCEEDED,
            verificationStatus: PaymentVerificationStatus.NOT_REQUIRED,
            createdAt: invoice.updatedAt || invoice.createdAt,
            processedAt: invoice.updatedAt || invoice.createdAt,
          },
        });
        paymentId = payment.id;
      }

      // Create Allocation
      await tx.allocation.create({
        data: {
          tenantId: invoice.tenantId,
          invoiceId: invoice.id,
          paymentId,
          amountCents: paidAmount,
        },
      });

      // Recompute status
      await recomputeAndPersistInvoiceStatus(invoice.id, invoice.tenantId);
    });
  } else if (invoice.paidAt) {
    // If paidAt is set but no payments, treat as fully paid
    await backfillPaidInvoice(invoice);
  } else {
    // No payment data, just recompute status
    await recomputeAndPersistInvoiceStatus(invoice.id, invoice.tenantId);
  }
}

async function backfillUnpaidInvoice(invoice: any) {
  // No Payment or Allocation created
  // Just recompute status to ensure it's consistent with dueAt
  await recomputeAndPersistInvoiceStatus(invoice.id, invoice.tenantId);
}

async function main() {
  console.log("Starting PAY-10 migration: Backfilling Payments and Allocations");
  console.log("=" .repeat(60));

  try {
    // Get all invoices grouped by status
    const allInvoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${allInvoices.length} total invoices`);

    let paidCount = 0;
    let partiallyPaidCount = 0;
    let unpaidCount = 0;

    for (const invoice of allInvoices) {
      if (invoice.status === InvoiceStatus.PAID) {
        await backfillPaidInvoice(invoice);
        paidCount++;
      } else if (invoice.status === InvoiceStatus.PARTIALLY_PAID) {
        await backfillPartiallyPaidInvoice(invoice);
        partiallyPaidCount++;
      } else {
        await backfillUnpaidInvoice(invoice);
        unpaidCount++;
      }
    }

    console.log("=" .repeat(60));
    console.log("Migration complete!");
    console.log(`  PAID invoices backfilled: ${paidCount}`);
    console.log(`  PARTIALLY_PAID invoices backfilled: ${partiallyPaidCount}`);
    console.log(`  Unpaid invoices status recomputed: ${unpaidCount}`);
    console.log(`  Total processed: ${allInvoices.length}`);

    // Verification: Check for orphaned allocations
    // Query allocations and check if invoice/payment exist
    const allAllocations = await prisma.allocation.findMany({
      select: { id: true, invoiceId: true, paymentId: true },
    });
    
    const invoiceIds = [...new Set(allAllocations.map(a => a.invoiceId))];
    const paymentIds = [...new Set(allAllocations.map(a => a.paymentId))];
    
    const existingInvoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true },
    });
    const existingPayments = await prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      select: { id: true },
    });
    
    const existingInvoiceIds = new Set(existingInvoices.map(i => i.id));
    const existingPaymentIds = new Set(existingPayments.map(p => p.id));
    
    const orphanedAllocations = allAllocations.filter(
      a => !existingInvoiceIds.has(a.invoiceId) || !existingPaymentIds.has(a.paymentId)
    );

    if (orphanedAllocations.length > 0) {
      console.warn(`WARNING: Found ${orphanedAllocations.length} orphaned allocations`);
    } else {
      console.log("✓ No orphaned allocations found");
    }

  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("Migration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration script failed:", error);
      process.exit(1);
    });
}

export { main as migratePay10Backfill };
