import {
  createEvent,
  __resetEvents,
  publishEvent,
  __getAuditLogs,
  updateEventCapacity,
  __setRegistrationsCount,
  registerForEvent,
  __getRegistrations,
  cancelRegistration,
  listUpcomingEvents,
  updateEventPricing,
  runEventReminders,
  __getEventReminderEvents,
} from "../src/handlers";

const mockRes = () => {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

describe("events create", () => {
  const adminUser = { tenantId: "t1", userId: "u1", roles: ["admin"] };
  const memberUser = { tenantId: "t1", userId: "u2", roles: ["member"] };

  beforeEach(() => __resetEvents());

  it("creates a draft event as admin", () => {
    const req: any = {
      user: adminUser,
      body: { title: "Board Meeting", description: "Monthly board", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z", capacity: 20, price: 1000 },
    };
    const res = mockRes();
    createEvent(req as any, res as any);
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("draft");
    expect(res.body.title).toBe("Board Meeting");
  });

  it("validates dates and required fields", () => {
    const req: any = { user: adminUser, body: { title: "", startDate: "2025-02-02T10:00:00Z", endDate: "2025-02-01T10:00:00Z" } };
    const res = mockRes();
    createEvent(req as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-admin", () => {
    const req: any = { user: memberUser, body: { title: "X", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z" } };
    const res = mockRes();
    createEvent(req as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("rejects unauthenticated", () => {
    const req: any = { body: { title: "X", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z" } };
    const res = mockRes();
    createEvent(req as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("prevents duplicate title per tenant", () => {
    const req: any = {
      user: adminUser,
      body: { title: "Dup", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z" },
    };
    const res1 = mockRes();
    createEvent(req as any, res1 as any);
    const res2 = mockRes();
    createEvent(req as any, res2 as any);
    expect(res2.statusCode).toBe(400);
  });
});

describe("publish event", () => {
  const adminUser = { tenantId: "t1", userId: "u1", roles: ["admin"] };
  const adminOther = { tenantId: "t2", userId: "u2", roles: ["admin"] };

  beforeEach(() => __resetEvents());

  const createDraft = () =>
    (() => {
      const req: any = {
        user: adminUser,
        body: { title: "Draft", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z" },
      };
      const res = mockRes();
      createEvent(req as any, res as any);
      return res.body;
    })();

  it("publishes a draft event", () => {
    const draft = createDraft();
    const res = mockRes();
    publishEvent({ params: { id: draft.id }, user: adminUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("published");
    expect(__getAuditLogs().some((a) => a.action === "event.published" && a.eventId === draft.id)).toBe(true);
  });

  it("rejects non-admin", () => {
    const draft = createDraft();
    const res = mockRes();
    publishEvent({ params: { id: draft.id }, user: { tenantId: "t1", roles: ["member"] } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("rejects unauthenticated", () => {
    const draft = createDraft();
    const res = mockRes();
    publishEvent({ params: { id: draft.id } } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("rejects cross-tenant", () => {
    const draft = createDraft();
    const res = mockRes();
    publishEvent({ params: { id: draft.id }, user: adminOther } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("rejects already published", () => {
    const draft = createDraft();
    const res1 = mockRes();
    publishEvent({ params: { id: draft.id }, user: adminUser } as any, res1 as any);
    const res2 = mockRes();
    publishEvent({ params: { id: draft.id }, user: adminUser } as any, res2 as any);
    expect(res2.statusCode).toBe(409);
  });

  it("rejects invalid date data", () => {
    const req: any = {
      user: adminUser,
      body: { title: "Bad", startDate: "2025-02-02T10:00:00Z", endDate: "2025-02-01T09:00:00Z" },
    };
    const resDraft = mockRes();
    createEvent(req as any, resDraft as any);
    const draft = resDraft.body;
    const resPub = mockRes();
    publishEvent({ params: { id: draft.id }, user: adminUser } as any, resPub as any);
    expect(resPub.statusCode).toBe(400);
  });
});

describe("update capacity", () => {
  const adminUser = { tenantId: "t1", userId: "u1", roles: ["admin"] };

  beforeEach(() => __resetEvents());

  const createDraft = () =>
    (() => {
      const req: any = {
        user: adminUser,
        body: { title: "Draft", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z" },
      };
      const res = mockRes();
      createEvent(req as any, res as any);
      return res.body;
    })();

  it("updates capacity", () => {
    const draft = createDraft();
    const res = mockRes();
    updateEventCapacity({ params: { id: draft.id }, user: adminUser, body: { capacity: 50 } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.capacity).toBe(50);
    expect(__getAuditLogs().some((a) => a.action === "event.capacity.updated" && a.eventId === draft.id)).toBe(true);
  });

  it("rejects negative capacity", () => {
    const draft = createDraft();
    const res = mockRes();
    updateEventCapacity({ params: { id: draft.id }, user: adminUser, body: { capacity: -1 } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects below current registrations", () => {
    const draft = createDraft();
    __setRegistrationsCount(draft.id, 10);
    const res = mockRes();
    updateEventCapacity({ params: { id: draft.id }, user: adminUser, body: { capacity: 5 } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-admin", () => {
    const draft = createDraft();
    const res = mockRes();
    updateEventCapacity({ params: { id: draft.id }, user: { tenantId: "t1", roles: ["member"] }, body: { capacity: 10 } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("rejects unauthenticated", () => {
    const draft = createDraft();
    const res = mockRes();
    updateEventCapacity({ params: { id: draft.id }, body: { capacity: 10 } } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("rejects cross-tenant", () => {
    const draft = createDraft();
    const res = mockRes();
    updateEventCapacity({ params: { id: draft.id }, user: { tenantId: "t2", roles: ["admin"] }, body: { capacity: 10 } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("rejects missing event", () => {
    const res = mockRes();
    updateEventCapacity({ params: { id: "evt-x" }, user: adminUser, body: { capacity: 10 } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("conflict when unchanged", () => {
    const draft = createDraft();
    const res1 = mockRes();
    updateEventCapacity({ params: { id: draft.id }, user: adminUser, body: { capacity: 10 } } as any, res1 as any);
    const res2 = mockRes();
    updateEventCapacity({ params: { id: draft.id }, user: adminUser, body: { capacity: 10 } } as any, res2 as any);
    expect(res2.statusCode).toBe(409);
  });
});

describe("register for event", () => {
  const memberUser = { tenantId: "t1", memberId: "m1", userId: "u1", roles: ["member"] };
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };

  beforeEach(() => __resetEvents());

  const createPublished = () =>
    (() => {
      const req: any = {
        user: adminUser,
        body: { title: "Pub", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z", capacity: 1 },
      };
      const res = mockRes();
      createEvent(req as any, res as any);
      const ev = res.body;
      const resPub = mockRes();
      publishEvent({ params: { id: ev.id }, user: adminUser } as any, resPub as any);
      return ev;
    })();

  it("registers successfully and increments count", () => {
    const ev = createPublished();
    const res = mockRes();
    registerForEvent({ params: { id: ev.id }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("registered");
    expect(__getRegistrations().length).toBe(1);
    expect(__getAuditLogs().some((a) => a.action === "event.registration.created" && a.eventId === ev.id)).toBe(true);
  });

  it("prevents duplicate registration", () => {
    const ev = createPublished();
    const res1 = mockRes();
    registerForEvent({ params: { id: ev.id }, user: memberUser } as any, res1 as any);
    const res2 = mockRes();
    registerForEvent({ params: { id: ev.id }, user: memberUser } as any, res2 as any);
    expect(res2.statusCode).toBe(409);
  });

  it("rejects when event full", () => {
    const ev = createPublished();
    __setRegistrationsCount(ev.id, 1);
    const res = mockRes();
    registerForEvent({ params: { id: ev.id }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("requires auth", () => {
    const ev = createPublished();
    const res = mockRes();
    registerForEvent({ params: { id: ev.id } } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-member role", () => {
    const ev = createPublished();
    const res = mockRes();
    registerForEvent({ params: { id: ev.id }, user: { tenantId: "t1", roles: ["admin"] } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("rejects cross-tenant", () => {
    const ev = createPublished();
    const res = mockRes();
    registerForEvent({ params: { id: ev.id }, user: { tenantId: "t2", memberId: "m2", roles: ["member"] } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("rejects when event not published", () => {
    // create draft only
    const req: any = { user: adminUser, body: { title: "Draft", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z" } };
    const resDraft = mockRes();
    createEvent(req as any, resDraft as any);
    const draft = resDraft.body;
    const res = mockRes();
    registerForEvent({ params: { id: draft.id }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(400);
  });
});

describe("cancel registration", () => {
  const memberUser = { tenantId: "t1", memberId: "m1", userId: "u1", roles: ["member"] };
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };

  beforeEach(() => __resetEvents());

  const createPublished = () =>
    (() => {
      const req: any = {
        user: adminUser,
        body: { title: "Pub", startDate: "2025-02-01T10:00:00Z", endDate: "2025-02-01T11:00:00Z", capacity: 2 },
      };
      const res = mockRes();
      createEvent(req as any, res as any);
      const ev = res.body;
      const resPub = mockRes();
      publishEvent({ params: { id: ev.id }, user: adminUser } as any, resPub as any);
      return ev;
    })();

  const registerMember = (evId: string) => {
    const res = mockRes();
    registerForEvent({ params: { id: evId }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(201);
  };

  it("cancels registration and decrements count", () => {
    const ev = createPublished();
    registerMember(ev.id);
    const res = mockRes();
    cancelRegistration({ params: { id: ev.id }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("canceled");
    expect(__getRegistrations().length).toBe(0);
  });

  it("returns 404 when no registration", () => {
    const ev = createPublished();
    const res = mockRes();
    cancelRegistration({ params: { id: ev.id }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when event missing", () => {
    const res = mockRes();
    cancelRegistration({ params: { id: "evt-x" }, user: memberUser } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("requires auth", () => {
    const ev = createPublished();
    const res = mockRes();
    cancelRegistration({ params: { id: ev.id } } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-member", () => {
    const ev = createPublished();
    const res = mockRes();
    cancelRegistration({ params: { id: ev.id }, user: { tenantId: "t1", roles: ["admin"] } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("rejects cross-tenant", () => {
    const ev = createPublished();
    const res = mockRes();
    cancelRegistration({ params: { id: ev.id }, user: { tenantId: "t2", memberId: "m2", roles: ["member"] } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });
});

describe("list upcoming events", () => {
  const memberUser = { tenantId: "t1", memberId: "m1", roles: ["member"] };
  const adminUser = { tenantId: "t1", memberId: "m-admin", roles: ["admin"] };

  beforeEach(() => __resetEvents());

  const createEventWith = (overrides: Partial<{ status: "draft" | "published"; start: string; end: string; tenantId: string }>) => {
    const tenantId = overrides.tenantId || "t1";
    const status = overrides.status || "published";
    const startDate = overrides.start || new Date(Date.now() + 3600 * 1000).toISOString();
    const endDate = overrides.end || new Date(Date.now() + 7200 * 1000).toISOString();
    const req: any = { user: { ...adminUser, tenantId }, body: { title: `Evt-${Math.random()}`, startDate, endDate } };
    const res = mockRes();
    createEvent(req as any, res as any);
    const ev = res.body;
    if (status === "published") {
      const resPub = mockRes();
      publishEvent({ params: { id: ev.id }, user: { ...adminUser, tenantId } } as any, resPub as any);
    }
    return { ...ev, tenantId, status };
  };

  it("returns published upcoming events ordered", () => {
    const future1 = createEventWith({ start: new Date(Date.now() + 3600 * 1000).toISOString(), end: new Date(Date.now() + 7200 * 1000).toISOString() });
    const future2 = createEventWith({ start: new Date(Date.now() + 1800 * 1000).toISOString(), end: new Date(Date.now() + 5400 * 1000).toISOString() });
    const res = mockRes();
    listUpcomingEvents({ user: memberUser, query: {}, headers: {} } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(new Date(res.body.items[0].startDate).getTime()).toBeLessThan(new Date(res.body.items[1].startDate).getTime());
  });

  it("excludes drafts and past events", () => {
    createEventWith({ status: "draft" });
    createEventWith({ status: "published", start: new Date(Date.now() - 7200 * 1000).toISOString(), end: new Date(Date.now() - 3600 * 1000).toISOString() });
    const res = mockRes();
    listUpcomingEvents({ user: memberUser, query: {}, headers: {} } as any, res as any);
    expect(res.body.items.length).toBe(0);
  });

  it("paginates", () => {
    createEventWith({});
    createEventWith({});
    const res = mockRes();
    listUpcomingEvents({ user: memberUser, query: { page: "1", page_size: "1" }, headers: {} } as any, res as any);
    expect(res.body.items.length).toBe(1);
    expect(res.body.total_items).toBeGreaterThanOrEqual(2);
  });

  it("enforces auth", () => {
    const res = mockRes();
    listUpcomingEvents({ query: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("forbids non-member/non-admin", () => {
    const res = mockRes();
    listUpcomingEvents({ user: { tenantId: "t1", roles: ["guest"] }, query: {} } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("tenant scoping - excludes other tenant events", () => {
    createEventWith({ tenantId: "t2" });
    const res = mockRes();
    listUpcomingEvents({ user: memberUser, query: {}, headers: {} } as any, res as any);
    expect(res.body.items.length).toBe(0);
  });
});

describe("update event pricing", () => {
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };

  beforeEach(() => __resetEvents());

  const createDraft = (startOffsetMs = 3600_000) =>
    (() => {
      const start = new Date(Date.now() + startOffsetMs).toISOString();
      const end = new Date(Date.now() + startOffsetMs + 3600_000).toISOString();
      const res = mockRes();
      createEvent({ user: adminUser, body: { title: "Draft", startDate: start, endDate: end } } as any, res as any);
      return res.body;
    })();

  it("updates pricing with audit", () => {
    const ev = createDraft();
    const res = mockRes();
    updateEventPricing({ params: { id: ev.id }, user: adminUser, body: { price: 5000, currency: "PHP" } } as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.price).toBe(5000);
    expect(res.body.currency).toBe("PHP");
    expect(__getAuditLogs().some((a) => a.action === "event.pricing.updated" && a.eventId === ev.id)).toBe(true);
  });

  it("rejects non-admin", () => {
    const ev = createDraft();
    const res = mockRes();
    updateEventPricing({ params: { id: ev.id }, user: { tenantId: "t1", roles: ["member"] }, body: { price: 1000, currency: "PHP" } } as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("404 for missing event", () => {
    const res = mockRes();
    updateEventPricing({ params: { id: "evt-x" }, user: adminUser, body: { price: 1000, currency: "PHP" } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });

  it("rejects negative price", () => {
    const ev = createDraft();
    const res = mockRes();
    updateEventPricing({ params: { id: ev.id }, user: adminUser, body: { price: -1, currency: "PHP" } } as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects past event", () => {
    const ev = createDraft(-7200_000);
    const res = mockRes();
    updateEventPricing({ params: { id: ev.id }, user: adminUser, body: { price: 1000, currency: "PHP" } } as any, res as any);
    expect(res.statusCode).toBe(409);
  });

  it("rejects cross-tenant", () => {
    const ev = createDraft();
    const res = mockRes();
    updateEventPricing({ params: { id: ev.id }, user: { tenantId: "t2", roles: ["admin"] }, body: { price: 1000, currency: "PHP" } } as any, res as any);
    expect(res.statusCode).toBe(404);
  });
});

describe("event reminders", () => {
  const adminUser = { tenantId: "t1", memberId: "m-admin", userId: "u-admin", roles: ["admin"] };

  beforeEach(() => __resetEvents());

  const createPublished = (startOffsetMs = 12 * 60 * 60 * 1000) =>
    (() => {
      const start = new Date(Date.now() + startOffsetMs).toISOString();
      const end = new Date(Date.now() + startOffsetMs + 60 * 60 * 1000).toISOString();
      const res = mockRes();
      createEvent({ user: adminUser, body: { title: "ReminderEvt", startDate: start, endDate: end } } as any, res as any);
      const ev = res.body;
      const resPub = mockRes();
      publishEvent({ params: { id: ev.id }, user: adminUser } as any, resPub as any);
      return ev;
    })();

  const addRegistration = (evId: string, tenantId = "t1", memberId = "m1") => {
    const res = mockRes();
    registerForEvent({ params: { id: evId }, user: { tenantId, memberId, roles: ["member"] } } as any, res as any);
    expect(res.statusCode).toBe(201);
  };

  it("sends reminders for upcoming events once", () => {
    const ev = createPublished(6 * 60 * 60 * 1000);
    addRegistration(ev.id);
    const res1 = mockRes();
    runEventReminders({ user: adminUser, headers: {} } as any, res1 as any);
    expect(res1.statusCode).toBe(200);
    expect(res1.body.sent).toBe(1);
    expect(__getEventReminderEvents().length).toBe(1);
    const res2 = mockRes();
    runEventReminders({ user: adminUser, headers: {} } as any, res2 as any);
    expect(res2.body.sent).toBe(0);
  });

  it("skips draft events", () => {
    const start = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
    const resEvt = mockRes();
    createEvent({ user: adminUser, body: { title: "DraftEvt", startDate: start, endDate: end } } as any, resEvt as any);
    const ev = resEvt.body;
    addRegistration(ev.id);
    const res = mockRes();
    runEventReminders({ user: adminUser, headers: {} } as any, res as any);
    expect(res.body.sent).toBe(0);
  });

  it("skips past events and beyond window", () => {
    const past = createPublished(-2 * 60 * 60 * 1000);
    addRegistration(past.id);
    const future = createPublished(48 * 60 * 60 * 1000);
    addRegistration(future.id);
    const res = mockRes();
    runEventReminders({ user: adminUser, headers: {} } as any, res as any);
    expect(res.body.sent).toBe(0);
  });

  it("skips already reminded", () => {
    const ev = createPublished(6 * 60 * 60 * 1000);
    addRegistration(ev.id);
    const reg = __getRegistrations().find((r) => r.eventId === ev.id)!;
    reg.reminderSentAt = Date.now();
    const res = mockRes();
    runEventReminders({ user: adminUser, headers: {} } as any, res as any);
    expect(res.body.sent).toBe(0);
  });

  it("tenant scoped", () => {
    const ev = createPublished(6 * 60 * 60 * 1000);
    addRegistration(ev.id, "t2", "m2"); // different tenant
    const res = mockRes();
    runEventReminders({ user: adminUser, headers: {} } as any, res as any);
    expect(res.body.sent).toBe(0);
  });

  it("requires auth", () => {
    const res = mockRes();
    runEventReminders({ headers: {} } as any, res as any);
    expect(res.statusCode).toBe(401);
  });
});

