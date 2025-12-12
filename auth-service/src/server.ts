import express, { Router } from "express";
import cors from "cors";
import routes from "./routes";
import { authMiddleware } from "./authMiddleware";
import { requireAnyRole, requireRole } from "./rbac";
import {
  approveMember,
  createRegistration,
  getCurrentMember,
  getMember,
  listMembers,
  listPendingMembers,
  requestVerification,
  searchDirectoryMembers,
  rejectMember,
  verify,
  getProfileCustomFieldSchema,
  getCurrentMemberCustomFields,
  getMemberPaymentMethods,
  createMemberPaymentMethod,
  deleteMemberPaymentMethod,
  updateMyAvatar,
  uploadPhoto,
  updateCurrentMember,
  updateMemberContact,
  updateMemberRoles,
  deactivateMemberAccount,
  adminUpdateAvatar,
  importMembersPlaceholder,
  auditMemberPlaceholder,
  updateProfileCustomFieldSchema,
  updateCurrentMemberCustomFields,
  adminGetMemberCustomFields,
  adminUpdateMemberCustomFields,
  getMembershipAdminSummary,
  getMembershipSelfSummary,
} from "./membershipHandlers";
import {
  createManualInvoiceHandler,
  createPaymentHandler,
  createPaymentMethodHandler,
  downloadInvoicePdfHandler,
  listMemberInvoicesHandler,
  listPaymentMethodsHandler,
  payEventFeeHandler,
  recordInvoicePaymentHandler,
  runDuesJobHandler,
  runPaymentRemindersHandler,
  sendInvoiceHandler,
  listTenantInvoicesPaginatedHandler,
  getFinanceSummaryHandler,
} from "./billingHandlers";
import { listMembersReport } from "./reportingHandlers";

// Membership helpers
const membershipStub = (label: string) => (_req: express.Request, res: express.Response) => {
  console.warn(`[membership] ${label} stub hit; not implemented in BKS-03 scope.`);
  return res.status(501).json({ error: "Membership not implemented yet" });
};
const createMember = createRegistration;
const createMemberAdmin = createRegistration;
const __seedDevMember = () => null;
const duesStub = (label: string) => (_req: express.Request, res: express.Response) => {
  console.warn(`[billing] ${label} stub hit; not implemented in BKS-04 scope.`);
  return res.status(501).json({ error: "Billing not implemented yet" });
};
const createDuesRunHandler = duesStub("createDuesRunHandler");
const listDuesSummaryHandler = duesStub("listDuesSummaryHandler");
import { emailLogHandler } from "./notifications/emailSender";
import {
  cancelRegistrationHandler,
  createEventHandler,
  eventCheckoutHandler,
  getEventDetailHandler,
  eventsAttendanceReportHandler,
  deleteEventHandler,
  cancelEventHandler,
  updateEventWithCapacityHandler,
  listAdminEventsHandler,
  listUpcomingEventsHandler,
  publishEventHandler,
  registerEventHandler,
  updateCapacityHandler,
  updatePricingHandler,
  updateEventBannerHandler,
  uploadEventBannerHandler,
  updateEventTagsHandler,
  updateEventRegistrationModeHandler,
  updateEventBasicsHandler,
  checkInByCodeHandler,
  listEventsHandler,
  listMyInvoicesHandler,
  getEventsAdminSummary,
  getEventsSelfSummary,
} from "./eventsHandlers";
import * as attendanceHandlers from "./attendanceHandlers";

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
const requireEventManagerOrAdmin = requireAnyRole(["ADMIN", "EVENT_MANAGER", "OFFICER"]);
const requireAdminOrFinance = requireAnyRole(["ADMIN", "OFFICER", "FINANCE_MANAGER"]);
const requireMembershipSummaryAdmin = requireAnyRole([
  "ADMIN",
  "FINANCE_MANAGER",
  "EVENT_MANAGER",
  "COMMUNICATIONS_MANAGER",
  "SUPER_ADMIN",
]);
const requireEventsSummaryAdmin = requireAnyRole(["ADMIN", "EVENT_MANAGER", "FINANCE_MANAGER", "SUPER_ADMIN"]);

// Reporting routes (after guards are defined)
const reportingRoutes = Router();
reportingRoutes.get("/reports/members", requireAdmin, listMembersReport);

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
membershipRouter.get("/admin/summary", requireMembershipSummaryAdmin, getMembershipAdminSummary);
membershipRouter.get("/me/summary", requireMemberOrHigher, getMembershipSelfSummary);

// Admin routes
membershipRouter.get("/members/pending", requireOfficerOrAdmin, listPendingMembers);
membershipRouter.post("/members/admin", requireAdmin, createMemberAdmin);

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
membershipRouter.delete("/members/me/payment-methods/:id", deleteMemberPaymentMethod);

// Search and list
membershipRouter.get("/members/search", requireOfficerOrAdmin, searchDirectoryMembers);
membershipRouter.get("/members", requireOfficerOrAdmin, listMembers);
membershipRouter.post("/members", requireOfficerOrAdmin, createMember);
membershipRouter.post("/members/import", requireOfficerOrAdmin, importMembersPlaceholder);

// Admin member management by ID (these come AFTER "me" routes)
membershipRouter.patch("/members/:id/avatar", requireAdmin, adminUpdateAvatar);
membershipRouter.get("/members/:id/custom-fields", requireAdmin, adminGetMemberCustomFields);
membershipRouter.patch("/members/:id/custom-fields", requireAdmin, adminUpdateMemberCustomFields);
membershipRouter.get("/members/:id", requireOfficerOrAdmin, getMember);
membershipRouter.post("/members/:id/approve", requireAdmin, approveMember);
membershipRouter.post("/members/:id/reject", requireAdmin, rejectMember);
membershipRouter.patch("/members/:id", requireOfficerOrAdmin, updateMemberContact);
membershipRouter.post("/members/:id/photo", requireOfficerOrAdmin, uploadPhoto);
membershipRouter.post("/members/:id/deactivate", requireAdmin, deactivateMemberAccount);
membershipRouter.put("/members/:id/roles", requireAdmin, updateMemberRoles);
membershipRouter.get("/members/:id/audit", requireAdmin, auditMemberPlaceholder);
//---------------------------------------------------------------

