"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__seedMembershipType = exports.__assignMembershipType = exports.__setMemberStatus = exports.__seedMember = exports.__getReminderEvents = exports.__getInvoiceSendEvents = exports.__getReceiptEvents = exports.__seedRegistration = exports.__seedEvent = exports.__getAuditLogs = exports.__seedInvoice = exports.__resetInvoices = exports.__resetPaymentMethods = exports.downloadInvoicePdf = exports.runPaymentReminders = exports.listMemberInvoices = exports.sendInvoice = exports.createManualInvoice = exports.markInvoicePaid = exports.runDuesJob = exports.payEventFee = exports.createPayment = exports.listPaymentMethods = exports.createPaymentMethod = void 0;
const paymentMethods = [];
const invoices = [];
const payments = [];
const transactions = [];
const idem = {};
const auditLogs = [];
const events = [];
const registrations = [];
const members = [];
const membershipTypes = [];
const receiptEvents = [];
const emittedReceiptKeys = new Set();
const reminderEvents = [];
const invoiceSendEvents = [];
let pmCounter = 1;
let invoiceCounter = 1;
let paymentCounter = 1;
let txnCounter = 1;
let auditCounter = 1;
let eventCounter = 1;
let regCounter = 1;
let memberCounter = 1;
const requireAuth = (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] }, trace_id: "trace-" + Date.now() });
        return false;
    }
    return true;
};
const errorResponse = (res, code, message, details, status = 400) => res.status(status).json({ error: { code, message, details: details || [] }, trace_id: "trace-" + Date.now() });
const inferBrand = (number) => {
    if (number.startsWith("4"))
        return "visa";
    if (number.startsWith("5"))
        return "mastercard";
    if (number.startsWith("3"))
        return "amex";
    return "card";
};
const emitReceipt = (key, tenantId, memberId, invoiceId, amount, currency, paymentMethodLast4, paymentType) => {
    if (emittedReceiptKeys.has(key))
        return;
    emittedReceiptKeys.add(key);
    const payload = {
        tenant_id: tenantId,
        member_id: memberId,
        invoice_id: invoiceId,
        amount,
        currency,
        payment_method_last4: paymentMethodLast4,
        payment_type: paymentType,
        timestamp: Date.now(),
        event: "payment.receipt.requested",
    };
    receiptEvents.push({ key, payload });
};
const createPaymentMethod = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const tenantId = user.tenantId;
    const memberId = user.memberId;
    const { number, exp_month, exp_year, cvc, brand } = req.body || {};
    const details = [];
    if (!number)
        details.push({ field: "number", issue: "required" });
    if (number && (!/^\d{12,19}$/.test(String(number))))
        details.push({ field: "number", issue: "invalid" });
    const monthNum = parseInt(exp_month, 10);
    const yearNum = parseInt(exp_year, 10);
    if (!exp_month)
        details.push({ field: "exp_month", issue: "required" });
    if (!exp_year)
        details.push({ field: "exp_year", issue: "required" });
    if (exp_month && (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12))
        details.push({ field: "exp_month", issue: "invalid" });
    if (exp_year && (Number.isNaN(yearNum) || yearNum < new Date().getFullYear()))
        details.push({ field: "exp_year", issue: "invalid" });
    if (!cvc)
        details.push({ field: "cvc", issue: "required" });
    if (cvc && !/^\d{3,4}$/.test(String(cvc)))
        details.push({ field: "cvc", issue: "invalid" });
    if (details.length)
        return errorResponse(res, "validation_failed", "Validation failed", details, 400);
    const pmId = `pm-${pmCounter++}`;
    const last4 = String(number).slice(-4);
    const token = `pm_tok_${pmId}`;
    const pm = {
        id: pmId,
        tenantId,
        memberId,
        brand: brand || inferBrand(String(number)),
        last4,
        token,
        status: "active",
    };
    paymentMethods.push(pm);
    return res.status(201).json({ payment_method_id: pm.id, last4: pm.last4, brand: pm.brand });
};
exports.createPaymentMethod = createPaymentMethod;
const listPaymentMethods = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const tenantId = user.tenantId;
    const memberId = user.memberId;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt(req.query.page_size || "20", 10), 100), 1);
    const filtered = paymentMethods.filter((pm) => pm.tenantId === tenantId && pm.memberId === memberId && pm.status === "active");
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((pm) => ({
        id: pm.id,
        brand: pm.brand,
        last4: pm.last4,
        status: pm.status,
    }));
    return res.json({
        items,
        page,
        page_size: pageSize,
        total_items: filtered.length,
        total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    });
};
exports.listPaymentMethods = listPaymentMethods;
const createPayment = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const tenantId = user.tenantId;
    const memberId = user.memberId;
    const { invoice_id, payment_method_id, card, amount, currency } = req.body || {};
    if (!invoice_id)
        return errorResponse(res, "validation_failed", "invoice_id required", [{ field: "invoice_id", issue: "required" }]);
    const invoice = invoices.find((i) => i.id === invoice_id && i.tenantId === tenantId);
    if (!invoice)
        return errorResponse(res, "not_found", "Invoice not found", [], 404);
    if (invoice.memberId !== memberId)
        return errorResponse(res, "forbidden", "Invoice does not belong to member", [], 403);
    return charge(tenantId, memberId, invoice, { payment_method_id, card, amount, currency }, req, res, true);
};
exports.createPayment = createPayment;
const payEventFee = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const tenantId = user.tenantId;
    const memberId = user.memberId;
    const eventId = req.params.id;
    const event = events.find((e) => e.id === eventId && e.tenantId === tenantId);
    if (!event)
        return errorResponse(res, "not_found", "Event not found", [], 404);
    if (event.status !== "open")
        return errorResponse(res, "invalid_status", "Event not payable", [], 409);
    const registration = registrations.find((r) => r.eventId === eventId && r.tenantId === tenantId && r.memberId === memberId);
    if (!registration)
        return errorResponse(res, "not_found", "Registration not found", [], 404);
    if (registration.status === "cancelled")
        return errorResponse(res, "invalid_status", "Registration not payable", [], 409);
    // ensure invoice
    let invoice;
    if (registration.invoiceId) {
        invoice = invoices.find((i) => i.id === registration.invoiceId && i.tenantId === tenantId);
    }
    if (!invoice) {
        invoice = {
            id: `inv-${invoiceCounter++}`,
            tenantId,
            memberId,
            amount: event.feeAmount,
            currency: event.currency,
            status: "unpaid",
            type: "event",
            createdAt: Date.now(),
        };
        invoices.push(invoice);
        registration.invoiceId = invoice.id;
    }
    const result = charge(tenantId, memberId, invoice, req.body || {}, req, res, true, "event");
    if (res.statusCode === 201) {
        registration.status = "confirmed";
    }
    return result;
};
exports.payEventFee = payEventFee;
const runDuesJob = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const roles = user.roles || [];
    const isInternal = req.headers["x-internal"] === "true";
    if (!isInternal && !roles.includes("admin"))
        return errorResponse(res, "forbidden", "Admin role required", [], 403);
    const tenantId = user.tenantId;
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString();
    let created = 0;
    let skipped = 0;
    members
        .filter((m) => m.tenantId === tenantId && m.status === "active" && m.membershipTypeId)
        .forEach((m) => {
        const mt = membershipTypes.find((mt) => mt.id === m.membershipTypeId && mt.tenantId === tenantId);
        if (!mt) {
            skipped += 1;
            return;
        }
        const exists = invoices.find((i) => i.tenantId === tenantId && i.memberId === m.id && i.type === "dues" && i.periodStart === periodStart && i.status === "unpaid");
        if (exists) {
            skipped += 1;
            return;
        }
        const invoice = {
            id: `inv-${invoiceCounter++}`,
            tenantId,
            memberId: m.id,
            amount: mt.amount,
            currency: mt.currency,
            status: "unpaid",
            type: "dues",
            periodStart,
            periodEnd,
            createdAt: Date.now(),
        };
        invoices.push(invoice);
        auditLogs.push({
            id: `audit-${auditCounter++}`,
            tenantId,
            invoiceId: invoice.id,
            memberId: m.id,
            amount: invoice.amount,
            action: "dues_generated",
            actorId: user.userId || "system",
            createdAt: Date.now(),
        });
        created += 1;
    });
    return res.json({ created, skipped });
};
exports.runDuesJob = runDuesJob;
const charge = (tenantId, memberId, invoice, payload, req, res, allowOneTimeCard = true, paymentType = "dues") => {
    const idempotencyKey = req.headers["idempotency-key"] || "";
    if (idempotencyKey && idem[idempotencyKey]) {
        const prev = idem[idempotencyKey];
        if (prev.tenantId === tenantId && prev.memberId === memberId) {
            return res.json({ payment_id: prev.id, invoice_id: prev.invoiceId, amount: prev.amount, status: prev.status });
        }
    }
    if (invoice.status === "paid")
        return errorResponse(res, "invoice_paid", "Invoice already paid", [], 409);
    if (invoice.status === "void")
        return errorResponse(res, "invalid_status", "Invoice not payable", [], 409);
    const { payment_method_id, card, amount, currency } = payload || {};
    let method = null;
    const details = [];
    if (payment_method_id) {
        method = paymentMethods.find((pm) => pm.id === payment_method_id && pm.tenantId === tenantId && pm.memberId === memberId && pm.status === "active") || null;
        if (!method)
            return errorResponse(res, "payment_method_not_found", "Payment method not found", [{ field: "payment_method_id", issue: "not_found" }], 404);
    }
    else if (allowOneTimeCard) {
        const { number, exp_month, exp_year, cvc } = card || {};
        if (!number)
            details.push({ field: "card.number", issue: "required" });
        if (number && !/^\d{12,19}$/.test(String(number)))
            details.push({ field: "card.number", issue: "invalid" });
        const monthNum = parseInt(exp_month, 10);
        const yearNum = parseInt(exp_year, 10);
        if (!exp_month)
            details.push({ field: "card.exp_month", issue: "required" });
        if (!exp_year)
            details.push({ field: "card.exp_year", issue: "required" });
        if (exp_month && (Number.isNaN(monthNum) || monthNum < 1 || monthNum > 12))
            details.push({ field: "card.exp_month", issue: "invalid" });
        if (exp_year && (Number.isNaN(yearNum) || yearNum < new Date().getFullYear()))
            details.push({ field: "card.exp_year", issue: "invalid" });
        if (!cvc)
            details.push({ field: "card.cvc", issue: "required" });
        if (cvc && !/^\d{3,4}$/.test(String(cvc)))
            details.push({ field: "card.cvc", issue: "invalid" });
        if (details.length)
            return errorResponse(res, "validation_failed", "Validation failed", details, 400);
        method = {
            id: `pm-onetime-${pmCounter++}`,
            tenantId,
            memberId,
            brand: inferBrand(String(number)),
            last4: String(number).slice(-4),
            token: `pm_tok_onetime_${Date.now()}`,
            status: "active",
        };
    }
    else {
        return errorResponse(res, "validation_failed", "Payment method required", [{ field: "payment_method_id", issue: "required" }], 400);
    }
    if (!method)
        return errorResponse(res, "validation_failed", "Payment method required", [{ field: "payment_method_id", issue: "required" }], 400);
    const finalAmount = amount ?? invoice.amount;
    if (!finalAmount || finalAmount <= 0)
        return errorResponse(res, "validation_failed", "Invalid amount", [{ field: "amount", issue: "invalid" }], 400);
    const currencyUsed = currency || invoice.currency || "USD";
    const paymentId = `pay-${paymentCounter++}`;
    const payment = {
        id: paymentId,
        tenantId,
        memberId,
        invoiceId: invoice.id,
        amount: finalAmount,
        currency: currencyUsed,
        status: "paid",
        paymentMethodId: payment_method_id || method.id,
        paymentMethodLast4: method.last4,
        paymentType,
    };
    payments.push(payment);
    invoice.status = "paid";
    const txn = {
        id: `txn-${txnCounter++}`,
        tenantId,
        memberId,
        paymentId,
        invoiceId: invoice.id,
        amount: finalAmount,
        status: "paid",
    };
    transactions.push(txn);
    auditLogs.push({
        id: `audit-${auditCounter++}`,
        tenantId,
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        amount: finalAmount,
        action: "paid",
        createdAt: Date.now(),
    });
    if (idempotencyKey) {
        idem[idempotencyKey] = payment;
    }
    try {
        emitReceipt(`payment:${payment.id}`, tenantId, invoice.memberId, invoice.id, finalAmount, currencyUsed, method.last4 || null, paymentType);
    }
    catch (e) {
        // Do not fail payment on receipt emission issues
        // eslint-disable-next-line no-console
        console.error("receipt emit failed", e);
    }
    return res.status(201).json({ payment_id: payment.id, invoice_id: invoice.id, amount: finalAmount, status: "paid" });
};
const markInvoicePaid = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const tenantId = user.tenantId;
    const invoiceId = req.params.id;
    const invoice = invoices.find((i) => i.id === invoiceId && i.tenantId === tenantId);
    if (!invoice)
        return errorResponse(res, "not_found", "Invoice not found", [], 404);
    if (invoice.status === "paid") {
        return res.json({ invoice_id: invoice.id, status: "paid" });
    }
    if (invoice.status === "void") {
        return errorResponse(res, "invalid_status", "Invoice not payable", [], 409);
    }
    if (invoice.status !== "unpaid") {
        return errorResponse(res, "invalid_status", "Invoice not payable", [], 409);
    }
    invoice.status = "paid";
    auditLogs.push({
        id: `audit-${auditCounter++}`,
        tenantId,
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        amount: invoice.amount,
        action: "paid",
        createdAt: Date.now(),
    });
    try {
        emitReceipt(`invoice:${invoice.id}`, tenantId, invoice.memberId, invoice.id, invoice.amount, invoice.currency, null, "dues");
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error("receipt emit failed", e);
    }
    return res.json({ invoice_id: invoice.id, status: "paid" });
};
exports.markInvoicePaid = markInvoicePaid;
const createManualInvoice = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const roles = user.roles || [];
    if (!roles.includes("admin"))
        return errorResponse(res, "forbidden", "Admin role required", [], 403);
    const tenantId = user.tenantId;
    const actorId = user.userId || "admin";
    const { member_id, amount, currency, description, due_date } = req.body || {};
    const details = [];
    if (!member_id)
        details.push({ field: "member_id", issue: "required" });
    if (amount === undefined)
        details.push({ field: "amount", issue: "required" });
    if (amount !== undefined && (typeof amount !== "number" || amount <= 0))
        details.push({ field: "amount", issue: "invalid" });
    if (!currency)
        details.push({ field: "currency", issue: "required" });
    if (details.length)
        return errorResponse(res, "validation_failed", "Validation failed", details, 400);
    const member = members.find((m) => m.id === member_id && m.tenantId === tenantId);
    if (!member)
        return errorResponse(res, "not_found", "Member not found", [{ field: "member_id", issue: "not_found" }], 404);
    const invoice = {
        id: `inv-${invoiceCounter++}`,
        tenantId,
        memberId: member_id,
        amount,
        currency,
        status: "unpaid",
        type: "manual",
        createdAt: Date.now(),
    };
    invoices.push(invoice);
    auditLogs.push({
        id: `audit-${auditCounter++}`,
        tenantId,
        invoiceId: invoice.id,
        memberId: member_id,
        amount,
        action: "created",
        actorId,
        createdAt: Date.now(),
    });
    return res.status(201).json({
        invoice_id: invoice.id,
        status: invoice.status,
        member_id,
        amount,
        currency,
        description: description || null,
        due_date: due_date || null,
        created_at: Date.now(),
    });
};
exports.createManualInvoice = createManualInvoice;
const sendInvoice = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const roles = user.roles || [];
    if (!roles.includes("admin"))
        return errorResponse(res, "forbidden", "Admin role required", [], 403);
    const tenantId = user.tenantId;
    const invoiceId = req.params.id;
    const invoice = invoices.find((i) => i.id === invoiceId && i.tenantId === tenantId);
    if (!invoice)
        return errorResponse(res, "not_found", "Invoice not found", [], 404);
    if (invoice.status !== "unpaid" && invoice.status !== "overdue") {
        return errorResponse(res, "invalid_status", "Invoice not sendable", [], 409);
    }
    const member = members.find((m) => m.id === invoice.memberId && m.tenantId === tenantId);
    if (!member)
        return errorResponse(res, "not_found", "Member not found", [], 404);
    if (member.status !== "active")
        return errorResponse(res, "invalid_status", "Member inactive", [], 409);
    const payload = {
        tenant_id: tenantId,
        member_id: invoice.memberId,
        invoice_id: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        description: null,
        due_date: null,
        timestamp: Date.now(),
        event: "invoice.send.requested",
    };
    invoiceSendEvents.push(payload);
    auditLogs.push({
        id: `audit-${auditCounter++}`,
        tenantId,
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        amount: invoice.amount,
        action: "send_requested",
        actorId: user.userId || "admin",
        createdAt: payload.timestamp,
    });
    return res.json({ status: "queued" });
};
exports.sendInvoice = sendInvoice;
const listMemberInvoices = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const tenantId = user.tenantId;
    const memberId = user.memberId;
    const statusFilter = req.query.status || "";
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt(req.query.page_size || "20", 10), 100), 1);
    const allowedStatuses = ["unpaid", "overdue"];
    const filterStatuses = statusFilter ? statusFilter.split(",").map((s) => s.trim()).filter((s) => allowedStatuses.includes(s)) : allowedStatuses;
    const filtered = invoices.filter((inv) => inv.tenantId === tenantId && inv.memberId === memberId && filterStatuses.includes(inv.status));
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((inv) => ({
        invoice_id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        description: null,
        due_date: null,
        status: inv.status,
        createdAt: inv.createdAt || 0,
    }));
    return res.json({
        items,
        page,
        page_size: pageSize,
        total_items: filtered.length,
        total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
    });
};
exports.listMemberInvoices = listMemberInvoices;
const runPaymentReminders = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const roles = user.roles || [];
    const isInternal = req.headers["x-internal"] === "true";
    if (!isInternal && !roles.includes("admin"))
        return errorResponse(res, "forbidden", "Admin role required", [], 403);
    const tenantId = user.tenantId;
    const now = Date.now();
    let sent = 0;
    invoices
        .filter((inv) => inv.tenantId === tenantId &&
        (inv.status === "unpaid" || inv.status === "overdue") &&
        (!inv.reminderSentAt || inv.reminderSentAt === null) &&
        inv.dueDate &&
        new Date(inv.dueDate).getTime() <= now)
        .forEach((inv) => {
        const member = members.find((m) => m.id === inv.memberId && m.tenantId === tenantId);
        if (!member)
            return;
        const payload = {
            tenant_id: tenantId,
            member_id: inv.memberId,
            invoice_id: inv.id,
            amount: inv.amount,
            currency: inv.currency,
            due_date: inv.dueDate || null,
            member_email: member.email || null,
            type: inv.type === "event" ? "event" : "dues",
        };
        reminderEvents.push(payload);
        inv.reminderSentAt = now;
        inv.reminderCount = (inv.reminderCount || 0) + 1;
        sent += 1;
        auditLogs.push({
            id: `audit-${auditCounter++}`,
            tenantId,
            invoiceId: inv.id,
            memberId: inv.memberId,
            amount: inv.amount,
            action: "send_requested",
            actorId: user.userId || "system",
            createdAt: now,
        });
    });
    return res.json({ sent });
};
exports.runPaymentReminders = runPaymentReminders;
const downloadInvoicePdf = (req, res) => {
    if (!requireAuth(req, res))
        return;
    const user = req.user;
    const tenantId = user.tenantId;
    const memberId = user.memberId;
    const invoiceId = req.params.id;
    const invoice = invoices.find((inv) => inv.id === invoiceId && inv.tenantId === tenantId);
    if (!invoice)
        return errorResponse(res, "not_found", "Invoice not found", [], 404);
    if (invoice.memberId !== memberId)
        return errorResponse(res, "forbidden", "Forbidden", [], 403);
    const pdfContent = "%PDF-1.4\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoiceId}.pdf"`);
    auditLogs.push({
        id: `audit-${auditCounter++}`,
        tenantId,
        invoiceId: invoice.id,
        memberId: invoice.memberId,
        amount: invoice.amount,
        action: "pdf_downloaded",
        actorId: user.userId || memberId,
        createdAt: Date.now(),
    });
    return res.send(pdfContent);
};
exports.downloadInvoicePdf = downloadInvoicePdf;
// test helpers
const __resetPaymentMethods = () => {
    paymentMethods.length = 0;
    pmCounter = 1;
};
exports.__resetPaymentMethods = __resetPaymentMethods;
const __resetInvoices = () => {
    invoices.length = 0;
    payments.length = 0;
    transactions.length = 0;
    paymentCounter = 1;
    invoiceCounter = 1;
    txnCounter = 1;
    for (const key of Object.keys(idem))
        delete idem[key];
    auditLogs.length = 0;
    auditCounter = 1;
    events.length = 0;
    registrations.length = 0;
    eventCounter = 1;
    regCounter = 1;
    receiptEvents.length = 0;
    emittedReceiptKeys.clear();
    members.length = 0;
    memberCounter = 1;
    membershipTypes.length = 0;
    invoiceSendEvents.length = 0;
    reminderEvents.length = 0;
};
exports.__resetInvoices = __resetInvoices;
const __seedInvoice = (tenantId, memberId, amount = 1000, currency = "USD", status = "unpaid") => {
    const invoice = { id: `inv-${invoiceCounter++}`, tenantId, memberId, amount, currency, status };
    invoices.push(invoice);
    return invoice;
};
exports.__seedInvoice = __seedInvoice;
const __getAuditLogs = () => auditLogs;
exports.__getAuditLogs = __getAuditLogs;
const __seedEvent = (tenantId, feeAmount = 1000, currency = "USD", status = "open") => {
    const ev = { id: `evt-${eventCounter++}`, tenantId, status, feeAmount, currency };
    events.push(ev);
    return ev;
};
exports.__seedEvent = __seedEvent;
const __seedRegistration = (tenantId, eventId, memberId, status = "pending") => {
    const reg = { id: `reg-${regCounter++}`, tenantId, eventId, memberId, status };
    registrations.push(reg);
    return reg;
};
exports.__seedRegistration = __seedRegistration;
const __getReceiptEvents = () => receiptEvents;
exports.__getReceiptEvents = __getReceiptEvents;
const __getInvoiceSendEvents = () => invoiceSendEvents;
exports.__getInvoiceSendEvents = __getInvoiceSendEvents;
const __getReminderEvents = () => reminderEvents;
exports.__getReminderEvents = __getReminderEvents;
const __seedMember = (tenantId, id) => {
    const memberId = id || `m-${memberCounter++}`;
    members.push({ id: memberId, tenantId, status: "active", email: `${memberId}@example.com` });
    return memberId;
};
exports.__seedMember = __seedMember;
const __setMemberStatus = (memberId, status) => {
    const m = members.find((m) => m.id === memberId);
    if (m)
        m.status = status;
};
exports.__setMemberStatus = __setMemberStatus;
const __assignMembershipType = (memberId, membershipTypeId) => {
    const m = members.find((m) => m.id === memberId);
    if (m)
        m.membershipTypeId = membershipTypeId;
};
exports.__assignMembershipType = __assignMembershipType;
const __seedMembershipType = (tenantId, amount, currency = "USD", id) => {
    const mtId = id || `mt-${membershipTypes.length + 1}`;
    membershipTypes.push({ id: mtId, tenantId, amount, currency });
    return mtId;
};
exports.__seedMembershipType = __seedMembershipType;
