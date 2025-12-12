import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupRcmeInvoices() {
  console.log("Cleaning up rcme-dev billing data...");

  const tenantId = "rcme-dev";

  // Delete payments first (FK constraint)
  const deletedPayments = await prisma.payment.deleteMany({
    where: { tenantId },
  });
  console.log(`Deleted ${deletedPayments.count} payments`);

  const deletedInvoices = await prisma.invoice.deleteMany({
    where: { tenantId },
  });
  console.log(`Deleted ${deletedInvoices.count} invoices`);

  console.log("✅ Cleanup complete - ready for reseed");
}

cleanupRcmeInvoices()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

