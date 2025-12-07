import { Invoice } from "../../libs/shared/src/models";

// Use the shared in-memory billing service to keep invoices consistent with checkout
// eslint-disable-next-line @typescript-eslint/no-var-requires
const billingHandlers = require("../../payments-billing-service/src/handlers");

const {
  getInvoiceById: billingGetInvoiceById,
  markInvoicePaidInternal: billingMarkInvoicePaid,
  createDuesInvoice: billingCreateDuesInvoice,
  getDuesInvoicesByPeriod: billingGetDuesInvoicesByPeriod,
  getAllDuesInvoices: billingGetAllDuesInvoices,
} = billingHandlers as any;

export function getInvoiceById(tenantId: string, invoiceId: string): Invoice | undefined {
  return billingGetInvoiceById(tenantId, invoiceId);
}

export function markInvoicePaid(
  tenantId: string,
  invoiceId: string,
  payload: { paymentMethod?: string | null; paymentReference?: string | null; paidAt?: string | null }
): Invoice {
  return billingMarkInvoicePaid(tenantId, invoiceId, payload);
}

export function createDuesInvoice(args: {
  tenantId: string;
  memberId: string;
  amountCents: number;
  currency: string;
  duesPeriodKey: string;
  duesLabel: string;
  dueDate?: string | null;
}): Invoice {
  return billingCreateDuesInvoice(args);
}

export function getDuesInvoicesByPeriod(tenantId: string, periodKey: string): Invoice[] {
  return billingGetDuesInvoicesByPeriod(tenantId, periodKey);
}

export function getAllDuesInvoices(tenantId: string): Invoice[] {
  return billingGetAllDuesInvoices(tenantId);
}


