import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "./db/prisma";
import type { AuthenticatedRequest } from "./authMiddleware";

// Mark a single registration as attended
export const markAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { registrationId } = req.params;
    const tenantId = req.user.tenantId;

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, tenantId },
    });
    if (!registration) {
      return res.status(404).json({ error: { code: "REGISTRATION_NOT_FOUND", message: "Registration not found" } });
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { checkedInAt: new Date() },
    });

    return res.json({ data: updated });
  } catch (error) {
    console.error("Mark attendance error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to mark attendance" } });
  }
};

// Undo attendance
export const undoAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { registrationId } = req.params;
    const tenantId = req.user.tenantId;

    const registration = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, tenantId },
    });
    if (!registration) {
      return res.status(404).json({ error: { code: "REGISTRATION_NOT_FOUND", message: "Registration not found" } });
    }

    const updated = await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { checkedInAt: null },
    });

    return res.json({ data: updated });
  } catch (error) {
    console.error("Undo attendance error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to undo attendance" } });
  }
};

// Bulk mark attendance
export const bulkMarkAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { registrationIds } = req.body || {};
    const tenantId = req.user.tenantId;

    if (!Array.isArray(registrationIds) || registrationIds.length === 0) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "registrationIds must be non-empty array" } });
    }

    const result = await prisma.eventRegistration.updateMany({
      where: { id: { in: registrationIds }, tenantId },
      data: { checkedInAt: new Date() },
    });

    return res.json({ data: { updated: result.count, message: `Marked ${result.count} members as attended` } });
  } catch (error) {
    console.error("Bulk mark attendance error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to bulk mark attendance" } });
  }
};

// Attendance report
export const getAttendanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { eventId } = req.params;
    const tenantId = req.user.tenantId;

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });
    }

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId, tenantId },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [
        { checkedInAt: "desc" as Prisma.SortOrder },
        { createdAt: "asc" as Prisma.SortOrder },
      ],
    });

    const invoices =
      event.priceCents && event.priceCents > 0
        ? await prisma.invoice.findMany({
            where: { eventId, tenantId },
            select: { id: true, invoiceNumber: true, memberId: true, amountCents: true, status: true },
          })
        : [];

    const invoiceMap = new Map<string, (typeof invoices)[number]>();
    invoices.forEach((inv) => {
      if (inv.memberId) invoiceMap.set(inv.memberId, inv);
    });

    const attendees = registrations.map((reg) => ({
      registrationId: reg.id,
      member: reg.member,
      registeredAt: reg.createdAt,
      checkedInAt: reg.checkedInAt,
      invoice: invoiceMap.get(reg.memberId) || null,
    }));

    const totalRegistrations = registrations.length;
    const totalAttended = registrations.filter((r) => r.checkedInAt).length;
    const attendanceRate = totalRegistrations > 0 ? Math.round((totalAttended / totalRegistrations) * 100) : 0;

    const paidInvoices = invoices.filter((i) => i.status === "PAID").length;
    const unpaidInvoices = invoices.filter((i) => i.status === "ISSUED").length;
    const totalCollected = invoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + (i.amountCents || 0), 0);

    const report = {
      event: {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        priceCents: event.priceCents,
        capacity: event.capacity,
        eventType: (event as any).eventType || "IN_PERSON",
        status: event.status || "PUBLISHED",
      },
      summary: {
        capacity: event.capacity,
        totalRegistrations,
        totalAttended,
        attendanceRate,
        ...(event.priceCents && event.priceCents > 0
          ? {
              paidInvoices,
              unpaidInvoices,
              totalCollectedCents: totalCollected,
            }
          : {}),
      },
      attendees,
    };

    return res.json({ data: report });
  } catch (error) {
    console.error("Get attendance report error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get attendance report" } });
  }
};

