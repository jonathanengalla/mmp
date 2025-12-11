import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Use string literals to avoid mismatch with generated client cache
type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID"
  | "FAILED";

async function backfillInvoices() {
  console.log("Starting invoice backfill...");

  const tenants = await prisma.tenant.findMany();

  for (const tenant of tenants) {
    console.log(`\nProcessing tenant: ${tenant.slug}`);

    const invoices = await prisma.invoice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
      include: { event: true, payments: true },
    });

    // per-year, per-type sequences
    const seq: Record<string, Record<string, number>> = {};

    for (const invoice of invoices) {
      const createdYear = new Date(invoice.createdAt).getFullYear();
      const type = invoice.eventId ? "EVT" : "DUES";
      seq[createdYear] = seq[createdYear] || {};
      seq[createdYear][type] = seq[createdYear][type] || 0;
      seq[createdYear][type] += 1;
      const padded = seq[createdYear][type].toString().padStart(3, "0");
      const invoiceNumber = `${tenant.slug.toUpperCase()}-${createdYear}-${type}-${padded}`;

      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountCents, 0);
      const now = new Date();
      const isPastDue = invoice.dueAt ? new Date(invoice.dueAt) < now : false;

      let newStatus: InvoiceStatus = "ISSUED";
      if (invoice.status === "PAID") {
        newStatus = "PAID";
      } else if (totalPaid >= invoice.amountCents) {
        newStatus = "PAID";
      } else if (totalPaid > 0) {
        newStatus = "PARTIALLY_PAID";
      } else if (isPastDue) {
        newStatus = "OVERDUE";
      } else {
        newStatus = "ISSUED";
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { invoiceNumber, status: newStatus as any },
      });

      console.log(`  ✓ ${invoiceNumber} -> ${newStatus} (was ${invoice.status})`);
    }

    console.log(`Completed tenant ${tenant.slug}: ${invoices.length} invoices`);
  }

  console.log("\n✅ Backfill complete.");
}

backfillInvoices()
  .catch((err) => {
    console.error("Backfill failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

