import { Request, Response } from "express";

type PaymentMethod = {
  id: string;
  tenantId: string;
  memberId: string;
  brand: string;
  last4: string;
  token: string;
  status: "active" | "inactive";
};

type InvoiceStatus = "draft" | "unpaid" | "pending" | "paid" | "void" | "overdue" | "cancelled";
type Invoice = {
  id: string;
  tenantId: string;
  memberId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  type?: "dues" | "manual" | "event";
  periodStart?: string;
  periodEnd?: string;
  createdAt?: number;
  dueDate?: string;
  reminderSentAt?: number | null;
  reminderCount?: number;
  paidAt?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  description?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  source?: string | null;
  duesPeriodKey?: string | null;
  duesLabel?: string | null;
};

type Payment = {
  id: string;
  tenantId: string;
  memberId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: "paid";
  paymentMethodId?: string;
  paymentMethodLast4?: string;
  paymentType?: "dues" | "event";
};

type Transaction = {
  id: string;
  tenantId: string;
  memberId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  status: string;
};

type AuditLog = {
  id: string;
  tenantId: string;
  invoiceId: string;
  memberId: string;
  amount: number;
  action: "paid" | "created" | "dues_generated" | "send_requested" | "pdf_downloaded";
  actorId?: string;
  createdAt: number;
};

type Event = {
  id: string;
  tenantId: string;
  status: "open" | "closed" | "cancelled";
  feeAmount: number;
  currency: string;
};

type Registration = {
  id: string;
  eventId: string;
  tenantId: string;
  memberId: string;
  status: "pending" | "confirmed" | "cancelled";
  invoiceId?: string;
};

const paymentMethods: PaymentMethod[] = [];
const invoices: Invoice[] = [];
const payments: Payment[] = [];
const transactions: Transaction[] = [];
const idem: Record<string, Payment> = {};
const auditLogs: AuditLog[] = [];
const events: Event[] = [];
const registrations: Registration[] = [];
const members: { id: string; tenantId: string; email?: string; status: "active" | "inactive"; membershipTypeId?: string }[] = [];
const membershipTypes: { id: string; tenantId: string; amount: number; currency: string }[] = [];
const receiptEvents: {
  key: string;
  payload: {
    tenant_id: string;
    member_id: string;
    invoice_id: string;
    amount: number;
    currency: string;
    payment_method_last4: string | null;
    payment_type: "dues" | "event";
    timestamp: number;
    event: "payment.receipt.requested";
  };
}[] = [];
const emittedReceiptKeys = new Set<string>();
const reminderEvents: {
  tenant_id: string;
  member_id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  due_date?: string | null;
  member_email?: string | null;
  type: "dues" | "event";
}[] = [];
const invoiceSendEvents: {
  tenant_id: string;
  member_id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  timestamp: number;
  event: "invoice.send.requested";
}[] = [];

let pmCounter = 1;
let invoiceCounter = 1;
let paymentCounter = 1;
let txnCounter = 1;
let auditCounter = 1;
let eventCounter = 1;
let regCounter = 1;
let memberCounter = 1;

const requireAuth = (req: Request, res: Response) => {
  if (!(req as any).user) {
    res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] }, trace_id: "trace-" + Date.now() });
    return false;
  }
  return true;
};

export const getInvoicesForMember = (tenantId: string, memberId: string): Invoice[] =>
  invoices.filter((inv) => inv.tenantId === tenantId && inv.memberId === memberId);

export const getInvoiceById = (tenantId: string, invoiceId: string): Invoice | undefined =>
  invoices.find((i) => i.id === invoiceId && i.tenantId === tenantId);

export const getAllInvoices = (tenantId: string): Invoice[] => invoices.filter((i) => i.tenantId === tenantId);

export const generateInvoiceId = () => `inv-${invoiceCounter++}`;

