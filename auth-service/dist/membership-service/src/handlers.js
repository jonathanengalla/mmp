"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUpdateMemberCustomFields = exports.adminGetMemberCustomFields = exports.updateCurrentMemberCustomFields = exports.getCurrentMemberCustomFields = exports.updateProfileCustomFieldSchema = exports.getProfileCustomFieldSchema = exports.updateMemberRoles = exports.adminUpdateAvatar = exports.updateMyAvatar = exports.createMemberAdmin = exports.__seedDevMember = exports.__resetPaymentMethods = exports.createMemberPaymentMethod = exports.getMemberPaymentMethods = exports.status = exports.health = exports.auditMember = exports.importMembers = exports.deactivateMember = exports.searchMembers = exports.searchDirectoryMembers = exports.uploadPhoto = exports.updateMemberContact = exports.updateMember = exports.rejectMember = exports.approveMember = exports.listPendingMembers = exports.updateCurrentMember = exports.getCurrentMember = exports.getMember = exports.createMember = exports.listMembers = exports.verify = exports.requestVerification = exports.createRegistration = void 0;
const models_1 = require("../../libs/shared/src/models");
const crypto_1 = __importDefault(require("crypto"));
const members = [];
// =============================================================================
// Custom Profile Fields Schema Storage (M-17 - M-20)
// =============================================================================
let profileCustomFieldSchema = {
    groups: [],
    fields: [],
    updatedAt: Date.now(),
};
const paymentMethods = [];
let paymentMethodCounter = 1;
const registrations = [];
const verificationTokens = new Map();
let memberCounter = 1;
let registrationCounter = 1;
const errorResponse = (res, code, message, details) => {
    return res.status(code === "conflict" ? 409 : 400).json({
        error: {
            code,
            message,
            details: details || [],
        },
        trace_id: "trace-" + Date.now(),
    });
};
const isEmail = (email) => /\S+@\S+\.\S+/.test(email);
const isUrl = (value) => {
    if (!/^https?:\/\//i.test(value))
        return false;
    try {
        new URL(value);
        return true;
    }
    catch {
        return false;
    }
};
const requireAuth = (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] }, trace_id: "trace-" + Date.now() });
        return false;
    }
    return true;
};
const requireAdmin = (req, res) => {
    const user = req.user || {};
    const roles = user.roles || [];
    if (!roles.includes("admin")) {
        res.status(403).json({
            error: { code: "forbidden", message: "Admin role required", details: [] },
            trace_id: "trace-" + Date.now(),
        });
        return false;
    }
    return true;
};
const genToken = () => crypto_1.default.randomBytes(32).toString("hex");
const verificationTtlMs = 1000 * 60 * 60; // 1h
const createRegistration = (req, res) => {
    const { email, firstName, lastName, phone, address, linkedinUrl, otherSocials } = req.body || {};
    const tenantId = req.headers["x-tenant-id"] || "unknown";
    const details = [];
    if (!email)
        details.push({ field: "email", issue: "required" });
    if (email && !isEmail(email))
        details.push({ field: "email", issue: "invalid" });
    if (!firstName)
        details.push({ field: "firstName", issue: "required" });
    if (!lastName)
        details.push({ field: "lastName", issue: "required" });
    if (linkedinUrl && !isUrl(linkedinUrl))
        details.push({ field: "linkedinUrl", issue: "invalid_url" });
    if (phone !== undefined && typeof phone !== "string")
        details.push({ field: "phone", issue: "invalid" });
    if (address !== undefined && typeof address !== "string")
        details.push({ field: "address", issue: "invalid" });
    if (otherSocials !== undefined && typeof otherSocials !== "string")
        details.push({ field: "otherSocials", issue: "invalid" });
    if (details.length) {
        return errorResponse(res, "validation_failed", "Validation failed", details);
    }
    const emailLower = email.toLowerCase();
    const existsMember = members.find((m) => m.email.toLowerCase() === emailLower);
    const existsRegistration = registrations.find((r) => r.email.toLowerCase() === emailLower && r.status === "pending");
    if (existsMember || existsRegistration) {
        return res.status(409).json({
            error: { code: "conflict", message: "Email already registered or pending", details: [{ field: "email", issue: "exists" }] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const id = `m-${memberCounter++}`;
    const token = genToken();
    const expiresAt = Date.now() + verificationTtlMs;
    const createdAt = Date.now();
    const member = {
        id,
        tenantId,
        email,
        status: "pendingVerification",
        firstName,
        lastName,
        phone,
        address,
        linkedinUrl,
        otherSocials,
        verificationToken: token,
        verificationExpires: expiresAt,
        createdAt,
    };
    members.push(member);
    const regId = `reg-${registrationCounter++}`;
    registrations.push({
        id: regId,
        email,
        firstName,
        lastName,
        phone,
        address,
        linkedinUrl,
        otherSocials,
        status: "pendingVerification",
        createdAt: Date.now(),
    });
    verificationTokens.set(token, { memberId: id, expiresAt });
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] verification URL: http://localhost:5173/verify?token=${token}`);
    }
    return res.status(201).json({ id: regId, member_id: id, email, status: "pendingVerification", verification_token: token });
};
exports.createRegistration = createRegistration;
const requestVerification = (req, res) => {
    const { email } = req.body || {};
    const details = [];
    if (!email)
        details.push({ field: "email", issue: "required" });
    if (email && !isEmail(email))
        details.push({ field: "email", issue: "invalid" });
    if (details.length) {
        return errorResponse(res, "validation_failed", "Validation failed", details);
    }
    const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (!member || member.status !== "pendingVerification") {
        return res.status(404).json({ error: { code: "not_found", message: "Pending verification not found", details: [] }, trace_id: "trace-" + Date.now() });
    }
    const token = genToken();
    const expiresAt = Date.now() + verificationTtlMs;
    member.verificationToken = token;
    member.verificationExpires = expiresAt;
    verificationTokens.set(token, { memberId: member.id, expiresAt });
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] verification URL: http://localhost:5173/verify?token=${token}`);
    }
    return res.json({ status: "sent" });
};
exports.requestVerification = requestVerification;
const verify = (req, res) => {
    const token = req.params.token || req.body?.token;
    const entry = verificationTokens.get(token);
    if (!entry) {
        return res.status(400).json({
            error: { code: "invalid_token", message: "Invalid verification token", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    if (Date.now() > entry.expiresAt) {
        verificationTokens.delete(token);
        return res.status(410).json({
            error: { code: "expired_token", message: "Verification token expired", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const member = members.find((m) => m.id === entry.memberId);
    if (!member) {
        return res.status(400).json({
            error: { code: "invalid_member", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    member.status = "pendingApproval";
    member.verificationToken = undefined;
    member.verificationExpires = undefined;
    verificationTokens.delete(token);
    return res.json({ status: "verified", login_redirect: "/login" });
};
exports.verify = verify;
const listMembers = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const query = req.query.query || "";
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt(req.query.page_size || "20", 10), 100), 1);
    if (!query.trim()) {
        return errorResponse(res, "validation_failed", "query is required", [{ field: "query", issue: "required" }]);
    }
    const lower = query.toLowerCase();
    const filtered = members.filter((m) => m.tenantId === tenantId &&
        m.status === "active" &&
        ((m.firstName && m.firstName.toLowerCase().includes(lower)) ||
            (m.lastName && m.lastName.toLowerCase().includes(lower)) ||
            (m.email && m.email.toLowerCase().includes(lower))));
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);
    const items = paged.map((m) => ({
        id: m.id,
        first_name: m.firstName,
        last_name: m.lastName,
        email: m.email,
        membership_type_id: m.membershipTypeId,
    }));
    return res.json({
        items,
        page,
        page_size: pageSize,
        total_items: filtered.length,
        total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    });
};
exports.listMembers = listMembers;
const createMember = (req, res) => {
    const tenantId = req.headers["x-tenant-id"] || "unknown";
    const { email, first_name, last_name, membership_type_id, roles } = req.body || {};
    const details = [];
    if (!email)
        details.push({ field: "email", issue: "required" });
    if (email && !isEmail(email))
        details.push({ field: "email", issue: "invalid" });
    if (!first_name)
        details.push({ field: "first_name", issue: "required" });
    if (!last_name)
        details.push({ field: "last_name", issue: "required" });
    if (details.length) {
        return errorResponse(res, "validation_failed", "Validation failed", details);
    }
    const id = `m-${memberCounter++}`;
    const member = {
        id,
        tenantId,
        email,
        status: "active",
        firstName: first_name,
        lastName: last_name,
        membershipTypeId: membership_type_id,
        roles: Array.isArray(roles) && roles.length ? roles : ["member"],
    };
    members.push(member);
    return res.status(201).json({ member_id: member.id, status: member.status });
};
exports.createMember = createMember;
const getMember = (req, res) => {
    const member = members.find((m) => m.id === req.params.id);
    if (!member)
        return res.status(404).json({ error: { code: "not_found", message: "Member not found", details: [] }, trace_id: "trace-" + Date.now() });
    return res.json(member);
};
exports.getMember = getMember;
/** Helper to validate LinkedIn URL format */
const isValidLinkedinUrl = (url) => {
    if (!url)
        return true; // Empty is valid (optional field)
    return /^https?:\/\//i.test(url) && url.toLowerCase().includes("linkedin.com");
};
/** GET /members/me - get the current authenticated member */
const getCurrentMember = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user || {};
    const memberId = user.memberId || user.member_id;
    if (!memberId) {
        return res.status(400).json({
            error: { code: "missing_member_id", message: "No member ID associated with user", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    return res.json({
        id: member.id,
        email: member.email,
        first_name: member.firstName,
        last_name: member.lastName,
        phone: member.phone || null,
        address: member.address || null,
        linkedinUrl: member.linkedinUrl || null,
        otherSocials: member.otherSocials || null,
        avatarUrl: member.avatarUrl || null,
        customFields: member.customFields || null,
        status: member.status,
        membership_type_id: member.membershipTypeId || null,
        created_at: member.createdAt || null,
    });
};
exports.getCurrentMember = getCurrentMember;
/** PATCH /members/me - update current member's contact info */
const updateCurrentMember = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user || {};
    const memberId = user.memberId || user.member_id;
    if (!memberId) {
        return res.status(400).json({
            error: { code: "missing_member_id", message: "No member ID associated with user", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const { phone, address, linkedinUrl, otherSocials, email, status, roles, createdAt } = req.body || {};
    const details = [];
    // Reject attempts to update disallowed fields
    if (email !== undefined)
        details.push({ field: "email", issue: "not_updatable" });
    if (status !== undefined)
        details.push({ field: "status", issue: "not_updatable" });
    if (roles !== undefined)
        details.push({ field: "roles", issue: "not_updatable" });
    if (createdAt !== undefined)
        details.push({ field: "createdAt", issue: "not_updatable" });
    // Validate allowed fields
    if (phone !== undefined && typeof phone !== "string")
        details.push({ field: "phone", issue: "invalid" });
    if (address !== undefined && typeof address !== "string")
        details.push({ field: "address", issue: "invalid" });
    if (linkedinUrl !== undefined && typeof linkedinUrl !== "string")
        details.push({ field: "linkedinUrl", issue: "invalid" });
    if (linkedinUrl && !isValidLinkedinUrl(linkedinUrl))
        details.push({ field: "linkedinUrl", issue: "invalid_url" });
    if (otherSocials !== undefined && typeof otherSocials !== "string")
        details.push({ field: "otherSocials", issue: "invalid" });
    if (details.length) {
        return res.status(400).json({
            error: { code: "validation_failed", message: "Validation failed", details },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Apply partial updates (only provided fields)
    if (phone !== undefined)
        member.phone = phone;
    if (address !== undefined)
        member.address = address;
    if (linkedinUrl !== undefined)
        member.linkedinUrl = linkedinUrl;
    if (otherSocials !== undefined)
        member.otherSocials = otherSocials;
    return res.json({
        id: member.id,
        email: member.email,
        first_name: member.firstName,
        last_name: member.lastName,
        phone: member.phone || null,
        address: member.address || null,
        linkedinUrl: member.linkedinUrl || null,
        otherSocials: member.otherSocials || null,
        avatarUrl: member.avatarUrl || null,
        customFields: member.customFields || null,
        status: member.status,
        membership_type_id: member.membershipTypeId || null,
        created_at: member.createdAt || null,
    });
};
exports.updateCurrentMember = updateCurrentMember;
/** GET /members/pending - list all pending approval members (admin only) */
const listPendingMembers = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt(req.query.page_size || "20", 10), 100), 1);
    const pending = members.filter((m) => m.tenantId === tenantId && m.status === "pendingApproval");
    const start = (page - 1) * pageSize;
    const paged = pending.slice(start, start + pageSize);
    const items = paged.map((m) => ({
        id: m.id,
        email: m.email,
        first_name: m.firstName,
        last_name: m.lastName,
        status: m.status,
        created_at: m.createdAt || Date.now(),
    }));
    return res.json({
        items,
        page,
        page_size: pageSize,
        total_items: pending.length,
        total_pages: Math.max(1, Math.ceil(pending.length / pageSize)),
    });
};
exports.listPendingMembers = listPendingMembers;
/** POST /members/:id/approve - approve a pending member (admin only) */
const approveMember = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const memberId = req.params.id;
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    if (member.status !== "pendingApproval") {
        return res.status(409).json({
            error: { code: "invalid_status", message: "Member not pending approval", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    member.status = "active";
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Member ${member.id} (${member.email}) approved by admin`);
    }
    return res.json({
        id: member.id,
        email: member.email,
        status: member.status,
        first_name: member.firstName,
        last_name: member.lastName,
        membership_type_id: member.membershipTypeId,
    });
};
exports.approveMember = approveMember;
/** POST /members/:id/reject - reject a pending member (admin only) */
const rejectMember = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const memberId = req.params.id;
    const { reason } = req.body || {};
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    if (member.status !== "pendingApproval") {
        return res.status(409).json({
            error: { code: "invalid_status", message: "Member not pending approval", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    member.status = "rejected";
    member.rejectionReason = reason || null;
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Member ${member.id} (${member.email}) rejected by admin. Reason: ${reason || "N/A"}`);
    }
    return res.json({
        id: member.id,
        email: member.email,
        status: member.status,
        first_name: member.firstName,
        last_name: member.lastName,
        rejection_reason: reason || null,
    });
};
exports.rejectMember = rejectMember;
const updateMember = (req, res) => res.json({ status: "updated" });
exports.updateMember = updateMember;
const updateMemberContact = (req, res) => {
    const memberId = req.params.id;
    const { phone, address } = req.body || {};
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({ error: { code: "not_found", message: "Member not found", details: [] }, trace_id: "trace-" + Date.now() });
    }
    const details = [];
    if (phone !== undefined && typeof phone !== "string")
        details.push({ field: "phone", issue: "invalid" });
    if (address !== undefined && typeof address !== "string")
        details.push({ field: "address", issue: "invalid" });
    if (details.length) {
        return res.status(400).json({ error: { code: "validation_failed", message: "Validation failed", details }, trace_id: "trace-" + Date.now() });
    }
    member.phone = phone ?? member.phone;
    member.address = address ?? member.address;
    return res.json({
        id: member.id,
        email: member.email,
        status: member.status,
        phone: member.phone,
        address: member.address,
    });
};
exports.updateMemberContact = updateMemberContact;
const uploadPhoto = (req, res) => res.json({ photo_url: "https://cdn.example.com/photo.jpg" });
exports.uploadPhoto = uploadPhoto;
/** GET /members/search - search members for directory (authenticated members only) */
const searchDirectoryMembers = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId;
    const q = (req.query.q || "").trim().toLowerCase();
    const limit = Math.max(Math.min(parseInt(req.query.limit || "20", 10), 100), 1);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
    // Filter to only active members (exclude pending, rejected, etc.)
    const directoryStatuses = ["active"];
    let filtered = members.filter((m) => m.tenantId === tenantId && directoryStatuses.includes(m.status));
    // Apply search filter if query provided
    if (q) {
        filtered = filtered.filter((m) => (m.firstName && m.firstName.toLowerCase().includes(q)) ||
            (m.lastName && m.lastName.toLowerCase().includes(q)) ||
            (m.email && m.email.toLowerCase().includes(q)));
    }
    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);
    const items = paged.map((m) => ({
        id: m.id,
        first_name: m.firstName || "",
        last_name: m.lastName || "",
        email: m.email,
        phone: m.phone || null,
        status: m.status,
        created_at: m.createdAt || null,
        linkedinUrl: m.linkedinUrl || null,
        otherSocials: m.otherSocials || null,
        avatarUrl: m.avatarUrl || null,
        customFields: m.customFields || null,
    }));
    return res.json({
        items,
        total,
        limit,
        offset,
    });
};
exports.searchDirectoryMembers = searchDirectoryMembers;
exports.searchMembers = exports.listMembers;
const deactivateMember = (req, res) => res.json({ status: "inactive" });
exports.deactivateMember = deactivateMember;
const importMembers = (req, res) => res.status(202).json({ job_id: "import-1" });
exports.importMembers = importMembers;
const auditMember = (req, res) => res.json({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });
exports.auditMember = auditMember;
const health = (_req, res) => res.json({ status: "ok" });
exports.health = health;
const status = (_req, res) => res.json({ status: "ok", deps: { db: "ok" } });
exports.status = status;
// =============================================================================
// Payment Methods (P-1: Member saves a payment method)
// =============================================================================
/** GET /members/me/payment-methods - list payment methods for current member */
const getMemberPaymentMethods = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user || {};
    const memberId = user.memberId || user.member_id;
    if (!memberId) {
        return res.status(400).json({
            error: { code: "missing_member_id", message: "No member ID associated with user", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Filter to current member's payment methods and sort by createdAt (newest first)
    const memberPaymentMethods = paymentMethods
        .filter((pm) => pm.memberId === memberId)
        .sort((a, b) => b.createdAt - a.createdAt);
    const defaultMethod = memberPaymentMethods.find((pm) => pm.isDefault);
    const response = {
        items: memberPaymentMethods,
        defaultId: defaultMethod ? defaultMethod.id : null,
    };
    return res.json(response);
};
exports.getMemberPaymentMethods = getMemberPaymentMethods;
/** POST /members/me/payment-methods - create a new payment method */
const createMemberPaymentMethod = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user || {};
    const memberId = user.memberId || user.member_id;
    if (!memberId) {
        return res.status(400).json({
            error: { code: "missing_member_id", message: "No member ID associated with user", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const { brand, last4, expMonth, expYear, label } = req.body || {};
    const details = [];
    // Validation
    if (!brand || typeof brand !== "string" || brand.trim() === "") {
        details.push({ field: "brand", issue: "required" });
    }
    if (!last4) {
        details.push({ field: "last4", issue: "required" });
    }
    else if (!/^\d{4}$/.test(String(last4))) {
        details.push({ field: "last4", issue: "must_be_4_digits" });
    }
    const monthNum = typeof expMonth === "number" ? expMonth : parseInt(String(expMonth), 10);
    if (expMonth === undefined || expMonth === null) {
        details.push({ field: "expMonth", issue: "required" });
    }
    else if (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        details.push({ field: "expMonth", issue: "invalid_range" });
    }
    const yearNum = typeof expYear === "number" ? expYear : parseInt(String(expYear), 10);
    const currentYear = new Date().getFullYear();
    if (expYear === undefined || expYear === null) {
        details.push({ field: "expYear", issue: "required" });
    }
    else if (Number.isNaN(yearNum) || yearNum < currentYear) {
        details.push({ field: "expYear", issue: "expired_or_invalid" });
    }
    if (details.length) {
        return res.status(400).json({
            error: { code: "validation_failed", message: "Validation failed", details },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Check if this is the first payment method for this member
    const existingMethods = paymentMethods.filter((pm) => pm.memberId === memberId);
    const isFirst = existingMethods.length === 0;
    const id = `pm-${paymentMethodCounter++}`;
    const newMethod = {
        id,
        memberId,
        brand: brand.trim(),
        last4: String(last4),
        expMonth: monthNum,
        expYear: yearNum,
        label: label?.trim() || null,
        isDefault: isFirst,
        createdAt: Date.now(),
        devPaymentToken: `dev_tok_${id}`,
    };
    paymentMethods.push(newMethod);
    // Return updated list
    const memberPaymentMethods = paymentMethods
        .filter((pm) => pm.memberId === memberId)
        .sort((a, b) => b.createdAt - a.createdAt);
    const defaultMethod = memberPaymentMethods.find((pm) => pm.isDefault);
    const response = {
        items: memberPaymentMethods,
        defaultId: defaultMethod ? defaultMethod.id : null,
    };
    return res.status(201).json(response);
};
exports.createMemberPaymentMethod = createMemberPaymentMethod;
// Test helper to reset payment methods store
const __resetPaymentMethods = () => {
    paymentMethods.length = 0;
    paymentMethodCounter = 1;
};
exports.__resetPaymentMethods = __resetPaymentMethods;
// Dev helper to seed a member for local testing
const __seedDevMember = () => {
    const existing = members.find((m) => m.id === "m-dev");
    if (existing)
        return existing;
    const devMember = {
        id: "m-dev",
        tenantId: "t1",
        email: "admin@test.local",
        status: "active",
        firstName: "Admin",
        lastName: "User",
        phone: null,
        address: null,
        roles: ["admin", "member", "event_manager", "finance_manager", "communications_manager"],
        createdAt: Date.now(),
    };
    devMember.linkedinUrl = null;
    devMember.otherSocials = null;
    members.push(devMember);
    console.log("[membership-service] Seeded dev member admin@test.local (m-dev) with all roles");
    return devMember;
};
exports.__seedDevMember = __seedDevMember;
// =============================================================================
// Admin Manual Member Creation (M-3)
// =============================================================================
/** POST /members/admin - admin creates a new member manually */
const createMemberAdmin = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const tenantId = req.headers["x-tenant-id"] || req.user?.tenantId || "unknown";
    const { email, first_name, last_name, phone, address, linkedinUrl, otherSocials, roles: inputRoles } = req.body || {};
    const details = [];
    // Required field validation
    if (!email)
        details.push({ field: "email", issue: "required" });
    if (email && !isEmail(email))
        details.push({ field: "email", issue: "invalid" });
    if (!first_name)
        details.push({ field: "first_name", issue: "required" });
    if (!last_name)
        details.push({ field: "last_name", issue: "required" });
    // Optional field validation
    if (phone !== undefined && phone !== null && typeof phone !== "string") {
        details.push({ field: "phone", issue: "invalid" });
    }
    if (address !== undefined && address !== null && typeof address !== "string") {
        details.push({ field: "address", issue: "invalid" });
    }
    if (linkedinUrl !== undefined && linkedinUrl !== null && typeof linkedinUrl !== "string") {
        details.push({ field: "linkedinUrl", issue: "invalid" });
    }
    if (linkedinUrl && !isValidLinkedinUrl(linkedinUrl)) {
        details.push({ field: "linkedinUrl", issue: "invalid_url" });
    }
    if (otherSocials !== undefined && otherSocials !== null && typeof otherSocials !== "string") {
        details.push({ field: "otherSocials", issue: "invalid" });
    }
    // Roles validation (optional, defaults to ["member"])
    let memberRoles = ["member"];
    if (inputRoles !== undefined) {
        if (!Array.isArray(inputRoles)) {
            details.push({ field: "roles", issue: "must_be_array" });
        }
        else if (inputRoles.length === 0) {
            details.push({ field: "roles", issue: "cannot_be_empty" });
        }
        else {
            const invalidRoles = inputRoles.filter((r) => typeof r !== "string" || !(0, models_1.isValidRole)(r));
            if (invalidRoles.length > 0) {
                details.push({ field: "roles", issue: `invalid_roles: ${invalidRoles.join(", ")}` });
            }
            else {
                memberRoles = inputRoles;
            }
        }
    }
    if (details.length) {
        return res.status(400).json({
            error: { code: "validation_failed", message: "Validation failed", details },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Check for duplicate email
    const emailLower = email.toLowerCase();
    const existingMember = members.find((m) => m.email.toLowerCase() === emailLower);
    if (existingMember) {
        return res.status(409).json({
            error: { code: "conflict", message: "A member with this email already exists", details: [{ field: "email", issue: "exists" }] },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Create new member
    const id = `m-${memberCounter++}`;
    const createdAt = Date.now();
    const member = {
        id,
        tenantId,
        email,
        status: "active",
        firstName: first_name,
        lastName: last_name,
        phone: phone || null,
        address: address || null,
        roles: memberRoles,
        createdAt,
    };
    member.linkedinUrl = linkedinUrl || null;
    member.otherSocials = otherSocials || null;
    members.push(member);
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Admin created member ${member.id} (${member.email}) with roles: ${memberRoles.join(", ")}`);
    }
    return res.status(201).json({
        id: member.id,
        email: member.email,
        first_name: member.firstName,
        last_name: member.lastName,
        phone: member.phone || null,
        address: member.address || null,
        linkedinUrl: member.linkedinUrl || null,
        otherSocials: member.otherSocials || null,
        status: member.status,
        roles: member.roles,
        created_at: member.createdAt,
    });
};
exports.createMemberAdmin = createMemberAdmin;
// =============================================================================
// Admin Role Management (M-13)
// =============================================================================
// =============================================================================
// Avatar Management (M-14, M-15)
// =============================================================================
/** PATCH /members/me/avatar - member updates their own avatar */
const updateMyAvatar = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user || {};
    const memberId = user.memberId || user.member_id;
    if (!memberId) {
        return res.status(400).json({
            error: { code: "missing_member_id", message: "No member ID associated with user", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const { avatarUrl } = req.body || {};
    if (avatarUrl !== null && typeof avatarUrl !== "string") {
        return res.status(400).json({
            error: { code: "validation_failed", message: "avatarUrl must be a string or null", details: [{ field: "avatarUrl", issue: "invalid_type" }] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    member.avatarUrl = avatarUrl;
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Member ${member.id} (${member.email}) updated their avatar`);
    }
    return res.json({
        memberId: member.id,
        avatarUrl: member.avatarUrl ?? null,
    });
};
exports.updateMyAvatar = updateMyAvatar;
/** PATCH /members/:id/avatar - admin updates a member's avatar */
const adminUpdateAvatar = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const targetMemberId = req.params.id;
    const { avatarUrl } = req.body || {};
    if (avatarUrl !== null && typeof avatarUrl !== "string") {
        return res.status(400).json({
            error: { code: "validation_failed", message: "avatarUrl must be a string or null", details: [{ field: "avatarUrl", issue: "invalid_type" }] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const member = members.find((m) => m.id === targetMemberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    member.avatarUrl = avatarUrl;
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Admin updated avatar for member ${member.id} (${member.email})`);
    }
    return res.json({
        memberId: member.id,
        avatarUrl: member.avatarUrl ?? null,
    });
};
exports.adminUpdateAvatar = adminUpdateAvatar;
/** PUT /members/:id/roles - admin updates a member's roles */
const updateMemberRoles = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const memberId = req.params.id;
    const { roles } = req.body || {};
    const details = [];
    // Validate roles
    if (!roles) {
        details.push({ field: "roles", issue: "required" });
    }
    else if (!Array.isArray(roles)) {
        details.push({ field: "roles", issue: "must_be_array" });
    }
    else if (roles.length === 0) {
        details.push({ field: "roles", issue: "cannot_be_empty" });
    }
    else {
        const invalidRoles = roles.filter((r) => typeof r !== "string" || !(0, models_1.isValidRole)(r));
        if (invalidRoles.length > 0) {
            details.push({ field: "roles", issue: `invalid_roles: ${invalidRoles.join(", ")}` });
        }
    }
    if (details.length) {
        return res.status(400).json({
            error: { code: "validation_failed", message: "Validation failed", details },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Find member
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Update roles
    member.roles = roles;
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Admin updated roles for member ${member.id} (${member.email}): ${member.roles.join(", ")}`);
    }
    return res.json({
        id: member.id,
        email: member.email,
        first_name: member.firstName,
        last_name: member.lastName,
        roles: member.roles,
        status: member.status,
    });
};
exports.updateMemberRoles = updateMemberRoles;
// =============================================================================
// Custom Profile Fields (M-17, M-18, M-19, M-20)
// =============================================================================
/** GET /custom-fields/profile-schema - get the current profile custom fields schema */
const getProfileCustomFieldSchema = (req, res) => {
    if (!requireAuth(req, res))
        return;
    return res.json(profileCustomFieldSchema);
};
exports.getProfileCustomFieldSchema = getProfileCustomFieldSchema;
/** PUT /custom-fields/profile-schema - admin updates the profile custom fields schema */
const updateProfileCustomFieldSchema = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const { groups, fields } = req.body || {};
    const errors = {};
    // Validate groups
    if (!Array.isArray(groups)) {
        errors.groups = "groups must be an array";
    }
    else {
        const groupIds = new Set();
        for (const group of groups) {
            if (!group.id || typeof group.id !== "string") {
                errors[`group_${group.id || "unknown"}`] = "Group must have a valid id";
                continue;
            }
            if (!group.label || typeof group.label !== "string") {
                errors[`group_${group.id}`] = "Group must have a label";
                continue;
            }
            if (groupIds.has(group.id)) {
                errors[`group_${group.id}`] = "Duplicate group id";
                continue;
            }
            groupIds.add(group.id);
        }
    }
    // Validate fields
    if (!Array.isArray(fields)) {
        errors.fields = "fields must be an array";
    }
    else {
        const fieldIds = new Set();
        const fieldKeys = new Set();
        const groupIds = new Set((groups || []).map((g) => g.id));
        for (const field of fields) {
            if (!field.id || typeof field.id !== "string") {
                errors[`field_${field.id || "unknown"}`] = "Field must have a valid id";
                continue;
            }
            if (!field.key || typeof field.key !== "string") {
                errors[`field_${field.id}`] = "Field must have a key";
                continue;
            }
            if (!field.label || typeof field.label !== "string") {
                errors[`field_${field.id}`] = "Field must have a label";
                continue;
            }
            if (!field.type || !models_1.CUSTOM_FIELD_TYPES.includes(field.type)) {
                errors[`field_${field.id}`] = `Field type must be one of: ${models_1.CUSTOM_FIELD_TYPES.join(", ")}`;
                continue;
            }
            if (fieldIds.has(field.id)) {
                errors[`field_${field.id}`] = "Duplicate field id";
                continue;
            }
            if (fieldKeys.has(field.key)) {
                errors[`field_${field.id}`] = "Duplicate field key";
                continue;
            }
            if (field.groupId && !groupIds.has(field.groupId)) {
                errors[`field_${field.id}`] = `Field references non-existent group: ${field.groupId}`;
                continue;
            }
            // Validate visibleWhen conditions
            if (field.visibleWhen && Array.isArray(field.visibleWhen)) {
                for (const condition of field.visibleWhen) {
                    if (!condition.fieldId) {
                        errors[`field_${field.id}_condition`] = "Condition must reference a fieldId";
                        break;
                    }
                    // Note: We validate against the new fields list being submitted
                    const referencedField = fields.find((f) => f.id === condition.fieldId);
                    if (!referencedField) {
                        errors[`field_${field.id}_condition`] = `Condition references non-existent field: ${condition.fieldId}`;
                        break;
                    }
                }
            }
            // Validate options for select/checkbox
            if ((field.type === "select" || field.type === "checkbox") && field.options) {
                if (!Array.isArray(field.options)) {
                    errors[`field_${field.id}_options`] = "Options must be an array";
                }
                else {
                    const optionValues = new Set();
                    for (const opt of field.options) {
                        if (!opt.value || typeof opt.value !== "string") {
                            errors[`field_${field.id}_options`] = "Each option must have a value";
                            break;
                        }
                        if (!opt.label || typeof opt.label !== "string") {
                            errors[`field_${field.id}_options`] = "Each option must have a label";
                            break;
                        }
                        if (optionValues.has(opt.value)) {
                            errors[`field_${field.id}_options`] = `Duplicate option value: ${opt.value}`;
                            break;
                        }
                        optionValues.add(opt.value);
                    }
                }
            }
            fieldIds.add(field.id);
            fieldKeys.add(field.key);
        }
    }
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            error: { code: "validation_failed", message: "Schema validation failed", errors },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Update the schema
    profileCustomFieldSchema = {
        groups: groups || [],
        fields: fields || [],
        updatedAt: Date.now(),
    };
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Profile custom fields schema updated: ${fields.length} fields, ${groups.length} groups`);
    }
    return res.json(profileCustomFieldSchema);
};
exports.updateProfileCustomFieldSchema = updateProfileCustomFieldSchema;
/** Helper to check if a field is visible based on conditions */
const isFieldVisible = (field, values) => {
    if (!field.visibleWhen || field.visibleWhen.length === 0) {
        return true;
    }
    // All conditions must match (AND logic)
    for (const condition of field.visibleWhen) {
        const currentValue = values[condition.fieldId];
        if (condition.equals !== undefined && currentValue !== condition.equals) {
            return false;
        }
    }
    return true;
};
/** Helper to validate custom field values against schema */
const validateCustomFieldValues = (schema, values) => {
    const errors = {};
    for (const field of schema.fields) {
        const value = values[field.id];
        const isVisible = isFieldVisible(field, values);
        // Skip validation for hidden fields
        if (!isVisible)
            continue;
        const validation = field.validation || {};
        // Required check
        if (validation.required) {
            if (value === undefined || value === null || value === "") {
                errors[field.id] = `${field.label} is required`;
                continue;
            }
        }
        // Skip further validation if value is empty and not required
        if (value === undefined || value === null || value === "")
            continue;
        // Type-specific validation
        switch (field.type) {
            case "text":
            case "textarea": {
                if (typeof value !== "string") {
                    errors[field.id] = `${field.label} must be text`;
                    continue;
                }
                if (validation.minLength !== undefined && value.length < validation.minLength) {
                    errors[field.id] = `${field.label} must be at least ${validation.minLength} characters`;
                    continue;
                }
                if (validation.maxLength !== undefined && value.length > validation.maxLength) {
                    errors[field.id] = `${field.label} must be at most ${validation.maxLength} characters`;
                    continue;
                }
                if (validation.pattern) {
                    try {
                        const regex = new RegExp(validation.pattern);
                        if (!regex.test(value)) {
                            errors[field.id] = `${field.label} does not match the required format`;
                            continue;
                        }
                    }
                    catch {
                        // Invalid regex pattern - skip validation
                    }
                }
                break;
            }
            case "number": {
                const numValue = typeof value === "number" ? value : parseFloat(String(value));
                if (isNaN(numValue)) {
                    errors[field.id] = `${field.label} must be a number`;
                    continue;
                }
                if (validation.min !== undefined && numValue < validation.min) {
                    errors[field.id] = `${field.label} must be at least ${validation.min}`;
                    continue;
                }
                if (validation.max !== undefined && numValue > validation.max) {
                    errors[field.id] = `${field.label} must be at most ${validation.max}`;
                    continue;
                }
                break;
            }
            case "date": {
                // Accept ISO date strings
                if (typeof value !== "string") {
                    errors[field.id] = `${field.label} must be a date string`;
                    continue;
                }
                const dateValue = new Date(value);
                if (isNaN(dateValue.getTime())) {
                    errors[field.id] = `${field.label} must be a valid date`;
                    continue;
                }
                if (validation.min !== undefined) {
                    const minDate = new Date(validation.min);
                    if (dateValue < minDate) {
                        errors[field.id] = `${field.label} must be on or after ${minDate.toISOString().split("T")[0]}`;
                        continue;
                    }
                }
                if (validation.max !== undefined) {
                    const maxDate = new Date(validation.max);
                    if (dateValue > maxDate) {
                        errors[field.id] = `${field.label} must be on or before ${maxDate.toISOString().split("T")[0]}`;
                        continue;
                    }
                }
                break;
            }
            case "select": {
                if (typeof value !== "string") {
                    errors[field.id] = `${field.label} must be a string`;
                    continue;
                }
                const validOptions = (field.options || []).map((o) => o.value);
                if (!validOptions.includes(value)) {
                    errors[field.id] = `${field.label} must be one of the allowed options`;
                    continue;
                }
                break;
            }
            case "checkbox": {
                if (typeof value !== "boolean" && value !== "true" && value !== "false") {
                    errors[field.id] = `${field.label} must be true or false`;
                    continue;
                }
                break;
            }
        }
    }
    return errors;
};
/** GET /members/me/custom-fields - get current member's custom fields */
const getCurrentMemberCustomFields = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user || {};
    const memberId = user.memberId || user.member_id;
    if (!memberId) {
        return res.status(400).json({
            error: { code: "missing_member_id", message: "No member ID associated with user", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    return res.json({
        customFields: member.customFields || {},
    });
};
exports.getCurrentMemberCustomFields = getCurrentMemberCustomFields;
/** PATCH /members/me/custom-fields - update current member's custom fields */
const updateCurrentMemberCustomFields = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user || {};
    const memberId = user.memberId || user.member_id;
    if (!memberId) {
        return res.status(400).json({
            error: { code: "missing_member_id", message: "No member ID associated with user", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const { customFields } = req.body || {};
    if (!customFields || typeof customFields !== "object") {
        return res.status(400).json({
            error: { code: "validation_failed", message: "customFields must be an object", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Validate against schema
    const validationErrors = validateCustomFieldValues(profileCustomFieldSchema, customFields);
    if (Object.keys(validationErrors).length > 0) {
        return res.status(400).json({
            error: { code: "validation_failed", message: "Custom field validation failed", errors: validationErrors },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Normalize values (coerce types where needed)
    const normalizedValues = {};
    for (const field of profileCustomFieldSchema.fields) {
        const value = customFields[field.id];
        if (value !== undefined && value !== null) {
            if (field.type === "number" && typeof value === "string") {
                normalizedValues[field.id] = parseFloat(value);
            }
            else if (field.type === "checkbox") {
                normalizedValues[field.id] = value === true || value === "true";
            }
            else {
                normalizedValues[field.id] = value;
            }
        }
        else {
            normalizedValues[field.id] = null;
        }
    }
    member.customFields = normalizedValues;
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Member ${member.id} updated custom fields`);
    }
    return res.json({
        customFields: member.customFields,
    });
};
exports.updateCurrentMemberCustomFields = updateCurrentMemberCustomFields;
/** GET /members/:id/custom-fields - admin gets a member's custom fields with schema */
const adminGetMemberCustomFields = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const memberId = req.params.id;
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    return res.json({
        schema: profileCustomFieldSchema,
        customFields: member.customFields || {},
    });
};
exports.adminGetMemberCustomFields = adminGetMemberCustomFields;
/** PATCH /members/:id/custom-fields - admin updates a member's custom fields */
const adminUpdateMemberCustomFields = (req, res) => {
    if (!requireAuth(req, res))
        return;
    if (!requireAdmin(req, res))
        return;
    const memberId = req.params.id;
    const member = members.find((m) => m.id === memberId);
    if (!member) {
        return res.status(404).json({
            error: { code: "not_found", message: "Member not found", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    const { customFields } = req.body || {};
    if (!customFields || typeof customFields !== "object") {
        return res.status(400).json({
            error: { code: "validation_failed", message: "customFields must be an object", details: [] },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Validate against schema
    const validationErrors = validateCustomFieldValues(profileCustomFieldSchema, customFields);
    if (Object.keys(validationErrors).length > 0) {
        return res.status(400).json({
            error: { code: "validation_failed", message: "Custom field validation failed", errors: validationErrors },
            trace_id: "trace-" + Date.now(),
        });
    }
    // Normalize values
    const normalizedValues = {};
    for (const field of profileCustomFieldSchema.fields) {
        const value = customFields[field.id];
        if (value !== undefined && value !== null) {
            if (field.type === "number" && typeof value === "string") {
                normalizedValues[field.id] = parseFloat(value);
            }
            else if (field.type === "checkbox") {
                normalizedValues[field.id] = value === true || value === "true";
            }
            else {
                normalizedValues[field.id] = value;
            }
        }
        else {
            normalizedValues[field.id] = null;
        }
    }
    member.customFields = normalizedValues;
    if (process.env.NODE_ENV !== "production") {
        console.log(`[membership] Admin updated custom fields for member ${member.id}`);
    }
    return res.json({
        schema: profileCustomFieldSchema,
        customFields: member.customFields,
    });
};
exports.adminUpdateMemberCustomFields = adminUpdateMemberCustomFields;
