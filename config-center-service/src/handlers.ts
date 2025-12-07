import { Request, Response } from "express";

type OrgProfile = {
  tenantId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  timezone?: string;
  locale?: string;
  updatedAt: number;
};

const defaultProfile: OrgProfile = {
  tenantId: "t1",
  name: "Rotary Club",
  description: "Default org",
  logoUrl: "",
  timezone: "Asia/Manila",
  locale: "en-PH",
  updatedAt: Date.now(),
};
const profiles: OrgProfile[] = [{ ...defaultProfile }];
const audits: {
  id: string;
  tenantId: string;
  action:
    | "config.org_profile.updated"
    | "config.org_profile.locale_timezone.updated"
    | "config.approval_workflow.updated"
    | "config.payment_category.created"
    | "config.payment_category.updated"
    | "config.invoice_template.updated"
    | "config.feature_flags.updated";
  actorId?: string;
  before?: any;
  after?: any;
  createdAt: number;
}[] = [];
let auditCounter = 1;
type MembershipTypeRecord = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  period: "monthly" | "annual";
  createdAt: number;
};
const membershipTypes: MembershipTypeRecord[] = [];
type ApprovalWorkflow = {
  id: string;
  tenantId: string;
  requireApproval: boolean;
  approverRoles?: string[];
  createdAt: number;
  updatedAt: number;
};
const approvalWorkflows: ApprovalWorkflow[] = [];
type PaymentCategory = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  type: "dues" | "event" | "other";
  active: boolean;
  createdAt: number;
  updatedAt: number;
};
const paymentCategories: PaymentCategory[] = [];
type InvoiceTemplate = {
  tenantId: string;
  subject: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};
const defaultInvoiceTemplate: InvoiceTemplate = {
  tenantId: "t1",
  subject: "Invoice {{invoice.number}}",
  body: "Hello {{member.name}}, your balance is {{amount}} due by {{due_date}}.",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
const invoiceTemplates: InvoiceTemplate[] = [{ ...defaultInvoiceTemplate }];
type FeatureFlags = {
  tenantId: string;
  payments: boolean;
  events: boolean;
  communications: boolean;
  reporting: boolean;
  createdAt: number;
  updatedAt: number;
};
const defaultFeatureFlags: FeatureFlags = {
  tenantId: "t1",
  payments: true,
  events: true,
  communications: true,
  reporting: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
const featureFlags: FeatureFlags[] = [{ ...defaultFeatureFlags }];

const requireAuth = (req: Request, res: Response) => {
  if (!(req as any).user) {
    res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] }, trace_id: "trace-" + Date.now() });
    return false;
  }
  return true;
};

const errorResponse = (res: Response, code: string, message: string, details?: { field: string; issue: string }[], status = 400) =>
  res.status(status).json({ error: { code, message, details: details || [] }, trace_id: "trace-" + Date.now() });

const isValidTimeZone = (tz?: string) => {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const isValidLocale = (loc?: string) => {
  if (!loc || typeof loc !== "string") return false;
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(loc);
};

const normalizeCode = (code: string) => code.trim().toUpperCase();
const isValidCode = (code?: string) => {
  if (!code || typeof code !== "string") return false;
  const norm = normalizeCode(code);
  return norm.length > 0 && norm.length <= 32 && /^[A-Z0-9_]+$/.test(norm);
};
const isValidName = (name?: string) => {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 100;
};
const isValidSubject = (subject?: string) => {
  if (subject === undefined || typeof subject !== "string") return false;
  const trimmed = subject.trim();
  return trimmed.length > 0 && trimmed.length <= 200;
};
const isValidBody = (body?: string) => {
  if (body === undefined || typeof body !== "string") return false;
  const trimmed = body.trim();
  return trimmed.length >= 10;
};

export const getOrgProfile = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const profile = profiles.find((p) => p.tenantId === tenantId);
  if (!profile) return errorResponse(res, "not_found", "Org profile not found", [], 404);
  return res.json({
    name: profile.name,
    description: profile.description || "",
    logoUrl: profile.logoUrl || "",
    timezone: profile.timezone || "",
    locale: profile.locale || "",
  });
};