export const createEventInvoice = (params: {
  tenantId: string;
  memberId: string;
  amount: number;
  currency: string;
  description: string;
  eventId?: string | null;
  eventTitle?: string | null;
  dueDate?: string | null;
  status?: InvoiceStatus;
}): Invoice => {
  const invoice: Invoice = {
    id: generateInvoiceId(),
    tenantId: params.tenantId,
    memberId: params.memberId,
    amount: params.amount,
    currency: params.currency,
    status: params.status || "unpaid",
    type: "event",
    createdAt: Date.now(),
    dueDate: params.dueDate || null,
    description: params.description,
    eventId: params.eventId || null,
    eventTitle: params.eventTitle || null,
    source: "event",
    paidAt: null,
    paymentMethod: null,
    paymentReference: null,
  };
  invoices.push(invoice);
  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId: params.tenantId,
    invoiceId: invoice.id,
    memberId: invoice.memberId,
    amount: invoice.amount,
    action: "created",
    actorId: "system",
    createdAt: invoice.createdAt || Date.now(),
  });
  return invoice;
};

const errorResponse = (res: Response, code: string, message: string, details?: { field: string; issue: string }[], status = 400) =>
  res.status(status).json({ error: { code, message, details: details || [] }, trace_id: "trace-" + Date.now() });

const inferBrand = (number: string) => {
  if (number.startsWith("4")) return "visa";
  if (number.startsWith("5")) return "mastercard";
  if (number.startsWith("3")) return "amex";
  return "card";
};

const emitReceipt = (
  key: string,
  tenantId: string,
  memberId: string,
  invoiceId: string,
  amount: number,
  currency: string,
  paymentMethodLast4: string | null,
  paymentType: "dues" | "event"
) => {
  if (emittedReceiptKeys.has(key)) return;
  emittedReceiptKeys.add(key);
  const payload = {
    tenant_id: tenantId,
    member_id: memberId,
    invoice_id: invoiceId,
    amount,
    currency,
    payment_method_last4: paymentMethodLast4,
    payment_type: paymentType,
    timestamp: Date.now(),
    event: "payment.receipt.requested" as const,
  };
  receiptEvents.push({ key, payload });
};

export const createPaymentMethod = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const tenantId = user.tenantId;
  const memberId = user.memberId;
  const { number, exp_month, exp_year, cvc, brand } = req.body || {};
  const details: { field: string; issue: string }[] = [];

  if (!number) details.push({ field: "number", issue: "required" });
  if (number && (!/^\d{12,19}$/.test(String(number)))) details.push({ field: "number", issue: "invalid" });
  const monthNum = parseInt(exp_month, 10);
  const yearNum = parseInt(exp_year, 10);
  if (!exp_month) details.push({ field: "exp_month", issue: "required" });
  if (!exp_year) details.push({ field: "exp_year", issue: "required" });
  if (exp_month && (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12)) details.push({ field: "exp_month", issue: "invalid" });
  if (exp_year && (Number.isNaN(yearNum) || yearNum < new Date().getFullYear())) details.push({ field: "exp_year", issue: "invalid" });
  if (!cvc) details.push({ field: "cvc", issue: "required" });
  if (cvc && !/^\d{3,4}$/.test(String(cvc))) details.push({ field: "cvc", issue: "invalid" });

  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const pmId = `pm-${pmCounter++}`;
  const last4 = String(number).slice(-4);
  const token = `pm_tok_${pmId}`;
  const pm: PaymentMethod = {
    id: pmId,
    tenantId,
    memberId,
    brand: brand || inferBrand(String(number)),
    last4,
    token,
    status: "active",
  };
  paymentMethods.push(pm);

  return res.status(201).json({ payment_method_id: pm.id, last4: pm.last4, brand: pm.brand });
};

export const listPaymentMethods = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const tenantId = user.tenantId;
  const memberId = user.memberId;

  const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
  const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);

  const filtered = paymentMethods.filter((pm) => pm.tenantId === tenantId && pm.memberId === memberId && pm.status === "active");
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((pm) => ({
    id: pm.id,
    brand: pm.brand,
    last4: pm.last4,
    status: pm.status,
  }));

  return res.json({
    items,
    page,
    page_size: pageSize,
    total_items: filtered.length,
    total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
};

export const createPayment = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const tenantId = user.tenantId;
  const memberId = user.memberId;

  const { invoice_id, payment_method_id, card, amount, currency } = req.body || {};
  if (!invoice_id) return errorResponse(res, "validation_failed", "invoice_id required", [{ field: "invoice_id", issue: "required" }]);

  const invoice = invoices.find((i) => i.id === invoice_id && i.tenantId === tenantId);
  if (!invoice) return errorResponse(res, "not_found", "Invoice not found", [], 404);
  if (invoice.memberId !== memberId) return errorResponse(res, "forbidden", "Invoice does not belong to member", [], 403);

  return charge(tenantId, memberId, invoice, { payment_method_id, card, amount, currency }, req, res, true);
};

