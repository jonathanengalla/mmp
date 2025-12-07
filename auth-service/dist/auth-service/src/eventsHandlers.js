"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsAttendanceReportHandler = exports.cancelRegistrationHandler = exports.registerEventHandler = exports.updatePricingHandler = exports.updateCapacityHandler = exports.publishEventHandler = exports.createEventHandler = exports.listUpcomingEventsHandler = void 0;
const eventsStore_1 = require("./eventsStore");
const toUpcomingDto = (e) => ({
    event_id: e.id,
    title: e.title,
    description: e.description ?? null,
    startDate: e.startDate,
    endDate: e.endDate ?? null,
    capacity: e.capacity ?? null,
    registrationsCount: e.registrationsCount,
    price: e.price ?? null,
    currency: e.currency ?? null,
    status: e.status,
});
const toAttendanceDto = (e) => ({
    event_id: e.id,
    title: e.title,
    startDate: e.startDate,
    endDate: e.endDate ?? null,
    capacity: e.capacity ?? null,
    registrationsCount: e.registrationsCount,
    status: e.status,
});
const listUpcomingEventsHandler = (_req, res) => {
    const items = (0, eventsStore_1.listUpcomingEvents)().map(toUpcomingDto);
    res.json({ items });
};
exports.listUpcomingEventsHandler = listUpcomingEventsHandler;
const createEventHandler = (req, res) => {
    const { title, description, startDate, endDate, capacity, price, currency } = req.body || {};
    if (!title || !startDate) {
        return res.status(400).json({ error: { message: "title and startDate are required" } });
    }
    const cap = capacity === null || capacity === undefined ? null : Number(capacity);
    const priceCents = price === null || price === undefined ? null : Number(price);
    const record = (0, eventsStore_1.createEvent)({
        title,
        description,
        startDate,
        endDate,
        capacity: Number.isNaN(cap) ? null : cap,
        price: Number.isNaN(priceCents) ? null : priceCents,
        currency: currency ?? null,
    });
    res.status(201).json(toUpcomingDto(record));
};
exports.createEventHandler = createEventHandler;
const publishEventHandler = (req, res) => {
    const { id } = req.params;
    const updated = (0, eventsStore_1.publishEvent)(id);
    if (!updated)
        return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toUpcomingDto(updated));
};
exports.publishEventHandler = publishEventHandler;
const updateCapacityHandler = (req, res) => {
    const { id } = req.params;
    const { capacity } = req.body || {};
    const cap = capacity === null || capacity === undefined ? null : Number(capacity);
    const updated = (0, eventsStore_1.updateEvent)(id, { capacity: Number.isNaN(cap) ? null : cap });
    if (!updated)
        return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toUpcomingDto(updated));
};
exports.updateCapacityHandler = updateCapacityHandler;
const updatePricingHandler = (req, res) => {
    const { id } = req.params;
    const { price, currency } = req.body || {};
    const priceCents = price === null || price === undefined ? null : Number(price);
    const updated = (0, eventsStore_1.updateEvent)(id, {
        price: Number.isNaN(priceCents) ? null : priceCents,
        currency: currency ?? null,
    });
    if (!updated)
        return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toUpcomingDto(updated));
};
exports.updatePricingHandler = updatePricingHandler;
const registerEventHandler = (req, res) => {
    const { id } = req.params;
    const updated = (0, eventsStore_1.registerForEvent)(id);
    if (!updated) {
        return res.status(400).json({ error: { message: "Event not found or capacity reached" } });
    }
    res.json(toUpcomingDto(updated));
};
exports.registerEventHandler = registerEventHandler;
const cancelRegistrationHandler = (req, res) => {
    const { id } = req.params;
    const updated = (0, eventsStore_1.cancelRegistration)(id);
    if (!updated)
        return res.status(404).json({ error: { message: "Event not found" } });
    res.json(toUpcomingDto(updated));
};
exports.cancelRegistrationHandler = cancelRegistrationHandler;
const eventsAttendanceReportHandler = (req, res) => {
    const statusFilter = req.query.status || undefined;
    let items = (0, eventsStore_1.listEvents)();
    if (statusFilter && statusFilter !== "all") {
        items = items.filter((e) => e.status === statusFilter);
    }
    res.json({ items: items.map(toAttendanceDto) });
};
exports.eventsAttendanceReportHandler = eventsAttendanceReportHandler;
