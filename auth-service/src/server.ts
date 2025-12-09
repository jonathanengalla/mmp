import express, { Router } from "express";
import cors from "cors";
import routes from "./routes";
import { authMiddleware } from "./authMiddleware";
import { requireAnyRole, requireRole } from "./rbac";

// Local reporting stub (501)
const reportingRoutes = Router();
reportingRoutes.use((_req, res) => {
  console.warn("[reporting] Stub route hit; reporting-service not implemented yet.");
  return res.status(501).json({ error: "Reporting not implemented yet" });
});

// Local stub billing helpers (until real billing is reintroduced)
const billingHandlers = {
  recordInvoicePaymentHandler: (_req: express.Request, res: express.Response) => {
    console.warn("[billingHandlers] recordInvoicePaymentHandler stub hit; billing not implemented yet");
    return res.status(501).json({ error: "Billing not implemented yet" });
  },
  createDuesRunHandler: (_req: express.Request, res: express.Response) => {
    console.warn("[billingHandlers] createDuesRunHandler stub hit; billing not implemented yet");
    return res.status(501).json({ error: "Billing not implemented yet" });
  },
  listDuesSummaryHandler: (_req: express.Request, res: express.Response) => {
    console.warn("[billingHandlers] listDuesSummaryHandler stub hit; billing not implemented yet");
    return res.status(501).json({ error: "Billing not implemented yet" });
  },
};

// Membership stubs (501) — removes cross-service dependency on membership-service
const membershipHandlers = {
  createRegistration: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] createRegistration stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  requestVerification: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] requestVerification stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  verify: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] verify stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  listMembers: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] listMembers stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  listPendingMembers: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] listPendingMembers stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  createMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] createMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  createMemberAdmin: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] createMemberAdmin stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  getMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] getMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  getCurrentMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] getCurrentMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  updateCurrentMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] updateCurrentMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  approveMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] approveMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  rejectMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] rejectMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  updateMemberContact: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] updateMemberContact stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  uploadPhoto: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] uploadPhoto stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  searchDirectoryMembers: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] searchDirectoryMembers stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  deactivateMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] deactivateMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  updateMemberRoles: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] updateMemberRoles stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  updateMyAvatar: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] updateMyAvatar stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  adminUpdateAvatar: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] adminUpdateAvatar stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  importMembers: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] importMembers stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  auditMember: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] auditMember stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  getMemberPaymentMethods: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] getMemberPaymentMethods stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  createMemberPaymentMethod: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] createMemberPaymentMethod stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  getProfileCustomFieldSchema: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] getProfileCustomFieldSchema stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  updateProfileCustomFieldSchema: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] updateProfileCustomFieldSchema stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  getCurrentMemberCustomFields: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] getCurrentMemberCustomFields stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  updateCurrentMemberCustomFields: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] updateCurrentMemberCustomFields stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  adminGetMemberCustomFields: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] adminGetMemberCustomFields stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  adminUpdateMemberCustomFields: (_req: express.Request, res: express.Response) => {
    console.warn("[membership] adminUpdateMemberCustomFields stub hit; membership-service not implemented yet.");
    return res.status(501).json({ error: "Membership not implemented yet" });
  },
  __seedDevMember: () => {
    console.warn("[membership] __seedDevMember stub hit; membership-service not implemented yet.");
    return null;
  },
};
const {
  createRegistration,
  requestVerification,
  verify,
  listMembers,
  listPendingMembers,
  createMember,
  createMemberAdmin,
  getMember,
  getCurrentMember,
  updateCurrentMember,
  approveMember,
  rejectMember,
  updateMemberContact,
  uploadPhoto,
  searchDirectoryMembers,
  deactivateMember,
  updateMemberRoles,
  updateMyAvatar,
  adminUpdateAvatar,
  importMembers,
  auditMember,
  getMemberPaymentMethods,
  createMemberPaymentMethod,
  getProfileCustomFieldSchema,
  updateProfileCustomFieldSchema,
  getCurrentMemberCustomFields,
  updateCurrentMemberCustomFields,
  adminGetMemberCustomFields,
  adminUpdateMemberCustomFields,
  __seedDevMember,
} = membershipHandlers;