export const payEventFee = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const tenantId = user.tenantId;
  const memberId = user.memberId;
  const eventId = req.params.id;

  const event = events.find((e) => e.id === eventId && e.tenantId === tenantId);
  if (!event) return errorResponse(res, "not_found", "Event not found", [], 404);
  if (event.status !== "open") return errorResponse(res, "invalid_status", "Event not payable", [], 409);

  const registration = registrations.find((r) => r.eventId === eventId && r.tenantId === tenantId && r.memberId === memberId);
  if (!registration) return errorResponse(res, "not_found", "Registration not found", [], 404);
  if (registration.status === "cancelled") return errorResponse(res, "invalid_status", "Registration not payable", [], 409);

  // ensure invoice
  let invoice: Invoice | undefined;
  if (registration.invoiceId) {
    invoice = invoices.find((i) => i.id === registration.invoiceId && i.tenantId === tenantId);
  }
  if (!invoice) {
    invoice = {
      id: `inv-${invoiceCounter++}`,
      tenantId,
      memberId,
      amount: event.feeAmount,
      currency: event.currency,
      status: "unpaid",
      type: "event",
      createdAt: Date.now(),
      eventId: event.id,
      source: "event",
    };
    invoices.push(invoice);
    registration.invoiceId = invoice.id;
  }

  const result = charge(tenantId, memberId, invoice, req.body || {}, req, res, true, "event");
  if (res.statusCode === 201) {
    registration.status = "confirmed";
  }
  return result;
};

export const runDuesJob = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  const isInternal = req.headers["x-internal"] === "true";
  if (!isInternal && !roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

  const tenantId = user.tenantId;
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString();

  let created = 0;
  let skipped = 0;

  members
    .filter((m) => m.tenantId === tenantId && m.status === "active" && m.membershipTypeId)
    .forEach((m) => {
      const mt = membershipTypes.find((mt) => mt.id === m.membershipTypeId && mt.tenantId === tenantId);
      if (!mt) {
        skipped += 1;
        return;
      }
      const exists = invoices.find(
        (i) => i.tenantId === tenantId && i.memberId === m.id && i.type === "dues" && i.periodStart === periodStart && i.status === "unpaid"
      );
      if (exists) {
        skipped += 1;
        return;
      }
      const invoice: Invoice = {
        id: `inv-${invoiceCounter++}`,
        tenantId,
        memberId: m.id,
        amount: mt.amount,
        currency: mt.currency,
        status: "unpaid",
        type: "dues",
        periodStart,
        periodEnd,
        createdAt: Date.now(),
      };
      invoices.push(invoice);
      auditLogs.push({
        id: `audit-${auditCounter++}`,
        tenantId,
        invoiceId: invoice.id,
        memberId: m.id,
        amount: invoice.amount,
        action: "dues_generated",
        actorId: user.userId || "system",
        createdAt: Date.now(),
      });
      created += 1;
    });

  return res.json({ created, skipped });
};

