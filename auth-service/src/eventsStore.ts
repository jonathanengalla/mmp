import crypto from "crypto";
import { EventRecord, EventRegistration, EventStatus } from "../../libs/shared/src/models";

const eventsById: Map<string, EventRecord> = new Map();
const eventsBySlug: Map<string, string> = new Map(); // slug -> id

const nowIso = () => new Date().toISOString();

const slugify = (title: string, fallback: string) => {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  if (!base) return fallback;
  let candidate = base;
  let counter = 1;
  while (eventsBySlug.has(candidate)) {
    candidate = `${base}-${counter++}`;
  }
  return candidate;
};

const refreshCounts = (event: EventRecord) => {
  event.registrationsCount = event.registrations?.filter((r) => r.status === "registered" || r.registrationStatus === "registered").length || 0;
};

export function listEvents(): EventRecord[] {
  return Array.from(eventsById.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function listPublishedEvents(): EventRecord[] {
  return listEvents().filter((e) => e.status === "published");
}

export function listUpcomingPublishedEvents(referenceDate: Date = new Date()): EventRecord[] {
  const now = referenceDate.toISOString();
  return listPublishedEvents().filter((e) => e.startDate >= now);
}

export function setEvent(record: EventRecord): EventRecord {
  eventsById.set(record.id, { ...record });
  eventsBySlug.set(record.slug, record.id);
  refreshCounts(record);
  return record;
}

interface CreateEventInput {
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  capacity?: number | null;
  price?: number | null;
  priceCents?: number | null;
  currency?: string | null;
  tags?: string[];
  registrationMode?: "rsvp" | "pay_now";
  location?: string | null;
}

export function createEvent(input: CreateEventInput): EventRecord {
  const id = crypto.randomUUID();
  const slug = slugify(input.title, id);
  const ts = nowIso();
  const record: EventRecord = {
    id,
    slug,
    title: input.title,
    description: input.description ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    capacity: input.capacity ?? null,
    price: input.price ?? input.priceCents ?? null,
    priceCents: input.priceCents ?? input.price ?? null,
    currency: input.currency ?? null,
    location: input.location ?? null,
    status: "draft",
    registrationsCount: 0,
    invoiceIds: [],
    bannerImageUrl: null,
    tags: input.tags ?? [],
    registrationMode: input.registrationMode ?? "rsvp",
    registrations: [],
    createdAt: ts,
    updatedAt: ts,
  };
  eventsById.set(id, record);
  eventsBySlug.set(slug, id);
  return record;
}

export function getEventById(id: string): EventRecord | undefined {
  return eventsById.get(id);
}

export function getEventBySlug(slug: string): EventRecord | undefined {
  const id = eventsBySlug.get(slug);
  if (!id) return undefined;
  return eventsById.get(id);
}

export function updateEvent(id: string, patch: Partial<EventRecord>): EventRecord | null {
  const e = getEventById(id);
  if (!e) return null;
  Object.assign(e, patch, { updatedAt: nowIso() });
  refreshCounts(e);
  if (patch.slug && patch.slug !== e.slug) {
    eventsBySlug.delete(e.slug);
    eventsBySlug.set(patch.slug, id);
  }
  return e;
}

export function publishEvent(id: string): EventRecord | null {
  return updateEvent(id, { status: "published" as EventStatus });
}

export function addRegistration(
  eventId: string,
  memberId: string,
  name: string,
  email: string,
  mode: "rsvp" | "pay_now",
  paymentStatus: "unpaid" | "pending" | "paid"
): EventRecord | null {
  const e = getEventById(eventId);
  if (!e) return null;
  if (typeof e.capacity === "number" && e.capacity >= 0 && e.registrationsCount >= e.capacity) {
    return null;
  }
  // prevent duplicate registrations
  e.registrations = e.registrations.filter((r) => r.memberId !== memberId);
  const registrationId = crypto.randomUUID();
  const shortRand = crypto.randomUUID().split("-")[0];
  const ticketCode = `EVT-${eventId}-${shortRand}`;
  const registration: EventRegistration = {
    memberId,
    email,
    name,
    status: "registered" as const,
    registrationStatus: "registered" as const,
    ticketCode,
    registrationId,
    paymentStatus,
    createdAt: nowIso(),
    checkInStatus: "not_checked_in" as const,
    checkedInAt: null as number | null,
    invoiceId: null,
  };
  e.registrations.push(registration);
  refreshCounts(e);
  e.updatedAt = nowIso();
  return e;
}

export function cancelRegistration(eventId: string, memberId: string): EventRecord | null {
  const e = getEventById(eventId);
  if (!e) return null;
  e.registrations = e.registrations.map((r) =>
    r.memberId === memberId ? { ...r, status: "cancelled" as const, registrationStatus: "cancelled" as const } : r
  );
  refreshCounts(e);
  e.updatedAt = nowIso();
  return e;
}

export function markCheckInByCode(code: string): { event: EventRecord; registration: EventRecord["registrations"][number] } | null {
  for (const e of eventsById.values()) {
    const reg = e.registrations.find((r) => r.ticketCode === code);
    if (reg) {
      reg.checkInStatus = "checked_in";
      reg.checkedInAt = Date.now();
      e.updatedAt = nowIso();
      return { event: e, registration: reg };
    }
  }
  return null;
}

export function ensureMemberRegistrationForCheckout(
  event: EventRecord,
  memberId: string,
  name: string,
  email: string
): { event: EventRecord; registration: EventRegistration; created: boolean } {
  const current = event.registrations.find((r) => r.memberId === memberId);
  const isRegistered = current && (current.status === "registered" || current.registrationStatus === "registered");
  if (current && isRegistered) {
    return { event, registration: current, created: false };
  }
  const paymentStatus: "unpaid" | "pending" | "paid" = event.registrationMode === "pay_now" ? "pending" : "unpaid";
  const updated = addRegistration(event.id, memberId, name, email, event.registrationMode, paymentStatus);
  if (!updated) throw new Error("Unable to register for event");
  const registration = updated.registrations.find((r) => r.memberId === memberId)!;
  return { event: updated, registration, created: true };
}

export function linkInvoiceToRegistration(eventId: string, memberId: string, invoiceId: string): EventRecord {
  const event = getEventById(eventId);
  if (!event) throw new Error("Event not found");
  event.registrations = event.registrations.map((r) =>
    r.memberId === memberId ? { ...r, invoiceId, paymentStatus: r.paymentStatus || "pending" } : r
  );
  if (!event.invoiceIds) event.invoiceIds = [];
  if (!event.invoiceIds.includes(invoiceId)) {
    event.invoiceIds.push(invoiceId);
  }
  event.updatedAt = nowIso();
  return event;
}

export function markRegistrationPaidForInvoice(invoiceId: string): void {
  for (const event of eventsById.values()) {
    let updated = false;
    event.registrations = event.registrations.map((reg) => {
      if (reg.invoiceId === invoiceId) {
        updated = true;
        return { ...reg, paymentStatus: "paid" as const };
      }
      return reg;
    });
    if (updated) {
      refreshCounts(event);
      event.updatedAt = nowIso();
    }
  }
}

