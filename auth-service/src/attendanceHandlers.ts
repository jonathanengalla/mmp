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

    // Validate all registrations belong to the same event and tenant
    const registrations = await prisma.eventRegistration.findMany({
      where: { id: { in: registrationIds }, tenantId },
      select: { eventId: true },
    });

    if (registrations.length !== registrationIds.length) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Some registration IDs not found or belong to different tenant" } });
    }

    const uniqueEventIds = new Set(registrations.map((r) => r.eventId));
    if (uniqueEventIds.size > 1) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "All registrations must belong to the same event" } });
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

// Helper to format CSV row
const escapeCsv = (value: any): string => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Attendance report
export const getAttendanceReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { eventId } = req.params;
    const tenantId = req.user.tenantId;

    // Query params
    const attendanceStatus = (req.query.attendanceStatus as string) || "all"; // all | attended | not-attended
    const paymentStatus = (req.query.paymentStatus as string) || "all"; // all | paid | unpaid | no-invoice
    const search = (req.query.search as string) || "";
    const format = (req.query.format as string) || "json"; // json | csv

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });
    }

    const isPaidEvent = (event.priceCents || 0) > 0;

    // Build where clause for registrations
    const registrationWhere: Prisma.EventRegistrationWhereInput = {
      eventId,
      tenantId,
    };

    // Filter by search term (member name or email)
    if (search.trim()) {
      registrationWhere.member = {
        OR: [
          { firstName: { contains: search.trim(), mode: "insensitive" as Prisma.QueryMode } },
          { lastName: { contains: search.trim(), mode: "insensitive" as Prisma.QueryMode } },
          { email: { contains: search.trim(), mode: "insensitive" as Prisma.QueryMode } },
        ],
      };
    }

    // Fetch registrations with member and invoice
    const registrations = await prisma.eventRegistration.findMany({
      where: registrationWhere,
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amountCents: true,
            status: true,
          },
        },
      },
      orderBy: [
        { checkedInAt: "desc" as Prisma.SortOrder },
        { createdAt: "asc" as Prisma.SortOrder },
      ],
    });

    // Apply attendance status filter
    let filteredRegistrations = registrations;
    if (attendanceStatus === "attended") {
      filteredRegistrations = registrations.filter((r) => r.checkedInAt !== null);
    } else if (attendanceStatus === "not-attended") {
      filteredRegistrations = registrations.filter((r) => r.checkedInAt === null);
    }

    // Apply payment status filter (paid events only)
    if (isPaidEvent && paymentStatus !== "all") {
      filteredRegistrations = filteredRegistrations.filter((reg) => {
        if (paymentStatus === "paid") {
          return reg.invoice?.status === "PAID";
        } else if (paymentStatus === "unpaid") {
          return reg.invoice?.status === "ISSUED" || reg.invoice?.status === "OVERDUE";
        } else if (paymentStatus === "no-invoice") {
          return !reg.invoice;
        }
        return true;
      });
    }

    // Build attendees array
    const attendees = filteredRegistrations.map((reg) => ({
      registrationId: reg.id,
      member: reg.member,
      registeredAt: reg.createdAt,
      checkedInAt: reg.checkedInAt,
      invoice: reg.invoice
        ? {
            id: reg.invoice.id,
            invoiceNumber: reg.invoice.invoiceNumber,
            amountCents: reg.invoice.amountCents,
            status: reg.invoice.status,
          }
        : null,
    }));

    // Calculate summary stats from all registrations (not filtered)
    const totalRegistrations = registrations.length;
    const totalAttended = registrations.filter((r) => r.checkedInAt).length;
    const attendanceRate = totalRegistrations > 0 ? Math.round((totalAttended / totalRegistrations) * 100) : 0;

    // Calculate invoice stats (only for paid events, from all registrations)
    let paidInvoices = 0;
    let unpaidInvoices = 0;
    let totalCollected = 0;

    if (isPaidEvent) {
      registrations.forEach((reg) => {
        if (reg.invoice) {
          if (reg.invoice.status === "PAID") {
            paidInvoices++;
            totalCollected += reg.invoice.amountCents || 0;
          } else if (reg.invoice.status === "ISSUED" || reg.invoice.status === "OVERDUE") {
            unpaidInvoices++;
          }
        }
      });
    }

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
        registrationMode: (event as any).registrationMode || "RSVP",
        status: event.status || "PUBLISHED",
      },
      summary: {
        capacity: event.capacity,
        totalRegistrations,
        totalAttended,
        attendanceRate,
        ...(isPaidEvent
          ? {
              paidInvoices,
              unpaidInvoices,
              totalCollectedCents: totalCollected,
            }
          : {}),
      },
      attendees,
    };

    // CSV export
    if (format === "csv") {
      const headers = [
        "Member Name",
        "Email",
        "Registered At",
        "Checked In At",
        ...(isPaidEvent ? ["Invoice Number", "Invoice Status", "Invoice Amount (₱)"] : []),
      ];

      const rows = attendees.map((a) => {
        const baseRow = [
          `${a.member.firstName} ${a.member.lastName}`,
          a.member.email,
          a.registeredAt ? new Date(a.registeredAt).toISOString() : "",
          a.checkedInAt ? new Date(a.checkedInAt).toISOString() : "",
        ];
        if (isPaidEvent) {
          baseRow.push(
            a.invoice?.invoiceNumber || "",
            a.invoice?.status || "",
            a.invoice?.amountCents ? (a.invoice.amountCents / 100).toFixed(2) : ""
          );
        }
        return baseRow.map(escapeCsv).join(",");
      });

      const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\n");

      res.setHeader("Content-Type", "text/csv;charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="attendance-${event.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv"`);
      return res.send(csvContent);
    }

    // JSON response
    return res.json({ data: report });
  } catch (error) {
    console.error("Get attendance report error:", error);
    return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get attendance report" } });
  }
};