const charge = (
  tenantId: string,
  memberId: string,
  invoice: Invoice,
  payload: any,
  req: Request,
  res: Response,
  allowOneTimeCard = true,
  paymentType: "dues" | "event" = "dues"
) => {
  const idempotencyKey = (req.headers["idempotency-key"] as string) || "";
  if (idempotencyKey && idem[idempotencyKey]) {
    const prev = idem[idempotencyKey];
    if (prev.tenantId === tenantId && prev.memberId === memberId) {
      return res.json({ payment_id: prev.id, invoice_id: prev.invoiceId, amount: prev.amount, status: prev.status });
    }
  }

  if (invoice.status === "paid") return errorResponse(res, "invoice_paid", "Invoice already paid", [], 409);
  if (invoice.status === "void") return errorResponse(res, "invalid_status", "Invoice not payable", [], 409);

  const { payment_method_id, card, amount, currency } = payload || {};
  let method: PaymentMethod | null = null;
  const details: { field: string; issue: string }[] = [];
  if (payment_method_id) {
    method = paymentMethods.find((pm) => pm.id === payment_method_id && pm.tenantId === tenantId && pm.memberId === memberId && pm.status === "active") || null;
    if (!method) return errorResponse(res, "payment_method_not_found", "Payment method not found", [{ field: "payment_method_id", issue: "not_found" }], 404);
  } else if (allowOneTimeCard) {
    const { number, exp_month, exp_year, cvc } = card || {};
    if (!number) details.push({ field: "card.number", issue: "required" });
    if (number && !/^\d{12,19}$/.test(String(number))) details.push({ field: "card.number", issue: "invalid" });
    const monthNum = parseInt(exp_month, 10);
    const yearNum = parseInt(exp_year, 10);
    if (!exp_month) details.push({ field: "card.exp_month", issue: "required" });
    if (!exp_year) details.push({ field: "card.exp_year", issue: "required" });
    if (exp_month && (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12)) details.push({ field: "card.exp_month", issue: "invalid" });
    if (exp_year && (Number.isNaN(yearNum) || yearNum < new Date().getFullYear())) details.push({ field: "card.exp_year", issue: "invalid" });
    if (!cvc) details.push({ field: "card.cvc", issue: "required" });
    if (cvc && !/^\d{3,4}$/.test(String(cvc))) details.push({ field: "card.cvc", issue: "invalid" });
    if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);
    method = {
      id: `pm-onetime-${pmCounter++}`,
      tenantId,
      memberId,
      brand: inferBrand(String(number)),
      last4: String(number).slice(-4),
      token: `pm_tok_onetime_${Date.now()}`,
      status: "active",
    };
  } else {
    return errorResponse(res, "validation_failed", "Payment method required", [{ field: "payment_method_id", issue: "required" }], 400);
  }

  if (!method) return errorResponse(res, "validation_failed", "Payment method required", [{ field: "payment_method_id", issue: "required" }], 400);

  const finalAmount = amount ?? invoice.amount;
  if (!finalAmount || finalAmount <= 0) return errorResponse(res, "validation_failed", "Invalid amount", [{ field: "amount", issue: "invalid" }], 400);
  const currencyUsed = currency || invoice.currency || "USD";

  const paymentId = `pay-${paymentCounter++}`;
  const payment: Payment = {
    id: paymentId,
    tenantId,
    memberId,
    invoiceId: invoice.id,
    amount: finalAmount,
    currency: currencyUsed,
    status: "paid",
    paymentMethodId: payment_method_id || method.id,
    paymentMethodLast4: method.last4,
    paymentType,
  };
  payments.push(payment);

  invoice.status = "paid";
  invoice.paidAt = invoice.paidAt || new Date().toISOString();
  invoice.paymentMethod = invoice.paymentMethod || method.brand || "card";
  invoice.paymentReference = invoice.paymentReference || payment_method_id || method.id;

  const txn: Transaction = {
    id: `txn-${txnCounter++}`,
    tenantId,
    memberId,
    paymentId,
    invoiceId: invoice.id,
    amount: finalAmount,
    status: "paid",
  };
  transactions.push(txn);

  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    invoiceId: invoice.id,
    memberId: invoice.memberId,
    amount: finalAmount,
    action: "paid",
    createdAt: Date.now(),
  });

  if (idempotencyKey) {
    idem[idempotencyKey] = payment;
  }

  try {
    emitReceipt(`payment:${payment.id}`, tenantId, invoice.memberId, invoice.id, finalAmount, currencyUsed, method.last4 || null, paymentType);
  } catch (e) {
    // Do not fail payment on receipt emission issues
    // eslint-disable-next-line no-console
    console.error("receipt emit failed", e);
  }

  return res.status(201).json({ payment_id: payment.id, invoice_id: invoice.id, amount: finalAmount, status: "paid" });
};
export const markInvoicePaid = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const tenantId = user.tenantId;
  const invoiceId = req.params.id;

  const invoice = invoices.find((i) => i.id === invoiceId && i.tenantId === tenantId);
  if (!invoice) return errorResponse(res, "not_found", "Invoice not found", [], 404);
  if (invoice.status === "paid") {
    invoice.paymentMethod = req.body?.payment_method || invoice.paymentMethod || null;
    invoice.paymentReference = req.body?.payment_reference || invoice.paymentReference || null;
    invoice.paidAt = invoice.paidAt || new Date().toISOString();
    return res.json({
      invoice_id: invoice.id,
      status: "paid",
      paid_at: invoice.paidAt,
      payment_method: invoice.paymentMethod,
      payment_reference: invoice.paymentReference,
    });
  }
  if (invoice.status === "void") {
    return errorResponse(res, "invalid_status", "Invoice not payable", [], 409);
  }
  if (invoice.status !== "unpaid") {
    return errorResponse(res, "invalid_status", "Invoice not payable", [], 409);
  }

  invoice.status = "paid";
  invoice.paidAt = new Date().toISOString();
  invoice.paymentMethod = req.body?.payment_method || invoice.paymentMethod || "manual";
  invoice.paymentReference = req.body?.payment_reference || invoice.paymentReference || null;
  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    invoiceId: invoice.id,
    memberId: invoice.memberId,
    amount: invoice.amount,
    action: "paid",
    createdAt: Date.now(),
  });

  try {
    emitReceipt(`invoice:${invoice.id}`, tenantId, invoice.memberId, invoice.id, invoice.amount, invoice.currency, null, "dues");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("receipt emit failed", e);
  }

  return res.json({ invoice_id: invoice.id, status: "paid" });
};

