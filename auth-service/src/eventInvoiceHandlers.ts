import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import type { AuthenticatedRequest } from "./authMiddleware";
import { createEventInvoice } from "./billingStore";

const prisma = new PrismaClient();

/**
 * Bulk invoice generation for a paid RSVP event
 * Creates invoices for all registrations that don't already have one
 */
export const bulkGenerateEventInvoices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { eventId } = req.params;
    const tenantId = req.user.tenantId;

    // Fetch event and validate
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });
    }

    // Guard: Free events cannot generate invoices
    if (!event.priceCents || event.priceCents <= 0) {
      return res.status(400).json({
        error: {
          code: "FREE_EVENT_NO_INVOICES",
          message: "Cannot generate invoices for free events",
        },
      });
    }

    // Fetch all registrations for this event that don't have invoices
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        tenantId,
        eventId,
        invoiceId: null, // Only registrations without invoices
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
      },
    });

    if (registrations.length === 0) {
      return res.json({
        data: {
          created: 0,
          skipped: 0,
          message: "All registrations already have invoices",
        },
      });
    }

    // Create invoices for each registration
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as Array<{ registrationId: string; error: string }>,
    };

    for (const registration of registrations) {
      try {
        // Double-check that registration still doesn't have an invoice (race condition protection)
        const existingReg = await prisma.eventRegistration.findFirst({
          where: {
            id: registration.id,
            tenantId,
            invoiceId: { not: null },
          },
        });

        if (existingReg) {
          results.skipped++;
          continue;
        }

        // Create invoice using event price as source of truth
        const invoice = await createEventInvoice(tenantId, {
          memberId: registration.memberId,
          amountCents: event.priceCents,
          currency: event.currency || "PHP",
          description: `Event: ${event.title}`,
          dueDate: event.startsAt,
          eventId: event.id,
        });

        // Link invoice to registration
        await prisma.eventRegistration.update({
          where: { id: registration.id },
          data: { invoiceId: invoice.id },
        });

        results.created++;
      } catch (error: any) {
        console.error(`[event-invoices] Failed to create invoice for registration ${registration.id}:`, error);
        results.errors.push({
          registrationId: registration.id,
          error: error.message || "Failed to create invoice",
        });
      }
    }

    return res.json({
      data: {
        created: results.created,
        skipped: results.skipped,
        errors: results.errors.length > 0 ? results.errors : undefined,
        message: `Created ${results.created} invoice(s), skipped ${results.skipped} registration(s)`,
      },
    });
  } catch (error: any) {
    console.error("[event-invoices] bulkGenerateEventInvoices error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to generate invoices" },
    });
  }
};

/**
 * Individual invoice generation for a single registration
 */
export const generateRegistrationInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { registrationId } = req.params;
    const tenantId = req.user.tenantId;

    // Fetch registration with event and member
    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, tenantId },
      include: {
        event: true,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
    });

    if (!registration) {
      return res.status(404).json({
        error: { code: "REGISTRATION_NOT_FOUND", message: "Registration not found" },
      });
    }

    // Guard: Free events cannot generate invoices
    if (!registration.event.priceCents || registration.event.priceCents <= 0) {
      return res.status(400).json({
        error: {
          code: "FREE_EVENT_NO_INVOICES",
          message: "Cannot generate invoices for free events",
        },
      });
    }

    // Guard: Registration already has an invoice
    if (registration.invoice) {
      return res.status(409).json({
        error: {
          code: "INVOICE_ALREADY_EXISTS",
          message: `Invoice already exists for this registration: ${registration.invoice.invoiceNumber}`,
          invoiceId: registration.invoice.id,
          invoiceNumber: registration.invoice.invoiceNumber,
        },
      });
    }

    // Create invoice using event price as source of truth
    const invoice = await createEventInvoice(tenantId, {
      memberId: registration.memberId,
      amountCents: registration.event.priceCents,
      currency: registration.event.currency || "PHP",
      description: `Event: ${registration.event.title}`,
      dueDate: registration.event.startsAt,
      eventId: registration.event.id,
    });

    // Link invoice to registration
    await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { invoiceId: invoice.id },
    });

    return res.json({
      data: {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountCents: invoice.amountCents,
          status: invoice.status,
        },
        message: "Invoice created successfully",
      },
    });
  } catch (error: any) {
    console.error("[event-invoices] generateRegistrationInvoice error:", error);
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to generate invoice" },
    });
  }
};

