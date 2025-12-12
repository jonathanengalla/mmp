import { Request, Response } from "express";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "./authMiddleware";
import { createManualInvoice, getInvoiceById, recordInvoicePayment, listPaymentMethodsForMember, savePaymentMethod } from "./billingStore";
import { prisma } from "./db/prisma";
import { applyTenantScope } from "./tenantGuard";
import { toInvoiceDto } from "./eventsHandlers";
import { generateInvoiceNumber } from "./utils/invoiceNumber";

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

const sanitizeInvoiceDetailed = (inv: any) => ({
  id: inv.id,
  invoiceNumber: inv.invoiceNumber,
  memberId: inv.memberId,
  member: inv.member
    ? {
        id: inv.member.id,
        firstName: inv.member.firstName,
        lastName: inv.member.lastName,
        email: inv.member.email,
      }
    : undefined,
  eventId: inv.eventId,
  event: inv.event
    ? {
        id: inv.event.id,
        title: inv.event.title,
      }
    : undefined,
  description: inv.description,
  amountCents: inv.amountCents,
  currency: inv.currency,
  status: inv.status,
  dueDate: inv.dueAt,
  createdAt: inv.createdAt,
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

    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt((req.query.pageSize as string) || "50", 10), 200), 1);
    const search = (req.query.search as string | undefined)?.trim();
    const status = (req.query.status as string | undefined) || undefined;
    const source = (req.query.source as string | undefined)?.toUpperCase();

    const where: any = { tenantId: req.user.tenantId, amountCents: { gt: 0 } };
    if (status && status !== "all") {
      where.status = status as InvoiceStatus;
    }
    if (source) {
      where.source = source;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { member: { firstName: { contains: search, mode: "insensitive" } } },
        { member: { lastName: { contains: search, mode: "insensitive" } } },
        { member: { email: { contains: search, mode: "insensitive" } } },
        { event: { title: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, invoices, outstanding, overdue, recentPaid] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: { event: true, member: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.invoice.aggregate({
        where: { tenantId: req.user.tenantId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] as any } },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: { tenantId: req.user.tenantId, status: "OVERDUE" as any },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId: req.user.tenantId,
          status: "PAID" as any,
          updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
    ]);

    return res.json({
      invoices: invoices.map(sanitizeInvoiceDetailed),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        outstanding: {
          count: outstanding._count || 0,
          totalCents: outstanding._sum.amountCents || 0,
        },
        overdue: {
          count: overdue._count || 0,
          totalCents: overdue._sum.amountCents || 0,
        },
        paidLast30Days: {
          count: recentPaid._count || 0,
          totalCents: recentPaid._sum.amountCents || 0,
        },
      },
    });
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
    const status = (req.query.status as string | undefined) || "all";
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt((req.query.pageSize as string) || "50", 10), 200), 1);
    const isAdmin = req.user.roles.includes("ADMIN") || req.user.roles.includes("OFFICER") || req.user.roles.includes("FINANCE_MANAGER");

    if (!isAdmin && !req.user.memberId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!isAdmin && requestedMemberId !== req.user.memberId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const where: any = { tenantId, amountCents: { gt: 0 } };
    if (isAdmin && requestedMemberId) where.memberId = requestedMemberId;
    if (!isAdmin && requestedMemberId) where.memberId = requestedMemberId;

    if (status === "outstanding") {
      where.status = { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] };
    } else if (status === "paid") {
      where.status = "PAID";
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { dueAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          event: { select: { id: true, title: true } },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    const outstanding = await prisma.invoice.aggregate({
      where: {
        tenantId,
        ...(where.memberId ? { memberId: where.memberId } : {}),
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] as any },
        amountCents: { gt: 0 },
      },
      _sum: { amountCents: true },
      _count: true,
    });

    return res.json({
      invoices: invoices.map(sanitizeInvoiceDetailed),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      summary: {
        outstanding: {
          count: outstanding._count || 0,
          totalCents: outstanding._sum.amountCents || 0,
        },
      },
    });
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