export const markInvoicePaidInternal = (
  tenantId: string,
  invoiceId: string,
  payload: { paymentMethod?: string | null; paymentReference?: string | null; paidAt?: string | null }
): Invoice => {
  const invoice = invoices.find((i) => i.id === invoiceId && i.tenantId === tenantId);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "void" || invoice.status === "cancelled") {
    throw new Error("Invoice not payable");
  }
  if (invoice.status !== "paid") {
    invoice.status = "paid";
    invoice.paymentMethod = payload.paymentMethod ?? "manual";
    invoice.paymentReference = payload.paymentReference ?? null;
    invoice.paidAt = payload.paidAt ?? new Date().toISOString();
  } else {
    invoice.paymentMethod = payload.paymentMethod ?? invoice.paymentMethod ?? null;
    invoice.paymentReference = payload.paymentReference ?? invoice.paymentReference ?? null;
    invoice.paidAt = payload.paidAt ?? invoice.paidAt ?? new Date().toISOString();
  }
  return invoice;
};

export interface CreateDuesInvoiceArgs {
  tenantId: string;
  memberId: string;
  amountCents: number;
  currency: string;
  duesPeriodKey: string;
  duesLabel: string;
  dueDate?: string | null;
}

export function createDuesInvoice(args: CreateDuesInvoiceArgs): Invoice {
  const nowIso = new Date().toISOString();
  const invoice: Invoice = {
    id: generateInvoiceId(),
    tenantId: args.tenantId,
    memberId: args.memberId,
    amount: args.amountCents,
    currency: args.currency,
    status: "unpaid",
    description: args.duesLabel,
    source: "dues",
    duesPeriodKey: args.duesPeriodKey,
    duesLabel: args.duesLabel,
    dueDate: args.dueDate ?? null,
    createdAt: Date.parse(nowIso),
    paidAt: null,
    paymentMethod: null,
    paymentReference: null,
  };
  invoices.push(invoice);
  return invoice;
}

export function getDuesInvoicesByPeriod(tenantId: string, periodKey: string): Invoice[] {
  return invoices.filter((inv) => inv.tenantId === tenantId && inv.source === "dues" && inv.duesPeriodKey === periodKey);
}

export function getAllDuesInvoices(tenantId: string): Invoice[] {
  return invoices.filter((inv) => inv.tenantId === tenantId && inv.source === "dues");
}

