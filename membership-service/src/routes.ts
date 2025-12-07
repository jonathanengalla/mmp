import { Router } from "express";
import {
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
  updateMember,
  updateMemberContact,
  uploadPhoto,
  searchMembers,
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
  health,
  status,
} from "./handlers";

const router = Router();

// Public-ish (verify uses token)
router.post("/members/registrations", createRegistration);
// keep legacy path for compatibility
router.post("/registrations", createRegistration);
router.post("/registrations/:token/verify", verify);
router.post("/members/verify-request", requestVerification);
router.post("/members/verify", verify);

// Protected (placeholder: attach real auth middleware in app bootstrap)
router.get("/members/pending", listPendingMembers);

// Custom fields schema routes
router.get("/custom-fields/profile-schema", getProfileCustomFieldSchema);
router.put("/custom-fields/profile-schema", updateProfileCustomFieldSchema);

// Current member routes (must be before :id routes)
router.get("/members/me", getCurrentMember);
router.patch("/members/me", updateCurrentMember);
router.patch("/members/me/avatar", updateMyAvatar);
router.get("/members/me/custom-fields", getCurrentMemberCustomFields);
router.patch("/members/me/custom-fields", updateCurrentMemberCustomFields);
router.get("/members/me/payment-methods", getMemberPaymentMethods);
router.post("/members/me/payment-methods", createMemberPaymentMethod);

// Search and list
router.get("/members/search", searchDirectoryMembers);
router.post("/members/admin", createMemberAdmin);
router.get("/members", listMembers);
router.post("/members", createMember);
router.post("/members/import", importMembers);

// Member by ID routes (must come after /members/me routes)
router.patch("/members/:id/avatar", adminUpdateAvatar);
router.get("/members/:id/custom-fields", adminGetMemberCustomFields);
router.patch("/members/:id/custom-fields", adminUpdateMemberCustomFields);
router.get("/members/:id", getMember);
router.post("/members/:id/approve", approveMember);
router.post("/members/:id/reject", rejectMember);
router.patch("/members/:id", updateMemberContact);
router.post("/members/:id/photo", uploadPhoto);
router.post("/members/:id/deactivate", deactivateMember);
router.put("/members/:id/roles", updateMemberRoles);
router.get("/members/:id/audit", auditMember);

// Health
router.get("/health", health);
router.get("/status", status);

export default router;

