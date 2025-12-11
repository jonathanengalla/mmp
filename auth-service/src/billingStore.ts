import { InvoiceStatus, PaymentMethodStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "./db/prisma";
import { generateInvoiceNumber, InvoiceNumberType } from "./utils/invoiceNumber";

export async function listMemberInvoices(
  tenantId: string,
  memberId: string,
  options?: { status?: InvoiceStatus[] }
) {
  return prisma.invoice.findMany({
    where: {
      tenantId,
      memberId,
      ...(options?.status ? { status: { in: options.status } } : {}),
    },
    orderBy: { issuedAt: "desc" },
  });
}

export async function listTenantInvoices(tenantId: string, options?: { status?: InvoiceStatus[] }) {
  return prisma.invoice.findMany({
    where: {
      tenantId,
      ...(options?.status ? { status: { in: options.status } } : {}),
    },
    orderBy: { issuedAt: "desc" },
  });
}

export async function getInvoiceById(tenantId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
  });
}

type CreateManualInvoiceInput = {
  memberId: string;
  amountCents: number;
  currency: string;
  description?: string;
  dueDate?: Date | string | null;
};

export async function createManualInvoice(tenantId: string, input: CreateManualInvoiceInput) {
  const invoiceNumber = await generateInvoiceNumber(tenantId, "DUES");
  return prisma.invoice.create({
    data: {
      tenantId,
      memberId: input.memberId,
      amountCents: input.amountCents,
      currency: input.currency,
      description: input.description ?? null,
      dueAt: input.dueDate ? new Date(input.dueDate) : null,
      invoiceNumber,
      status: InvoiceStatus.ISSUED,
      source: "DUES",
    },
  });
}

type RecordInvoicePaymentInput = {
  invoiceId: string;
  amountCents: number;
  methodId?: string | null;
  externalRef?: string | null;
};

export async function recordInvoicePayment(tenantId: string, input: RecordInvoicePaymentInput) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, tenantId },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (input.amountCents <= 0) throw new Error("Invalid amount");

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      invoiceId: invoice.id,
      memberId: invoice.memberId,
      paymentMethodId: input.methodId ?? null,
      amountCents: input.amountCents,
      currency: invoice.currency,
      status: PaymentStatus.SUCCEEDED,
      reference: input.externalRef ?? null,
      processedAt: new Date(),
    },
  });

  const aggregate = await prisma.payment.aggregate({
    where: { tenantId, invoiceId: invoice.id },
    _sum: { amountCents: true },
  });
  const totalPaid = aggregate._sum.amountCents || 0;
  const remaining = invoice.amountCents - totalPaid;

  // Donations cannot be partially paid
  if ((invoice.source || "").toUpperCase() === "DONATION") {
    if (remaining > 0) {
      throw new Error("Donations must be paid in full; partial payments are not allowed");
    }
  }

  let nextStatus: InvoiceStatus = InvoiceStatus.PARTIALLY_PAID;
  let paidAt: Date | null = invoice.paidAt ?? null;
  if (remaining <= 0) {
    nextStatus = InvoiceStatus.PAID;
    paidAt = new Date();
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { id_tenantId: { id: invoice.id, tenantId } },
    data: {
      status: nextStatus,
      paidAt,
      updatedAt: new Date(),
    },
  });

  return { invoice: updatedInvoice, payment };
}

export async function listPaymentMethodsForMember(tenantId: string, memberId: string) {
  return prisma.paymentMethod.findMany({
    where: { tenantId, memberId },
    orderBy: { createdAt: "desc" },
  });
}

type SavePaymentMethodInput = {
  memberId: string;
  token: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  label?: string | null;
};

export async function savePaymentMethod(tenantId: string, input: SavePaymentMethodInput) {
  const existingDefault = await prisma.paymentMethod.findFirst({
    where: { tenantId, memberId: input.memberId, isDefault: true },
  });

  return prisma.paymentMethod.create({
    data: {
      tenantId,
      memberId: input.memberId,
      token: input.token,
      brand: input.brand,
      last4: input.last4,
      expMonth: input.expiryMonth,
      expYear: input.expiryYear,
      label: input.label ?? null,
      isDefault: existingDefault ? false : true,
      status: PaymentMethodStatus.ACTIVE,
    },
  });
}

export async function removePaymentMethod(tenantId: string, memberId: string, id: string) {
  const existing = await prisma.paymentMethod.findFirst({
    where: { id, tenantId, memberId },
  });
  if (!existing) {
    throw new Error("Payment method not found");
  }
  return prisma.paymentMethod.delete({
    where: { id_tenantId: { id, tenantId } },
  });
}


