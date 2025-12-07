import {
  getOrgProfile,
  updateOrgProfile,
  createMembershipType,
  listMembershipTypes,
  getApprovalWorkflow,
  updateApprovalWorkflow,
  listPaymentCategories,
  createPaymentCategory,
  updatePaymentCategory,
  getInvoiceTemplate,
  updateInvoiceTemplate,
  getFeatureFlags,
  updateFeatureFlags,
  __resetConfigStores,
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

beforeEach(() => {
  __resetConfigStores();
});

describe("config org profile", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"], userId: "u1" };
  const memberUser = { tenantId: "t1", roles: ["member"], userId: "u2" };

  it("gets profile (admin)", () => {
    const res = mockRes();
    getOrgProfile({ user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBeDefined();
  });

  it("forbids non-admin", () => {
    const res = mockRes();
    getOrgProfile({ user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("updates profile", () => {
    const res = mockRes();
    updateOrgProfile(
      { user: adminUser, body: { name: "New Org", description: "Desc", logoUrl: "http://logo", timezone: "UTC", locale: "en-US" } } as any,
      res as any
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe("New Org");
  });

  it("validates name required", () => {
    const res = mockRes();
    updateOrgProfile({ user: adminUser, body: { description: "No name" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("tenant isolation (no profile)", () => {
    const res = mockRes();
    getOrgProfile({ user: { tenantId: "unknown", roles: ["admin"] } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("rejects invalid logoUrl type", () => {
    const res = mockRes();
    updateOrgProfile({ user: adminUser, body: { name: "Org", logoUrl: 123 } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("updates timezone with audit", () => {
    const res = mockRes();
    updateOrgProfile({ user: adminUser, body: { name: "Org", timezone: "Asia/Manila" } } as any, res as any);
    expect(res.statusCode).toBe(200);
  });

  it("rejects invalid timezone", () => {
    const res = mockRes();
    updateOrgProfile({ user: adminUser, body: { name: "Org", timezone: "Not/Real" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("updates locale", () => {
    const res = mockRes();
    updateOrgProfile({ user: adminUser, body: { name: "Org", locale: "en-US" } } as any, res as any);
    expect(res.statusCode).toBe(200);
  });

  it("rejects invalid locale", () => {
    const res = mockRes();
    updateOrgProfile({ user: adminUser, body: { name: "Org", locale: "english" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });
});

describe("membership types", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"], userId: "u1" };
  const memberUser = { tenantId: "t1", roles: ["member"], userId: "u2" };

  it("creates membership type", () => {
    const res = mockRes();
    createMembershipType({ user: adminUser, body: { name: "Basic", price: 1000, period: "monthly" } } as any, res as any);
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it("rejects duplicate name", () => {
    createMembershipType({ user: adminUser, body: { name: "Basic", price: 1000, period: "monthly" } } as any, mockRes() as any);
    const res = mockRes();
    createMembershipType({ user: adminUser, body: { name: "Basic", price: 1500, period: "annual" } } as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("validates price and period", () => {
    const res = mockRes();
    createMembershipType({ user: adminUser, body: { name: "Bad", price: -1, period: "weekly" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("requires admin", () => {
    const res = mockRes();
    createMembershipType({ user: memberUser, body: { name: "X", price: 1000, period: "monthly" } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("lists membership types per tenant", () => {
    createMembershipType({ user: adminUser, body: { name: "Basic", price: 1000, period: "monthly" } } as any, mockRes() as any);
    createMembershipType({ user: { tenantId: "t2", roles: ["admin"] }, body: { name: "Other", price: 2000, period: "annual" } } as any, mockRes() as any);
    const res = mockRes();
    listMembershipTypes({ user: adminUser } as any, res as any);
    expect(res.body.items.length).toBe(1);
  });
});

describe("approval workflow", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"], userId: "u1" };
  const memberUser = { tenantId: "t1", roles: ["member"], userId: "u2" };

  it("loads default workflow", () => {
    const res = mockRes();
    getApprovalWorkflow({ user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.requireApproval).toBe(false);
    expect(res.body.approverRoles).toEqual([]);
  });

  it("updates workflow from false to true with roles", () => {
    const res = mockRes();
    updateApprovalWorkflow({ user: adminUser, body: { requireApproval: true, approverRoles: ["admin"] } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.requireApproval).toBe(true);
    expect(res.body.approverRoles).toEqual(["admin"]);

    const res2 = mockRes();
    updateApprovalWorkflow({ user: adminUser, body: { requireApproval: false } } as any, res2 as any);
    expect(res2.statusCode).toBe(200);
    expect(res2.body.requireApproval).toBe(false);
  });

  it("rejects invalid payloads", () => {
    const res = mockRes();
    updateApprovalWorkflow({ user: adminUser, body: { requireApproval: "yes" } } as any, res as any);
    expect(res.statusCode).toBe(400);

    const res2 = mockRes();
    updateApprovalWorkflow({ user: adminUser, body: { requireApproval: true, approverRoles: [] } } as any, res: res2 as any);
    expect(res2.statusCode).toBe(400);
  });

  it("forbids non-admin", () => {
    const res = mockRes();
    updateApprovalWorkflow({ user: memberUser, body: { requireApproval: true, approverRoles: ["admin"] } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("tenant isolation for workflow load", () => {
    updateApprovalWorkflow({ user: adminUser, body: { requireApproval: true, approverRoles: ["admin"] } } as any, mockRes() as any);
    const res = mockRes();
    getApprovalWorkflow({ user: { tenantId: "t2", roles: ["admin"] } } as any, res as any);
    expect(res.body.requireApproval).toBe(false);
  });

  it("requires auth", () => {
    const res = mockRes();
    getApprovalWorkflow({} as any, res as any);
    expect(res.statusCode).toBe(401);
  });
});

describe("payment categories", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"], userId: "u1" };
  const memberUser = { tenantId: "t1", roles: ["member"], userId: "u2" };

  it("lists empty for tenant", () => {
    const res = mockRes();
    listPaymentCategories({ user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it("creates payment category", () => {
    const res = mockRes();
    createPaymentCategory(
      { user: adminUser, body: { code: "DUES", name: "Dues", type: "dues", description: "Membership dues" } } as any,
      res as any
    );
    expect(res.statusCode).toBe(201);
    expect(res.body.code).toBe("DUES");
  });

  it("rejects duplicate code", () => {
    createPaymentCategory({ user: adminUser, body: { code: "DUES", name: "Dues", type: "dues" } } as any, mockRes() as any);
    const res = mockRes();
    createPaymentCategory({ user: adminUser, body: { code: "dues", name: "Duplicate", type: "dues" } } as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("rejects invalid payloads", () => {
    const res = mockRes();
    createPaymentCategory({ user: adminUser, body: { code: "", name: "", type: "x" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("updates payment category and rejects no-change", () => {
    const createRes = mockRes();
    createPaymentCategory({ user: adminUser, body: { code: "EVENT", name: "Event", type: "event" } } as any, createRes as any);
    const id = createRes.body.id;
    const res = mockRes();
    updatePaymentCategory({ user: adminUser, params: { id }, body: { name: "Event Fees", active: false } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe("Event Fees");
    expect(res.body.active).toBe(false);

    const resNoChange = mockRes();
    updatePaymentCategory({ user: adminUser, params: { id }, body: {} } as any, resNoChange as any);
    expect(resNoChange.statusCode).toBe(409);
  });

  it("forbids non-admin", () => {
    const res = mockRes();
    createPaymentCategory({ user: memberUser, body: { code: "DUES", name: "Dues", type: "dues" } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("tenant isolation", () => {
    createPaymentCategory({ user: adminUser, body: { code: "DUES", name: "Dues", type: "dues" } } as any, mockRes() as any);
    const res = mockRes();
    listPaymentCategories({ user: { tenantId: "t2", roles: ["admin"] } } as any, res as any);
    expect(res.body.items).toHaveLength(0);
  });
});

describe("invoice template", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"], userId: "u1" };
  const memberUser = { tenantId: "t1", roles: ["member"], userId: "u2" };

  it("loads default template", () => {
    const res = mockRes();
    getInvoiceTemplate({ user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.subject).toBeDefined();
    expect(res.body.body).toBeDefined();
  });

  it("updates template", () => {
    const res = mockRes();
    updateInvoiceTemplate({ user: adminUser, body: { subject: "New Subject", body: "Hello {{member.name}}" } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.subject).toBe("New Subject");
    expect(res.body.body).toBe("Hello {{member.name}}");
  });

  it("rejects empty subject/body", () => {
    const res = mockRes();
    updateInvoiceTemplate({ user: adminUser, body: { subject: "", body: "short" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects unchanged payload", () => {
    const res1 = mockRes();
    updateInvoiceTemplate({ user: adminUser, body: { subject: "S1", body: "Body content long enough" } } as any, res1 as any);
    const res2 = mockRes();
    updateInvoiceTemplate({ user: adminUser, body: {} } as any, res2 as any);
    expect(res2.statusCode).toBe(400); // empty payload

    const res3 = mockRes();
    updateInvoiceTemplate({ user: adminUser, body: { subject: "S1", body: "Body content long enough" } } as any, res3 as any);
    expect(res3.statusCode).toBe(409);
  });

  it("forbids non-admin", () => {
    const res = mockRes();
    updateInvoiceTemplate({ user: memberUser, body: { subject: "S", body: "Long enough body text" } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("tenant isolation", () => {
    updateInvoiceTemplate({ user: adminUser, body: { subject: "Tenant1", body: "Body for t1 long enough" } } as any, mockRes() as any);
    const res = mockRes();
    getInvoiceTemplate({ user: { tenantId: "t2", roles: ["admin"] } } as any, res as any);
    expect(res.body.subject).not.toBe("Tenant1");
  });
});

describe("feature flags", () => {
  const adminUser = { tenantId: "t1", roles: ["admin"], userId: "u1" };
  const memberUser = { tenantId: "t1", roles: ["member"], userId: "u2" };

  it("loads defaults", () => {
    const res = mockRes();
    getFeatureFlags({ user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.payments).toBe(true);
  });

  it("updates flags", () => {
    const res = mockRes();
    updateFeatureFlags({ user: adminUser, body: { payments: false, events: true } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.payments).toBe(false);
    expect(res.body.events).toBe(true);
  });

  it("rejects invalid types", () => {
    const res = mockRes();
    updateFeatureFlags({ user: adminUser, body: { payments: "nope" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects unchanged", () => {
    const res1 = mockRes();
    updateFeatureFlags({ user: adminUser, body: { payments: false } } as any, res1 as any);
    const res2 = mockRes();
    updateFeatureFlags({ user: adminUser, body: { payments: false } } as any, res2 as any);
    expect(res2.statusCode).toBe(409);
  });

  it("tenant isolation", () => {
    updateFeatureFlags({ user: adminUser, body: { payments: false } } as any, mockRes() as any);
    const res = mockRes();
    getFeatureFlags({ user: { tenantId: "t2", roles: ["admin"] } } as any, res as any);
    expect(res.body.payments).toBe(true);
  });

  it("forbids non-admin", () => {
    const res = mockRes();
    updateFeatureFlags({ user: memberUser, body: { payments: false } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });
});