// Import billing handlers via require to avoid TS dependency on sibling service types
const paymentsBillingHandlers = {
  createPaymentMethod: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] createPaymentMethod stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  listPaymentMethods: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] listPaymentMethods stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  createPayment: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] createPayment stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  markInvoicePaid: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] markInvoicePaid stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  payEventFee: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] payEventFee stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  createManualInvoice: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] createManualInvoice stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  runDuesJob: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] runDuesJob stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  sendInvoice: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] sendInvoice stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  listMemberInvoices: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] listMemberInvoices stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  downloadInvoicePdf: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] downloadInvoicePdf stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
  runPaymentReminders: (_req: express.Request, res: express.Response) => {
    console.warn("[payments-billing] runPaymentReminders stub hit; payments-billing-service not implemented yet.");
    return res.status(501).json({ error: "Payments/Billing not implemented yet" });
  },
};

const {
  recordInvoicePaymentHandler,
  createDuesRunHandler,
  listDuesSummaryHandler,
} = billingHandlers;
import { emailLogHandler } from "./notifications/emailSender";
import {
  cancelRegistrationHandler,
  createEventHandler,
  eventCheckoutHandler,
  getEventDetailHandler,
  eventsAttendanceReportHandler,
  listUpcomingEventsHandler,
  publishEventHandler,
  registerEventHandler,
  updateCapacityHandler,
  updatePricingHandler,
  updateEventBannerHandler,
  updateEventTagsHandler,
  updateEventRegistrationModeHandler,
  updateEventBasicsHandler,
  checkInByCodeHandler,
  listEventsHandler,
  listMyInvoicesHandler,
} from "./eventsHandlers";

const app = express();

// Allow cross-origin for dev
app.use(cors());

// Parse request bodies with a higher limit to support banner uploads
const BODY_LIMIT = process.env.BODY_LIMIT || "10mb";
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

// -----------------------------------------------------
// Health Check Endpoints (for Render + Smoke Test)
// -----------------------------------------------------
app.get("/health", (req, res) => {
  console.log("[health] Basic health check hit");
  res.status(200).json({ status: "ok", service: "auth-service" });
});

app.get("/auth/health", (req, res) => {
  console.log("[auth-health] Auth namespace health check hit");
  res.status(200).json({ status: "ok", service: "auth-service", scope: "auth" });
});

// Apply auth middleware to all protected routes (public: /health, /auth/health, /auth/login, /auth/register)
app.use(authMiddleware);

const requireAdmin = requireRole("ADMIN");
const requireOfficerOrAdmin = requireAnyRole(["ADMIN", "OFFICER"]);
const requireMemberOrHigher = requireAnyRole(["ADMIN", "OFFICER", "MEMBER"]);

// Mount auth routes
app.use("/auth", routes);

// Build membership routes inline
const membershipRouter = Router();
membershipRouter.use(requireMemberOrHigher);

// Registration and verification routes
membershipRouter.post("/members/registrations", createRegistration);
membershipRouter.post("/registrations", createRegistration);
membershipRouter.post("/registrations/:token/verify", verify);
membershipRouter.post("/members/verify-request", requestVerification);
membershipRouter.post("/members/verify", verify);

// Admin routes
membershipRouter.get("/members/pending", requireOfficerOrAdmin, listPendingMembers);
membershipRouter.post("/members/admin", requireAdmin, createMemberAdmin);

// Custom fields schema routes
membershipRouter.get("/custom-fields/profile-schema", requireOfficerOrAdmin, getProfileCustomFieldSchema);
membershipRouter.put("/custom-fields/profile-schema", requireOfficerOrAdmin, updateProfileCustomFieldSchema);

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
membershipRouter.get("/members/search", requireOfficerOrAdmin, searchDirectoryMembers);
membershipRouter.get("/members", requireOfficerOrAdmin, listMembers);
membershipRouter.post("/members", requireOfficerOrAdmin, createMember);
membershipRouter.post("/members/import", requireOfficerOrAdmin, importMembers);

