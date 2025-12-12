import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_SLUG = "rcme-dev";

async function cleanupZeroInvoices() {
  console.log(`Cleaning up zero-amount invoices for tenant slug: ${TENANT_SLUG} ...`);

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.error(`❌ Tenant with slug '${TENANT_SLUG}' not found. Aborting.`);
    process.exit(1);
  }

  const tenantId = tenant.id;

  const zeroInvoices = await prisma.invoice.findMany({
    where: { tenantId, amountCents: 0 },
  });

  console.log(`Found ${zeroInvoices.length} zero-amount invoices`);

  const deleted = await prisma.invoice.deleteMany({
    where: { tenantId, amountCents: 0 },
  });

  console.log(`✅ Deleted ${deleted.count} zero-amount invoices`);
}

cleanupZeroInvoices()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