export const createManualInvoice = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const actorId = user.userId || "admin";

  const { member_id, amount, currency, description, due_date } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (!member_id) details.push({ field: "member_id", issue: "required" });
  if (amount === undefined) details.push({ field: "amount", issue: "required" });
  if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) details.push({ field: "amount", issue: "invalid" });
  if (!currency) details.push({ field: "currency", issue: "required" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const member = members.find((m) => m.id === member_id && m.tenantId === tenantId);
  if (!member) return errorResponse(res, "not_found", "Member not found", [{ field: "member_id", issue: "not_found" }], 404);

  const invoice: Invoice = {
    id: `inv-${invoiceCounter++}`,
    tenantId,
    memberId: member_id,
    amount,
    currency,
    status: "unpaid",
    type: "manual",
    createdAt: Date.now(),
    description: description || null,
    dueDate: due_date || null,
    source: "manual",
  };
  invoices.push(invoice);

  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    invoiceId: invoice.id,
    memberId: member_id,
    amount,
    action: "created",
    actorId,
    createdAt: Date.now(),
  });

  return res.status(201).json({
    invoice_id: invoice.id,
    status: invoice.status,
    member_id,
    amount,
    currency,
    description: description || null,
    due_date: due_date || null,
    created_at: Date.now(),
  });
};

export const sendInvoice = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const invoiceId = req.params.id;

  const invoice = invoices.find((i) => i.id === invoiceId && i.tenantId === tenantId);
  if (!invoice) return errorResponse(res, "not_found", "Invoice not found", [], 404);
  if (invoice.status !== "unpaid" && invoice.status !== "overdue") {
    return errorResponse(res, "invalid_status", "Invoice not sendable", [], 409);
  }
  const member = members.find((m) => m.id === invoice.memberId && m.tenantId === tenantId);
  if (!member) return errorResponse(res, "not_found", "Member not found", [], 404);
  if (member.status !== "active") return errorResponse(res, "invalid_status", "Member inactive", [], 409);

  const payload = {
    tenant_id: tenantId,
    member_id: invoice.memberId,
    invoice_id: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    description: null,
    due_date: null,
    timestamp: Date.now(),
    event: "invoice.send.requested" as const,
  };
  invoiceSendEvents.push(payload);
  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    invoiceId: invoice.id,
    memberId: invoice.memberId,
    amount: invoice.amount,
    action: "send_requested",
    actorId: user.userId || "admin",
    createdAt: payload.timestamp,
  });

  return res.json({ status: "queued" });
};

