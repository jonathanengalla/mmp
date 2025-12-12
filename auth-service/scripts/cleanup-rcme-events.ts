import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TENANT_SLUG = "rcme-dev";

async function cleanupRcmeEvents() {
  console.log(`Cleaning up events and registrations for tenant slug: ${TENANT_SLUG} ...`);

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    console.error(`❌ Tenant with slug '${TENANT_SLUG}' not found. Aborting.`);
    process.exit(1);
  }

  const tenantId = tenant.id;

  // Delete registrations first (FK to events)
  const deletedRegistrations = await prisma.eventRegistration.deleteMany({
    where: { tenantId },
  });
  console.log(`✅ Deleted ${deletedRegistrations.count} event registrations`);

  // Delete payments linked to event invoices (safety)
  const deletedPayments = await prisma.payment.deleteMany({
    where: { tenantId, invoice: { eventId: { not: null } } },
  });
  console.log(`✅ Deleted ${deletedPayments.count} payments tied to event invoices`);

  // Null out invoiceId on event registrations (if any remain)
  await prisma.eventRegistration.updateMany({
    where: { tenantId, invoiceId: { not: null } },
    data: { invoiceId: null },
  });

  // Delete invoices linked to events
  const deletedInvoices = await prisma.invoice.deleteMany({
    where: { tenantId, eventId: { not: null } },
  });
  console.log(`✅ Deleted ${deletedInvoices.count} invoices linked to events`);

  // Delete events
  const deletedEvents = await prisma.event.deleteMany({
    where: { tenantId },
  });
  console.log(`✅ Deleted ${deletedEvents.count} events`);

  console.log("✅ Cleanup complete - ready for reseed");
}

cleanupRcmeEvents()
  .catch((e) => {
    console.error("❌ Cleanup failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

