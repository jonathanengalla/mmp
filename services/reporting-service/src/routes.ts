import { Router } from "express";
import { listMembersReport, duesSummaryReport, eventAttendanceReport } from "./handlers";

const router = Router();

// Protected: auth middleware attached at bootstrap
router.get("/reports/members", listMembersReport);
router.get("/reports/dues-summary", duesSummaryReport);
router.get("/reports/events/attendance", eventAttendanceReport);

export default router;