export const updateOrgProfile = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

  const tenantId = user.tenantId;
  const { name, description, logoUrl, timezone, locale } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (!name || typeof name !== "string") details.push({ field: "name", issue: "required" });
  if (logoUrl !== undefined && typeof logoUrl !== "string") details.push({ field: "logoUrl", issue: "invalid" });
  if (timezone !== undefined && !isValidTimeZone(timezone)) details.push({ field: "timezone", issue: "invalid" });
  if (locale !== undefined && !isValidLocale(locale)) details.push({ field: "locale", issue: "invalid" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  let profile = profiles.find((p) => p.tenantId === tenantId);
  if (!profile) {
    profile = { tenantId, name: "", updatedAt: Date.now() };
    profiles.push(profile);
  }
  const before = { ...profile };
  profile.name = name;
  profile.description = description;
  profile.logoUrl = logoUrl;
  profile.timezone = timezone;
  profile.locale = locale;
  profile.updatedAt = Date.now();

  const afterSnapshot = { ...profile };
  audits.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    action: "config.org_profile.updated",
    actorId: user.userId || "admin",
    before,
    after: afterSnapshot,
    createdAt: Date.now(),
  });
  if (timezone !== undefined || locale !== undefined) {
    audits.push({
      id: `audit-${auditCounter++}`,
      tenantId,
      action: "config.org_profile.locale_timezone.updated",
      actorId: user.userId || "admin",
      before: { timezone: before.timezone, locale: before.locale },
      after: { timezone: afterSnapshot.timezone, locale: afterSnapshot.locale },
      createdAt: Date.now(),
    });
  }

  return res.json({
    name: profile.name,
    description: profile.description || "",
    logoUrl: profile.logoUrl || "",
    timezone: profile.timezone || "",
    locale: profile.locale || "",
  });
};

export const createMembershipType = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const { name, description, price, period } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (!name || typeof name !== "string") details.push({ field: "name", issue: "required" });
  if (price === undefined || typeof price !== "number" || price < 0) details.push({ field: "price", issue: "invalid" });
  if (period !== "monthly" && period !== "annual") details.push({ field: "period", issue: "invalid" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const dup = membershipTypes.find((mt) => mt.tenantId === tenantId && mt.name.toLowerCase() === String(name).toLowerCase());
  if (dup) return errorResponse(res, "duplicate", "Membership type name exists", [], 409);

  const record: MembershipTypeRecord = {
    id: `mt-${membershipTypes.length + 1}`,
    tenantId,
    name,
    description,
    price,
    period,
    createdAt: Date.now(),
  };
  membershipTypes.push(record);
  audits.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    action: "config.org_profile.updated",
    actorId: user.userId || "admin",
    before: {},
    after: record,
    createdAt: Date.now(),
  });
  return res.status(201).json(record);
};
export const listMembershipTypes = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const items = membershipTypes.filter((mt) => mt.tenantId === tenantId);
  return res.json({ items, page: 1, page_size: items.length || 20, total_items: items.length, total_pages: 1 });
};
export const updateMembershipType = (_req: Request, res: Response) => res.json({ status: "updated" });

export const getApprovalWorkflow = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const wf = approvalWorkflows.find((w) => w.tenantId === tenantId);
  if (!wf) return res.json({ requireApproval: false, approverRoles: [] });
  return res.json({ workflowId: wf.id, requireApproval: wf.requireApproval, approverRoles: wf.approverRoles || [] });
};