// Admin member management by ID (these come AFTER "me" routes)
membershipRouter.patch("/members/:id/avatar", requireAdmin, adminUpdateAvatar);
membershipRouter.get("/members/:id/custom-fields", requireAdmin, adminGetMemberCustomFields);
membershipRouter.patch("/members/:id/custom-fields", requireAdmin, adminUpdateMemberCustomFields);
membershipRouter.get("/members/:id", requireOfficerOrAdmin, getMember);
membershipRouter.post("/members/:id/approve", requireAdmin, approveMember);
membershipRouter.post("/members/:id/reject", requireAdmin, rejectMember);
membershipRouter.patch("/members/:id", requireOfficerOrAdmin, updateMemberContact);
membershipRouter.post("/members/:id/photo", requireOfficerOrAdmin, uploadPhoto);
membershipRouter.post("/members/:id/deactivate", requireAdmin, deactivateMember);
membershipRouter.put("/members/:id/roles", requireAdmin, updateMemberRoles);
membershipRouter.get("/members/:id/audit", requireAdmin, auditMember);
//---------------------------------------------------------------

app.use("/membership", membershipRouter);

// Build billing routes inline
const billingRouter = Router();
billingRouter.use(requireAdmin);
billingRouter.post("/payment-methods", paymentsBillingHandlers.createPaymentMethod);
billingRouter.get("/payment-methods", paymentsBillingHandlers.listPaymentMethods);
billingRouter.post("/payments", paymentsBillingHandlers.createPayment);
billingRouter.post("/invoices/:id/mark-paid", paymentsBillingHandlers.markInvoicePaid);
billingRouter.post("/events/:id/pay", paymentsBillingHandlers.payEventFee);
billingRouter.post("/invoices", paymentsBillingHandlers.createManualInvoice);
billingRouter.get("/invoices", paymentsBillingHandlers.listMemberInvoices);
billingRouter.post("/internal/dues/run", paymentsBillingHandlers.runDuesJob);
billingRouter.post("/invoices/:id/send", paymentsBillingHandlers.sendInvoice);
billingRouter.get("/invoices/:id/pdf", paymentsBillingHandlers.downloadInvoicePdf);
billingRouter.post("/internal/payment-reminders/run", paymentsBillingHandlers.runPaymentReminders);
billingRouter.post("/billing/dues/runs", requireAdmin, createDuesRunHandler);
billingRouter.get("/billing/dues/summary", requireAdmin, listDuesSummaryHandler);
app.use("/billing", billingRouter);

const invoicesRouter = Router();
invoicesRouter.get("/invoices/me", requireMemberOrHigher, listMyInvoicesHandler);
invoicesRouter.post("/invoices/:id/record-payment", requireAdmin, recordInvoicePaymentHandler);
app.use("/", invoicesRouter);
app.use("/api", invoicesRouter);
app.get("/dev/email-log", emailLogHandler);
app.get("/api/dev/email-log", emailLogHandler);

// Events routes (in-memory dev implementation)
const eventsRouter = Router();
eventsRouter.get("/events/upcoming", listUpcomingEventsHandler);
eventsRouter.get("/events", listEventsHandler);
eventsRouter.post("/events/:id/checkout", eventCheckoutHandler);
eventsRouter.get("/events/slug/:slug", getEventDetailHandler);
eventsRouter.get("/events/:id", getEventDetailHandler);
eventsRouter.post("/events", createEventHandler);
eventsRouter.post("/events/:id/publish", publishEventHandler);
eventsRouter.patch("/events/:id", updateEventBasicsHandler);
eventsRouter.patch("/events/:id/capacity", updateCapacityHandler);
eventsRouter.patch("/events/:id/pricing", updatePricingHandler);
eventsRouter.patch("/events/:id/banner", updateEventBannerHandler);
eventsRouter.patch("/events/:id/tags", updateEventTagsHandler);
eventsRouter.patch("/events/:id/registration-mode", updateEventRegistrationModeHandler);
eventsRouter.post("/events/:id/register", registerEventHandler);
eventsRouter.delete("/events/:id/register", cancelRegistrationHandler);
eventsRouter.get("/reporting/reports/events/attendance", eventsAttendanceReportHandler);
eventsRouter.post("/events/checkin", checkInByCodeHandler);
app.use("/", eventsRouter);
app.use("/api", eventsRouter);

// Reporting routes (admin-protected)
app.use("/reporting", reportingRoutes);
app.use("/api/reporting", reportingRoutes);

const port = process.env.PORT || 3001;

__seedDevMember();

app.listen(port, () => {
  console.log(`[dev-server] listening on http://localhost:${port}`);
  console.log(`[dev-server] Routes: /auth, /membership, /billing, /reporting`);
});

export default app;