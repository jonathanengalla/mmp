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
const handlers_1 = require("../../membership-service/src/handlers");
// Import billing handlers directly
const handlers_2 = require("../../payments-billing-service/src/handlers");
const eventsHandlers_1 = require("./eventsHandlers");
const app = (0, express_1.default)();
// Allow cross-origin for dev
app.use((0, cors_1.default)());
// Parse JSON request bodies
app.use(express_1.default.json());
// Also parse URL-encoded form bodies (in case the client sends form data)
app.use(express_1.default.urlencoded({ extended: true }));
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
// Mount auth routes
app.use("/auth", routes_1.default);
// Build membership routes inline
const membershipRouter = (0, express_1.Router)();
// Registration and verification routes
membershipRouter.post("/members/registrations", handlers_1.createRegistration);
membershipRouter.post("/registrations", handlers_1.createRegistration);
membershipRouter.post("/registrations/:token/verify", handlers_1.verify);
membershipRouter.post("/members/verify-request", handlers_1.requestVerification);
membershipRouter.post("/members/verify", handlers_1.verify);
// Admin routes
membershipRouter.get("/members/pending", handlers_1.listPendingMembers);
membershipRouter.post("/members/admin", handlers_1.createMemberAdmin);
// Custom fields schema routes
membershipRouter.get("/custom-fields/profile-schema", handlers_1.getProfileCustomFieldSchema);
membershipRouter.put("/custom-fields/profile-schema", handlers_1.updateProfileCustomFieldSchema);
//---------------------------------------------------------------
// MEMBERSHIP ROUTES - ORDER MATTERS: "me" routes before ":id"
//---------------------------------------------------------------
// Current member routes (must be before :id routes)
membershipRouter.get("/members/me", handlers_1.getCurrentMember);
membershipRouter.patch("/members/me", handlers_1.updateCurrentMember);
membershipRouter.patch("/members/me/avatar", handlers_1.updateMyAvatar);
membershipRouter.get("/members/me/custom-fields", handlers_1.getCurrentMemberCustomFields);
membershipRouter.patch("/members/me/custom-fields", handlers_1.updateCurrentMemberCustomFields);
membershipRouter.get("/members/me/payment-methods", handlers_1.getMemberPaymentMethods);
membershipRouter.post("/members/me/payment-methods", handlers_1.createMemberPaymentMethod);
// Search and list
membershipRouter.get("/members/search", handlers_1.searchDirectoryMembers);
membershipRouter.get("/members", handlers_1.listMembers);
membershipRouter.post("/members", handlers_1.createMember);
membershipRouter.post("/members/import", handlers_1.importMembers);
// Admin member management by ID (these come AFTER "me" routes)
membershipRouter.patch("/members/:id/avatar", handlers_1.adminUpdateAvatar);
membershipRouter.get("/members/:id/custom-fields", handlers_1.adminGetMemberCustomFields);
membershipRouter.patch("/members/:id/custom-fields", handlers_1.adminUpdateMemberCustomFields);
membershipRouter.get("/members/:id", handlers_1.getMember);
membershipRouter.post("/members/:id/approve", handlers_1.approveMember);
membershipRouter.post("/members/:id/reject", handlers_1.rejectMember);
membershipRouter.patch("/members/:id", handlers_1.updateMemberContact);
membershipRouter.post("/members/:id/photo", handlers_1.uploadPhoto);
membershipRouter.post("/members/:id/deactivate", handlers_1.deactivateMember);
membershipRouter.put("/members/:id/roles", handlers_1.updateMemberRoles);
membershipRouter.get("/members/:id/audit", handlers_1.auditMember);
//---------------------------------------------------------------
app.use("/membership", membershipRouter);
// Build billing routes inline
const billingRouter = (0, express_1.Router)();
billingRouter.post("/payment-methods", handlers_2.createPaymentMethod);
billingRouter.get("/payment-methods", handlers_2.listPaymentMethods);
billingRouter.post("/payments", handlers_2.createPayment);
billingRouter.post("/invoices/:id/mark-paid", handlers_2.markInvoicePaid);
billingRouter.post("/events/:id/pay", handlers_2.payEventFee);
billingRouter.post("/invoices", handlers_2.createManualInvoice);
billingRouter.get("/invoices", handlers_2.listMemberInvoices);
billingRouter.post("/internal/dues/run", handlers_2.runDuesJob);
billingRouter.post("/invoices/:id/send", handlers_2.sendInvoice);
billingRouter.get("/invoices/:id/pdf", handlers_2.downloadInvoicePdf);
billingRouter.post("/internal/payment-reminders/run", handlers_2.runPaymentReminders);
app.use("/billing", billingRouter);
// Events routes (in-memory dev implementation)
const eventsRouter = (0, express_1.Router)();
eventsRouter.get("/events/upcoming", eventsHandlers_1.listUpcomingEventsHandler);
eventsRouter.post("/events", eventsHandlers_1.createEventHandler);
eventsRouter.post("/events/:id/publish", eventsHandlers_1.publishEventHandler);
eventsRouter.patch("/events/:id/capacity", eventsHandlers_1.updateCapacityHandler);
eventsRouter.patch("/events/:id/pricing", eventsHandlers_1.updatePricingHandler);
eventsRouter.post("/events/:id/register", eventsHandlers_1.registerEventHandler);
eventsRouter.delete("/events/:id/register", eventsHandlers_1.cancelRegistrationHandler);
eventsRouter.get("/reporting/reports/events/attendance", eventsHandlers_1.eventsAttendanceReportHandler);
app.use("/", eventsRouter);
app.use("/api", eventsRouter);
const port = process.env.PORT || 3001;
// Seed dev data for local testing
(0, store_1.seedDevUser)().then(() => {
    console.log("[dev-server] Auth dev user seeded");
});
(0, handlers_1.__seedDevMember)();
app.listen(port, () => {
    console.log(`[dev-server] listening on http://localhost:${port}`);
    console.log(`[dev-server] Routes: /auth, /membership, /billing`);
});
exports.default = app;
