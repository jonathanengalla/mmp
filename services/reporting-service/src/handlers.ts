import { Request, Response } from "express";

type MemberRecord = {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "pending" | "active" | "inactive" | "rejected";
  membershipTypeId?: string;
  createdAt: number;
};

const members: MemberRecord[] = [
  {
    id: "m1",
    tenantId: "t1",
    firstName: "Alice",
    lastName: "Example",
    email: "alice@example.com",
    status: "active",
    membershipTypeId: "mt-basic",
    createdAt: Date.now() - 86400000,
  },
];

type InvoiceRecord = {
  id: string;
  tenantId: string;
  memberId: string;
  amount: number;
  currency: string;
  status: "unpaid" | "paid" | "overdue" | "void";
};
const invoices: InvoiceRecord[] = [];
type EventRecord = {
  id: string;
  tenantId: string;
  title: string;
  startDate: string;
  endDate: string;
  capacity?: number;
  status: "draft" | "published";
};
type RegistrationRecord = { eventId: string; tenantId: string; memberId: string };
const events: EventRecord[] = [];
const eventRegistrations: RegistrationRecord[] = [];

const requireAuth = (req: Request, res: Response) => {
  if (!(req as any).user) {
    res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] }, trace_id: "trace-" + Date.now() });
    return false;
  }
  return true;
};

const errorResponse = (res: Response, code: string, message: string, details?: { field: string; issue: string }[], status = 400) =>
  res.status(status).json({ error: { code, message, details: details || [] }, trace_id: "trace-" + Date.now() });

export const listMembersReport = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

  const tenantId = user.tenantId;
  const statusFilter = (req.query.status as string) || "";
  const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
  const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);

  const filtered = members.filter(
    (m) => m.tenantId === tenantId && (!statusFilter || m.status === statusFilter)
  );

  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((m) => ({
    member_id: m.id,
    first_name: m.firstName,
    last_name: m.lastName,
    email: m.email,
    status: m.status,
    membershipTypeId: m.membershipTypeId,
    createdAt: m.createdAt,
  }));

  return res.json({
    items,
    page,
    page_size: pageSize,
    total_items: filtered.length,
    total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
};

export const duesSummaryReport = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

  const tenantId = user.tenantId;
  const tenantInvoices = invoices.filter((i) => i.tenantId === tenantId);
  const totalInvoices = tenantInvoices.length;
  const totals = {
    total_members: new Set(tenantInvoices.map((i) => i.memberId)).size,
    total_invoices: totalInvoices,
    unpaid_count: tenantInvoices.filter((i) => i.status === "unpaid").length,
    unpaid_amount: tenantInvoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + i.amount, 0),
    overdue_count: tenantInvoices.filter((i) => i.status === "overdue").length,
    overdue_amount: tenantInvoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0),
    paid_count: tenantInvoices.filter((i) => i.status === "paid").length,
    paid_amount: tenantInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0),
  };

  return res.json(totals);
};

export const eventAttendanceReport = (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;
  const user = (req as any).user;
  const roles: string[] = user.roles || [];
  if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);
  const tenantId = user.tenantId;

  const statusFilter = (req.query.status as string) || "published";
  const dateFrom = req.query.start as string | undefined;
  const dateTo = req.query.end as string | undefined;
  const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
  const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);

  const filtered = events
    .filter((e) => e.tenantId === tenantId)
    .filter((e) => (statusFilter === "all" ? true : e.status === statusFilter))
    .filter((e) => {
      const start = new Date(e.startDate).getTime();
      const end = new Date(e.endDate).getTime();
      if (dateFrom && start < new Date(dateFrom).getTime()) return false;
      if (dateTo && end > new Date(dateTo).getTime()) return false;
      return true;
    });

  const startIdx = (page - 1) * pageSize;
  const slice = filtered.slice(startIdx, startIdx + pageSize);
  const items = slice.map((e) => {
    const regs = eventRegistrations.filter((r) => r.eventId === e.id && r.tenantId === tenantId);
    return {
      event_id: e.id,
      title: e.title,
      startDate: e.startDate,
      endDate: e.endDate,
      capacity: e.capacity ?? null,
      registrationsCount: regs.length,
      attendanceCount: regs.length,
      status: e.status,
    };
  });

  return res.json({
    items,
    page,
    page_size: pageSize,
    total_items: filtered.length,
    total_pages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
};

// test helpers
export const __resetReportStore = () => {
  members.length = 0;
  invoices.length = 0;
  events.length = 0;
  eventRegistrations.length = 0;
};

export const __seedMemberReport = (m: MemberRecord) => {
  members.push(m);
};

export const __seedInvoiceReport = (inv: InvoiceRecord) => {
  invoices.push(inv);
};

export const __seedEventReport = (ev: EventRecord) => {
  events.push(ev);
};

export const __seedEventRegistrationReport = (reg: RegistrationRecord) => {
  eventRegistrations.push(reg);
};