export const updateApprovalWorkflow = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const { requireApproval, approverRoles } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (typeof requireApproval !== "boolean") details.push({ field: "requireApproval", issue: "invalid" });
  if (requireApproval === true) {
    if (!Array.isArray(approverRoles) || approverRoles.length === 0 || approverRoles.some((r) => typeof r !== "string")) {
      details.push({ field: "approverRoles", issue: "required_when_requireApproval_true" });
    }
  }
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const existing = approvalWorkflows.find((w) => w.tenantId === tenantId);
  const before = existing ? { requireApproval: existing.requireApproval, approverRoles: existing.approverRoles || [] } : { requireApproval: false, approverRoles: [] };
  const rolesToSave = requireApproval ? approverRoles || [] : [];
  if (existing) {
    existing.requireApproval = requireApproval;
    existing.approverRoles = rolesToSave;
    existing.updatedAt = Date.now();
  } else {
    const now = Date.now();
    approvalWorkflows.push({
      id: `aw-${approvalWorkflows.length + 1}`,
      tenantId,
      requireApproval,
      approverRoles: rolesToSave,
      createdAt: now,
      updatedAt: now,
    });
  }
  const wf = approvalWorkflows.find((w) => w.tenantId === tenantId)!;
  audits.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    action: "config.approval_workflow.updated",
    actorId: user.userId || "admin",
    before,
    after: { requireApproval: wf.requireApproval, approverRoles: wf.approverRoles || [] },
    createdAt: Date.now(),
  });
  return res.json({ workflowId: wf.id, requireApproval: wf.requireApproval, approverRoles: wf.approverRoles || [] });
};

export const listPaymentCategories = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const items = paymentCategories.filter((c) => c.tenantId === tenantId);
  return res.json({ items, page: 1, page_size: items.length || 20, total_items: items.length, total_pages: 1 });
};

export const createPaymentCategory = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const { code, name, description, type } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (!isValidCode(code)) details.push({ field: "code", issue: "invalid" });
  if (!isValidName(name)) details.push({ field: "name", issue: "invalid" });
  if (type !== "dues" && type !== "event" && type !== "other") details.push({ field: "type", issue: "invalid" });
  if (description !== undefined && typeof description !== "string") details.push({ field: "description", issue: "invalid" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const normCode = normalizeCode(code);
  const dup = paymentCategories.find((c) => c.tenantId === tenantId && c.code === normCode);
  if (dup) return errorResponse(res, "duplicate", "Payment category code exists", [], 409);

  const now = Date.now();
  const record: PaymentCategory = {
    id: `pc-${paymentCategories.length + 1}`,
    tenantId,
    code: normCode,
    name: name.trim(),
    description,
    type,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  paymentCategories.push(record);
  audits.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    action: "config.payment_category.created",
    actorId: user.userId || "admin",
    before: {},
    after: { id: record.id, code: record.code },
    createdAt: now,
  });
  return res.status(201).json(record);
};

export const updatePaymentCategory = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const id = req.params.id;
  const category = paymentCategories.find((c) => c.tenantId === tenantId && c.id === id);
  if (!category) return errorResponse(res, "not_found", "Payment category not found", [], 404);

  const { name, description, type, active } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (name !== undefined && !isValidName(name)) details.push({ field: "name", issue: "invalid" });
  if (description !== undefined && typeof description !== "string") details.push({ field: "description", issue: "invalid" });
  if (type !== undefined && type !== "dues" && type !== "event" && type !== "other") details.push({ field: "type", issue: "invalid" });
  if (active !== undefined && typeof active !== "boolean") details.push({ field: "active", issue: "invalid" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  const before = { ...category };
  let changed = false;
  if (name !== undefined && name.trim() !== category.name) {
    category.name = name.trim();
    changed = true;
  }
  if (description !== undefined && description !== category.description) {
    category.description = description;
    changed = true;
  }
  if (type !== undefined && type !== category.type) {
    category.type = type;
    changed = true;
  }
  if (active !== undefined && active !== category.active) {
    category.active = active;
    changed = true;
  }
  if (!changed) return errorResponse(res, "conflict", "No changes detected", [], 409);

  category.updatedAt = Date.now();
  audits.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    action: "config.payment_category.updated",
    actorId: user.userId || "admin",
    before,
    after: { ...category },
    createdAt: Date.now(),
  });
  return res.json(category);
};

