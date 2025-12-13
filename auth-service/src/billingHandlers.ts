import { Request, Response } from "express";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import type { AuthenticatedRequest } from "./authMiddleware";
import { createManualInvoice, getInvoiceById, recordInvoicePayment, listPaymentMethodsForMember, savePaymentMethod } from "./billingStore";
import { prisma } from "./db/prisma";
import { applyTenantScope } from "./tenantGuard";
import { toInvoiceDto } from "./eventsHandlers";
import { generateInvoiceNumber } from "./utils/invoiceNumber";
import { resolveFinancePeriod, FinancePeriod } from "./utils/financePeriod";
import { mapInvoiceStatusToReporting, isOutstandingStatus, isPaidStatus, isCancelledStatus, ReportingStatus } from "./utils/invoiceStatusMapper";
import { calculateInvoiceBalance, calculateInvoiceBalanceFromAllocations } from "./utils/invoiceBalance";
import { getInvoiceAllocationsTotalCents, computeInvoiceBalanceCents } from "./services/invoice/balance";

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

const sanitizeInvoiceDetailed = (inv: any, includeBalance = false) => {
  const base = {
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
    rawStatus: inv.status, // Keep raw status for detail views
    dueDate: inv.dueAt,
    issuedAt: inv.issuedAt,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
    source: inv.source || null,
  };

  // Add balance calculation if payments are included
  if (includeBalance && inv.payments) {
    const balanceCents = calculateInvoiceBalance(inv.amountCents, inv.payments);
    return {
      ...base,
      balanceCents,
      status: mapInvoiceStatusToReporting(inv.status) as ReportingStatus,
    };
  }

  // Map status to reporting status for list views
  return {
    ...base,
    status: mapInvoiceStatusToReporting(inv.status) as ReportingStatus,
  };
};

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

/**
 * FIN-02: Enhanced Admin Invoice List Handler
 * Supports period filtering, status/source filtering, sorting, and balance calculation
 */
export async function listTenantInvoicesPaginatedHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const roles = (req.user.roles || []).map((r) => r.toUpperCase());
    const isPrivileged = roles.includes("ADMIN") || roles.includes("OFFICER") || roles.includes("FINANCE_MANAGER");
    if (!isPrivileged) return res.status(403).json({ error: "Forbidden" });

    // Parse query parameters
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt((req.query.pageSize as string) || "50", 10), 200), 1);
    const search = (req.query.search as string | undefined)?.trim();
    
    // Support array or single value for status and source
    const statusParam = req.query.status;
    const statusArray = Array.isArray(statusParam) ? statusParam : statusParam ? [statusParam] : [];
    const statusFilters = statusArray.filter((s: string) => s && s !== "all").map((s: string) => s.toUpperCase());
    
    const sourceParam = req.query.source;
    const sourceArray = Array.isArray(sourceParam) ? sourceParam : sourceParam ? [sourceParam] : [];
    const sourceFilters = sourceArray.filter((s: string) => s && s !== "all").map((s: string) => s.toUpperCase());
    
    // Period filtering (FIN-01 compatible)
    let period: FinancePeriod | null = null;
    if (req.query.period || req.query.from || req.query.to) {
      try {
        period = resolveFinancePeriod(
          req.query.period as string | undefined,
          req.query.from as string | undefined,
          req.query.to as string | undefined
        );
      } catch (err: any) {
        return res.status(400).json({ error: err.message || "Invalid period parameters" });
      }
    }

    // Sort parameters
    const sortBy = (req.query.sortBy as string) || "issuedAt";
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === "ASC" ? "asc" : "desc";

    // Build where clause
    const where: any = {
      tenantId: req.user.tenantId,
      amountCents: { gt: 0 }, // Zero-amount exclusion
    };

    // Period filter (on issuedAt)
    if (period) {
      where.issuedAt = { gte: period.from, lte: period.to };
    }

    // Status filter: map reporting statuses to raw statuses
    if (statusFilters.length > 0) {
      const statusConditions: InvoiceStatus[] = [];
      statusFilters.forEach((reportingStatus: string) => {
        const upper = reportingStatus.toUpperCase();
        if (upper === "OUTSTANDING") {
          statusConditions.push(InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE);
        } else if (upper === "PAID") {
          statusConditions.push(InvoiceStatus.PAID);
        } else if (upper === "CANCELLED") {
          statusConditions.push(InvoiceStatus.VOID, InvoiceStatus.FAILED, InvoiceStatus.DRAFT);
        }
      });
      if (statusConditions.length > 0) {
        where.status = { in: statusConditions };
        console.log("[billing] Status filter applied:", {
          requested: statusFilters,
          mappedTo: statusConditions,
          whereClause: where.status,
        });
      }
    }

    // Source filter
    if (sourceFilters.length > 0) {
      // Normalize source values: frontend sends "EVENT" but database stores "EVT"
      const normalizedSources = sourceFilters.map((s: string) => {
        const upper = s.toUpperCase();
        // Map frontend "EVENT" to database "EVT"
        if (upper === "EVENT") return "EVT";
        // Other values should match: DUES, DONATION, OTHER
        return upper;
      });
      where.source = { in: normalizedSources };
    }

    // Search filter
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

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === "dueAt") {
      orderBy.dueAt = sortOrder;
    } else if (sortBy === "amountCents") {
      orderBy.amountCents = sortOrder;
    } else if (sortBy === "memberName") {
      // Sort by member last name, then first name
      orderBy.member = { lastName: sortOrder, firstName: sortOrder };
    } else {
      // Default: issuedAt
      orderBy.issuedAt = sortOrder;
    }

    // PAY-10: Fetch invoices with allocations for balance calculation
    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          event: true,
          member: true,
          allocations: {
            include: {
              payment: true, // Include payment, filter by status after
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // PAY-10: Map invoices with balance calculation using Allocations
    // CRITICAL: After PAY-10, we must compute status from allocations, not use stored status
    // because stored status may be stale. We filter by stored status (for performance),
    // but we compute and return the correct status based on allocations.
    const { computeInvoiceStatus } = require("./services/invoice/computeInvoiceStatus");
    
    const invoiceList = invoices.map((inv: any) => {
      // Calculate balance from allocations
      const allocations = (inv.allocations || []).filter((alloc: any) => alloc.payment && alloc.payment.status === PaymentStatus.SUCCEEDED); // Only allocations with succeeded payments
      const balanceCents = calculateInvoiceBalanceFromAllocations(inv.amountCents, allocations);
      const allocationsTotal = allocations.reduce((sum: number, alloc: any) => sum + (alloc.amountCents || 0), 0);
      
      // Compute the CORRECT status from allocations (PAY-10: allocations are source of truth)
      const computedStatus = computeInvoiceStatus(
        { amountCents: inv.amountCents, dueAt: inv.dueAt, status: inv.status },
        allocationsTotal
      );
      const computedReportingStatus = mapInvoiceStatusToReporting(computedStatus);
      
      // Log mismatch for debugging (stored vs computed)
      if (mapInvoiceStatusToReporting(inv.status) !== computedReportingStatus) {
        console.warn("[billing] Invoice status mismatch (stored vs computed):", {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          stored: inv.status,
          computed: computedStatus,
          storedReporting: mapInvoiceStatusToReporting(inv.status),
          computedReporting: computedReportingStatus,
          allocationsTotal,
          balanceCents,
        });
      }
      
      return {
        ...sanitizeInvoiceDetailed(inv, false), // Don't use old balance calculation
        balanceCents,
        // Use computed status (from allocations) as source of truth
        status: computedReportingStatus as ReportingStatus,
      };
    });
    
    // POST-FILTER: If status filter was applied, filter out invoices that don't match computed status
    // This handles cases where stored status is stale but we filtered by it
    let filteredInvoiceList = invoiceList;
    if (statusFilters.length > 0) {
      filteredInvoiceList = invoiceList.filter((inv: any) => {
        const matches = statusFilters.includes(inv.status);
        if (!matches) {
          console.warn("[billing] Invoice filtered out due to status mismatch:", {
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            computedStatus: inv.status,
            requestedFilters: statusFilters,
          });
        }
        return matches;
      });
      
      // Update total count to reflect post-filtering
      const filteredTotal = await prisma.invoice.count({ where });
      // Recalculate total based on post-filter results
      // Note: This is approximate since we can't efficiently count by computed status
      console.log("[billing] Post-filter status check:", {
        beforeFilter: invoiceList.length,
        afterFilter: filteredInvoiceList.length,
        requestedStatuses: statusFilters,
      });
    }
    
    return res.json({
      invoices: filteredInvoiceList,
      pagination: {
        page,
        pageSize,
        // If we post-filtered, the total might be slightly off, but it's the best we can do
        // without recomputing status for all invoices in the database
        total: statusFilters.length > 0 ? filteredInvoiceList.length : total,
        totalPages: statusFilters.length > 0 
          ? Math.max(1, Math.ceil(filteredInvoiceList.length / pageSize))
          : Math.max(1, Math.ceil(total / pageSize)),
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
      invoices: invoices.map((inv: any) => sanitizeInvoiceDetailed(inv, false)),
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

/**
 * FIN-02: Admin Invoice Detail Handler
 * Returns full invoice details with payment history and source context
 */
export async function getAdminInvoiceDetailHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const roles = (req.user.roles || []).map((r) => r.toUpperCase());
    const isPrivileged = roles.includes("ADMIN") || roles.includes("OFFICER") || roles.includes("FINANCE_MANAGER");
    if (!isPrivileged) return res.status(403).json({ error: "Forbidden" });

    const invoiceId = req.params.id;
    if (!invoiceId) return res.status(400).json({ error: "Invoice ID required" });

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: req.user.tenantId,
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          include: {
            paymentMethod: {
              select: {
                id: true,
                brand: true,
                last4: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Calculate balance
    const succeededPayments = invoice.payments.filter((p) => p.status === PaymentStatus.SUCCEEDED);
    const balanceCents = calculateInvoiceBalance(invoice.amountCents, succeededPayments);

    // Build source context
    const sourceContext: any = {
      type: (invoice.source || "OTHER").toUpperCase(),
    };

    if (invoice.source === "EVENT" && invoice.event) {
      sourceContext.event = {
        id: invoice.event.id,
        eventTitle: invoice.event.title,
        eventDate: invoice.event.startsAt,
      };
    } else if (invoice.source === "DUES") {
      // Extract membership year from invoice number or description if available
      const yearMatch = invoice.invoiceNumber?.match(/\d{4}/);
      sourceContext.membershipYear = yearMatch ? yearMatch[0] : new Date(invoice.issuedAt).getFullYear().toString();
      sourceContext.description = invoice.description;
    } else if (invoice.source === "DONATION") {
      sourceContext.description = invoice.description;
      // Campaign name would come from a future field if we add it
    } else {
      sourceContext.description = invoice.description;
    }

    // Build line items (single item from invoice description for now)
    const lineItems = [
      {
        description: invoice.description || `Invoice ${invoice.invoiceNumber}`,
        quantity: 1,
        unitAmountCents: invoice.amountCents,
        totalAmountCents: invoice.amountCents,
      },
    ];

    // Map payments
    const paymentRecords = invoice.payments.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      reference: p.reference,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
      paymentMethod: p.paymentMethod
        ? {
            id: p.paymentMethod.id,
            brand: p.paymentMethod.brand,
            last4: p.paymentMethod.last4,
          }
        : null,
    }));

    return res.json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: invoice.memberId,
      member: invoice.member,
      source: invoice.source || "OTHER",
      status: mapInvoiceStatusToReporting(invoice.status),
      rawStatus: invoice.status,
      amountCents: invoice.amountCents,
      balanceCents,
      currency: invoice.currency,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      description: invoice.description,
      lineItems,
      payments: paymentRecords,
      sourceContext,
    });
  } catch (err) {
    console.error("[billing] getAdminInvoiceDetailHandler error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * FIN-02: Member Invoice Detail Handler
 * Returns invoice details for authenticated member (restricted)
 */
export async function getMemberInvoiceDetailHandler(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.user.memberId;
    if (!memberId) return res.status(403).json({ error: "No member context" });

    const invoiceId = req.params.id;
    if (!invoiceId) return res.status(400).json({ error: "Invoice ID required" });

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: req.user.tenantId,
        memberId, // Enforce ownership
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.SUCCEEDED },
          orderBy: { createdAt: "desc" },
          include: {
            paymentMethod: {
              select: {
                id: true,
                brand: true,
                last4: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      // Return 404 to avoid leaking existence
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Calculate balance
    const balanceCents = calculateInvoiceBalance(invoice.amountCents, invoice.payments);

    // Build simplified source context for member view
    const sourceContext: any = {
      type: (invoice.source || "OTHER").toUpperCase(),
    };

    if (invoice.source === "EVENT" && invoice.event) {
      sourceContext.event = {
        id: invoice.event.id,
        eventTitle: invoice.event.title,
        eventDate: invoice.event.startsAt,
      };
    } else if (invoice.source === "DUES") {
      const yearMatch = invoice.invoiceNumber?.match(/\d{4}/);
      sourceContext.membershipYear = yearMatch ? yearMatch[0] : new Date(invoice.issuedAt).getFullYear().toString();
    }

    // Build line items
    const lineItems = [
      {
        description: invoice.description || `Invoice ${invoice.invoiceNumber}`,
        quantity: 1,
        unitAmountCents: invoice.amountCents,
        totalAmountCents: invoice.amountCents,
      },
    ];

    // Map payments (only succeeded for member view)
    const paymentRecords = invoice.payments.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      reference: p.reference,
      processedAt: p.processedAt,
      createdAt: p.createdAt,
      paymentMethod: p.paymentMethod
        ? {
            id: p.paymentMethod.id,
            brand: p.paymentMethod.brand,
            last4: p.paymentMethod.last4,
          }
        : null,
    }));

    return res.json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      source: invoice.source || "OTHER",
      status: mapInvoiceStatusToReporting(invoice.status),
      rawStatus: invoice.status,
      amountCents: invoice.amountCents,
      balanceCents,
      currency: invoice.currency,
      issuedAt: invoice.issuedAt,
      dueAt: invoice.dueAt,
      paidAt: invoice.paidAt,
      description: invoice.description,
      lineItems,
      payments: paymentRecords,
      sourceContext,
    });
  } catch (err) {
    console.error("[billing] getMemberInvoiceDetailHandler error", err);
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

/**
 * FIN-01: Finance Dashboard Summary Handler
 * Returns comprehensive finance metrics with time window support and source breakdown
 */
export const getFinanceSummaryHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const tenantId = req.user.tenantId;

    // Resolve time window from query params
    let period: FinancePeriod;
    try {
      period = resolveFinancePeriod(
        req.query.period as string | undefined,
        req.query.from as string | undefined,
        req.query.to as string | undefined
      );
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Invalid period parameters" });
    }

    // Base where clause: tenant-scoped, non-zero amounts only
    const baseWhere = {
      tenantId,
      amountCents: { gt: 0 }, // Zero-amount exclusion enforced at query level
      issuedAt: { gte: period.from, lte: period.to }, // Time window filter on issuedAt
    };

    // Get all invoices in period for aggregation
    // PAY-10: Now we load allocations instead of payments directly
    const allInvoices = await prisma.invoice.findMany({
      where: baseWhere,
    });

    // PAY-10: Batch load allocations for all invoices
    const invoiceIds = allInvoices.map((inv) => inv.id);
    const allAllocations = invoiceIds.length > 0
      ? await prisma.allocation.findMany({
          where: {
            tenantId,
            invoiceId: { in: invoiceIds },
            payment: {
              status: PaymentStatus.SUCCEEDED, // Only count succeeded payments
            },
          },
          include: {
            payment: true,
          },
        })
      : [];

    // Group allocations by invoiceId for quick lookup
    const allocationsByInvoice = new Map<string, typeof allAllocations>();
    for (const alloc of allAllocations) {
      if (!allocationsByInvoice.has(alloc.invoiceId)) {
        allocationsByInvoice.set(alloc.invoiceId, []);
      }
      allocationsByInvoice.get(alloc.invoiceId)!.push(alloc);
    }

    // PAY-10: Calculate outstanding amounts using Allocations (single source of truth)
    const calculateOutstandingAmount = (invoice: any): number => {
      if (isPaidStatus(invoice.status)) return 0;
      if (isCancelledStatus(invoice.status)) return 0;
      
      const allocations = allocationsByInvoice.get(invoice.id) || [];
      const allocationsTotal = allocations.reduce((sum, alloc) => sum + (alloc.amountCents || 0), 0);
      return computeInvoiceBalanceCents(invoice, allocationsTotal);
    };

    // PAY-10: Calculate collected amounts using Allocations
    const calculateCollectedAmount = (invoice: any): number => {
      if (isCancelledStatus(invoice.status)) return 0;
      
      const allocations = allocationsByInvoice.get(invoice.id) || [];
      const allocationsTotal = allocations.reduce((sum, alloc) => sum + (alloc.amountCents || 0), 0);
      
      return allocationsTotal;
    };

    // Aggregate by source and status
    const bySource: Record<string, { outstanding: { count: number; totalCents: number }; collected: { count: number; totalCents: number } }> = {
      DUES: { outstanding: { count: 0, totalCents: 0 }, collected: { count: 0, totalCents: 0 } },
      DONATION: { outstanding: { count: 0, totalCents: 0 }, collected: { count: 0, totalCents: 0 } },
      EVENT: { outstanding: { count: 0, totalCents: 0 }, collected: { count: 0, totalCents: 0 } },
      OTHER: { outstanding: { count: 0, totalCents: 0 }, collected: { count: 0, totalCents: 0 } },
    };

    const byStatus: Record<string, { count: number; totalCents: number }> = {
      OUTSTANDING: { count: 0, totalCents: 0 },
      PAID: { count: 0, totalCents: 0 },
      CANCELLED: { count: 0, totalCents: 0 },
    };

    let totalOutstanding = { count: 0, totalCents: 0 };
    let totalCollected = { count: 0, totalCents: 0 };
    let totalCancelled = { count: 0, totalCents: 0 };

    for (const invoice of allInvoices) {
      const source = (invoice.source || "OTHER").toUpperCase();
      const reportingStatus = mapInvoiceStatusToReporting(invoice.status);
      const outstandingAmount = calculateOutstandingAmount(invoice);
      const collectedAmount = calculateCollectedAmount(invoice);

      // Update byStatus
      byStatus[reportingStatus].count += 1;
      if (reportingStatus === "OUTSTANDING") {
        byStatus[reportingStatus].totalCents += outstandingAmount;
      } else if (reportingStatus === "PAID") {
        byStatus[reportingStatus].totalCents += invoice.amountCents;
      } else {
        byStatus[reportingStatus].totalCents += invoice.amountCents;
      }

      // Update totals
      if (reportingStatus === "OUTSTANDING") {
        totalOutstanding.count += 1;
        totalOutstanding.totalCents += outstandingAmount;
        // Also count collected amount for partially paid invoices
        if (collectedAmount > 0) {
          totalCollected.count += 1;
          totalCollected.totalCents += collectedAmount;
        }
      } else if (reportingStatus === "PAID") {
        totalCollected.count += 1;
        totalCollected.totalCents += invoice.amountCents; // Full invoice amount for PAID (use invoice amount as source of truth)
      } else {
        totalCancelled.count += 1;
        totalCancelled.totalCents += invoice.amountCents;
      }

      // Update bySource (only for non-cancelled)
      // Count invoices by status to match top metrics, not just by amount
      if (!isCancelledStatus(invoice.status)) {
        const sourceKey = source === "EVT" ? "EVENT" : source;
        const bucket = bySource[sourceKey] || bySource.OTHER;

        // Count outstanding invoices by status (matches top metrics logic)
        if (reportingStatus === "OUTSTANDING") {
          bucket.outstanding.count += 1;
          bucket.outstanding.totalCents += outstandingAmount;
        }

        // Count collected invoices: PAID status OR any collected amount (for partially paid)
        if (reportingStatus === "PAID") {
          bucket.collected.count += 1;
          // For PAID invoices, use invoice amount (they're fully paid)
          // Allocations should match, but use invoice amount as source of truth for PAID status
          bucket.collected.totalCents += invoice.amountCents;
        } else if (reportingStatus === "OUTSTANDING" && collectedAmount > 0) {
          // Partially paid invoices: count in collected but not as a separate invoice count
          // (they're already counted in outstanding)
          bucket.collected.totalCents += collectedAmount;
          // Note: We don't increment count here to avoid double-counting the invoice
          // The invoice is counted once in outstanding, and we just add its collected amount
        }
      }
    }

    // Build response with self-describing range
    return res.json({
      range: {
        type: period.type,
        from: period.from.toISOString(),
        to: period.to.toISOString(),
        label: period.label,
      },
      totals: {
        outstanding: totalOutstanding,
        collected: totalCollected,
        cancelled: totalCancelled,
      },
      bySource: {
        DUES: bySource.DUES,
        DONATION: {
          // Donations don't have outstanding in business model
          collected: bySource.DONATION.collected,
        },
        EVENT: bySource.EVENT,
        OTHER: bySource.OTHER,
      },
      byStatus,
    });
  } catch (err: any) {
    console.error("[billing] getFinanceSummaryHandler error", err);
    if (err.message && err.message.includes("Invalid")) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};