export const getFinanceSummaryHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const tenantId = req.user.tenantId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const duesEventOtherSources = ["DUES", "EVT", "OTHER"];
    const donationSources = ["DONATION"];

    const activeDuesStatuses = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"] as any;

    const [outstanding, overdue, paidLast30Days, totalDonations, donationsLast30Days, revenueMix, duesBilled, duesPaid] =
      await Promise.all([
      prisma.invoice.aggregate({
        where: {
          tenantId,
          amountCents: { gt: 0 },
          OR: [
            {
              source: { in: duesEventOtherSources },
              status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] as any },
            },
            {
              source: { in: donationSources },
              status: { in: ["ISSUED", "OVERDUE"] as any },
            },
          ],
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId,
          amountCents: { gt: 0 },
          source: { in: duesEventOtherSources.concat(donationSources) },
          status: "OVERDUE" as any,
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId,
          status: "PAID",
          amountCents: { gt: 0 },
          updatedAt: { gte: thirtyDaysAgo },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId,
          source: { in: donationSources },
          status: "PAID",
          amountCents: { gt: 0 },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          tenantId,
          source: { in: donationSources },
          status: "PAID",
          amountCents: { gt: 0 },
          updatedAt: { gte: thirtyDaysAgo },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      // Revenue mix: only PAID, grouped by source
      prisma.invoice.groupBy({
        by: ["source"],
        where: {
          tenantId,
          status: "PAID",
          amountCents: { gt: 0 },
        },
        _sum: { amountCents: true },
        _count: true,
      }),
      // Dues billed total (exclude draft/void/failed)
      prisma.invoice.aggregate({
        where: {
          tenantId,
          source: "DUES",
          status: { in: activeDuesStatuses as any },
          amountCents: { gt: 0 },
        },
        _sum: { amountCents: true },
      }),
      // Dues paid total (payments on DUES invoices)
      prisma.payment.aggregate({
        where: {
          tenantId,
          status: PaymentStatus.SUCCEEDED,
          invoice: {
            source: "DUES",
            status: { in: activeDuesStatuses as any },
          },
        },
        _sum: { amountCents: true },
      }),
    ]);

    const mixBuckets = {
      DUES: { totalCents: 0, count: 0 },
      EVT: { totalCents: 0, count: 0 },
      DONATION: { totalCents: 0, count: 0 },
      OTHER: { totalCents: 0, count: 0 },
    };

    revenueMix.forEach((row) => {
      const key = (row.source || "OTHER").toUpperCase();
      const bucket = mixBuckets[key as keyof typeof mixBuckets] ?? mixBuckets.OTHER;
      bucket.totalCents += row._sum.amountCents || 0;
      bucket.count += row._count || 0;
    });

    return res.json({
      outstanding: {
        count: outstanding._count || 0,
        totalCents: outstanding._sum.amountCents || 0,
      },
      overdue: {
        count: overdue._count || 0,
        totalCents: overdue._sum.amountCents || 0,
      },
      paidLast30Days: {
        count: paidLast30Days._count || 0,
        totalCents: paidLast30Days._sum.amountCents || 0,
      },
      totalDonations: {
        count: totalDonations._count || 0,
        totalCents: totalDonations._sum.amountCents || 0,
      },
      donationsLast30Days: {
        count: donationsLast30Days._count || 0,
        totalCents: donationsLast30Days._sum.amountCents || 0,
      },
      revenueMix: mixBuckets,
      duesSummary: {
        billedTotalCents: duesBilled._sum.amountCents || 0,
        paidTotalCents: duesPaid._sum.amountCents || 0,
        outstandingCents: Math.max((duesBilled._sum.amountCents || 0) - (duesPaid._sum.amountCents || 0), 0),
      },
    });
  } catch (err) {
    console.error("[billing] getFinanceSummaryHandler error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