app.use("/membership", membershipRouter);

// Build billing routes inline
const billingRouter = Router();

// Payment methods (member-facing, admin/officer can act on behalf via memberId)
billingRouter.post("/payment-methods", requireMemberOrHigher, createPaymentMethodHandler);
billingRouter.get("/payment-methods", requireMemberOrHigher, listPaymentMethodsHandler);

// Payments and invoices
billingRouter.post("/payments", requireMemberOrHigher, createPaymentHandler);
billingRouter.post("/invoices/:id/mark-paid", requireOfficerOrAdmin, recordInvoicePaymentHandler);
billingRouter.post("/invoices", requireOfficerOrAdmin, createManualInvoiceHandler);
billingRouter.get("/invoices", requireMemberOrHigher, listMemberInvoicesHandler);
billingRouter.get("/invoices/tenant", requireAdminOrFinance, listTenantInvoicesPaginatedHandler);
billingRouter.get("/admin/finance/summary", requireAdminOrFinance, getFinanceSummaryHandler);

// Out-of-scope stubs
billingRouter.post("/events/:id/pay", payEventFeeHandler);
billingRouter.post("/internal/dues/run", runDuesJobHandler);
billingRouter.post("/invoices/:id/send", sendInvoiceHandler);
billingRouter.get("/invoices/:id/pdf", downloadInvoicePdfHandler);
billingRouter.post("/internal/payment-reminders/run", runPaymentRemindersHandler);
billingRouter.post("/billing/dues/runs", requireAdmin, createDuesRunHandler);
billingRouter.get("/billing/dues/summary", requireAdmin, listDuesSummaryHandler);
app.use("/billing", billingRouter);

const invoicesRouter = Router();
invoicesRouter.get("/invoices/me", requireMemberOrHigher, listMyInvoicesHandler);
invoicesRouter.post("/invoices/:id/record-payment", requireOfficerOrAdmin, recordInvoicePaymentHandler);
app.use("/", invoicesRouter);
app.use("/api", invoicesRouter);
app.get("/dev/email-log", requireAdmin, emailLogHandler);
app.get("/api/dev/email-log", requireAdmin, emailLogHandler);

// Events routes (in-memory dev implementation)
const eventsRouter = Router();
eventsRouter.use(requireMemberOrHigher);
eventsRouter.get("/events/admin/summary", requireEventsSummaryAdmin, getEventsAdminSummary);
eventsRouter.get("/events/me/summary", getEventsSelfSummary);
eventsRouter.get("/events/upcoming", listUpcomingEventsHandler);
eventsRouter.get("/events", listEventsHandler);
eventsRouter.get("/admin/events", requireEventManagerOrAdmin, listAdminEventsHandler);
eventsRouter.delete("/admin/events/:eventId", requireEventManagerOrAdmin, deleteEventHandler);
eventsRouter.post("/admin/events/:eventId/cancel", requireEventManagerOrAdmin, cancelEventHandler);
eventsRouter.put("/admin/events/:eventId", requireEventManagerOrAdmin, updateEventWithCapacityHandler);
eventsRouter.post("/events/:id/checkout", eventCheckoutHandler);
eventsRouter.get("/events/slug/:slug", getEventDetailHandler);
eventsRouter.get("/events/:id", getEventDetailHandler);
eventsRouter.post("/events", requireEventManagerOrAdmin, createEventHandler);
eventsRouter.post("/events/:id/publish", requireEventManagerOrAdmin, publishEventHandler);
eventsRouter.patch("/events/:id", requireEventManagerOrAdmin, updateEventBasicsHandler);
eventsRouter.patch("/events/:id/capacity", requireEventManagerOrAdmin, updateCapacityHandler);
eventsRouter.patch("/events/:id/pricing", requireEventManagerOrAdmin, updatePricingHandler);
eventsRouter.patch("/events/:id/banner", requireEventManagerOrAdmin, updateEventBannerHandler);
eventsRouter.post("/events/:id/banner/upload", requireEventManagerOrAdmin, uploadEventBannerHandler);
eventsRouter.patch("/events/:id/tags", requireEventManagerOrAdmin, updateEventTagsHandler);
eventsRouter.patch("/events/:id/registration-mode", requireEventManagerOrAdmin, updateEventRegistrationModeHandler);
eventsRouter.post("/events/:id/register", registerEventHandler);
eventsRouter.delete("/events/:id/register", cancelRegistrationHandler);
eventsRouter.get("/reporting/reports/events/attendance", requireEventManagerOrAdmin, eventsAttendanceReportHandler);
eventsRouter.post("/events/checkin", requireEventManagerOrAdmin, checkInByCodeHandler);
eventsRouter.post("/admin/attendance/:registrationId/mark", requireEventManagerOrAdmin, attendanceHandlers.markAttendance);
eventsRouter.post("/admin/attendance/:registrationId/undo", requireEventManagerOrAdmin, attendanceHandlers.undoAttendance);
eventsRouter.post("/admin/attendance/bulk-mark", requireEventManagerOrAdmin, attendanceHandlers.bulkMarkAttendance);
eventsRouter.get("/admin/events/:eventId/attendance", requireEventManagerOrAdmin, attendanceHandlers.getAttendanceReport);
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