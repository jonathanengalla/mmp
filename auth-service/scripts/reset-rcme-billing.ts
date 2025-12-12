import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RCME_SLUG = "rcme-dev";

async function resetRcmeBilling() {
  const env = process.env.NODE_ENV || "";
  if (env.toLowerCase() === "production") {
    throw new Error("Refusing to reset billing in production. Set NODE_ENV to non-production to proceed.");
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: RCME_SLUG } });
  if (!tenant) {
    throw new Error(`Tenant with slug ${RCME_SLUG} not found. Aborting reset.`);
  }

  const tenantId = tenant.id;
  console.log(`Resetting billing for rcme-dev (tenantId=${tenantId})`);

  // Null out invoiceId on event registrations to avoid FK issues
  const clearedRegs = await prisma.eventRegistration.updateMany({
    where: { tenantId, invoiceId: { not: null } },
    data: { invoiceId: null },
  });
  console.log(`Cleared invoiceId on ${clearedRegs.count} event registrations`);

  // Delete payments first (FK)
  const payments = await prisma.payment.deleteMany({ where: { tenantId } });
  console.log(`Deleted ${payments.count} payments`);

  // Delete invoices for this tenant
  const invoices = await prisma.invoice.deleteMany({ where: { tenantId } });
  console.log(`Deleted ${invoices.count} invoices`);

  console.log("✅ Billing reset complete for rcme-dev. Ready for reseed.");
}

resetRcmeBilling()
  .catch((e) => {
    console.error("❌ Billing reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

