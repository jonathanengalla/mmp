"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEvents = listEvents;
exports.listPublishedEvents = listPublishedEvents;
exports.listUpcomingPublishedEvents = listUpcomingPublishedEvents;
exports.createEvent = createEvent;
exports.getEventById = getEventById;
exports.getEventBySlug = getEventBySlug;
exports.updateEvent = updateEvent;
exports.publishEvent = publishEvent;
exports.addRegistration = addRegistration;
exports.cancelRegistration = cancelRegistration;
exports.markCheckInByCode = markCheckInByCode;
exports.ensureMemberRegistrationForCheckout = ensureMemberRegistrationForCheckout;
exports.linkInvoiceToRegistration = linkInvoiceToRegistration;
exports.markRegistrationPaidForInvoice = markRegistrationPaidForInvoice;
const crypto_1 = __importDefault(require("crypto"));
const eventsById = new Map();
const eventsBySlug = new Map(); // slug -> id
const nowIso = () => new Date().toISOString();
const slugify = (title, fallback) => {
    const base = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    if (!base)
        return fallback;
    let candidate = base;
    let counter = 1;
    while (eventsBySlug.has(candidate)) {
        candidate = `${base}-${counter++}`;
    }
    return candidate;
};
const refreshCounts = (event) => {
    event.registrationsCount = event.registrations?.filter((r) => r.status === "registered" || r.registrationStatus === "registered").length || 0;
};
function listEvents() {
    return Array.from(eventsById.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
}
function listPublishedEvents() {
    return listEvents().filter((e) => e.status === "published");
}
function listUpcomingPublishedEvents(referenceDate = new Date()) {
    const now = referenceDate.toISOString();
    return listPublishedEvents().filter((e) => e.startDate >= now);
}
function createEvent(input) {
    const id = crypto_1.default.randomUUID();
    const slug = slugify(input.title, id);
    const ts = nowIso();
    const record = {
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
function getEventById(id) {
    return eventsById.get(id);
}
function getEventBySlug(slug) {
    const id = eventsBySlug.get(slug);
    if (!id)
        return undefined;
    return eventsById.get(id);
}
function updateEvent(id, patch) {
    const e = getEventById(id);
    if (!e)
        return null;
    Object.assign(e, patch, { updatedAt: nowIso() });
    refreshCounts(e);
    if (patch.slug && patch.slug !== e.slug) {
        eventsBySlug.delete(e.slug);
        eventsBySlug.set(patch.slug, id);
    }
    return e;
}
function publishEvent(id) {
    return updateEvent(id, { status: "published" });
}
function addRegistration(eventId, memberId, name, email, mode, paymentStatus) {
    const e = getEventById(eventId);
    if (!e)
        return null;
    if (typeof e.capacity === "number" && e.capacity >= 0 && e.registrationsCount >= e.capacity) {
        return null;
    }
    // prevent duplicate registrations
    e.registrations = e.registrations.filter((r) => r.memberId !== memberId);
    const registrationId = crypto_1.default.randomUUID();
    const shortRand = crypto_1.default.randomUUID().split("-")[0];
    const ticketCode = `EVT-${eventId}-${shortRand}`;
    const registration = {
        memberId,
        email,
        name,
        status: "registered",
        registrationStatus: "registered",
        ticketCode,
        registrationId,
        paymentStatus,
        createdAt: nowIso(),
        checkInStatus: "not_checked_in",
        checkedInAt: null,
        invoiceId: null,
    };
    e.registrations.push(registration);
    refreshCounts(e);
    e.updatedAt = nowIso();
    return e;
}
function cancelRegistration(eventId, memberId) {
    const e = getEventById(eventId);
    if (!e)
        return null;
    e.registrations = e.registrations.map((r) => r.memberId === memberId ? { ...r, status: "cancelled", registrationStatus: "cancelled" } : r);
    refreshCounts(e);
    e.updatedAt = nowIso();
    return e;
}
function markCheckInByCode(code) {
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
function ensureMemberRegistrationForCheckout(event, memberId, name, email) {
    const current = event.registrations.find((r) => r.memberId === memberId);
    const isRegistered = current && (current.status === "registered" || current.registrationStatus === "registered");
    if (current && isRegistered) {
        return { event, registration: current, created: false };
    }
    const paymentStatus = event.registrationMode === "pay_now" ? "pending" : "unpaid";
    const updated = addRegistration(event.id, memberId, name, email, event.registrationMode, paymentStatus);
    if (!updated)
        throw new Error("Unable to register for event");
    const registration = updated.registrations.find((r) => r.memberId === memberId);
    return { event: updated, registration, created: true };
}
function linkInvoiceToRegistration(eventId, memberId, invoiceId) {
    const event = getEventById(eventId);
    if (!event)
        throw new Error("Event not found");
    event.registrations = event.registrations.map((r) => r.memberId === memberId ? { ...r, invoiceId, paymentStatus: r.paymentStatus || "pending" } : r);
    if (!event.invoiceIds)
        event.invoiceIds = [];
    if (!event.invoiceIds.includes(invoiceId)) {
        event.invoiceIds.push(invoiceId);
    }
    event.updatedAt = nowIso();
    return event;
}
function markRegistrationPaidForInvoice(invoiceId) {
    for (const event of eventsById.values()) {
        let updated = false;
        event.registrations = event.registrations.map((reg) => {
            if (reg.invoiceId === invoiceId) {
                updated = true;
                return { ...reg, paymentStatus: "paid" };
            }
            return reg;
        });
        if (updated) {
            refreshCounts(event);
            event.updatedAt = nowIso();
        }
    }
}
