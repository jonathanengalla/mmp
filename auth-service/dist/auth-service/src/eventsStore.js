"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listEvents = listEvents;
exports.listUpcomingEvents = listUpcomingEvents;
exports.createEvent = createEvent;
exports.findEventById = findEventById;
exports.updateEvent = updateEvent;
exports.publishEvent = publishEvent;
exports.registerForEvent = registerForEvent;
exports.cancelRegistration = cancelRegistration;
const crypto_1 = __importDefault(require("crypto"));
const events = [];
const nowIso = () => new Date().toISOString();
function listEvents() {
    return events.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
}
function listUpcomingEvents(referenceDate = new Date()) {
    const now = referenceDate.toISOString();
    return events
        .filter((e) => e.status === "published" && e.startDate >= now)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
function createEvent(input) {
    const id = crypto_1.default.randomUUID();
    const ts = nowIso();
    const record = {
        id,
        title: input.title,
        description: input.description ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        capacity: input.capacity ?? null,
        price: input.price ?? null,
        currency: input.currency ?? null,
        status: "draft",
        registrationsCount: 0,
        createdAt: ts,
        updatedAt: ts,
    };
    events.push(record);
    return record;
}
function findEventById(id) {
    return events.find((e) => e.id === id);
}
function updateEvent(id, patch) {
    const e = findEventById(id);
    if (!e)
        return null;
    Object.assign(e, patch, { updatedAt: nowIso() });
    return e;
}
function publishEvent(id) {
    return updateEvent(id, { status: "published" });
}
function registerForEvent(id) {
    const e = findEventById(id);
    if (!e)
        return null;
    if (typeof e.capacity === "number" && e.capacity >= 0 && e.registrationsCount >= e.capacity) {
        return null;
    }
    e.registrationsCount += 1;
    e.updatedAt = nowIso();
    return e;
}
function cancelRegistration(id) {
    const e = findEventById(id);
    if (!e)
        return null;
    if (e.registrationsCount > 0) {
        e.registrationsCount -= 1;
        e.updatedAt = nowIso();
    }
    return e;
}
