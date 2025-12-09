import { NextFunction, Request, Response } from "express";
import { prisma } from "./db/prisma";
import { getUserFromAuthHeader } from "./utils/auth";
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
} from "../../libs/shared/src/models";
import {
  addRegistration,
  cancelRegistration,
  createEvent,
  getEventById,
  getEventBySlug,
  ensureMemberRegistrationForCheckout,
  linkInvoiceToRegistration,
  listEvents,
  listUpcomingPublishedEvents,
  markCheckInByCode,
  publishEvent,
  updateEvent,
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

const getMemberContext = (req: Request) => {
  const user = (req as any).user || {};
  return {
    memberId: user.member_id || user.memberId || null,
    email: user.email || `${user.member_id || "member"}@example.com`,
    name: user.name || user.email || "Member",
    roles: (user.roles as string[] | undefined) || [],
  };
};

const ensureAdmin = (req: Request, res: Response, next: NextFunction) => {
  const { roles } = getMemberContext(req);
  if (!roles.includes("admin")) {
    return res.status(403).json({ error: { message: "Admin only" } });
  }
  return next();
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

const toInvoiceDto = (invoice: any): Invoice => {
  const statusMap: Record<string, InvoiceStatus> = {
    void: "cancelled",
  };
  return {
    id: invoice.id,
    memberId: invoice.memberId,
    amountCents: invoice.amount,
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

export const listUpcomingEventsHandler = (req: Request, res: Response) => {
  const { memberId } = getMemberContext(req);
  const items = listUpcomingPublishedEvents().map((e) => toUpcomingDto(e, memberId));
  res.json({ items });
};

export const listEventsHandler = [ensureAdmin, (_req: Request, res: Response) => {
  const items = listEvents().map((e) => toDetailDto(e));
  res.json({ items });
}];

export const createEventHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
  const { title, description, startDate, endDate, capacity, priceCents, price, currency, tags, registrationMode, location } =
    req.body || {};
  if (!title || !startDate) {
    return res.status(400).json({ error: { message: "title and startDate are required" } });
  }

  const cap = capacity === null || capacity === undefined ? null : Number(capacity);
  const priceValue = priceCents ?? price;
  const priceCentsValue = priceValue === null || priceValue === undefined ? null : Number(priceValue);

  const record = createEvent({
    title,
    description,
    startDate,
    endDate,
    capacity: Number.isNaN(cap as number) ? null : cap,
    priceCents: Number.isNaN(priceCentsValue as number) ? null : priceCentsValue,
    currency: currency ?? null,
    tags,
    registrationMode: registrationMode === "pay_now" ? "pay_now" : "rsvp",
    location,
  });

  res.status(201).json(toDetailDto(record));
  },
];

export const publishEventHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = publishEvent(id);
  if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
  res.json(toDetailDto(updated));
  },
];

export const updateCapacityHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
  const { id } = req.params;
  const { capacity } = req.body || {};
  const cap = capacity === null || capacity === undefined ? null : Number(capacity);
  const updated = updateEvent(id, { capacity: Number.isNaN(cap as number) ? null : cap });
  if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
  res.json(toDetailDto(updated));
  },
];

export const updatePricingHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
  const { id } = req.params;
  const { priceCents, currency, price } = req.body || {};
  const priceValue = priceCents ?? price;
  const priceCentsValue = priceValue === null || priceValue === undefined ? null : Number(priceValue);
  const updated = updateEvent(id, {
    priceCents: Number.isNaN(priceCentsValue as number) ? null : priceCentsValue,
    price: Number.isNaN(priceCentsValue as number) ? null : priceCentsValue,
    currency: currency ?? null,
  });
  if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
  res.json(toDetailDto(updated));
  },
];

export const updateEventBasicsHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, startDate, endDate, location } = req.body || {};
    const patch: Partial<EventRecord> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (startDate !== undefined) patch.startDate = startDate;
    if (endDate !== undefined) patch.endDate = endDate;
    if (location !== undefined) patch.location = location;

    const updated = updateEvent(id, patch);
    if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toDetailDto(updated));
  },
];

export const registerEventHandler = (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberId, email, name } = getMemberContext(req);
  if (!memberId) return res.status(401).json({ error: { message: "Unauthorized" } });
  const event = getEventById(id);
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
  if (!memberId) return res.status(401).json({ error: { message: "Unauthorized" } });

  const event = getEventById(id) || getEventBySlug(id);
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
  const tenantId = (req as any).user?.tenantId || "t1";

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

export const listMyInvoicesHandler = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user || !user.memberId) return res.status(401).json({ error: { message: "Unauthorized" } });

    const invoices = await prisma.invoice.findMany({
      where: { memberId: user.memberId },
      include: { event: true },
      orderBy: { issuedAt: "desc" },
    });
    const items = invoices.map(toInvoiceDto);
    return res.json({ items });
  } catch (err) {
    console.error("[invoices] listMyInvoicesHandler error", err);
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
};

export const eventsAttendanceReportHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
    const statusFilter = (req.query.status as string | undefined) || undefined;
    let items = listEvents();
    if (statusFilter && statusFilter !== "all") {
      items = items.filter((e) => e.status === statusFilter);
    }
    res.json({ items: items.map(toAttendanceDto) });
  },
];

export const getEventDetailHandler = (req: Request, res: Response) => {
  const id = (req.params as any).id;
  const slug = (req.params as any).slug;
  const { memberId } = getMemberContext(req);
  const event = slug ? getEventBySlug(slug) : getEventById(id);
  if (!event) return res.status(404).json({ error: { message: "Event not found" } });
  res.json(toDetailDto(event, memberId));
};

export const updateEventBannerHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
    const { id } = req.params;
    const { bannerImageUrl } = req.body || {};
    const updated = updateEvent(id, { bannerImageUrl: bannerImageUrl ?? null });
    if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toDetailDto(updated));
  },
];

export const updateEventTagsHandler = [
  ensureAdmin,
  (req: Request, res: Response) => {
    const { id } = req.params;
    const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const updated = updateEvent(id, { tags });
    if (!updated) return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toDetailDto(updated));
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

