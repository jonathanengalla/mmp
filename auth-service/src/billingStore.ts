import { Invoice } from "../../libs/shared/src/models";

const billingHandlers = {
  getInvoiceById: (..._args: any[]) => {
    console.warn("[payments-billing] getInvoiceById stub hit; payments-billing-service not implemented yet.");
    return undefined;
  },
  markInvoicePaidInternal: (..._args: any[]) => {
    console.warn("[payments-billing] markInvoicePaidInternal stub hit; payments-billing-service not implemented yet.");
    throw new Error("Billing not implemented");
  },
  createDuesInvoice: (..._args: any[]) => {
    console.warn("[payments-billing] createDuesInvoice stub hit; payments-billing-service not implemented yet.");
    throw new Error("Billing not implemented");
  },
  getDuesInvoicesByPeriod: (..._args: any[]) => {
    console.warn("[payments-billing] getDuesInvoicesByPeriod stub hit; payments-billing-service not implemented yet.");
    return [];
  },
  getAllDuesInvoices: (..._args: any[]) => {
    console.warn("[payments-billing] getAllDuesInvoices stub hit; payments-billing-service not implemented yet.");
    return [];
  },
};

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


