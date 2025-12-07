"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInByCodeHandler = exports.updateEventRegistrationModeHandler = exports.updateEventTagsHandler = exports.updateEventBannerHandler = exports.getEventDetailHandler = exports.eventsAttendanceReportHandler = exports.listMyInvoicesHandler = exports.eventCheckoutHandler = exports.cancelRegistrationHandler = exports.registerEventHandler = exports.updateEventBasicsHandler = exports.updatePricingHandler = exports.updateCapacityHandler = exports.publishEventHandler = exports.createEventHandler = exports.listEventsHandler = exports.listUpcomingEventsHandler = void 0;
const eventsStore_1 = require("./eventsStore");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const billingHandlers = require("../../payments-billing-service/src/handlers");
const { createEventInvoice, getInvoiceById, getInvoicesForMember } = billingHandlers;
const emailSender_1 = require("./notifications/emailSender");
const emailTemplates_1 = require("./notifications/emailTemplates");
const getMemberContext = (req) => {
    const user = req.user || {};
    return {
        memberId: user.member_id || user.memberId || null,
        email: user.email || `${user.member_id || "member"}@example.com`,
        name: user.name || user.email || "Member",
        roles: user.roles || [],
    };
};
const ensureAdmin = (req, res, next) => {
    const { roles } = getMemberContext(req);
    if (!roles.includes("admin")) {
        return res.status(403).json({ error: { message: "Admin only" } });
    }
    return next();
};
const toUpcomingDto = (e, currentMemberId) => {
    const regMode = e.registrationMode === "pay_now" ? "pay_now" : "rsvp";
    const memberReg = currentMemberId
        ? [...e.registrations].reverse().find((r) => r.memberId === currentMemberId)
        : undefined;
    const isRegistered = memberReg?.status === "registered";
    const regStatus = memberReg?.registrationStatus === "checked_in"
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
        registrationStatus: regStatus,
        ticketCode: memberReg?.ticketCode ?? null,
        paymentStatus: memberReg?.paymentStatus ?? null,
        invoiceId: memberReg?.invoiceId ?? null,
    };
};
const toDetailDto = (e, currentMemberId) => {
    const regMode = e.registrationMode === "pay_now" ? "pay_now" : "rsvp";
    const memberReg = currentMemberId
        ? [...e.registrations].reverse().find((r) => r.memberId === currentMemberId)
        : undefined;
    const isRegistered = memberReg?.status === "registered";
    const regStatus = memberReg?.registrationStatus === "checked_in"
        ? "registered"
        : memberReg?.registrationStatus ?? memberReg?.status ?? null;
    const remainingCapacity = e.capacity != null ? Math.max(e.capacity - (e.registrations.filter((r) => r.status === "registered").length || 0), 0) : null;
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
        registrationStatus: regStatus,
        ticketCode: memberReg?.ticketCode ?? null,
        paymentStatus: memberReg?.paymentStatus ?? null,
        invoiceId: memberReg?.invoiceId ?? null,
        remainingCapacity,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
    };
};
const toAttendanceDto = (e) => ({
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
const toInvoiceDto = (invoice) => {
    const statusMap = {
        void: "cancelled",
    };
    return {
        id: invoice.id,
        memberId: invoice.memberId,
        amountCents: invoice.amount,
        currency: invoice.currency,
        status: statusMap[invoice.status] || invoice.status,
        description: invoice.description || invoice.type || "Invoice",
        eventId: invoice.eventId || null,
        eventTitle: invoice.eventTitle || null,
        source: invoice.source || invoice.type || "manual",
        dueDate: invoice.dueDate || null,
        createdAt: invoice.createdAt ? new Date(invoice.createdAt).toISOString() : new Date().toISOString(),
        paidAt: invoice.paidAt || null,
        paymentMethod: invoice.paymentMethod || null,
        paymentReference: invoice.paymentReference || null,
    };
};
const listUpcomingEventsHandler = (req, res) => {
    const { memberId } = getMemberContext(req);
    const items = (0, eventsStore_1.listUpcomingPublishedEvents)().map((e) => toUpcomingDto(e, memberId));
    res.json({ items });
};
exports.listUpcomingEventsHandler = listUpcomingEventsHandler;
exports.listEventsHandler = [ensureAdmin, (_req, res) => {
        const items = (0, eventsStore_1.listEvents)().map((e) => toDetailDto(e));
        res.json({ items });
    }];
exports.createEventHandler = [
    ensureAdmin,
    (req, res) => {
        const { title, description, startDate, endDate, capacity, priceCents, price, currency, tags, registrationMode, location } = req.body || {};
        if (!title || !startDate) {
            return res.status(400).json({ error: { message: "title and startDate are required" } });
        }
        const cap = capacity === null || capacity === undefined ? null : Number(capacity);
        const priceValue = priceCents ?? price;
        const priceCentsValue = priceValue === null || priceValue === undefined ? null : Number(priceValue);
        const record = (0, eventsStore_1.createEvent)({
            title,
            description,
            startDate,
            endDate,
            capacity: Number.isNaN(cap) ? null : cap,
            priceCents: Number.isNaN(priceCentsValue) ? null : priceCentsValue,
            currency: currency ?? null,
            tags,
            registrationMode: registrationMode === "pay_now" ? "pay_now" : "rsvp",
            location,
        });
        res.status(201).json(toDetailDto(record));
    },
];
exports.publishEventHandler = [
    ensureAdmin,
    (req, res) => {
        const { id } = req.params;
        const updated = (0, eventsStore_1.publishEvent)(id);
        if (!updated)
            return res.status(404).json({ error: { message: "Event not found" } });
        res.json(toDetailDto(updated));
    },
];
exports.updateCapacityHandler = [
    ensureAdmin,
    (req, res) => {
        const { id } = req.params;
        const { capacity } = req.body || {};
        const cap = capacity === null || capacity === undefined ? null : Number(capacity);
        const updated = (0, eventsStore_1.updateEvent)(id, { capacity: Number.isNaN(cap) ? null : cap });
        if (!updated)
            return res.status(404).json({ error: { message: "Event not found" } });
        res.json(toDetailDto(updated));
    },
];
exports.updatePricingHandler = [
    ensureAdmin,
    (req, res) => {
        const { id } = req.params;
        const { priceCents, currency, price } = req.body || {};
        const priceValue = priceCents ?? price;
        const priceCentsValue = priceValue === null || priceValue === undefined ? null : Number(priceValue);
        const updated = (0, eventsStore_1.updateEvent)(id, {
            priceCents: Number.isNaN(priceCentsValue) ? null : priceCentsValue,
            price: Number.isNaN(priceCentsValue) ? null : priceCentsValue,
            currency: currency ?? null,
        });
        if (!updated)
            return res.status(404).json({ error: { message: "Event not found" } });
        res.json(toDetailDto(updated));
    },
];
exports.updateEventBasicsHandler = [
    ensureAdmin,
    (req, res) => {
        const { id } = req.params;
        const { title, description, startDate, endDate, location } = req.body || {};
        const patch = {};
        if (title !== undefined)
            patch.title = title;
        if (description !== undefined)
            patch.description = description;
        if (startDate !== undefined)
            patch.startDate = startDate;
        if (endDate !== undefined)
            patch.endDate = endDate;
        if (location !== undefined)
            patch.location = location;
        const updated = (0, eventsStore_1.updateEvent)(id, patch);
        if (!updated)
            return res.status(404).json({ error: { message: "Event not found" } });
        res.json(toDetailDto(updated));
    },
];
const registerEventHandler = (req, res) => {
    const { id } = req.params;
    const { memberId, email, name } = getMemberContext(req);
    if (!memberId)
        return res.status(401).json({ error: { message: "Unauthorized" } });
    const event = (0, eventsStore_1.getEventById)(id);
    if (!event)
        return res.status(404).json({ error: { message: "Event not found" } });
    if (event.status !== "published")
        return res.status(400).json({ error: { message: "Event not open for registration" } });
    const regMode = event.registrationMode === "pay_now" ? "pay_now" : "rsvp";
    const paymentStatus = regMode === "pay_now" ? "pending" : "unpaid";
    const updated = (0, eventsStore_1.addRegistration)(id, memberId, name, email, regMode, paymentStatus);
    if (!updated) {
        return res.status(400).json({ error: { message: "Event not found or capacity reached" } });
    }
    res.json(toDetailDto(updated, memberId));
};
exports.registerEventHandler = registerEventHandler;
const cancelRegistrationHandler = (req, res) => {
    const { id } = req.params;
    const { memberId } = getMemberContext(req);
    if (!memberId)
        return res.status(401).json({ error: { message: "Unauthorized" } });
    const updated = (0, eventsStore_1.cancelRegistration)(id, memberId);
    if (!updated)
        return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toDetailDto(updated, memberId));
};
exports.cancelRegistrationHandler = cancelRegistrationHandler;
const eventCheckoutHandler = async (req, res) => {
    const { id } = req.params;
    const { memberId, email, name } = getMemberContext(req);
    if (!memberId)
        return res.status(401).json({ error: { message: "Unauthorized" } });
    const event = (0, eventsStore_1.getEventById)(id) || (0, eventsStore_1.getEventBySlug)(id);
    if (!event || event.status !== "published") {
        return res.status(404).json({ error: { message: "Event not found" } });
    }
    let ensured;
    try {
        ensured = (0, eventsStore_1.ensureMemberRegistrationForCheckout)(event, memberId, name, email);
    }
    catch (e) {
        return res.status(400).json({ error: { message: e?.message || "Unable to register for event" } });
    }
    const registration = ensured.registration;
    const tenantId = req.user?.tenantId || "t1";
    if (event.registrationMode === "rsvp") {
        const detailDto = toDetailDto(ensured.event, memberId);
        try {
            if (email && memberId) {
                const e = (0, emailTemplates_1.buildEventRsvpEmail)({ member: { email, name }, event: detailDto });
                void (0, emailSender_1.sendEmail)({
                    to: email,
                    subject: e.subject,
                    text: e.text,
                    html: e.html,
                    template: "event_rsvp_confirmed",
                    meta: { memberId, eventId: event.id },
                });
            }
        }
        catch (err) {
            // eslint-disable-next-line no-console
            console.error("[events] RSVP email error", err);
        }
        const payload = { event: detailDto, invoice: null };
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
    const updatedEvent = (0, eventsStore_1.linkInvoiceToRegistration)(event.id, memberId, invoice.id);
    const payload = {
        event: toDetailDto(updatedEvent, memberId),
        invoice: invoice ? toInvoiceDto(invoice) : null,
    };
    try {
        if (email && memberId && invoice) {
            const detailDto = toDetailDto(updatedEvent, memberId);
            const e = (0, emailTemplates_1.buildEventInvoiceEmail)({ member: { email, name }, invoice: payload.invoice, event: detailDto });
            void (0, emailSender_1.sendEmail)({
                to: email,
                subject: e.subject,
                text: e.text,
                html: e.html,
                template: "event_invoice_created",
                meta: { memberId, eventId: updatedEvent.id, invoiceId: invoice.id },
            });
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[events] Invoice email error", err);
    }
    return res.status(201).json(payload);
};
exports.eventCheckoutHandler = eventCheckoutHandler;
const listMyInvoicesHandler = (req, res) => {
    const { memberId } = getMemberContext(req);
    const tenantId = req.user?.tenantId || "t1";
    if (!memberId)
        return res.status(401).json({ error: { message: "Unauthorized" } });
    const invs = getInvoicesForMember(tenantId, memberId).map(toInvoiceDto);
    return res.json({ items: invs });
};
exports.listMyInvoicesHandler = listMyInvoicesHandler;
exports.eventsAttendanceReportHandler = [
    ensureAdmin,
    (req, res) => {
        const statusFilter = req.query.status || undefined;
        let items = (0, eventsStore_1.listEvents)();
        if (statusFilter && statusFilter !== "all") {
            items = items.filter((e) => e.status === statusFilter);
        }
        res.json({ items: items.map(toAttendanceDto) });
    },
];
const getEventDetailHandler = (req, res) => {
    const id = req.params.id;
    const slug = req.params.slug;
    const { memberId } = getMemberContext(req);
    const event = slug ? (0, eventsStore_1.getEventBySlug)(slug) : (0, eventsStore_1.getEventById)(id);
    if (!event)
        return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toDetailDto(event, memberId));
};
exports.getEventDetailHandler = getEventDetailHandler;
exports.updateEventBannerHandler = [
    ensureAdmin,
    (req, res) => {
        const { id } = req.params;
        const { bannerImageUrl } = req.body || {};
        const updated = (0, eventsStore_1.updateEvent)(id, { bannerImageUrl: bannerImageUrl ?? null });
        if (!updated)
            return res.status(404).json({ error: { message: "Event not found" } });
        res.json(toDetailDto(updated));
    },
];
exports.updateEventTagsHandler = [
    ensureAdmin,
    (req, res) => {
        const { id } = req.params;
        const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
        const updated = (0, eventsStore_1.updateEvent)(id, { tags });
        if (!updated)
            return res.status(404).json({ error: { message: "Event not found" } });
        res.json(toDetailDto(updated));
    },
];
exports.updateEventRegistrationModeHandler = [
    ensureAdmin,
    (req, res) => {
        const { id } = req.params;
        const mode = req.body?.mode;
        const updated = (0, eventsStore_1.updateEvent)(id, { registrationMode: mode === "pay_now" ? "pay_now" : "rsvp" });
        if (!updated)
            return res.status(404).json({ error: { message: "Event not found" } });
        res.json(toDetailDto(updated));
    },
];
exports.checkInByCodeHandler = [
    ensureAdmin,
    (req, res) => {
        const code = req.body?.code;
        if (!code)
            return res.status(400).json({ error: { message: "code is required" } });
        const result = (0, eventsStore_1.markCheckInByCode)(code);
        if (!result)
            return res.status(404).json({ error: { message: "Registration not found" } });
        const payload = {
            eventId: result.event.id,
            registrationId: result.registration.registrationId,
            checkInStatus: "checked_in",
            checkedInAt: new Date(result.registration.checkedInAt || Date.now()).toISOString(),
        };
        res.json(payload);
    },
];
