"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const store_1 = require("./store");
// Import membership handlers directly (not routes, to avoid express resolution issue)
// Import membership handlers via require to avoid TS dependency on sibling service types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const membershipHandlers = require("../../membership-service/src/handlers");
const { createRegistration, requestVerification, verify, listMembers, listPendingMembers, createMember, createMemberAdmin, getMember, getCurrentMember, updateCurrentMember, approveMember, rejectMember, updateMemberContact, uploadPhoto, searchDirectoryMembers, deactivateMember, updateMemberRoles, updateMyAvatar, adminUpdateAvatar, importMembers, auditMember, getMemberPaymentMethods, createMemberPaymentMethod, getProfileCustomFieldSchema, updateProfileCustomFieldSchema, getCurrentMemberCustomFields, updateCurrentMemberCustomFields, adminGetMemberCustomFields, adminUpdateMemberCustomFields, __seedDevMember, } = membershipHandlers;
// Import billing handlers via require to avoid TS dependency on sibling service types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const billingHandlers = require("../../payments-billing-service/src/handlers");
const { createPaymentMethod, listPaymentMethods, createPayment, markInvoicePaid, payEventFee, createManualInvoice, runDuesJob, sendInvoice, listMemberInvoices, downloadInvoicePdf, runPaymentReminders, } = billingHandlers;
const billingHandlers_1 = require("./billingHandlers");
const emailSender_1 = require("./notifications/emailSender");
const eventsHandlers_1 = require("./eventsHandlers");
const app = (0, express_1.default)();
// Allow cross-origin for dev
app.use((0, cors_1.default)());
// Parse request bodies with a higher limit to support banner uploads
const BODY_LIMIT = process.env.BODY_LIMIT || "10mb";
app.use(express_1.default.json({ limit: BODY_LIMIT }));
app.use(express_1.default.urlencoded({ extended: true, limit: BODY_LIMIT }));
// Auth middleware that attaches user context for protected routes
const authMiddleware = (req, _res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        // For dev mode, decode the token or use a simple dev context
        // In real production, verify JWT and extract user info
        const token = authHeader.slice("Bearer ".length);
        if (token) {
            // Dev mode: set a basic user context matching the seeded dev member
            req.user = {
                userId: "dev-1",
                memberId: "m-dev",
                member_id: "m-dev",
                tenantId: "t1",
                roles: ["admin", "member"],
            };
        }
    }
    next();
};
// Apply auth middleware to all routes
app.use(authMiddleware);
const requireAdmin = (req, res, next) => {
    const roles = req.user?.roles || [];
    if (roles.includes("admin") || roles.includes("finance_manager")) {
        return next();
    }
    return res.status(403).json({ error: { message: "Admin only" } });
};
// Mount auth routes
app.use("/auth", routes_1.default);
// Build membership routes inline
const membershipRouter = (0, express_1.Router)();
// Registration and verification routes
membershipRouter.post("/members/registrations", createRegistration);
membershipRouter.post("/registrations", createRegistration);
membershipRouter.post("/registrations/:token/verify", verify);
membershipRouter.post("/members/verify-request", requestVerification);
membershipRouter.post("/members/verify", verify);
// Admin routes
membershipRouter.get("/members/pending", listPendingMembers);
membershipRouter.post("/members/admin", createMemberAdmin);
// Custom fields schema routes
membershipRouter.get("/custom-fields/profile-schema", getProfileCustomFieldSchema);
membershipRouter.put("/custom-fields/profile-schema", updateProfileCustomFieldSchema);
//---------------------------------------------------------------
// MEMBERSHIP ROUTES - ORDER MATTERS: "me" routes before ":id"
//---------------------------------------------------------------
// Current member routes (must be before :id routes)
membershipRouter.get("/members/me", getCurrentMember);
membershipRouter.patch("/members/me", updateCurrentMember);
membershipRouter.patch("/members/me/avatar", updateMyAvatar);
membershipRouter.get("/members/me/custom-fields", getCurrentMemberCustomFields);
membershipRouter.patch("/members/me/custom-fields", updateCurrentMemberCustomFields);
membershipRouter.get("/members/me/payment-methods", getMemberPaymentMethods);
membershipRouter.post("/members/me/payment-methods", createMemberPaymentMethod);
// Search and list
membershipRouter.get("/members/search", searchDirectoryMembers);
membershipRouter.get("/members", listMembers);
membershipRouter.post("/members", createMember);
membershipRouter.post("/members/import", importMembers);
// Admin member management by ID (these come AFTER "me" routes)
membershipRouter.patch("/members/:id/avatar", adminUpdateAvatar);
membershipRouter.get("/members/:id/custom-fields", adminGetMemberCustomFields);
membershipRouter.patch("/members/:id/custom-fields", adminUpdateMemberCustomFields);
membershipRouter.get("/members/:id", getMember);
membershipRouter.post("/members/:id/approve", approveMember);
membershipRouter.post("/members/:id/reject", rejectMember);
membershipRouter.patch("/members/:id", updateMemberContact);
membershipRouter.post("/members/:id/photo", uploadPhoto);
membershipRouter.post("/members/:id/deactivate", deactivateMember);
membershipRouter.put("/members/:id/roles", updateMemberRoles);
membershipRouter.get("/members/:id/audit", auditMember);
//---------------------------------------------------------------
app.use("/membership", membershipRouter);
// Build billing routes inline
const billingRouter = (0, express_1.Router)();
billingRouter.post("/payment-methods", createPaymentMethod);
billingRouter.get("/payment-methods", listPaymentMethods);
billingRouter.post("/payments", createPayment);
billingRouter.post("/invoices/:id/mark-paid", markInvoicePaid);
billingRouter.post("/events/:id/pay", payEventFee);
billingRouter.post("/invoices", createManualInvoice);
billingRouter.get("/invoices", listMemberInvoices);
billingRouter.post("/internal/dues/run", runDuesJob);
billingRouter.post("/invoices/:id/send", sendInvoice);
billingRouter.get("/invoices/:id/pdf", downloadInvoicePdf);
billingRouter.post("/internal/payment-reminders/run", runPaymentReminders);
billingRouter.post("/billing/dues/runs", requireAdmin, billingHandlers_1.createDuesRunHandler);
billingRouter.get("/billing/dues/summary", requireAdmin, billingHandlers_1.listDuesSummaryHandler);
app.use("/billing", billingRouter);
const invoicesRouter = (0, express_1.Router)();
invoicesRouter.get("/invoices/me", eventsHandlers_1.listMyInvoicesHandler);
invoicesRouter.post("/invoices/:id/record-payment", requireAdmin, billingHandlers_1.recordInvoicePaymentHandler);
app.use("/", invoicesRouter);
app.use("/api", invoicesRouter);
app.get("/dev/email-log", emailSender_1.emailLogHandler);
app.get("/api/dev/email-log", emailSender_1.emailLogHandler);
// Events routes (in-memory dev implementation)
const eventsRouter = (0, express_1.Router)();
eventsRouter.get("/events/upcoming", eventsHandlers_1.listUpcomingEventsHandler);
eventsRouter.get("/events", eventsHandlers_1.listEventsHandler);
eventsRouter.post("/events/:id/checkout", eventsHandlers_1.eventCheckoutHandler);
eventsRouter.get("/events/slug/:slug", eventsHandlers_1.getEventDetailHandler);
eventsRouter.get("/events/:id", eventsHandlers_1.getEventDetailHandler);
eventsRouter.post("/events", eventsHandlers_1.createEventHandler);
eventsRouter.post("/events/:id/publish", eventsHandlers_1.publishEventHandler);
eventsRouter.patch("/events/:id", eventsHandlers_1.updateEventBasicsHandler);
eventsRouter.patch("/events/:id/capacity", eventsHandlers_1.updateCapacityHandler);
eventsRouter.patch("/events/:id/pricing", eventsHandlers_1.updatePricingHandler);
eventsRouter.patch("/events/:id/banner", eventsHandlers_1.updateEventBannerHandler);
eventsRouter.patch("/events/:id/tags", eventsHandlers_1.updateEventTagsHandler);
eventsRouter.patch("/events/:id/registration-mode", eventsHandlers_1.updateEventRegistrationModeHandler);
eventsRouter.post("/events/:id/register", eventsHandlers_1.registerEventHandler);
eventsRouter.delete("/events/:id/register", eventsHandlers_1.cancelRegistrationHandler);
eventsRouter.get("/reporting/reports/events/attendance", eventsHandlers_1.eventsAttendanceReportHandler);
eventsRouter.post("/events/checkin", eventsHandlers_1.checkInByCodeHandler);
app.use("/", eventsRouter);
app.use("/api", eventsRouter);
const port = process.env.PORT || 3001;
// Seed dev data for local testing
(0, store_1.seedDevUser)().then(() => {
    console.log("[dev-server] Auth dev user seeded");
});
__seedDevMember();
app.listen(port, () => {
    console.log(`[dev-server] listening on http://localhost:${port}`);
    console.log(`[dev-server] Routes: /auth, /membership, /billing`);
});
exports.default = app;
