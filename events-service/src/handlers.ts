import { Request, Response } from "express";

type Event = {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  capacity?: number;
  price?: number;
  currency?: string;
  status: "draft" | "published";
  createdAt: number;
};

type Registration = {
  id: string;
  eventId: string;
  tenantId: string;
  memberId: string;
  status: "pending" | "confirmed" | "cancelled";
  invoiceId?: string;
  reminderSentAt?: number | null;
  reminderCount?: number;
};

const events: Event[] = [];
let eventCounter = 1;
const auditLogs: {
  id: string;
  tenantId: string;
  eventId: string;
  action:
    | "event.published"
    | "event.capacity.updated"
    | "event.registration.created"
    | "event.registration.canceled"
    | "event.pricing.updated";
  actorId?: string;
  createdAt: number;
  meta?: any;
}[] = [];
let auditCounter = 1;
const registrationsCount: Record<string, number> = {};
const registrations: Registration[] = [];
const eventReminderEvents: {
  tenant_id: string;
  event_id: string;
  event_title: string;
  member_id: string;
  member_email: string | null;
  startDate: string;
  location?: string | null;
}[] = [];

const errorResponse = (res: Response, code: string, message: string, details?: { field: string; issue: string }[], status = 400) =>
  res.status(status).json({ error: { code, message, details: details || [] }, trace_id: "trace-" + Date.now() });

const requireAuth = (req: Request, res: Response) => {
  if (!(req as any).user) {
    res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] }, trace_id: "trace-" + Date.now() });
    return false;
  }
  return true;
};

export const createEvent = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

  const tenantId = user.tenantId;
  const { title, description, startDate, endDate, capacity, price } = req.body || {};
  const details: { field: string; issue: string }[] = [];

  if (!title) details.push({ field: "title", issue: "required" });
  if (!startDate) details.push({ field: "startDate", issue: "required" });
  if (!endDate) details.push({ field: "endDate", issue: "required" });

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (start && end && start >= end) details.push({ field: "date_range", issue: "invalid_order" });

  if (capacity !== undefined && (typeof capacity !== "number" || capacity < 0)) details.push({ field: "capacity", issue: "invalid" });
  if (price !== undefined && (typeof price !== "number" || price < 0)) details.push({ field: "price", issue: "invalid" });

  const dup = events.find((e) => e.tenantId === tenantId && e.title.toLowerCase() === String(title).toLowerCase());
  if (dup) details.push({ field: "title", issue: "duplicate" });

  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const event: Event = {
    id: `evt-${eventCounter++}`,
    tenantId,
    title,
    description,
    startDate,
    endDate,
    capacity,
    price,
    status: "draft",
    createdAt: Date.now(),
  };
  events.push(event);

  return res.status(201).json(event);
};

// test helpers
export const __resetEvents = () => {
  events.length = 0;
  eventCounter = 1;
  auditLogs.length = 0;
  auditCounter = 1;
  Object.keys(registrationsCount).forEach((k) => delete registrationsCount[k]);
  registrations.length = 0;
  eventReminderEvents.length = 0;
};

export const publishEvent = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const eventId = req.params.id;

  const event = events.find((e) => e.id === eventId && e.tenantId === tenantId);
  if (!event) return errorResponse(res, "not_found", "Event not found", [], 404);
  if (event.status === "published") return errorResponse(res, "already_published", "Event already published", [], 409);

  const details: { field: string; issue: string }[] = [];
  if (!event.title) details.push({ field: "title", issue: "required" });
  const start = event.startDate ? new Date(event.startDate) : null;
  const end = event.endDate ? new Date(event.endDate) : null;
  if (!start || !end || start >= end) details.push({ field: "date_range", issue: "invalid_order" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  event.status = "published";
  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    eventId: event.id,
    action: "event.published",
    actorId: user.userId || "admin",
    createdAt: Date.now(),
  });

  return res.json(event);
};

export const __getAuditLogs = () => auditLogs;
export const __getRegistrations = () => registrations;
export const __getEventReminderEvents = () => eventReminderEvents;

export const registerForEvent = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("member")) return errorResponse(res, "forbidden", "Member role required", [], 403);
  const tenantId = user.tenantId;
  const memberId = user.memberId;
  const eventId = req.params.id;

  const event = events.find((e) => e.id === eventId && e.tenantId === tenantId);
  if (!event) return errorResponse(res, "not_found", "Event not found", [], 404);
  if (event.status !== "published") return errorResponse(res, "invalid_status", "Event not published", [], 400);

  const currentRegs = registrationsCount[eventId] || 0;
  if (event.capacity !== undefined && currentRegs >= event.capacity) {
    return errorResponse(res, "event_full", "Event is full", [], 409);
  }
  const duplicate = registrations.find((r) => r.eventId === eventId && r.tenantId === tenantId && r.memberId === memberId);
  if (duplicate) return errorResponse(res, "duplicate_registration", "Already registered", [], 409);

  const registration = {
    id: `reg-${registrations.length + 1}`,
    eventId,
    tenantId,
    memberId,
    status: "confirmed",
    reminderSentAt: null,
    reminderCount: 0,
  };
  registrations.push(registration);
  registrationsCount[eventId] = currentRegs + 1;

  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    eventId,
    action: "event.registration.created" as any,
    actorId: user.userId || memberId,
    createdAt: registration.createdAt,
  });

  return res.status(201).json({ registration_id: registration.id, status: "registered" });
};
export const __setRegistrationsCount = (eventId: string, count: number) => {
  registrationsCount[eventId] = count;
};

