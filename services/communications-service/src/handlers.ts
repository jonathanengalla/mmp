import { Request, Response } from "express";

type Broadcast = {
  id: string;
  tenantId: string;
  subject: string;
  body: string;
  audienceSegmentId?: string;
  tags?: string[];
  status: "draft";
  createdAt: number;
  createdBy: string;
};

const broadcasts: Broadcast[] = [];
let broadcastCounter = 1;
type Segment = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  type: string;
  config?: any;
};
const segments: Segment[] = [
  { id: "seg-all", tenantId: "t1", name: "All Members", description: "All members", type: "all_members" },
  { id: "seg-overdue", tenantId: "t1", name: "Dues Past Due", description: "Members with overdue dues", type: "dues_past_due" },
];
type AuditLog = {
  id: string;
  tenantId: string;
  broadcastId: string;
  action: "broadcast.updated";
  actorId?: string;
  createdAt: number;
  meta?: any;
};
const auditLogs: AuditLog[] = [];
let auditCounter = 1;
const reminderOutbox: any[] = [];
const eventReminderOutbox: any[] = [];

const errorResponse = (res: Response, code: string, message: string, details?: { field: string; issue: string }[], status = 400) =>
  res.status(status).json({ error: { code, message, details: details || [] }, trace_id: "trace-" + Date.now() });

const requireAuth = (req: Request, res: Response) => {
  if (!(req as any).user) {
    res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] }, trace_id: "trace-" + Date.now() });
    return false;
  }
  return true;
};

export const createBroadcast = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

  const tenantId = user.tenantId;
  const { subject, body, audience_segment_id, tags } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (!subject) details.push({ field: "subject", issue: "required" });
  if (!body) details.push({ field: "body", issue: "required" });
   if (audience_segment_id) {
    const seg = segments.find((s) => s.id === audience_segment_id && s.tenantId === tenantId);
    if (!seg) details.push({ field: "audience_segment_id", issue: "not_found" });
  }
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const broadcast: Broadcast = {
    id: `bc-${broadcastCounter++}`,
    tenantId,
    subject,
    body,
    audienceSegmentId: audience_segment_id,
    tags: Array.isArray(tags) ? tags : undefined,
    status: "draft",
    createdAt: Date.now(),
    createdBy: user.userId || "admin",
  };
  broadcasts.push(broadcast);

  return res.status(201).json({
    broadcast_id: broadcast.id,
    status: broadcast.status,
    subject: broadcast.subject,
    body: broadcast.body,
    audience_segment_id: broadcast.audienceSegmentId,
    created_at: broadcast.createdAt,
  });
};

export const listBroadcasts = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const status = (req.query.status as string) || "draft";
  const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
  const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);

  const filtered = broadcasts.filter((b) => b.tenantId === tenantId && b.status === status);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((b) => ({
    id: b.id,
    subject: b.subject,
    status: b.status,
    created_at: b.createdAt,
  }));

  return res.json({
    items,
    page,
    page_size: pageSize,
    total_items: filtered.length,
    total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
};

// test helpers
export const __resetBroadcasts = () => {
  broadcasts.length = 0;
  broadcastCounter = 1;
  auditLogs.length = 0;
  auditCounter = 1;
  reminderOutbox.length = 0;
  eventReminderOutbox.length = 0;
};

export const listSegments = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const items = segments.filter((s) => s.tenantId === tenantId);
  return res.json({ items, page: 1, page_size: items.length || 20, total_items: items.length, total_pages: 1 });
};

export const handlePaymentReminder = (req: Request, res: Response) => {
  const payload = req.body || {};
  const required = ["tenant_id", "member_id", "invoice_id", "amount", "currency"];
  const missing = required.filter((k) => payload[k] === undefined);
  if (missing.length) return errorResponse(res, "validation_failed", "Validation failed", missing.map((m) => ({ field: m, issue: "required" })), 400);
  reminderOutbox.push({ ...payload, type: "payment_reminder" });
  return res.status(202).json({ status: "queued" });
};

export const __getReminderOutbox = () => reminderOutbox;
export const handleEventReminder = (req: Request, res: Response) => {
  const payload = req.body || {};
  const required = ["tenant_id", "event_id", "event_title", "member_id", "member_email", "startDate"];
  const missing = required.filter((k) => payload[k] === undefined || payload[k] === null);
  if (missing.length) return errorResponse(res, "validation_failed", "Validation failed", missing.map((m) => ({ field: m, issue: "required" })), 400);
  eventReminderOutbox.push({ ...payload, type: "event_reminder" });
  return res.status(202).json({ status: "queued" });
};
export const __getEventReminderOutbox = () => eventReminderOutbox;
export const previewBroadcast = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const broadcastId = req.params.id;

  const draft = broadcasts.find((b) => b.id === broadcastId && b.tenantId === tenantId);
  if (!draft) return errorResponse(res, "not_found", "Broadcast not found", [], 404);
  if (draft.status !== "draft") return errorResponse(res, "invalid_status", "Only drafts can be previewed", [], 409);

  const seg = draft.audienceSegmentId ? segments.find((s) => s.id === draft.audienceSegmentId) : null;
  return res.json({
    broadcast_id: draft.id,
    subject: draft.subject,
    body: draft.body,
    audience_segment_id: draft.audienceSegmentId || null,
    audience_segment_name: seg?.name || null,
    renderedPreview: draft.body,
  });
};

export const updateBroadcast = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const broadcastId = req.params.id;
  const { subject, body, audience_segment_id, tags } = req.body || {};

  const draft = broadcasts.find((b) => b.id === broadcastId && b.tenantId === tenantId);
  if (!draft) return errorResponse(res, "not_found", "Broadcast not found", [], 404);
  if (draft.status !== "draft") return errorResponse(res, "invalid_status", "Only drafts can be edited", [], 409);

  const details: { field: string; issue: string }[] = [];
  if (!subject) details.push({ field: "subject", issue: "required" });
  if (!body) details.push({ field: "body", issue: "required" });
  if (audience_segment_id) {
    const seg = segments.find((s) => s.id === audience_segment_id && s.tenantId === tenantId);
    if (!seg) details.push({ field: "audience_segment_id", issue: "not_found" });
  }
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const before = { subject: draft.subject, body: draft.body, audienceSegmentId: draft.audienceSegmentId, tags: draft.tags };
  draft.subject = subject;
  draft.body = body;
  draft.audienceSegmentId = audience_segment_id || undefined;
  draft.tags = Array.isArray(tags) ? tags : draft.tags;

  auditLogs.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    broadcastId: draft.id,
    action: "broadcast.updated",
    actorId: user.userId || "admin",
    createdAt: Date.now(),
    meta: { before, after: { subject: draft.subject, body: draft.body, audienceSegmentId: draft.audienceSegmentId, tags: draft.tags } },
  });

  return res.json({
    broadcast_id: draft.id,
    status: draft.status,
    subject: draft.subject,
    body: draft.body,
    audience_segment_id: draft.audienceSegmentId,
    created_at: draft.createdAt,
  });
};

