import { Request, Response } from "express";
import {
  Invoice,
  InvoiceStatus,
  RecordInvoicePaymentPayload,
  DuesSummaryItem,
  DuesSummaryResponse,
} from "../../libs/shared/src/models";
import {
  getInvoiceById,
  markInvoicePaid,
  createDuesInvoice,
  getDuesInvoicesByPeriod,
  getAllDuesInvoices,
} from "./billingStore";
import { markRegistrationPaidForInvoice } from "./eventsStore";
import { sendEmail } from "./notifications/emailSender";
import { buildDuesInvoiceEmail } from "./notifications/emailTemplates";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const membershipHandlers = require("../../membership-service/src/handlers");

const toInvoiceDto = (invoice: Invoice): Invoice => {
  const statusMap: Record<string, InvoiceStatus> = {
    void: "cancelled",
  };
  return {
    ...invoice,
    status: (statusMap[invoice.status] as InvoiceStatus) || invoice.status,
    paidAt: invoice.paidAt ?? null,
    paymentMethod: invoice.paymentMethod ?? null,
    paymentReference: invoice.paymentReference ?? null,
  };
};

export const recordInvoicePaymentHandler = (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId || "t1";
    const payload = (req.body || {}) as RecordInvoicePaymentPayload;
    const updated = markInvoicePaid(tenantId, id, payload);
    if (updated.eventId) {
      markRegistrationPaidForInvoice(updated.id);
    }
    return res.status(200).json(toInvoiceDto(updated));
  } catch (err: any) {
    const message = err?.message || "Unable to record payment";
    if (message === "Invoice not found") {
      return res.status(404).json({ error: { message } });
    }
    return res.status(400).json({ error: { message } });
  }
};

export const createDuesRunHandler = async (req: Request, res: Response) => {
  try {
    const { periodKey, label, amountCents, currency, dueDate } = req.body || {};
    if (!periodKey || !label || !amountCents || !currency) {
      return res.status(400).json({ error: { message: "periodKey, label, amountCents, and currency are required" } });
    }
    const tenantId = (req as any).user?.tenantId || "t1";
    const members = (await membershipHandlers.getAllActiveMembersForTenant?.(tenantId)) || [];
    const existingForPeriod = getDuesInvoicesByPeriod(tenantId, periodKey);
    let createdCount = 0;
    let skippedExistingCount = 0;

    for (const m of members) {
      const already = existingForPeriod.find(
        (inv: Invoice) => inv.memberId === m.id && (inv.status === "unpaid" || inv.status === "pending")
      );
      if (already) {
        skippedExistingCount += 1;
        continue;
      }
      const invoice = createDuesInvoice({
        tenantId,
        memberId: m.id,
        amountCents: Number(amountCents),
        currency,
        duesPeriodKey: periodKey,
        duesLabel: label,
        dueDate: dueDate ?? null,
      });
      createdCount += 1;

      try {
        if (m.email) {
          const fullName = `${(m as any).firstName ?? (m as any).first_name ?? ""} ${(m as any).lastName ?? (m as any).last_name ?? ""}`.trim() || null;
          const emailContent = buildDuesInvoiceEmail({
            member: { email: m.email, name: fullName },
            invoice,
          });
          void sendEmail({
            to: m.email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
            template: "dues_invoice_created",
            meta: { memberId: m.id, invoiceId: invoice.id, tenantId },
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[billing] Email error", err);
      }
    }

    return res.status(201).json({
      periodKey,
      label,
      createdCount,
      skippedExistingCount,
      amountCentsPerInvoice: Number(amountCents),
      currency,
    });
  } catch (err: any) {
    console.error("[createDuesRunHandler] error", err);
    return res.status(500).json({ error: { message: "Failed to create dues run" } });
  }
};

export const listDuesSummaryHandler = (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user?.tenantId || "t1";
    const invoices = getAllDuesInvoices(tenantId);
    const byPeriod = new Map<string, DuesSummaryItem>();

    for (const inv of invoices) {
      const periodKey = inv.duesPeriodKey || "unknown";
      const label = inv.duesLabel || inv.description || "Dues";
      const currency = inv.currency || "PHP";
      const key = `${tenantId}:${periodKey}`;
      let bucket = byPeriod.get(key);
      if (!bucket) {
        bucket = {
          periodKey,
          label,
          currency,
          totalCount: 0,
          unpaidCount: 0,
          paidCount: 0,
          amountCentsTotal: 0,
          amountCentsUnpaid: 0,
          amountCentsPaid: 0,
        };
        byPeriod.set(key, bucket);
      }
      bucket.totalCount += 1;
      bucket.amountCentsTotal += inv.amountCents;
      if (inv.status === "paid") {
        bucket.paidCount += 1;
        bucket.amountCentsPaid += inv.amountCents;
      } else {
        bucket.unpaidCount += 1;
        bucket.amountCentsUnpaid += inv.amountCents;
      }
    }

    const response: DuesSummaryResponse = { items: Array.from(byPeriod.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey)) };
    return res.json(response);
  } catch (err: any) {
    console.error("[listDuesSummaryHandler] error", err);
    return res.status(500).json({ error: { message: "Failed to load dues summary" } });
  }
};


