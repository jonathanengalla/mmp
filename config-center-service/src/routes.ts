import { Router } from "express";
import {
  getOrgProfile,
  updateOrgProfile,
  createMembershipType,
  listMembershipTypes,
  updateMembershipType,
  getApprovalWorkflow,
  updateApprovalWorkflow,
  addProfileField,
  listProfileFields,
  createPaymentCategory,
  listPaymentCategories,
  updatePaymentCategory,
  getInvoiceTemplate,
  updateInvoiceTemplate,
  getFeatureFlags,
  updateFeatureFlags,
  setFeatureFlag,
  listFeatureFlags,
  createEmailTemplate,
  listEmailTemplates,
  setReminderSchedule,
  configureInvoiceTemplate,
  configureDuesRules,
  configureGateway,
  setEventDefaults,
  createProjectTemplate,
  listProjectTemplates,
  setDirectoryVisibility,
  createRole,
  listRoles,
  updateRole,
  setMfaPolicy,
  health,
  status,
} from "./handlers";

const router = Router();

// Org profile
router.get("/org-profile", getOrgProfile);
router.patch("/org-profile", updateOrgProfile);

// Membership config
router.post("/membership-types", createMembershipType);
router.get("/membership-types", listMembershipTypes);
router.patch("/membership-types/:id", updateMembershipType);
router.get("/approval-workflow", getApprovalWorkflow);
router.patch("/approval-workflow", updateApprovalWorkflow);
router.post("/profile-fields", addProfileField);
router.get("/profile-fields", listProfileFields);

// Payments & billing config
router.post("/payment-categories", createPaymentCategory);
router.get("/payment-categories", listPaymentCategories);
router.patch("/payment-categories/:id", updatePaymentCategory);
router.get("/invoice-template", getInvoiceTemplate);
router.patch("/invoice-template", updateInvoiceTemplate);
router.get("/feature-flags", getFeatureFlags);
router.patch("/feature-flags", updateFeatureFlags);
router.post("/dues-rules", configureDuesRules);
router.post("/payment-gateways", configureGateway);

// Feature flags
router.post("/feature-flags", setFeatureFlag);
router.get("/feature-flags", listFeatureFlags);

// Communications settings
router.post("/email-senders", setReminderSchedule); // placeholder
router.post("/reminder-schedules", setReminderSchedule);
router.post("/email-templates", createEmailTemplate);
router.get("/email-templates", listEmailTemplates);

// Events & projects defaults
router.post("/event-defaults", setEventDefaults);
router.post("/project-templates", createProjectTemplate);
router.get("/project-templates", listProjectTemplates);

// Directory & security
router.post("/directory-visibility", setDirectoryVisibility);
router.post("/roles", createRole);
router.get("/roles", listRoles);
router.patch("/roles/:id", updateRole);
router.post("/mfa-policy", setMfaPolicy);

// Health
router.get("/health", health);
router.get("/status", status);

export default router;

