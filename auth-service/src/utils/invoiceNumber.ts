import { prisma } from "../db/prisma";

export type InvoiceNumberType = "DUES" | "EVT";

export async function generateInvoiceNumber(tenantId: string, type: InvoiceNumberType = "DUES") {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const slug = (tenant?.slug || "TENANT").toUpperCase();
  const year = new Date().getFullYear();
  const typePrefix = type === "EVT" ? "EVT" : "DUES";

  const last = await prisma.invoice.findFirst({
    where: {
      tenantId,
      invoiceNumber: { startsWith: `${slug}-${year}-${typePrefix}-` },
    },
    orderBy: { invoiceNumber: "desc" },
  });

  let nextSeq = 1;
  if (last?.invoiceNumber) {
    const parts = last.invoiceNumber.split("-");
    const maybeSeq = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(maybeSeq)) {
      nextSeq = maybeSeq + 1;
    }
  }

  const seqStr = nextSeq.toString().padStart(3, "0");
  return `${slug}-${year}-${typePrefix}-${seqStr}`;
}

