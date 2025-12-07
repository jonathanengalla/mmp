import {
  createBroadcast,
  listBroadcasts,
  listSegments,
  updateBroadcast,
  previewBroadcast,
  handlePaymentReminder,
  __resetBroadcasts,
  __getReminderOutbox,
  handleEventReminder,
  __getEventReminderOutbox,
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

describe("broadcast drafts", () => {
  const adminUser = { tenantId: "t1", userId: "u1", roles: ["admin"] };
  const otherTenantAdmin = { tenantId: "t2", userId: "u2", roles: ["admin"] };
  const memberUser = { tenantId: "t1", userId: "u3", roles: ["member"] };

  beforeEach(() => __resetBroadcasts());

  it("creates a draft", () => {
    const req: any = { user: adminUser, body: { subject: "Hello", body: "World" } };
    const res = mockRes();
    createBroadcast(req as any, res as any);
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("draft");
  });

  it("validates required fields", () => {
    const req: any = { user: adminUser, body: { body: "No subject" } };
    const res = mockRes();
    createBroadcast(req as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("forbids non-admin", () => {
    const req: any = { user: memberUser, body: { subject: "Hi", body: "There" } };
    const res = mockRes();
    createBroadcast(req as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("requires auth", () => {
    const req: any = { body: { subject: "Hi", body: "There" } };
    const res = mockRes();
    createBroadcast(req as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("lists drafts paginated and tenant scoped", () => {
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, mockRes() as any);
    createBroadcast({ user: otherTenantAdmin, body: { subject: "B", body: "b" } } as any, mockRes() as any);
    const res = mockRes();
    listBroadcasts({ user: adminUser, query: { status: "draft", page: "1", page_size: "10" } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].subject).toBe("A");
  });

  it("validates audience segment", () => {
    const res = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a", audience_segment_id: "missing" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("lists segments per tenant", () => {
    const res = mockRes();
    listSegments({ user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it("updates a draft", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    const res = mockRes();
    updateBroadcast({ user: adminUser, params: { id }, body: { subject: "B", body: "b" } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.subject).toBe("B");
  });

  it("validates subject/body on update", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    const res = mockRes();
    updateBroadcast({ user: adminUser, params: { id }, body: { subject: "", body: "" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("requires draft status", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    // simulate non-draft
    (createRes as any).body.status = "sent";
    const res = mockRes();
    updateBroadcast({ user: adminUser, params: { id }, body: { subject: "B", body: "b" } } as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("rejects invalid segment", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    const res = mockRes();
    updateBroadcast({ user: adminUser, params: { id }, body: { subject: "B", body: "b", audience_segment_id: "nope" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("tenant isolation on update", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    const res = mockRes();
    updateBroadcast({ user: { tenantId: "t2", roles: ["admin"] }, params: { id }, body: { subject: "B", body: "b" } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("auth required on update", () => {
    const res = mockRes();
    updateBroadcast({ params: { id: "bc-1" }, body: { subject: "B", body: "b" } } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("previews a draft", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    const res = mockRes();
    previewBroadcast({ user: adminUser, params: { id } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.renderedPreview).toBe("a");
  });

  it("rejects preview for non-draft", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    // mark as non-draft
    (createRes as any).body.status = "sent";
    const res = mockRes();
    previewBroadcast({ user: adminUser, params: { id } } as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("enforces tenant on preview", () => {
    const createRes = mockRes();
    createBroadcast({ user: adminUser, body: { subject: "A", body: "a" } } as any, createRes as any);
    const id = createRes.body.broadcast_id;
    const res = mockRes();
    previewBroadcast({ user: { tenantId: "t2", roles: ["admin"] }, params: { id } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("stores payment reminder", () => {
    const res = mockRes();
    handlePaymentReminder({
      body: { tenant_id: "t1", member_id: "m1", invoice_id: "inv1", amount: 1000, currency: "USD", due_date: "2025-01-01" },
    } as any, res as any);
    expect(res.statusCode).toBe(202);
    expect(__getReminderOutbox().length).toBe(1);
  });

  it("stores event reminder", () => {
    const res = mockRes();
    handleEventReminder({
      body: {
        tenant_id: "t1",
        event_id: "evt1",
        event_title: "Board",
        member_id: "m1",
        member_email: "m1@example.com",
        startDate: "2025-01-01T10:00:00Z",
      },
    } as any, res as any);
    expect(res.statusCode).toBe(202);
    expect(__getEventReminderOutbox().length).toBe(1);
  });

  it("rejects invalid event reminder", () => {
    const res = mockRes();
    handleEventReminder({ body: { tenant_id: "t1" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });
});

