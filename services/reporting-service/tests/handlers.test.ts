import {
  listMembersReport,
  duesSummaryReport,
  eventAttendanceReport,
  __resetReportStore,
  __seedMemberReport,
  __seedInvoiceReport,
  __seedEventReport,
  __seedEventRegistrationReport,
} from "../src/handlers";

const mockRes = () => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe("members report", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"] };
  const memberUser = { tenantId: "t1", roles: ["member"] };

  beforeEach(() => {
    __resetReportStore();
    __seedMemberReport({
      id: "m1",
      tenantId: "t1",
      firstName: "Ann",
      lastName: "Lee",
      email: "ann@example.com",
      status: "active",
      membershipTypeId: "mt1",
      createdAt: Date.now(),
    });
    __seedMemberReport({
      id: "m2",
      tenantId: "t1",
      firstName: "Bob",
      lastName: "Smith",
      email: "bob@example.com",
      status: "pending",
      membershipTypeId: "mt2",
      createdAt: Date.now(),
    });
    __seedMemberReport({
      id: "m3",
      tenantId: "t2",
      firstName: "Other",
      lastName: "Tenant",
      email: "other@example.com",
      status: "active",
      membershipTypeId: "mt3",
      createdAt: Date.now(),
    });
  });

  it("returns paginated members", () => {
    const res = mockRes();
    listMembersReport({ user: adminUser, query: { page: "1", page_size: "1" } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total_items).toBe(2);
  });

  it("filters by status", () => {
    const res = mockRes();
    listMembersReport({ user: adminUser, query: { status: "pending" } } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].status).toBe("pending");
  });

  it("enforces admin", () => {
    const res = mockRes();
    listMembersReport({ user: memberUser, query: {} } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("requires auth", () => {
    const res = mockRes();
    listMembersReport({ query: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("tenant isolation", () => {
    const res = mockRes();
    listMembersReport({ user: { tenantId: "t2", roles: ["admin"] }, query: {} } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].tenantId).toBeUndefined();
  });
});

describe("dues summary report", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"] };

  beforeEach(() => {
    __resetReportStore();
    __seedInvoiceReport({ id: "inv1", tenantId: "t1", memberId: "m1", amount: 1000, currency: "USD", status: "unpaid" });
    __seedInvoiceReport({ id: "inv2", tenantId: "t1", memberId: "m2", amount: 2000, currency: "USD", status: "overdue" });
    __seedInvoiceReport({ id: "inv3", tenantId: "t1", memberId: "m2", amount: 3000, currency: "USD", status: "paid" });
    __seedInvoiceReport({ id: "inv4", tenantId: "t2", memberId: "m9", amount: 999, currency: "USD", status: "unpaid" });
  });

  it("aggregates totals", () => {
    const res = mockRes();
    duesSummaryReport({ user: adminUser, query: {} } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.total_invoices).toBe(3);
    expect(res.body.unpaid_count).toBe(1);
    expect(res.body.unpaid_amount).toBe(1000);
    expect(res.body.overdue_count).toBe(1);
    expect(res.body.overdue_amount).toBe(2000);
    expect(res.body.paid_count).toBe(1);
    expect(res.body.paid_amount).toBe(3000);
    expect(res.body.total_members).toBe(2);
  });

  it("empty dataset handled", () => {
    __resetReportStore();
    const res = mockRes();
    duesSummaryReport({ user: adminUser, query: {} } as any, res as any);
    expect(res.body.total_invoices).toBe(0);
  });

  it("auth enforced", () => {
    const res = mockRes();
    duesSummaryReport({ query: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("admin required", () => {
    const res = mockRes();
    duesSummaryReport({ user: { tenantId: "t1", roles: ["member"] }, query: {} } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("tenant isolation", () => {
    const res = mockRes();
    duesSummaryReport({ user: { tenantId: "t2", roles: ["admin"] }, query: {} } as any, res as any);
    expect(res.body.total_invoices).toBe(1);
    expect(res.body.total_members).toBe(1);
  });
});

describe("event attendance report", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"] };

  beforeEach(() => {
    __resetReportStore();
    __seedEventReport({
      id: "evt1",
      tenantId: "t1",
      title: "Published",
      startDate: "2025-02-01T10:00:00Z",
      endDate: "2025-02-01T11:00:00Z",
      capacity: 100,
      status: "published",
    });
    __seedEventReport({
      id: "evt2",
      tenantId: "t1",
      title: "Draft",
      startDate: "2025-03-01T10:00:00Z",
      endDate: "2025-03-01T11:00:00Z",
      capacity: 50,
      status: "draft",
    });
    __seedEventReport({
      id: "evt3",
      tenantId: "t2",
      title: "Other tenant",
      startDate: "2025-04-01T10:00:00Z",
      endDate: "2025-04-01T11:00:00Z",
      capacity: 20,
      status: "published",
    });
    __seedEventRegistrationReport({ eventId: "evt1", tenantId: "t1", memberId: "m1" });
    __seedEventRegistrationReport({ eventId: "evt1", tenantId: "t1", memberId: "m2" });
  });

  it("lists published events with attendance", () => {
    const res = mockRes();
    eventAttendanceReport({ user: adminUser, query: {} } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].registrationsCount).toBe(2);
  });

  it("filters by status draft", () => {
    const res = mockRes();
    eventAttendanceReport({ user: adminUser, query: { status: "draft" } } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].status).toBe("draft");
  });

  it("paginates", () => {
    __seedEventReport({
      id: "evt4",
      tenantId: "t1",
      title: "Extra",
      startDate: "2025-05-01T10:00:00Z",
      endDate: "2025-05-01T11:00:00Z",
      capacity: 10,
      status: "published",
    });
    const res = mockRes();
    eventAttendanceReport({ user: adminUser, query: { page: "1", page_size: "1", status: "all" } } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total_items).toBeGreaterThanOrEqual(2);
  });

  it("tenant isolation", () => {
    const res = mockRes();
    eventAttendanceReport({ user: { tenantId: "t2", roles: ["admin"] }, query: {} } as any, res as any);
    expect(res.body.items.length).toBe(1);
  });

  it("auth enforced", () => {
    const res = mockRes();
    eventAttendanceReport({ query: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
  });
});

