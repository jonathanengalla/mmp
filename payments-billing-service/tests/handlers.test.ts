import {
  createPaymentMethod,
  listPaymentMethods,
  createPayment,
  __resetPaymentMethods,
  __resetInvoices,
  __seedInvoice,
  markInvoicePaid,
  __getAuditLogs,
  payEventFee,
  __seedEvent,
  __seedRegistration,
  __getReceiptEvents,
  __seedMember,
  createManualInvoice,
  __seedMembershipType,
  __setMemberStatus,
  __assignMembershipType,
  runDuesJob,
  sendInvoice,
  __getInvoiceSendEvents,
  listMemberInvoices,
  downloadInvoicePdf,
  runPaymentReminders,
  __getReminderEvents,
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

const makeReq = (body: any, user: any = null, query: any = {}, headers: any = {}) => ({
  body,
  query,
  user,
  headers,
});

describe("payment methods", () => {
  beforeEach(() => {
    __resetPaymentMethods();
    __resetInvoices();
    __getReceiptEvents().length = 0;
  });

  const authedUser = { tenantId: "t1", memberId: "m1", roles: ["member"] };

  it("creates a payment method with valid card", () => {
    const req: any = makeReq({ number: "4242424242424242", exp_month: 12, exp_year: 2030, cvc: "123" }, authedUser);
    const res = mockRes();

    createPaymentMethod(req as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body.payment_method_id).toBeDefined();
    expect(res.body.last4).toBe("4242");
    expect(res.body.brand).toBe("visa");
  });

  it("rejects validation errors", () => {
    const req: any = makeReq({ number: "123", exp_month: 15, exp_year: 2010, cvc: "12" }, authedUser);
    const res = mockRes();

    createPaymentMethod(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("requires authentication", () => {
    const req: any = makeReq({ number: "4242424242424242", exp_month: 12, exp_year: 2030, cvc: "123" }, null);
    const res = mockRes();

    createPaymentMethod(req as any, res as any);

    expect(res.statusCode).toBe(401);
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("lists only current member methods and paginates", () => {
    // create for member 1
    createPaymentMethod(makeReq({ number: "4242424242424242", exp_month: 12, exp_year: 2030, cvc: "123" }, authedUser) as any, mockRes() as any);
    createPaymentMethod(makeReq({ number: "5555555555554444", exp_month: 11, exp_year: 2031, cvc: "999" }, authedUser) as any, mockRes() as any);
    // create for another member
    createPaymentMethod(makeReq({ number: "4000000000000002", exp_month: 10, exp_year: 2031, cvc: "111" }, { tenantId: "t1", memberId: "m2" }) as any, mockRes() as any);

    const res = mockRes();
    listPaymentMethods(makeReq({}, authedUser, { page: "1", page_size: "1" }) as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total_items).toBe(2);
    expect(res.body.total_pages).toBeGreaterThanOrEqual(2);
  });

  it("requires auth on list", () => {
    const res = mockRes();
    listPaymentMethods(makeReq({}, null) as any, res as any);
    expect(res.statusCode).toBe(401);
  });
});

describe("one-time payments", () => {
  const authedUser = { tenantId: "t1", memberId: "m1", roles: ["member"] };

  beforeEach(() => {
    __resetPaymentMethods();
    __resetInvoices();
    __getReceiptEvents().length = 0;
  });

  it("pays an unpaid invoice with saved payment method", () => {
    const invoice = __seedInvoice("t1", "m1", 2000, "USD", "unpaid");
    const pmRes = mockRes();
    createPaymentMethod(makeReq({ number: "4242424242424242", exp_month: 12, exp_year: 2030, cvc: "123" }, authedUser) as any, pmRes as any);
    const paymentMethodId = pmRes.body.payment_method_id;

    const res = mockRes();
    createPayment(makeReq({ invoice_id: invoice.id, payment_method_id: paymentMethodId }, authedUser) as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("paid");
    expect(res.body.invoice_id).toBe(invoice.id);
    expect(invoice.status).toBe("paid");
    expect(__getReceiptEvents().length).toBe(1);
  });

  it("pays with one-time card when no saved method", () => {
    const invoice = __seedInvoice("t1", "m1", 1500, "USD", "unpaid");

    const res = mockRes();
    createPayment(
      makeReq(
        { invoice_id: invoice.id, card: { number: "5555555555554444", exp_month: 11, exp_year: 2031, cvc: "321" } },
        authedUser
      ) as any,
      res as any
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.amount).toBe(1500);
    expect(res.body.status).toBe("paid");
    expect(invoice.status).toBe("paid");
    expect(__getReceiptEvents().length).toBe(1);
  });

  it("rejects already paid invoice", () => {
    const invoice = __seedInvoice("t1", "m1", 1500, "USD", "paid");
    const res = mockRes();
    createPayment(makeReq({ invoice_id: invoice.id }, authedUser) as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("rejects missing auth", () => {
    const invoice = __seedInvoice("t1", "m1", 1500, "USD", "unpaid");
    const res = mockRes();
    createPayment(makeReq({ invoice_id: invoice.id }, null) as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("rejects invoice not found", () => {
    const res = mockRes();
    createPayment(makeReq({ invoice_id: "inv-x" }, authedUser) as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("enforces invoice ownership", () => {
    const invoice = __seedInvoice("t1", "m2", 1000, "USD", "unpaid");
    const res = mockRes();
    createPayment(makeReq({ invoice_id: invoice.id }, authedUser) as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("supports idempotency", () => {
    const invoice = __seedInvoice("t1", "m1", 1000, "USD", "unpaid");
    const res1 = mockRes();
    createPayment(makeReq({ invoice_id: invoice.id }, authedUser, {}, { "idempotency-key": "idem-1" }) as any, res1 as any);
    const paymentId = res1.body.payment_id;

    const res2 = mockRes();
    createPayment(makeReq({ invoice_id: invoice.id }, authedUser, {}, { "idempotency-key": "idem-1" }) as any, res2 as any);

    expect(res2.body.payment_id).toBe(paymentId);
    expect(res2.body.status).toBe("paid");
    expect(__getReceiptEvents().length).toBe(1);
  });

  it("rejects when no payment method or card provided", () => {
    const invoice = __seedInvoice("t1", "m1", 1000, "USD", "unpaid");
    const res = mockRes();
    createPayment(makeReq({ invoice_id: invoice.id }, authedUser) as any, res as any);
    expect(res.statusCode).toBe(400);
    expect(__getReceiptEvents().length).toBe(0);
  });
});

describe("mark invoice paid", () => {
  const authedUser = { tenantId: "t1", memberId: "m1", roles: ["admin"] };

  beforeEach(() => {
    __resetInvoices();
    __getReceiptEvents().length = 0;
  });

  it("marks unpaid invoice as paid and logs audit", () => {
    const invoice = __seedInvoice("t1", "m1", 5000, "USD", "unpaid");
    const res = mockRes();

    markInvoicePaid({ params: { id: invoice.id }, user: authedUser } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("paid");
    expect(invoice.status).toBe("paid");
    expect(__getAuditLogs().length).toBe(1);
    expect(__getReceiptEvents().length).toBe(1);
  });

  it("is idempotent when already paid", () => {
    const invoice = __seedInvoice("t1", "m1", 5000, "USD", "paid");
    const res = mockRes();
    markInvoicePaid({ params: { id: invoice.id }, user: authedUser } as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(__getAuditLogs().length).toBe(0);
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("rejects invalid status (void)", () => {
    const invoice = __seedInvoice("t1", "m1", 5000, "USD", "void");
    const res = mockRes();
    markInvoicePaid({ params: { id: invoice.id }, user: authedUser } as any, res as any);
    expect(res.statusCode).toBe(409);
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("returns 404 for missing invoice", () => {
    const res = mockRes();
    markInvoicePaid({ params: { id: "inv-x" }, user: authedUser } as any, res as any);
    expect(res.statusCode).toBe(404);
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("rejects cross-tenant access", () => {
    const invoice = __seedInvoice("t2", "m1", 5000, "USD", "unpaid");
    const res = mockRes();
    markInvoicePaid({ params: { id: invoice.id }, user: authedUser } as any, res as any);
    expect(res.statusCode).toBe(404); // hidden cross-tenant
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("requires auth", () => {
    const invoice = __seedInvoice("t1", "m1", 5000, "USD", "unpaid");
    const res = mockRes();
    markInvoicePaid({ params: { id: invoice.id } } as any, res as any);
    expect(res.statusCode).toBe(401);
    expect(__getReceiptEvents().length).toBe(0);
  });
});

describe("event fee payment", () => {
  const authedUser = { tenantId: "t1", memberId: "m1", roles: ["member"] };

  beforeEach(() => {
    __resetInvoices();
    __resetPaymentMethods();
    __getReceiptEvents().length = 0;
  });

  it("creates invoice if missing and pays with saved method", () => {
    const ev = __seedEvent("t1", 3000, "USD", "open");
    const reg = __seedRegistration("t1", ev.id, "m1", "pending");
    const pmRes = mockRes();
    createPaymentMethod(makeReq({ number: "4242424242424242", exp_month: 12, exp_year: 2030, cvc: "123" }, authedUser) as any, pmRes as any);
    const pmId = pmRes.body.payment_method_id;

    const res = mockRes();
    payEventFee({ params: { id: ev.id }, body: { payment_method_id: pmId }, user: authedUser, headers: {} } as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("paid");
    expect(reg.status).toBe("confirmed");
    expect(__getReceiptEvents().length).toBe(1);
  });

  it("pays with one-time card and uses idempotency", () => {
    const ev = __seedEvent("t1", 2000, "USD", "open");
    __seedRegistration("t1", ev.id, "m1", "pending");

    const res1 = mockRes();
    payEventFee(
      {
        params: { id: ev.id },
        body: { card: { number: "5555555555554444", exp_month: 11, exp_year: 2031, cvc: "999" } },
        user: authedUser,
        headers: { "idempotency-key": "idem-evt-1" },
      } as any,
      res1 as any
    );
    const payId = res1.body.payment_id;

    const res2 = mockRes();
    payEventFee(
      {
        params: { id: ev.id },
        body: { card: { number: "5555555555554444", exp_month: 11, exp_year: 2031, cvc: "999" } },
        user: authedUser,
        headers: { "idempotency-key": "idem-evt-1" },
      } as any,
      res2 as any
    );

    expect(res2.body.payment_id).toBe(payId);
    expect(__getReceiptEvents().length).toBe(1);
  });

  it("returns 404 when event not found", () => {
    const res = mockRes();
    payEventFee({ params: { id: "evt-x" }, body: {}, user: authedUser, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(404);
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("returns 404 when registration missing", () => {
    const ev = __seedEvent("t1", 2000, "USD", "open");
    const res = mockRes();
    payEventFee({ params: { id: ev.id }, body: {}, user: authedUser, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(404);
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("rejects invalid event status", () => {
    const ev = __seedEvent("t1", 2000, "USD", "closed");
    __seedRegistration("t1", ev.id, "m1", "pending");
    const res = mockRes();
    payEventFee({ params: { id: ev.id }, body: {}, user: authedUser, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(409);
    expect(__getReceiptEvents().length).toBe(0);
  });

  it("requires auth", () => {
    const ev = __seedEvent("t1", 2000, "USD", "open");
    __seedRegistration("t1", ev.id, "m1", "pending");
    const res = mockRes();
    payEventFee({ params: { id: ev.id }, body: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
    expect(__getReceiptEvents().length).toBe(0);
  });
});

describe("manual invoices", () => {
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };
  const memberUser = { tenantId: "t1", memberId: "m1", roles: ["member"] };

  beforeEach(() => {
    __resetInvoices();
    __getReceiptEvents().length = 0;
    __seedMember("t1", "m1");
  });

  it("creates manual invoice with admin role and logs audit", () => {
    const res = mockRes();
    createManualInvoice(
      {
        body: { member_id: "m1", amount: 5000, currency: "USD", description: "Manual dues" },
        user: adminUser,
      } as any,
      res as any
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("unpaid");
    expect(res.body.invoice_id).toBeDefined();
    expect(__getAuditLogs().some((a) => a.action === "created" && a.invoiceId === res.body.invoice_id)).toBe(true);
  });

  it("rejects non-admin", () => {
    const res = mockRes();
    createManualInvoice({ body: { member_id: "m1", amount: 5000, currency: "USD" }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("validates payload", () => {
    const res = mockRes();
    createManualInvoice({ body: { amount: -1 }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects cross-tenant member", () => {
    __seedMember("t2", "m-other");
    const res = mockRes();
    createManualInvoice({ body: { member_id: "m-other", amount: 1000, currency: "USD" }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(404);
  });
});

describe("dues job", () => {
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };
  const otherTenantAdmin = { tenantId: "t2", memberId: "m-admin2", userId: "u-admin2", roles: ["admin"] };

  beforeEach(() => {
    __resetInvoices();
    __getReceiptEvents().length = 0;
    const mt1 = __seedMembershipType("t1", 1000, "USD", "mt1");
    const mt2 = __seedMembershipType("t2", 2000, "USD", "mt2");
    const m1 = __seedMember("t1", "m1");
    const m2 = __seedMember("t1", "m2");
    const m3 = __seedMember("t2", "m3");
    __assignMembershipType(m1, mt1);
    __assignMembershipType(m2, mt1);
    __assignMembershipType(m3, mt2);
  });

  it("creates dues invoices for active members once", () => {
    const res = mockRes();
    runDuesJob({ user: adminUser, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(0);

    const res2 = mockRes();
    runDuesJob({ user: adminUser, headers: {} } as any, res2 as any);
    expect(res2.body.created).toBe(0);
    expect(res2.body.skipped).toBeGreaterThanOrEqual(2);
  });

  it("skips inactive members and missing membership type", () => {
    __setMemberStatus("m2", "inactive");
    const res = mockRes();
    runDuesJob({ user: adminUser, headers: {} } as any, res as any);
    expect(res.body.created).toBe(1);
    expect(res.body.skipped).toBe(1);
  });

  it("enforces tenant scoping", () => {
    const res = mockRes();
    runDuesJob({ user: otherTenantAdmin, headers: {} } as any, res as any);
    expect(res.body.created).toBe(1); // only tenant t2 member
  });

  it("rejects non-admin without internal header", () => {
    const res = mockRes();
    runDuesJob({ user: { tenantId: "t1", memberId: "m1", roles: ["member"] }, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("allows internal header", () => {
    const res = mockRes();
    runDuesJob({ user: { tenantId: "t1", memberId: "m1", roles: [] }, headers: { "x-internal": "true" } } as any, res as any);
    expect(res.statusCode).toBe(200);
  });
});

describe("send invoice", () => {
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };

  beforeEach(() => {
    __resetInvoices();
    __getReceiptEvents().length = 0;
    __getInvoiceSendEvents().length = 0;
    __seedMember("t1", "m1");
  });

  it("sends invoice and emits event", () => {
    const inv = __seedInvoice("t1", "m1", 1200, "USD", "unpaid");
    const res = mockRes();
    sendInvoice({ params: { id: inv.id }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("queued");
    expect(__getInvoiceSendEvents().length).toBe(1);
    expect(__getAuditLogs().some((a) => a.action === "send_requested" && a.invoiceId === inv.id)).toBe(true);
  });

  it("requires admin", () => {
    const inv = __seedInvoice("t1", "m1", 1200, "USD", "unpaid");
    const res = mockRes();
    sendInvoice({ params: { id: inv.id }, user: { tenantId: "t1", roles: ["member"] } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("404 when invoice missing", () => {
    const res = mockRes();
    sendInvoice({ params: { id: "inv-x" }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("404 when member missing", () => {
    const inv = __seedInvoice("t1", "missing", 1200, "USD", "unpaid");
    const res = mockRes();
    sendInvoice({ params: { id: inv.id }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("rejects invalid invoice status", () => {
    const inv = __seedInvoice("t1", "m1", 1200, "USD", "paid");
    const res = mockRes();
    sendInvoice({ params: { id: inv.id }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("idempotency per request: multiple calls produce events", () => {
    const inv = __seedInvoice("t1", "m1", 1200, "USD", "unpaid");
    const res1 = mockRes();
    sendInvoice({ params: { id: inv.id }, user: adminUser } as any, res1 as any);
    const res2 = mockRes();
    sendInvoice({ params: { id: inv.id }, user: adminUser } as any, res2 as any);
    expect(__getInvoiceSendEvents().length).toBe(2);
  });

  it("requires active member", () => {
    __setMemberStatus("m1", "inactive");
    const inv = __seedInvoice("t1", "m1", 1200, "USD", "unpaid");
    const res = mockRes();
    sendInvoice({ params: { id: inv.id }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(409);
  });
});

describe("list member invoices", () => {
  const memberUser = { tenantId: "t1", memberId: "m1", roles: ["member"] };

  beforeEach(() => {
    __resetInvoices();
    __getReceiptEvents().length = 0;
    __seedMember("t1", "m1");
    __seedMember("t1", "m2");
    __seedInvoice("t1", "m1", 1000, "USD", "unpaid");
    __seedInvoice("t1", "m1", 2000, "USD", "paid");
    __seedInvoice("t1", "m1", 1500, "USD", "overdue");
    __seedInvoice("t1", "m2", 999, "USD", "unpaid");
  });

  it("returns unpaid/overdue invoices for member", () => {
    const res = mockRes();
    listMemberInvoices({ user: memberUser, query: {}, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items.every((i: any) => i.status === "unpaid" || i.status === "overdue")).toBe(true);
  });

  it("supports pagination", () => {
    const res = mockRes();
    listMemberInvoices({ user: memberUser, query: { page: "1", page_size: "1" }, headers: {} } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total_items).toBe(2);
  });

  it("filters by status", () => {
    const res = mockRes();
    listMemberInvoices({ user: memberUser, query: { status: "overdue" }, headers: {} } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].status).toBe("overdue");
  });

  it("requires auth", () => {
    const res = mockRes();
    listMemberInvoices({ query: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("tenant/member scoped (excludes others)", () => {
    const res = mockRes();
    listMemberInvoices({ user: { tenantId: "t1", memberId: "m2", roles: ["member"] }, query: {}, headers: {} } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].amount).toBe(999);
  });
});

describe("payment reminders", () => {
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };

  beforeEach(() => {
    __resetInvoices();
    __getReminderEvents().length = 0;
    __seedMember("t1", "m1");
  });

  it("sends reminder for overdue invoice once", () => {
    const inv = __seedInvoice("t1", "m1", 1000, "USD", "overdue");
    inv.dueDate = new Date(Date.now() - 86400000).toISOString();
    const res1 = mockRes();
    runPaymentReminders({ user: adminUser, headers: {} } as any, res1 as any);
    expect(res1.statusCode).toBe(200);
    expect(res1.body.sent).toBe(1);
    expect(__getReminderEvents().length).toBe(1);
    const res2 = mockRes();
    runPaymentReminders({ user: adminUser, headers: {} } as any, res2 as any);
    expect(res2.body.sent).toBe(0);
  });

  it("skips paid or reminded", () => {
    const inv = __seedInvoice("t1", "m1", 1000, "USD", "paid");
    inv.dueDate = new Date(Date.now() - 86400000).toISOString();
    const res = mockRes();
    runPaymentReminders({ user: adminUser, headers: {} } as any, res as any);
    expect(res.body.sent).toBe(0);
  });

  it("respects tenant scoping", () => {
    const inv = __seedInvoice("t2", "m2", 1000, "USD", "overdue");
    inv.dueDate = new Date(Date.now() - 86400000).toISOString();
    const res = mockRes();
    runPaymentReminders({ user: adminUser, headers: {} } as any, res as any);
    expect(res.body.sent).toBe(0);
  });

  it("requires auth/admin", () => {
    const inv = __seedInvoice("t1", "m1", 1000, "USD", "overdue");
    inv.dueDate = new Date(Date.now() - 86400000).toISOString();
    const res = mockRes();
    runPaymentReminders({ headers: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
  });
});

describe("download invoice pdf", () => {
  const memberUser = { tenantId: "t1", memberId: "m1", roles: ["member"] };

  beforeEach(() => {
    __resetInvoices();
    __seedMember("t1", "m1");
  });

  it("allows member to download own invoice", () => {
    const inv = __seedInvoice("t1", "m1", 1000, "USD", "unpaid");
    const res = mockRes();
    res.setHeader = function (k: string, v: string) {
      this.headers = this.headers || {};
      this.headers[k] = v;
      return this;
    };
    res.send = function (body: any) {
      this.body = body;
      return this;
    };
    downloadInvoicePdf({ params: { id: inv.id }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/pdf");
    expect(res.body).toContain("%PDF");
    expect(__getAuditLogs().some((a) => a.action === "pdf_downloaded" && a.invoiceId === inv.id)).toBe(true);
  });

  it("requires auth", () => {
    const inv = __seedInvoice("t1", "m1", 1000, "USD", "unpaid");
    const res = mockRes();
    downloadInvoicePdf({ params: { id: inv.id } } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("forbids other member same tenant", () => {
    __seedMember("t1", "m2");
    const inv = __seedInvoice("t1", "m1", 1000, "USD", "unpaid");
    const res = mockRes();
    downloadInvoicePdf({ params: { id: inv.id }, user: { tenantId: "t1", memberId: "m2", roles: ["member"] } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("404 when invoice missing", () => {
    const res = mockRes();
    downloadInvoicePdf({ params: { id: "inv-x" }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(404);
  });
});