export const getInvoiceTemplate = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const tpl = invoiceTemplates.find((t) => t.tenantId === tenantId);
  const template = tpl || {
    tenantId,
    subject: defaultInvoiceTemplate.subject,
    body: defaultInvoiceTemplate.body,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return res.json({ subject: template.subject, body: template.body, updatedAt: template.updatedAt, createdAt: template.createdAt });
};

export const updateInvoiceTemplate = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const { subject, body } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  if (subject !== undefined && !isValidSubject(subject)) details.push({ field: "subject", issue: "invalid" });
  if (body !== undefined && !isValidBody(body)) details.push({ field: "body", issue: "invalid" });
  if (subject === undefined && body === undefined) details.push({ field: "payload", issue: "empty" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  let tpl = invoiceTemplates.find((t) => t.tenantId === tenantId);
  const now = Date.now();
  if (!tpl) {
    tpl = {
      tenantId,
      subject: subject?.trim() ?? defaultInvoiceTemplate.subject,
      body: body?.trim() ?? defaultInvoiceTemplate.body,
      createdAt: now,
      updatedAt: now,
    };
    invoiceTemplates.push(tpl);
    audits.push({
      id: `audit-${auditCounter++}`,
      tenantId,
      action: "config.invoice_template.updated",
      actorId: user.userId || "admin",
      before: { subject: defaultInvoiceTemplate.subject, body: defaultInvoiceTemplate.body },
      after: { subject: tpl.subject, body: tpl.body },
      createdAt: now,
    });
    return res.json({ subject: tpl.subject, body: tpl.body, updatedAt: tpl.updatedAt, createdAt: tpl.createdAt });
  }

  const before = { subject: tpl.subject, body: tpl.body };
  let changed = false;
  if (subject !== undefined && subject.trim() !== tpl.subject) {
    tpl.subject = subject.trim();
    changed = true;
  }
  if (body !== undefined && body.trim() !== tpl.body) {
    tpl.body = body.trim();
    changed = true;
  }
  if (!changed) return errorResponse(res, "conflict", "No changes detected", [], 409);

  tpl.updatedAt = now;
  audits.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    action: "config.invoice_template.updated",
    actorId: user.userId || "admin",
    before,
    after: { subject: tpl.subject, body: tpl.body },
    createdAt: now,
  });
  return res.json({ subject: tpl.subject, body: tpl.body, updatedAt: tpl.updatedAt, createdAt: tpl.createdAt });
};

export const getFeatureFlags = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const flags = featureFlags.find((f) => f.tenantId === tenantId);
  const data =
    flags ||
    ({
      tenantId,
      payments: true,
      events: true,
      communications: true,
      reporting: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as FeatureFlags);
  return res.json({ payments: data.payments, events: data.events, communications: data.communications, reporting: data.reporting, updatedAt: data.updatedAt, createdAt: data.createdAt });
};

