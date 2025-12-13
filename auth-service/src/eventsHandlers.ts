import { NextFunction, Request, Response } from "express";
import { EventRegistrationStatus as PrismaEventRegistrationStatus, EventStatus as PrismaEventStatus, InvoiceStatus as PrismaInvoiceStatus } from "@prisma/client";
import { prisma } from "./db/prisma";
import { applyTenantScope } from "./tenantGuard";
import type { AuthenticatedRequest } from "./authMiddleware";
import {
  EventAttendanceReportItem,
  EventCheckInResult,
  EventCheckoutResponse,
  EventDetailDto,
  EventRecord,
  EventRegistration,
  Invoice,
  InvoiceStatus,
  UpcomingEventDto,
  EventStatus,
  EventsAdminSummary,
  EventsSelfSummary,
} from "../../libs/shared/src/models";
import {
  addRegistration,
  cancelRegistration,
  getEventById,
  getEventBySlug,
  ensureMemberRegistrationForCheckout,
  linkInvoiceToRegistration,
  listEvents,
  markCheckInByCode,
  updateEvent,
  setEvent,
} from "./eventsStore";
import { createEventInvoice as createEventInvoiceFromStore, getInvoiceById } from "./billingStore";
import { sendEmail } from "./notifications/emailSender";
import { buildEventInvoiceEmail, buildEventRsvpEmail } from "./notifications/emailTemplates";

const PAYMENT_STATUS_MAP: Record<string, "unpaid" | "pending" | "paid"> = {
  PAID: "paid",
  paid: "paid",
  PENDING: "pending",
  pending: "pending",
  OVERDUE: "pending",
  UNPAID: "unpaid",
  unpaid: "unpaid",
  DRAFT: "unpaid",
};

const getMemberContext = (req: Request) => {
  const user = (req as any).user || {};
  return {
    memberId: user.member_id || user.memberId || null,
    email: user.email || `${user.member_id || "member"}@example.com`,
    name: user.name || user.email || "Member",
    roles: ((user.roles as string[] | undefined) || []).map((r) => r.toUpperCase()),
  };
};

const hasAnyRole = (roles: string[] | undefined, allowed: string[]) => {
  const userRoles = roles || [];
  return allowed.some((role) => userRoles.includes(role));
};

const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
  const { roles } = getMemberContext(req);
  if (!roles.includes("ADMIN")) {
    return res.status(403).json({ error: { message: "Admin only" } });
  }
  return next();
};
const requireEventManagerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const roles = getMemberContext(req).roles;
  if (hasAnyRole(roles, ["ADMIN", "EVENT_MANAGER"])) return next();
  return res.status(403).json({ error: { message: "Forbidden" } });
};

const slugifyTitle = (title: string, fallback: string) => {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return base || fallback;
};

