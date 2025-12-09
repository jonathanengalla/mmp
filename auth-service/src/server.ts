import express, { Router } from "express";
import cors from "cors";
import routes from "./routes";
import { seedDevUser } from "./store";
// Reporting routes
// eslint-disable-next-line @typescript-eslint/no-var-requires
const reportingRoutes = require("../../services/reporting-service/src/routes").default;

// Guarded billing handlers import (stubbed if missing)
let billingHandlers: any;
try {
  // Path relative to this file; adjust if relocated
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  billingHandlers = require("./billingHandlers");
} catch (err) {
  console.warn(
    "[billing] Handlers module not found, using stub implementations (501).",
    (err as Error)?.message ?? err
  );

  const stub = (req: any, res: any) => res.status(501).json({ error: "Billing not implemented" });
  billingHandlers = {
    createInvoice: stub,
    getInvoice: stub,
    recordInvoicePaymentHandler: stub,
    createDuesRunHandler: stub,
    listDuesSummaryHandler: stub,
  };
}

// Import membership handlers directly (not routes, to avoid express resolution issue)
// Import membership handlers via require to avoid TS dependency on sibling service types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const membershipHandlers = require("../../membership-service/src/handlers");
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const billingHandlersFromPayments = require("../../payments-billing-service/src/handlers");
const {
  createPaymentMethod,
  listPaymentMethods,
  createPayment,
  markInvoicePaid,
  payEventFee,
  createManualInvoice,
  runDuesJob,
  sendInvoice,
  listMemberInvoices,
  downloadInvoicePdf,
  runPaymentReminders,
} = billingHandlersFromPayments;

const {
  recordInvoicePaymentHandler = billingHandlers.recordInvoicePaymentHandler,
  createDuesRunHandler = billingHandlers.createDuesRunHandler,
  listDuesSummaryHandler = billingHandlers.listDuesSummaryHandler,
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

// Auth middleware that attaches user context for protected routes
const authMiddleware = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    // For dev mode, decode the token or use a simple dev context
    // In real production, verify JWT and extract user info
    const token = authHeader.slice("Bearer ".length);
    if (token) {
      // Dev mode: set a basic user context matching the seeded dev member
      (req as any).user = {
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

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const roles: string[] = ((req as any).user?.roles as string[]) || [];
  if (roles.includes("admin") || roles.includes("finance_manager")) {
    return next();
  }
  return res.status(403).json({ error: { message: "Admin only" } });
};

// Mount auth routes
app.use("/auth", routes);

// Build membership routes inline
const membershipRouter = Router();

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
const billingRouter = Router();
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
billingRouter.post("/billing/dues/runs", requireAdmin, createDuesRunHandler);
billingRouter.get("/billing/dues/summary", requireAdmin, listDuesSummaryHandler);
app.use("/billing", billingRouter);

const invoicesRouter = Router();
invoicesRouter.get("/invoices/me", listMyInvoicesHandler);
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

// Seed dev data for local testing
seedDevUser().then(() => {
  console.log("[dev-server] Auth dev user seeded");
});
__seedDevMember();

app.listen(port, () => {
  console.log(`[dev-server] listening on http://localhost:${port}`);
  console.log(`[dev-server] Routes: /auth, /membership, /billing, /reporting`);
});

export default app;