export const listMemberInvoices = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const tenantId = user.tenantId;
  const memberId = user.memberId;
  const statusFilter = (req.query.status as string) || "";
  const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
  const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);

  const allowedStatuses = ["unpaid", "overdue"];
  const filterStatuses = statusFilter ? statusFilter.split(",").map((s) => s.trim()).filter((s) => allowedStatuses.includes(s)) : allowedStatuses;

  const filtered = invoices.filter(
    (inv) => inv.tenantId === tenantId && inv.memberId === memberId && filterStatuses.includes(inv.status)
  );

  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((inv) => ({
    invoice_id: inv.id,
    amount: inv.amount,
    currency: inv.currency,
    description: inv.description || null,
    due_date: inv.dueDate || null,
    status: inv.status,
    createdAt: inv.createdAt || 0,
    event_id: inv.eventId || null,
    event_title: inv.eventTitle || null,
    source: inv.source || inv.type || null,
    paid_at: inv.paidAt || null,
    payment_method: inv.paymentMethod || null,
    payment_reference: inv.paymentReference || null,
    dues_period_key: inv.duesPeriodKey || null,
    dues_label: inv.duesLabel || null,
  }));

  return res.json({
    items,
    page,
    page_size: pageSize,
    total_items: filtered.length,
    total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
};

export const runPaymentReminders = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  const isInternal = req.headers["x-internal"] === "true";
  if (!isInternal && !roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

  const tenantId = user.tenantId;
  const now = Date.now();
  let sent = 0;

  invoices
    .filter(
      (inv) =>
        inv.tenantId === tenantId &&
        (inv.status === "unpaid" || inv.status === "overdue") &&
        (!inv.reminderSentAt || inv.reminderSentAt === null) &&
        inv.dueDate &&
        new Date(inv.dueDate).getTime() <= now
    )
    .forEach((inv) => {
      const member = members.find((m) => m.id === inv.memberId && m.tenantId === tenantId);
      if (!member) return;
      const payload = {
        tenant_id: tenantId,
        member_id: inv.memberId,
        invoice_id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        due_date: inv.dueDate || null,
        member_email: member.email || null,
        type: inv.type === "event" ? ("event" as const) : ("dues" as const),
      };
      reminderEvents.push(payload);
      inv.reminderSentAt = now;
      inv.reminderCount = (inv.reminderCount || 0) + 1;
      sent += 1;
      auditLogs.push({
        id: `audit-${auditCounter++}`,
        tenantId,
        invoiceId: inv.id,
        memberId: inv.memberId,
        amount: inv.amount,
        action: "send_requested",
        actorId: user.userId || "system",
        createdAt: now,
      });
    });

  return res.json({ sent });
};

export const downloadInvoicePdf = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const tenantId = user.tenantId;
  const memberId = user.memberId;
  const invoiceId = req.params.id;

  const invoice = invoices.find((inv) => inv.id === invoiceId && inv.tenantId === tenantId);
  if (!invoice) return errorResponse(res, "not_found", "Invoice not found", [], 404);
  if (invoice.memberId !== memberId) return errorResponse(res, "forbidden", "Forbidden", [], 403);

  const pdfContent = "%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoiceId}.pdf"`);

  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    invoiceId: invoice.id,
    memberId: invoice.memberId,
    amount: invoice.amount,
    action: "pdf_downloaded",
    actorId: user.userId || memberId,
    createdAt: Date.now(),
  });

  return res.send(pdfContent);
};

// test helpers
export const __resetPaymentMethods = () => {
  paymentMethods.length = 0;
  pmCounter = 1;
};

export const __resetInvoices = () => {
  invoices.length = 0;
  payments.length = 0;
  transactions.length = 0;
  paymentCounter = 1;
  invoiceCounter = 1;
  txnCounter = 1;
  for (const key of Object.keys(idem)) delete idem[key];
  auditLogs.length = 0;
  auditCounter = 1;
  events.length = 0;
  registrations.length = 0;
  eventCounter = 1;
  regCounter = 1;
  receiptEvents.length = 0;
  emittedReceiptKeys.clear();
  members.length = 0;
  memberCounter = 1;
  membershipTypes.length = 0;
  invoiceSendEvents.length = 0;
  reminderEvents.length = 0;
};

export const __seedInvoice = (tenantId: string, memberId: string, amount = 1000, currency = "USD", status: InvoiceStatus = "unpaid") => {
  const invoice: Invoice = { id: `inv-${invoiceCounter++}`, tenantId, memberId, amount, currency, status };
  invoices.push(invoice);
  return invoice;
};

export const __getAuditLogs = () => auditLogs;
export const __seedEvent = (tenantId: string, feeAmount = 1000, currency = "USD", status: "open" | "closed" | "cancelled" = "open") => {
  const ev: Event = { id: `evt-${eventCounter++}`, tenantId, status, feeAmount, currency };
  events.push(ev);
  return ev;
};

export const __seedRegistration = (
  tenantId: string,
  eventId: string,
  memberId: string,
  status: "pending" | "confirmed" | "cancelled" = "pending"
) => {
  const reg: Registration = { id: `reg-${regCounter++}`, tenantId, eventId, memberId, status };
  registrations.push(reg);
  return reg;
};

export const __getReceiptEvents = () => receiptEvents;
export const __getInvoiceSendEvents = () => invoiceSendEvents;
export const __getReminderEvents = () => reminderEvents;
export const __seedMember = (tenantId: string, id?: string) => {
  const memberId = id || `m-${memberCounter++}`;
  members.push({ id: memberId, tenantId, status: "active", email: `${memberId}@example.com` });
  return memberId;
};
export const __setMemberStatus = (memberId: string, status: "active" | "inactive") => {
  const m = members.find((m) => m.id === memberId);
  if (m) m.status = status;
};
export const __assignMembershipType = (memberId: string, membershipTypeId: string) => {
  const m = members.find((m) => m.id === memberId);
  if (m) m.membershipTypeId = membershipTypeId;
};
export const __seedMembershipType = (tenantId: string, amount: number, currency = "USD", id?: string) => {
  const mtId = id || `mt-${membershipTypes.length + 1}`;
  membershipTypes.push({ id: mtId, tenantId, amount, currency });
  return mtId;
};

