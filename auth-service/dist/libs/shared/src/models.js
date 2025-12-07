"use strict";
// Shared DTOs/models (scaffolding only)
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOM_FIELD_TYPE_LABELS = exports.CUSTOM_FIELD_TYPES = exports.isValidRole = exports.ROLE_LABELS = exports.ALL_ROLES = void 0;
/** All available roles in the system */
exports.ALL_ROLES = ["admin", "member", "event_manager", "finance_manager", "communications_manager"];
/** Human-readable labels for roles */
exports.ROLE_LABELS = {
    admin: "Administrator",
    member: "Member",
    event_manager: "Event Manager",
    finance_manager: "Finance Manager",
    communications_manager: "Communications Manager",
};
/** Check if a string is a valid Role */
const isValidRole = (role) => exports.ALL_ROLES.includes(role);
exports.isValidRole = isValidRole;
/** All available custom field types */
exports.CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "date", "select", "checkbox"];
/** Human-readable labels for custom field types */
exports.CUSTOM_FIELD_TYPE_LABELS = {
    text: "Text",
    textarea: "Text Area",
    number: "Number",
    date: "Date",
    select: "Select (Dropdown)",
    checkbox: "Checkbox",
};
