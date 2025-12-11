import { NextFunction, Request, Response } from "express";
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
const billingHandlers = {
  createEventInvoice: (..._args: any[]) => {
    console.warn("[payments-billing] createEventInvoice stub hit; payments-billing-service not implemented yet.");
    throw new Error("Billing not implemented");
  },
  getInvoiceById: (..._args: any[]) => {
    console.warn("[payments-billing] getInvoiceById stub hit; payments-billing-service not implemented yet.");
    return null;
  },
};
const { createEventInvoice, getInvoiceById } = billingHandlers;
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

const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
  const { roles } = getMemberContext(req);
  if (!roles.includes("ADMIN")) {
    return res.status(403).json({ error: { message: "Admin only" } });
  }
  return next();
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
    checkedInAt: reg.checkInAt ? reg.checkInAt.getTime() : null,
  };
};

const prismaEventToRecord = (e: any): EventRecord => {
  const regMode: "rsvp" | "pay_now" = e.priceCents && e.priceCents > 0 ? "pay_now" : "rsvp";
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
  const existing = bySlug ? getEventBySlug(idOrSlug) : getEventById(idOrSlug);
  if (existing) return existing;
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
  if (!event) return null;
  const record = prismaEventToRecord(event);
  return setEvent(record);
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
  const isPrivileged = roles.includes("ADMIN") || roles.includes("OFFICER") || roles.includes("EVENT_MANAGER");
  const now = new Date();
  const recentCompletedCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const baseWhere: any = isPrivileged
    ? {}
    : {
        OR: [
          { status: "PUBLISHED", startsAt: { gte: now } },
          { status: "COMPLETED", startsAt: { gte: recentCompletedCutoff } },
        ],
      };

  const where = applyTenantScope({ where: baseWhere }, tenantId).where;
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

    const { title, description, startDate, endDate, capacity, priceCents, price, currency, tags, location } = req.body || {};
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
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data: { priceCents: nextPrice, currency: currency ?? null },
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
  const event = (await loadEventFromDbIntoStore(tenantId, id)) || getEventById(id);
  if (!event) return res.status(404).json({ error: { message: "Event not found" } });
  if (event.status !== "published") return res.status(400).json({ error: { message: "Event not open for registration" } });

  const regMode: "rsvp" | "pay_now" = event.registrationMode === "pay_now" ? "pay_now" : "rsvp";
  const paymentStatus: "unpaid" | "pending" | "paid" = regMode === "pay_now" ? "pending" : "unpaid";

  const updated = addRegistration(id, memberId, name, email, regMode, paymentStatus);
  if (!updated) {
    return res.status(400).json({ error: { message: "Event not found or capacity reached" } });
  }
  res.json(toDetailDto(updated, memberId));
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
  if (!event || event.status !== "published") {
    return res.status(404).json({ error: { message: "Event not found" } });
  }

  let ensured: { event: EventRecord; registration: EventRegistration; created: boolean };
  try {
    ensured = ensureMemberRegistrationForCheckout(event, memberId, name, email);
  } catch (e: any) {
    return res.status(400).json({ error: { message: e?.message || "Unable to register for event" } });
  }
  const registration = ensured.registration;

  if (event.registrationMode === "rsvp") {
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

  let invoice = registration.invoiceId ? getInvoiceById(tenantId, registration.invoiceId) : undefined;
  if (!invoice) {
    invoice = createEventInvoice({
      tenantId,
      memberId,
      amount: event.priceCents ?? event.price ?? 0,
      currency: event.currency || "PHP",
      description: `Event: ${event.title}`,
      eventId: event.id,
      eventTitle: event.title,
      dueDate: event.startDate || null,
      status: "unpaid",
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
  ensureAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) return res.status(401).json({ error: { message: "Unauthorized" } });
    const { bannerImageUrl } = req.body || {};
    try {
      const updated = await prisma.event.update({
        where: { id_tenantId: { id, tenantId } },
        data: { bannerUrl: bannerImageUrl ?? null },
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
  (req: Request, res: Response) => {
    const { id } = req.params;
    const mode = req.body?.mode as "pay_now" | "rsvp" | undefined;
    const updated = updateEvent(id, { registrationMode: mode === "pay_now" ? "pay_now" : "rsvp" });
    if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
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

