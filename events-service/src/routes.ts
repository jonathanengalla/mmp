import { Router } from "express";
import {
  createEvent,
  publishEvent,
  updateEventCapacity,
  registerForEvent,
  cancelRegistration,
  listUpcomingEvents,
  updateEventPricing,
  runEventReminders,
} from "./handlers";

const router = Router();

// Protected: attach auth middleware in bootstrap
router.post("/events", createEvent);
router.post("/events/:id/publish", publishEvent);
router.patch("/events/:id/capacity", updateEventCapacity);
router.patch("/events/:id/pricing", updateEventPricing);
router.post("/events/:id/register", registerForEvent);
router.delete("/events/:id/register", cancelRegistration);
router.get("/events/upcoming", listUpcomingEvents);
router.post("/internal/event-reminders/run", runEventReminders);

export default router;

