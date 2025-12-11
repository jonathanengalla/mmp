import { Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "./authMiddleware";
import {
  createManualInvoice,
  getInvoiceById,
  listMemberInvoices,
  listTenantInvoices,
  recordInvoicePayment,
  listPaymentMethodsForMember,
  savePaymentMethod,
} from "./billingStore";
import { prisma } from "./db/prisma";
import { applyTenantScope } from "./tenantGuard";
import { toInvoiceDto } from "./eventsHandlers";

const sanitizeInvoice = (inv: any) => ({
  id: inv.id,
  invoiceNumber: inv.invoiceNumber,
  tenantId: inv.tenantId,
  memberId: inv.memberId,
  amountCents: inv.amountCents,
  currency: inv.currency,
  status: inv.status,
  issuedAt: inv.issuedAt,
  dueAt: inv.dueAt,
  paidAt: inv.paidAt,
  description: inv.description,
  source: inv.source ?? null,
});

const sanitizePaymentMethod = (pm: any) => ({
  id: pm.id,
  tenantId: pm.tenantId,
  memberId: pm.memberId,
  brand: pm.brand,
  last4: pm.last4,
  expMonth: pm.expMonth,
  expYear: pm.expYear,
  label: pm.label,
  isDefault: pm.isDefault,
  status: pm.status,
  createdAt: pm.createdAt,
  updatedAt: pm.updatedAt,
  token: pm.token, // token is safe; no PAN/CVC stored
});

export async function listTenantInvoicesPaginatedHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const roles = (req.user.roles || []).map((r) => r.toUpperCase());
    const isPrivileged = roles.includes("ADMIN") || roles.includes("OFFICER") || roles.includes("FINANCE_MANAGER");
    if (!isPrivileged) return res.status(403).json({ error: "Forbidden" });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const where = applyTenantScope({ where: {} }, req.user.tenantId).where;

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: { event: true, member: true },
        orderBy: { issuedAt: "desc" },
        skip: offset,
        take: limit,
      }),
    ]);

    const items = invoices.map(toInvoiceDto);
    return res.json({ items, total, limit, offset });
  } catch (err) {
    console.error("[billing] listTenantInvoicesPaginatedHandler error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listMemberInvoicesHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const tenantId = req.user.tenantId;
    const requestedMemberId = (req.query.memberId as string | undefined) || req.user.memberId || null;
    const isAdmin = req.user.roles.includes("ADMIN") || req.user.roles.includes("OFFICER");

    if (!isAdmin && !req.user.memberId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!isAdmin && requestedMemberId !== req.user.memberId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (isAdmin && !requestedMemberId) {
      const invoices = await listTenantInvoices(tenantId);
      return res.json({ items: invoices.map(sanitizeInvoice) });
    }

    const invoices = await listMemberInvoices(tenantId, requestedMemberId as string);
    return res.json({ items: invoices.map(sanitizeInvoice) });
  } catch (err) {
    console.error("[billing] listMemberInvoicesHandler error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createManualInvoiceHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { memberId, amountCents, currency, description, dueDate } = req.body || {};
    if (!memberId || !amountCents || !currency) {
      return res.status(400).json({ error: "memberId, amountCents, and currency are required" });
    }
    if (Number(amountCents) <= 0) {
      return res.status(400).json({ error: "amountCents must be > 0" });
    }
    const invoice = await createManualInvoice(req.user.tenantId, {
      memberId,
      amountCents: Number(amountCents),
      currency,
      description,
      dueDate: dueDate ?? null,
    });
    return res.status(201).json(sanitizeInvoice(invoice));
  } catch (err) {
    console.error("[billing] createManualInvoiceHandler error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function recordInvoicePaymentHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const invoiceId = req.params.id || (req.body && (req.body.invoiceId as string));
    const { amountCents, paymentMethodId, externalRef } = req.body || {};
    if (!invoiceId) return res.status(400).json({ error: "invoiceId is required" });
    const invoice = await getInvoiceById(req.user.tenantId, invoiceId);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });

    const isAdmin = req.user.roles.includes("ADMIN") || req.user.roles.includes("OFFICER");
    if (!isAdmin && req.user.memberId !== invoice.memberId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { invoice: updatedInvoice, payment } = await recordInvoicePayment(req.user.tenantId, {
      invoiceId,
      amountCents: amountCents ? Number(amountCents) : invoice.amountCents,
      methodId: paymentMethodId ?? null,
      externalRef: externalRef ?? null,
    });
    return res.status(200).json({
      invoice: sanitizeInvoice(updatedInvoice),
      payment: {
        id: payment.id,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: payment.status,
        reference: payment.reference,
        processedAt: payment.processedAt,
      },
    });
  } catch (err: any) {
    const message = err?.message || "Unable to record payment";
    if (message === "Invoice not found") {
      return res.status(404).json({ error: message });
    }
    if (message === "Invoice already paid" || message === "Invalid amount") {
      return res.status(400).json({ error: message });
    }
    console.error("[billing] recordInvoicePaymentHandler error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listPaymentMethodsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const isAdmin = req.user.roles.includes("ADMIN") || req.user.roles.includes("OFFICER");
    const memberId = (req.query.memberId as string | undefined) || req.user.memberId || null;

    if (!isAdmin && !memberId) return res.status(403).json({ error: "Forbidden" });
    if (!isAdmin && memberId !== req.user.memberId) return res.status(403).json({ error: "Forbidden" });

    if (!memberId) {
      // Graceful empty response for missing member context
      return res.json({ items: [] });
    }

    const methods = await listPaymentMethodsForMember(req.user.tenantId, memberId);
    return res.json({ items: methods.map(sanitizePaymentMethod) });
  } catch (err) {
    console.error("[billing] listPaymentMethodsHandler error", err);
    return res.json({ items: [] });
  }
}

export async function createPaymentMethodHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const isAdmin = req.user.roles.includes("ADMIN") || req.user.roles.includes("OFFICER");
    const memberId = (req.body?.memberId as string | undefined) || req.user.memberId || null;
    const { token, brand, last4, expMonth, expYear, label } = req.body || {};

    if (!memberId) return res.status(400).json({ error: "memberId is required" });
    if (!token || !brand || !last4 || !expMonth || !expYear) {
      return res.status(400).json({ error: "token, brand, last4, expMonth, expYear are required" });
    }
    if (!isAdmin && memberId !== req.user.memberId) return res.status(403).json({ error: "Forbidden" });

    const pm = await savePaymentMethod(req.user.tenantId, {
      memberId,
      token,
      brand,
      last4,
      expiryMonth: Number(expMonth),
      expiryYear: Number(expYear),
      label: label ?? null,
    });
    return res.status(201).json(sanitizePaymentMethod(pm));
  } catch (err) {
    console.error("[billing] createPaymentMethodHandler error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createPaymentHandler(req: AuthenticatedRequest, res: Response) {
  req.params.id = req.body?.invoiceId;
  return recordInvoicePaymentHandler(req, res);
}

export function payEventFeeHandler(_req: Request, res: Response) {
  console.warn("[billing] payEventFeeHandler stub hit; not implemented in BKS-04 scope.");
  return res.status(501).json({ error: "Event fee payment not implemented yet" });
}

export function runDuesJobHandler(_req: Request, res: Response) {
  console.warn("[billing] runDuesJobHandler stub hit; not implemented in BKS-04 scope.");
  return res.status(501).json({ error: "Dues job not implemented yet" });
}

export function sendInvoiceHandler(_req: Request, res: Response) {
  console.warn("[billing] sendInvoiceHandler stub hit; not implemented in BKS-04 scope.");
  return res.status(501).json({ error: "Send invoice not implemented yet" });
}

export function downloadInvoicePdfHandler(_req: Request, res: Response) {
  console.warn("[billing] downloadInvoicePdfHandler stub hit; not implemented in BKS-04 scope.");
  return res.status(501).json({ error: "Invoice PDF not implemented yet" });
}

export function runPaymentRemindersHandler(_req: Request, res: Response) {
  console.warn("[billing] runPaymentRemindersHandler stub hit; not implemented in BKS-04 scope.");
  return res.status(501).json({ error: "Payment reminders not implemented yet" });
}