export const cancelRegistration = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("member")) return errorResponse(res, "forbidden", "Member role required", [], 403);
  const tenantId = user.tenantId;
  const memberId = user.memberId;
  const eventId = req.params.id;

  const event = events.find((e) => e.id === eventId && e.tenantId === tenantId);
  if (!event) return errorResponse(res, "not_found", "Event not found", [], 404);

  const idx = registrations.findIndex((r) => r.eventId === eventId && r.tenantId === tenantId && r.memberId === memberId);
  if (idx === -1) return errorResponse(res, "not_found", "Registration not found", [], 404);

  registrations.splice(idx, 1);
  registrationsCount[eventId] = Math.max(0, (registrationsCount[eventId] || 0) - 1);

  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    eventId,
    action: "event.registration.canceled",
    actorId: user.userId || memberId,
    createdAt: Date.now(),
  });

  return res.json({ status: "canceled" });
};

export const listUpcomingEvents = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("member") && !roles.includes("admin")) return errorResponse(res, "forbidden", "Member role required", [], 403);

  const tenantId = user.tenantId;
  const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
  const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);
  const now = new Date();

  const filtered = events
    .filter((e) => e.tenantId === tenantId && e.status === "published" && new Date(e.startDate) >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((e) => ({
    event_id: e.id,
    title: e.title,
    description: e.description,
    startDate: e.startDate,
    endDate: e.endDate,
    capacity: e.capacity ?? null,
    registrationsCount: registrationsCount[e.id] || 0,
    price: e.price ?? null,
  }));

  return res.json({
    items,
    page,
    page_size: pageSize,
    total_items: filtered.length,
    total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
};

export const updateEventCapacity = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const eventId = req.params.id;
  const { capacity } = req.body || {};

  const event = events.find((e) => e.id === eventId && e.tenantId === tenantId);
  if (!event) return errorResponse(res, "not_found", "Event not found", [], 404);
  if (capacity === undefined || typeof capacity !== "number" || capacity < 0) {
    return errorResponse(res, "validation_failed", "Invalid capacity", [{ field: "capacity", issue: "invalid" }], 400);
  }
  if (event.status !== "draft" && event.status !== "published") {
    return errorResponse(res, "invalid_status", "Cannot update capacity", [], 400);
  }
  const currentRegs = registrationsCount[eventId] || 0;
  if (capacity < currentRegs) {
    return errorResponse(res, "validation_failed", "Capacity below registrations", [{ field: "capacity", issue: "below_registrations" }], 400);
  }
  if (event.capacity === capacity) {
    return errorResponse(res, "conflict", "Capacity unchanged", [], 409);
  }

  const old = event.capacity;
  event.capacity = capacity;
  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    eventId: event.id,
    action: "event.capacity.updated",
    actorId: user.userId || "admin",
    createdAt: Date.now(),
    meta: { old_capacity: old ?? null, new_capacity: capacity },
  });

  return res.json(event);
};

export const updateEventPricing = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const eventId = req.params.id;
  const { price, currency } = req.body || {};

  const event = events.find((e) => e.id === eventId && e.tenantId === tenantId);
  if (!event) return errorResponse(res, "not_found", "Event not found", [], 404);
  if (event.status !== "draft" && event.status !== "published") {
    return errorResponse(res, "invalid_status", "Cannot update pricing for this event", [], 409);
  }
  const now = Date.now();
  if (new Date(event.startDate).getTime() < now) {
    return errorResponse(res, "invalid_status", "Cannot update pricing for past events", [], 409);
  }
  if (price === undefined || typeof price !== "number" || price < 0) {
    return errorResponse(res, "validation_failed", "Invalid price", [{ field: "price", issue: "invalid" }], 400);
  }
  if (!currency || typeof currency !== "string") {
    return errorResponse(res, "validation_failed", "Currency required", [{ field: "currency", issue: "required" }], 400);
  }

  const oldPrice = event.price ?? null;
  const oldCurrency = event.currency ?? null;
  event.price = price;
  event.currency = currency;

  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    eventId: event.id,
    action: "event.pricing.updated",
    actorId: user.userId || "admin",
    createdAt: Date.now(),
    meta: { old_price: oldPrice, old_currency: oldCurrency, new_price: price, new_currency: currency },
  });

  return res.json(event);
};

export const runEventReminders = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  const isInternal = req.headers["x-internal"] === "true";
  if (!isInternal && !roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const now = Date.now();
  const windowEnd = now + 24 * 60 * 60 * 1000;

  let sent = 0;

  events
    .filter((e) => e.tenantId === tenantId && e.status === "published")
    .forEach((ev) => {
      const start = new Date(ev.startDate).getTime();
      if (isNaN(start) || start < now || start > windowEnd) return;

      registrations
        .filter((r) => r.eventId === ev.id && r.tenantId === tenantId && r.status !== "cancelled")
        .forEach((reg) => {
          if (reg.reminderSentAt) return;
          eventReminderEvents.push({
            tenant_id: tenantId,
            event_id: ev.id,
            event_title: ev.title,
            member_id: reg.memberId,
            member_email: null,
            startDate: ev.startDate,
            location: null,
          });
          reg.reminderSentAt = now;
          reg.reminderCount = (reg.reminderCount || 0) + 1;
          sent += 1;
          auditLogs.push({
            id: `audit-${auditCounter++}`,
            tenantId,
            eventId: ev.id,
            action: "event.registration.created",
            actorId: user.userId || "system",
            createdAt: now,
            meta: { reminder: true },
          });
        });
    });

  return res.json({ sent });
};

