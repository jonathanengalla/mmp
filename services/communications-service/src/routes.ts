import { Router } from "express";
import {
  createBroadcast,
  listBroadcasts,
  listSegments,
  updateBroadcast,
  previewBroadcast,
  handlePaymentReminder,
  handleEventReminder,
} from "./handlers";

const router = Router();

// Protected routes; auth middleware attached at app bootstrap
router.post("/broadcasts", createBroadcast);
router.get("/broadcasts", listBroadcasts);
router.get("/segments", listSegments);
router.patch("/broadcasts/:id", updateBroadcast);
router.get("/broadcasts/:id/preview", previewBroadcast);
router.post("/internal/payment-reminders", handlePaymentReminder);
router.post("/internal/event-reminders", handleEventReminder);

export default router;