const generateUniqueSlugForTenant = async (tenantId: string, title: string) => {
  const base = slugifyTitle(title, `event-${Date.now()}`);
  let candidate = base;
  let counter = 1;
  // loop until we find a slug that does not exist for this tenant
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.event.findFirst({
      where: { tenantId, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${counter++}`;
  }
};

const EVENT_RELATIONS = { registrations: { include: { member: true, invoice: true } } };

const normalizeRegistrationMode = (priceCents?: number | null, requested?: string) => {
  const amount = priceCents ?? 0;
  if (amount <= 0 || amount === null) return "RSVP";
  const mode = requested?.toString?.().toUpperCase?.();
  return mode === "PAY_NOW" ? "PAY_NOW" : "RSVP";
};

const prismaRegistrationToRecord = (reg: any, event: any): EventRegistration => {
  const memberName = reg.member ? `${reg.member.firstName ?? ""} ${reg.member.lastName ?? ""}`.trim() : reg.memberId;
  const paymentStatus = reg.invoice ? PAYMENT_STATUS_MAP[reg.invoice.status] || "unpaid" : undefined;
  const status = reg.status === "CANCELLED" ? "cancelled" : "registered";
  const checkInStatus = reg.status === "CHECKED_IN" ? "checked_in" : "not_checked_in";
  return {
    memberId: reg.memberId,
    email: reg.member?.email ?? `${reg.memberId}@example.com`,
    name: memberName || reg.member?.email || reg.memberId,
    status,
    registrationStatus: reg.status === "CHECKED_IN" ? "checked_in" : status,
    ticketCode: reg.checkInCode || `EVT-${event.slug}-${reg.id.slice(0, 8)}`,
    registrationId: reg.id,
    paymentStatus,
    invoiceId: reg.invoiceId ?? null,
    createdAt: reg.createdAt ? reg.createdAt.toISOString() : new Date().toISOString(),
    checkInStatus,
    checkedInAt: reg.checkedInAt
      ? reg.checkedInAt instanceof Date
        ? reg.checkedInAt.getTime()
        : reg.checkedInAt
      : reg.checkInAt
      ? reg.checkInAt.getTime()
      : null,
  };
};

const prismaEventToRecord = (e: any): EventRecord => {
  const regMode: "rsvp" | "pay_now" =
    (e.registrationMode?.toString?.().toUpperCase?.() === "PAY_NOW" ? "pay_now" : null) ||
    (e.priceCents && e.priceCents > 0 ? "pay_now" : "rsvp");
  const registrations = (e.registrations || []).map((reg: any) => prismaRegistrationToRecord(reg, e));
  const registrationCount = registrations.filter((r) => r.status === "registered" || r.registrationStatus === "registered").length;
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description ?? null,
    startDate: e.startsAt ? new Date(e.startsAt).toISOString() : e.startDate ?? new Date().toISOString(),
    endDate: e.endsAt ? new Date(e.endsAt).toISOString() : e.endDate ?? null,
    location: e.location ?? null,
    capacity: e.capacity ?? null,
    price: e.priceCents ?? e.price ?? null,
    priceCents: e.priceCents ?? e.price ?? null,
    currency: e.currency ?? null,
    status: (e.status?.toLowerCase?.() || e.status || "draft") as EventStatus,
    registrationsCount: registrationCount,
    invoiceIds: registrations.map((r) => r.invoiceId).filter(Boolean) as string[],
    bannerImageUrl: e.bannerUrl ?? e.bannerImageUrl ?? null,
    tags: Array.isArray(e.tags) ? e.tags : [],
    registrationMode: regMode,
    registrations,
    createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: e.updatedAt ? new Date(e.updatedAt).toISOString() : new Date().toISOString(),
  };
};

const loadEventFromDbIntoStore = async (tenantId: string, idOrSlug: string, bySlug = false): Promise<EventRecord | null> => {
  // Always attempt to refresh from DB so capacity/registrations stay current
  const where = bySlug ? { slug: idOrSlug } : { id: idOrSlug };
  const event = await prisma.event.findFirst(
    applyTenantScope(
      {
        where,
        include: { registrations: { include: { member: true, invoice: true } } },
      },
      tenantId
    )
  );
  if (event) {
    const record = prismaEventToRecord(event);
    return setEvent(record);
  }
  // Fallback to any cached copy if DB lookup fails
  return bySlug ? getEventBySlug(idOrSlug) ?? null : getEventById(idOrSlug) ?? null;
};

const toUpcomingDto = (e: EventRecord, currentMemberId?: string | null): UpcomingEventDto => {
  const regMode: "rsvp" | "pay_now" = e.registrationMode === "pay_now" ? "pay_now" : "rsvp";
  const memberReg = currentMemberId
    ? [...e.registrations].reverse().find((r) => r.memberId === currentMemberId)
    : undefined;
  const isRegistered = memberReg?.status === "registered";
  const regStatus =
    memberReg?.registrationStatus === "checked_in"
      ? "registered"
      : memberReg?.registrationStatus ?? memberReg?.status ?? null;
  return {
    event_id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description ?? null,
    startDate: e.startDate,
    endDate: e.endDate ?? null,
    location: e.location ?? null,
    capacity: e.capacity ?? null,
    registrationsCount: e.registrationsCount,
    priceCents: e.priceCents ?? e.price ?? null,
    currency: e.currency ?? null,
    status: e.status,
    bannerImageUrl: e.bannerImageUrl ?? null,
    tags: e.tags ?? [],
    registrationMode: regMode,
    isRegistered: !!isRegistered,
    registrationStatus: regStatus as UpcomingEventDto["registrationStatus"],
    ticketCode: memberReg?.ticketCode ?? null,
    paymentStatus: memberReg?.paymentStatus ?? null,
    invoiceId: memberReg?.invoiceId ?? null,
  };
};

const toDetailDto = (e: EventRecord, currentMemberId?: string | null): EventDetailDto => {
  const regMode: "rsvp" | "pay_now" = e.registrationMode === "pay_now" ? "pay_now" : "rsvp";
  const memberReg = currentMemberId
    ? [...e.registrations].reverse().find((r) => r.memberId === currentMemberId)
    : undefined;
  const isRegistered = memberReg?.status === "registered";
  const regStatus =
    memberReg?.registrationStatus === "checked_in"
      ? "registered"
      : memberReg?.registrationStatus ?? memberReg?.status ?? null;
  const remainingCapacity =
    e.capacity != null ? Math.max(e.capacity - (e.registrations.filter((r) => r.status === "registered").length || 0), 0) : null;
  return {
    event_id: e.id,
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description ?? undefined,
    status: e.status,
    startDate: e.startDate,
    endDate: e.endDate ?? undefined,
    location: e.location ?? undefined,
    capacity: e.capacity ?? null,
    registrationsCount: e.registrationsCount,
    priceCents: e.priceCents ?? e.price ?? null,
    currency: e.currency ?? null,
    bannerImageUrl: e.bannerImageUrl ?? null,
    tags: e.tags ?? [],
    registrationMode: regMode,
    isRegistered: !!isRegistered,
    registrationStatus: regStatus as EventDetailDto["registrationStatus"],
    ticketCode: memberReg?.ticketCode ?? null,
    paymentStatus: memberReg?.paymentStatus ?? null,
    invoiceId: memberReg?.invoiceId ?? null,
    remainingCapacity,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
};

const toAttendanceDto = (e: EventRecord): EventAttendanceReportItem => ({
  event_id: e.id,
  title: e.title,
  startDate: e.startDate,
  endDate: e.endDate ?? null,
  capacity: e.capacity ?? null,
  registrationsCount: e.registrationsCount,
  status: e.status,
  bannerImageUrl: e.bannerImageUrl ?? null,
  tags: e.tags ?? [],
  checkInCount: e.registrations.filter((r) => r.checkInStatus === "checked_in").length,
  paidCount: e.registrations.filter((r) => r.paymentStatus === "paid").length,
  unpaidCount: e.registrations.filter((r) => r.paymentStatus !== "paid").length,
  invoiceIds: e.invoiceIds ?? [],
});

export const toInvoiceDto = (invoice: any): Invoice => {
  const statusMap: Record<string, InvoiceStatus> = {
    void: "cancelled",
  };
  const amountCents = invoice.amountCents ?? invoice.amount ?? 0;
  return {
    id: invoice.id,
    memberId: invoice.memberId,
    amountCents,
    currency: invoice.currency,
    status: (statusMap[invoice.status] as InvoiceStatus) || (invoice.status as InvoiceStatus),
    description: invoice.description || invoice.type || "Invoice",
    eventId: invoice.eventId || null,
    eventTitle: invoice.event?.title || invoice.eventTitle || null,
    source: (invoice.source as Invoice["source"]) || (invoice.type as Invoice["source"]) || "manual",
    dueDate: invoice.dueAt ? new Date(invoice.dueAt).toISOString() : invoice.dueDate || null,
    createdAt: invoice.createdAt ? new Date(invoice.createdAt).toISOString() : new Date().toISOString(),
    paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : null,
    paymentMethod: invoice.paymentMethod || null,
    paymentReference: invoice.paymentReference || null,
  };
};

export const listUpcomingEventsHandler = async (req: Request, res: Response) => {
  const { memberId } = getMemberContext(req);
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const now = new Date();
  const events = await prisma.event.findMany(
    applyTenantScope(
      {
        where: { status: "PUBLISHED", startsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        include: { registrations: { include: { member: true, invoice: true } } },
      },
      tenantId
    )
  );
  const mapped = events.map(prismaEventToRecord);
  mapped.forEach(setEvent);
  const items = mapped.map((e) => toUpcomingDto(e, memberId));
  res.json({ items });
};

export const listEventsHandler = async (req: Request, res: Response) => {
  const { memberId, roles } = getMemberContext(req);
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const normalizedRoles = roles.map((r) => r.toUpperCase());
  const isPrivileged = normalizedRoles.some((r) => ["ADMIN", "OFFICER", "EVENT_MANAGER", "ROLE_ADMIN", "ROLE_OFFICER", "ROLE_EVENT_MANAGER"].includes(r));
  const now = new Date();
  const recentCompletedCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const baseWhere: any = isPrivileged
    ? {}
    : {
        // Member-facing: only published and not soft-deleted
        status: "PUBLISHED",
        deletedAt: null,
      };

  const where = applyTenantScope({ where: baseWhere as any }, tenantId).where;
  const [total, events] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      orderBy: { startsAt: "asc" },
      include: { registrations: { include: { member: true, invoice: true } } },
      skip: offset,
      take: limit,
    }),
  ]);
  const mapped = events.map(prismaEventToRecord);
  mapped.forEach(setEvent);
  const items = mapped.map((e) => toDetailDto(e, memberId));
  res.json({ items, total, limit, offset });
};

export const createEventHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const { title, description, startDate, endDate, capacity, priceCents, price, currency, tags, location, registrationMode, eventType } = req.body || {};
    if (!title || !startDate) {
      return res.status(400).json({ error: { message: "title and startDate are required" } });
    }

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: { message: "Invalid startDate" } });
    }
    const end = endDate ? new Date(endDate) : start;
    if (Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: { message: "Invalid endDate" } });
    }

    const cap = capacity === null || capacity === undefined ? null : Number(capacity);
    const priceValue = priceCents ?? price;
    const priceCentsValue = priceValue === null || priceValue === undefined ? null : Number(priceValue);

    try {
      const slug = await generateUniqueSlugForTenant(tenantId, title);
      const regMode = normalizeRegistrationMode(priceCentsValue, registrationMode);
      const created = await prisma.event.create({
        data: {
          tenantId,
          title,
          slug,
          description: description ?? null,
          location: location ?? null,
          status: "DRAFT",
          bannerUrl: null,
          capacity: Number.isNaN(cap as number) ? null : cap,
          priceCents: Number.isNaN(priceCentsValue as number) ? null : priceCentsValue,
          currency: currency ?? null,
          tags: Array.isArray(tags) ? tags : [],
          registrationMode: regMode,
          eventType: (eventType === "ONLINE" ? "ONLINE" : "IN_PERSON") as "IN_PERSON" | "ONLINE",
          startsAt: start,
          endsAt: end,
        },
        include: EVENT_RELATIONS,
      });
      const record = setEvent(prismaEventToRecord(created));
      return res.status(201).json(toDetailDto(record));
    } catch (err) {
      console.error("[events] createEventHandler error", err);
      return res.status(500).json({ error: { message: "Failed to create event" } });
    }
  },
];

export const listAdminEventsHandler = async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const events = await prisma.event.findMany({
    where: { tenantId, deletedAt: null } as any,
    include: {
      _count: { select: { registrations: true, invoices: true } },
    },
    orderBy: { startsAt: "desc" },
  });
  const mapped = events.map((e) => ({
    ...prismaEventToRecord(e),
    registrationsCount: (e as any)._count?.registrations ?? 0,
    invoicesCount: (e as any)._count?.invoices ?? 0,
  }));
  res.json({ events: mapped });
};

export const deleteEventHandler = async (req: Request, res: Response) => {
  const { eventId } = req.params as any;
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
  if (!event) return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });

  const [invoiceCount, registrationCount] = await Promise.all([
    prisma.invoice.count({ where: { tenantId, eventId } }),
    prisma.eventRegistration.count({ where: { tenantId, eventId } }),
  ]);

  if (invoiceCount > 0 || registrationCount > 0) {
    return res.status(400).json({
      error: {
        code: "EVENT_HAS_ACTIVITY",
        message: "This event already has registrations or invoices. You can cancel it but not delete it.",
      },
    });
  }

  await prisma.event.update({ where: { id: eventId }, data: { deletedAt: new Date() } as any });
  res.json({ success: true });
};

export const cancelEventHandler = async (req: Request, res: Response) => {
  const { eventId } = req.params as any;
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
  if (!event) return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });

  await prisma.event.update({ where: { id: eventId }, data: { status: "CANCELLED" } });
  res.json({ success: true });
};

export const updateEventWithCapacityHandler = async (req: Request, res: Response) => {
  const { eventId } = req.params as any;
  const tenantId = (req as any).user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const { capacity, ...rest } = req.body || {};
  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    include: { _count: { select: { registrations: true } } },
  });
  if (!event) return res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Event not found" } });

  if (capacity !== undefined && capacity !== null) {
    const current = (event as any)._count?.registrations ?? 0;
    if (capacity < current) {
      return res.status(400).json({
        error: { code: "CAPACITY_TOO_LOW", message: `Capacity cannot be less than current registrations (${current}).` },
      });
    }
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { ...(capacity !== undefined ? { capacity } : {}), ...rest } as any,
    include: EVENT_RELATIONS,
  });
  const record = prismaEventToRecord(updated);
  setEvent(record);
  res.json(toDetailDto(record));
};

export const publishEventHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    try {
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data: { status: "PUBLISHED" },
        include: EVENT_RELATIONS,
      });
      const record = setEvent(prismaEventToRecord(updated));
      return res.json(toDetailDto(record));
    } catch (err: any) {
      if (err?.code === "P2025") return res.status(404).json({ error: { message: "Event not found" } });
      console.error("[events] publishEventHandler error", err);
      return res.status(500).json({ error: { message: "Unable to publish event" } });
    }
  },
];

export const updateCapacityHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { capacity } = req.body || {};
    const cap = capacity === null || capacity === undefined ? null : Number(capacity);
    const nextCap = Number.isNaN(cap as number) ? null : cap;
    try {
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data: { capacity: nextCap },
        include: EVENT_RELATIONS,
      });
      const record = setEvent(prismaEventToRecord(updated));
      return res.json(toDetailDto(record));
    } catch (err: any) {
      if (err?.code === "P2025") return res.status(404).json({ error: { message: "Event not found" } });
      console.error("[events] updateCapacityHandler error", err);
      return res.status(500).json({ error: { message: "Unable to update capacity" } });
    }
  },
];

export const updatePricingHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { priceCents, currency, price } = req.body || {};
    const priceValue = priceCents ?? price;
    const priceCentsValue = priceValue === null || priceValue === undefined ? null : Number(priceValue);
    const nextPrice = Number.isNaN(priceCentsValue as number) ? null : priceCentsValue;
    try {
      const current = await prisma.event.findFirst({ where: { id, tenantId } });
      if (!current) return res.status(404).json({ error: { message: "Event not found" } });
      const regMode = normalizeRegistrationMode(nextPrice, current.registrationMode);
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data: { priceCents: nextPrice, currency: currency ?? null, registrationMode: regMode },
        include: EVENT_RELATIONS,
      });
      const record = setEvent(prismaEventToRecord(updated));
      return res.json(toDetailDto(record));
    } catch (err: any) {
      if (err?.code === "P2025") return res.status(404).json({ error: { message: "Event not found" } });
      console.error("[events] updatePricingHandler error", err);
      return res.status(500).json({ error: { message: "Unable to update pricing" } });
    }
  },
];

export const updateEventBasicsHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { title, description, startDate, endDate, location } = req.body || {};

    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description ?? null;
    if (startDate !== undefined) {
      const start = new Date(startDate);
      if (Number.isNaN(start.getTime())) return res.status(400).json({ error: { message: "Invalid startDate" } });
      data.startsAt = start;
    }
    if (endDate !== undefined) {
      const end = endDate ? new Date(endDate) : null;
      if (end && Number.isNaN(end.getTime())) return res.status(400).json({ error: { message: "Invalid endDate" } });
      data.endsAt = end ?? data.startsAt ?? undefined;
    }
    if (location !== undefined) data.location = location ?? null;

    try {
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data,
        include: EVENT_RELATIONS,
      });
      const record = setEvent(prismaEventToRecord(updated));
      return res.json(toDetailDto(record));
    } catch (err: any) {
      if (err?.code === "P2025") return res.status(404).json({ error: { message: "Event not found" } });
      console.error("[events] updateEventBasicsHandler error", err);
      return res.status(500).json({ error: { message: "Unable to update event" } });
    }
  },
];

export const registerEventHandler = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberId, email, name } = getMemberContext(req);
  const tenantId = (req as any).user?.tenantId;
  if (!memberId) return res.status(401).json({ error: { message: "Unauthorized" } });
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });

  // Load event from database
  const eventData = await prisma.event.findFirst({
    where: { id, tenantId },
    include: { registrations: { include: { member: true, invoice: true } } },
  });
  if (!eventData) return res.status(404).json({ error: { message: "Event not found" } });

  const statusUpper = (eventData.status || "").toString().toUpperCase();
  if (statusUpper !== "PUBLISHED") return res.status(400).json({ error: { message: "Event not open for registration" } });

  // Check capacity
  if (eventData.capacity != null && eventData.registrations.length >= eventData.capacity) {
    return res.status(400).json({ error: { message: "Event capacity reached" } });
  }

  // Check if already registered (not cancelled)
  const existingRegistration = eventData.registrations.find((r) => r.memberId === memberId);
  if (existingRegistration && existingRegistration.status !== "CANCELLED") {
    return res.status(400).json({ error: { message: "Already registered for this event" } });
  }

  const regMode: "rsvp" | "pay_now" = eventData.registrationMode === "PAY_NOW" ? "pay_now" : "rsvp";
  const amount = eventData.priceCents ?? 0;

  // For PAY_NOW mode with price > 0, create invoice
  let invoiceId: string | null = null;
  if (regMode === "pay_now" && amount > 0) {
    try {
      const invoice = await createEventInvoiceFromStore(tenantId, {
        memberId,
        amountCents: amount,
        currency: eventData.currency || "PHP",
        description: `Event: ${eventData.title}`,
        dueDate: eventData.startsAt,
        eventId: eventData.id,
      });
      invoiceId = invoice.id;
    } catch (err) {
      console.error("[events] registerEventHandler invoice creation error", err);
      return res.status(500).json({ error: { message: "Failed to create invoice" } });
    }
  }

  // Create or update registration in database
  const dbRegistration = await prisma.eventRegistration.findFirst({
    where: {
      tenantId,
      eventId: eventData.id,
      memberId,
    },
  });

  const registration = dbRegistration
    ? await prisma.eventRegistration.update({
        where: { id: dbRegistration.id },
        data: {
          invoiceId,
          status: "PENDING",
          checkedInAt: null,
          updatedAt: new Date(),
        },
      })
    : await prisma.eventRegistration.create({
        data: {
          tenantId,
          eventId: eventData.id,
          memberId,
          invoiceId,
          status: "PENDING",
        },
      });

  // Reload event with updated registration
  const updatedEvent = await prisma.event.findFirst({
    where: { id, tenantId },
    include: { registrations: { include: { member: true, invoice: true } } },
  });

  if (!updatedEvent) return res.status(500).json({ error: { message: "Failed to reload event" } });

  const record = prismaEventToRecord(updatedEvent);
  setEvent(record);
  res.json(toDetailDto(record, memberId));
};

export const cancelRegistrationHandler = (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberId } = getMemberContext(req);
  if (!memberId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const updated = cancelRegistration(id, memberId);
  if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
  res.json(toDetailDto(updated, memberId));
};

export const eventCheckoutHandler = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberId, email, name } = getMemberContext(req);
  const tenantId = (req as any).user?.tenantId;
  if (!memberId) return res.status(401).json({ error: { message: "Unauthorized" } });
  if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });

  const event = (await loadEventFromDbIntoStore(tenantId, id)) || (await loadEventFromDbIntoStore(tenantId, id, true)) || getEventById(id) || getEventBySlug(id);
  const statusUpper = (event?.status || "").toString().toUpperCase();
  if (!event || statusUpper !== "PUBLISHED") {
    return res.status(404).json({ error: { message: "Event not found" } });
  }

  let ensured: { event: EventRecord; registration: EventRegistration; created: boolean };
  try {
    ensured = ensureMemberRegistrationForCheckout(event, memberId, name, email);
  } catch (e: any) {
    return res.status(400).json({ error: { message: e?.message || "Unable to register for event" } });
  }
  const registration = ensured.registration;

  const amount = event.priceCents ?? event.price ?? 0;

  // RSVP or free/sponsored events: return without invoice
  if (event.registrationMode === "rsvp" || amount <= 0) {
    const detailDto = toDetailDto(ensured.event, memberId);
    try {
      if (email && memberId) {
        const e = buildEventRsvpEmail({ member: { email, name }, event: detailDto });
        void sendEmail({
          to: email,
          subject: e.subject,
          text: e.text,
          html: e.html,
          template: "event_rsvp_confirmed",
          meta: { memberId, eventId: event.id },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[events] RSVP email error", err);
    }
    const payload: EventCheckoutResponse = { event: detailDto, invoice: null };
    return res.json(payload);
  }

  let invoice = registration.invoiceId ? await getInvoiceById(tenantId, registration.invoiceId) : undefined;
  if (!invoice) {
    invoice = await createEventInvoiceFromStore(tenantId, {
      memberId,
      amountCents: amount,
      currency: event.currency || "PHP",
      description: `Event: ${event.title}`,
      dueDate: event.startDate || null,
      eventId: event.id,
    });
  }

  const updatedEvent = linkInvoiceToRegistration(event.id, memberId, invoice.id);
  const payload: EventCheckoutResponse = {
    event: toDetailDto(updatedEvent, memberId),
    invoice: invoice ? toInvoiceDto(invoice) : null,
  };
  try {
    if (email && memberId && invoice) {
      const detailDto = toDetailDto(updatedEvent, memberId);
      const e = buildEventInvoiceEmail({ member: { email, name }, invoice: payload.invoice!, event: detailDto });
      void sendEmail({
        to: email,
        subject: e.subject,
        text: e.text,
        html: e.html,
        template: "event_invoice_created",
        meta: { memberId, eventId: updatedEvent.id, invoiceId: invoice.id },
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[events] Invoice email error", err);
  }
  return res.status(201).json(payload);
};

export const listMyInvoicesHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const memberId = req.user.memberId;
    if (!memberId) return res.status(403).json({ error: { message: "No member context" } });

    const invoices = await prisma.invoice.findMany(
      applyTenantScope(
        {
          where: { memberId },
          include: { event: true },
          orderBy: { issuedAt: "desc" },
        },
        req.user.tenantId
      )
    );
    const items = invoices.map(toInvoiceDto);
    return res.json({ items });
  } catch (err) {
    console.error("[invoices] listMyInvoicesHandler error", err);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
};

export const eventsAttendanceReportHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const statusFilter = (req.query.status as string | undefined) || undefined;
    const tenantId = (req as any).user?.tenantId;
    if (listEvents().length === 0 && tenantId) {
      const events = await prisma.event.findMany(
        applyTenantScope(
          {
            where: {},
            include: { registrations: { include: { member: true, invoice: true } } },
          },
          tenantId
        )
      );
      events.map(prismaEventToRecord).forEach(setEvent);
    }
    let items = listEvents();
    if (statusFilter && statusFilter !== "all") {
      items = items.filter((e) => e.status === statusFilter);
    }
    res.json({ items: items.map(toAttendanceDto) });
  },
];

export const getEventDetailHandler = async (req: Request, res: Response) => {
  const id = (req.params as any).id;
  const slug = (req.params as any).slug;
  const { memberId } = getMemberContext(req);
  const tenantId = (req as any).user?.tenantId;
  let event = slug ? getEventBySlug(slug) : getEventById(id);
  if (!event && tenantId) {
    event = slug ? await loadEventFromDbIntoStore(tenantId, slug, true) : await loadEventFromDbIntoStore(tenantId, id);
  }
  if (!event) return res.status(404).json({ error: { message: "Event not found" } });
  res.json(toDetailDto(event, memberId));
};

export const updateEventBannerHandler = [
  requireEventManagerOrAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { bannerImageUrl, bannerUrl } = req.body || {};
    const nextUrl = bannerUrl ?? bannerImageUrl ?? null;
    try {
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data: { bannerUrl: nextUrl },
        include: EVENT_RELATIONS,
      });
      const record = setEvent(prismaEventToRecord(updated));
      return res.json(toDetailDto(record));
    } catch (err: any) {
      if (err?.code === "P2025") return res.status(404).json({ error: { message: "Event not found" } });
      console.error("[events] updateEventBannerHandler error", err);
      return res.status(500).json({ error: { message: "Unable to update banner" } });
    }
  },
];

export const uploadEventBannerHandler = [
  requireEventManagerOrAdmin,
  async (req: Request, res: Response) => {
    const { imageData, imageUrl } = req.body || {};
    if (imageUrl && typeof imageUrl === "string") {
      return res.json({ url: imageUrl });
    }
    if (!imageData || typeof imageData !== "string") {
      return res.status(400).json({ error: { message: "Image data is required" } });
    }
    const isDataUrl = imageData.startsWith("data:image/");
    const allowed = ["png", "jpg", "jpeg", "webp"];
    const matches = imageData.match(/^data:image\/(png|jpg|jpeg|webp);base64,/i);
    if (!isDataUrl || !matches || !allowed.includes(matches[1].toLowerCase())) {
      return res.status(400).json({ error: { message: "Invalid image type. Use JPG, PNG, or WEBP." } });
    }
    // Rough size check: base64 overhead ~1.37x
    const sizeBytes = (imageData.length * 3) / 4;
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (sizeBytes > maxBytes) {
      return res
        .status(400)
        .json({ error: { message: "Image too large. Please upload under 5 MB." } });
    }
    // In this implementation we simply echo back the data URL.
    // If backed by blob storage, integrate upload here and return the stored URL.
    return res.json({ url: imageData });
  },
];

export const updateEventTagsHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    try {
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data: { tags },
        include: EVENT_RELATIONS,
      });
      const record = setEvent(prismaEventToRecord(updated));
      return res.json(toDetailDto(record));
    } catch (err: any) {
      if (err?.code === "P2025") return res.status(404).json({ error: { message: "Event not found" } });
      console.error("[events] updateEventTagsHandler error", err);
      return res.status(500).json({ error: { message: "Unable to update tags" } });
    }
  },
];

export const updateEventRegistrationModeHandler = [
  ensureAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const mode = req.body?.mode as "pay_now" | "rsvp" | undefined;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const event = await prisma.event.findFirst({ where: { id, tenantId } });
    if (!event) return res.status(404).json({ error: { message: "Event not found" } });

    const regMode = normalizeRegistrationMode(event.priceCents ?? 0, mode);
    const updatedDb = await prisma.event.update({
      where: { id_tenantId: { id, tenantId } },
      data: { registrationMode: regMode },
      include: EVENT_RELATIONS,
    });
    const updated = setEvent(prismaEventToRecord(updatedDb));
    res.json(toDetailDto(updated));
  },
];

export const checkInByCodeHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
    const code = req.body?.code as string;
    if (!code) return res.status(400).json({ error: { message: "code is required" } });
    const result = markCheckInByCode(code);
    if (!result) return res.status(404).json({ error: { message: "Registration not found" } });
    const payload: EventCheckInResult = {
      eventId: result.event.id,
      registrationId: result.registration.registrationId,
      checkInStatus: "checked_in",
      checkedInAt: new Date(result.registration.checkedInAt || Date.now()).toISOString(),
    };
    res.json(payload);
  },
];

export const getEventsAdminSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const allowedRoles = ["ADMIN", "EVENT_MANAGER", "FINANCE_MANAGER", "SUPER_ADMIN"];
    if (!hasAnyRole(req.user.roles, allowedRoles)) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const tenantId = req.user.tenantId;
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const upcomingEvents = await prisma.event.findMany({
      where: {
        tenantId,
        status: PrismaEventStatus.PUBLISHED,
        startsAt: { gt: now },
      },
      select: { id: true, title: true, startsAt: true, capacity: true, priceCents: true },
      orderBy: { startsAt: "asc" },
    });

    const eventsInNext30Days = upcomingEvents.filter((ev) => ev.startsAt <= thirtyDaysFromNow);
    const windowEventIds = eventsInNext30Days.map((ev) => ev.id);

    const registrationsCount = windowEventIds.length
      ? await prisma.eventRegistration.count({
          where: {
            tenantId,
            eventId: { in: windowEventIds },
            status: { not: PrismaEventRegistrationStatus.CANCELLED },
          },
        })
      : 0;

    const capacityTotalRaw = eventsInNext30Days
      .map((ev) => ev.capacity)
      .filter((c): c is number => typeof c === "number");
    const capacityTotal = capacityTotalRaw.length ? capacityTotalRaw.reduce((sum, c) => sum + c, 0) : undefined;

    const revenueAgg = await prisma.invoice.aggregate({
      where: {
        tenantId,
        source: "EVT",
        status: PrismaInvoiceStatus.PAID,
        OR: [
          { paidAt: { gte: startOfYear, lte: now } },
          { AND: [{ paidAt: null }, { updatedAt: { gte: startOfYear, lte: now } }] },
        ],
      },
      _sum: { amountCents: true },
    });

    const summary: EventsAdminSummary = {
      upcomingEventsCount: upcomingEvents.length,
      nextEvent: upcomingEvents[0]
        ? {
            id: upcomingEvents[0].id,
            title: upcomingEvents[0].title,
            startsAt: upcomingEvents[0].startsAt.toISOString(),
          }
        : null,
      registrationsNext30Days: {
        registrationsCount,
        capacityTotal,
      },
      eventRevenueThisYearCents: revenueAgg._sum.amountCents ?? 0,
      freeEventsCount: upcomingEvents.filter((ev) => (ev.priceCents ?? 0) === 0).length,
      paidEventsCount: upcomingEvents.filter((ev) => (ev.priceCents ?? 0) > 0).length,
    };

    return res.json(summary);
  } catch (err) {
    console.error("[events] getEventsAdminSummary error", err);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
};

export const getEventsSelfSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: { message: "Unauthorized" } });
    const memberId = req.user.memberId;
    if (!memberId) return res.status(400).json({ error: { message: "Member ID missing" } });

    const tenantId = req.user.tenantId;
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const upcomingPublishedEvents = await prisma.event.findMany({
      where: { tenantId, status: PrismaEventStatus.PUBLISHED, startsAt: { gt: now } },
      select: { id: true },
    });
    const upcomingIds = upcomingPublishedEvents.map((ev) => ev.id);

    const myUpcomingRegistrations = upcomingIds.length
      ? await prisma.eventRegistration.count({
          where: {
            tenantId,
            memberId,
            eventId: { in: upcomingIds },
            status: { not: PrismaEventRegistrationStatus.CANCELLED },
            event: { status: PrismaEventStatus.PUBLISHED, startsAt: { gt: now } },
          },
        })
      : 0;

    const eventsAttendedThisYear = await prisma.eventRegistration.count({
      where: {
        tenantId,
        memberId,
        event: { startsAt: { gte: startOfYear, lte: now } },
        OR: [
          { status: PrismaEventRegistrationStatus.CHECKED_IN },
          { checkInAt: { not: null } },
        ],
      },
    });

    const openRegistrationsCount = Math.max(upcomingIds.length - myUpcomingRegistrations, 0);

    const summary: EventsSelfSummary = {
      myUpcomingRegistrations,
      eventsAttendedThisYear,
      openRegistrationsCount,
    };

    return res.json(summary);
  } catch (err) {
    console.error("[events] getEventsSelfSummary error", err);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
};