export const updateFeatureFlags = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;
  const { payments, events, communications, reporting } = req.body || {};
  const details: { field: string; issue: string }[] = [];
  const providedKeys = ["payments", "events", "communications", "reporting"].filter((k) => req.body && Object.prototype.hasOwnProperty.call(req.body, k));
  if (providedKeys.length === 0) details.push({ field: "payload", issue: "empty" });
  if (payments !== undefined && typeof payments !== "boolean") details.push({ field: "payments", issue: "invalid" });
  if (events !== undefined && typeof events !== "boolean") details.push({ field: "events", issue: "invalid" });
  if (communications !== undefined && typeof communications !== "boolean") details.push({ field: "communications", issue: "invalid" });
  if (reporting !== undefined && typeof reporting !== "boolean") details.push({ field: "reporting", issue: "invalid" });
  if (details.length) return errorResponse(res, "validation_failed", "Validation failed", details, 400);

  let flags = featureFlags.find((f) => f.tenantId === tenantId);
  const now = Date.now();
  if (!flags) {
    flags = {
      tenantId,
      payments: true,
      events: true,
      communications: true,
      reporting: true,
      createdAt: now,
      updatedAt: now,
    };
    featureFlags.push(flags);
  }
  const before = { payments: flags.payments, events: flags.events, communications: flags.communications, reporting: flags.reporting };
  let changed = false;
  if (payments !== undefined && payments !== flags.payments) {
    flags.payments = payments;
    changed = true;
  }
  if (events !== undefined && events !== flags.events) {
    flags.events = events;
    changed = true;
  }
  if (communications !== undefined && communications !== flags.communications) {
    flags.communications = communications;
    changed = true;
  }
  if (reporting !== undefined && reporting !== flags.reporting) {
    flags.reporting = reporting;
    changed = true;
  }
  if (!changed) return errorResponse(res, "conflict", "No changes detected", [], 409);

  flags.updatedAt = now;
  audits.push({
    id: `audit-${auditCounter++}`,
    tenantId,
    action: "config.feature_flags.updated",
    actorId: user.userId || "admin",
    before,
    after: { payments: flags.payments, events: flags.events, communications: flags.communications, reporting: flags.reporting },
    createdAt: now,
  });
  return res.json({ payments: flags.payments, events: flags.events, communications: flags.communications, reporting: flags.reporting, updatedAt: flags.updatedAt, createdAt: flags.createdAt });
};
export const addProfileField = (_req: Request, res: Response) => res.status(201).json({ field_key: "custom" });
export const listProfileFields = (_req: Request, res: Response) => res.json({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });

export const createPaymentCategory = (_req: Request, res: Response) => res.status(201).json({ name: "dues" });
export const listPaymentCategories = (_req: Request, res: Response) => res.json({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });

export const setFeatureFlag = (_req: Request, res: Response) => res.json({ status: "ok" });
export const listFeatureFlags = (_req: Request, res: Response) => res.json({ items: [] });

export const createEmailTemplate = (_req: Request, res: Response) => res.status(201).json({ id: "t1" });
export const listEmailTemplates = (_req: Request, res: Response) => res.json({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });

export const setReminderSchedule = (_req: Request, res: Response) => res.status(201).json({ status: "ok" });
export const configureInvoiceTemplate = (_req: Request, res: Response) => res.json({ status: "ok" });
export const configureDuesRules = (_req: Request, res: Response) => res.json({ status: "ok" });
export const configureGateway = (_req: Request, res: Response) => res.status(201).json({ status: "ok" });

export const setEventDefaults = (_req: Request, res: Response) => res.json({ status: "ok" });
export const createProjectTemplate = (_req: Request, res: Response) => res.status(201).json({ id: "pt1" });
export const listProjectTemplates = (_req: Request, res: Response) => res.json({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });

export const setDirectoryVisibility = (_req: Request, res: Response) => res.json({ status: "ok" });
export const createRole = (_req: Request, res: Response) => res.status(201).json({ id: "role1" });
export const listRoles = (_req: Request, res: Response) => res.json({ items: [], page: 1, page_size: 20, total_items: 0, total_pages: 0 });
export const updateRole = (_req: Request, res: Response) => res.json({ status: "ok" });
export const setMfaPolicy = (_req: Request, res: Response) => res.json({ admin_mfa_required: true });

export const health = (_req: Request, res: Response) => res.json({ status: "ok" });
export const status = (_req: Request, res: Response) => res.json({ status: "ok", deps: { db: "ok" } });

// Test helpers
export const __resetConfigStores = () => {
  membershipTypes.length = 0;
  approvalWorkflows.length = 0;
  paymentCategories.length = 0;
  invoiceTemplates.length = 0;
  featureFlags.length = 0;
  audits.length = 0;
  auditCounter = 1;
  profiles.length = 0;
  profiles.push({ ...defaultProfile, updatedAt: Date.now() });
  invoiceTemplates.push({ ...defaultInvoiceTemplate, createdAt: Date.now(), updatedAt: Date.now() });
  featureFlags.push({ ...defaultFeatureFlags, createdAt: Date.now(), updatedAt: Date.now() });
};

