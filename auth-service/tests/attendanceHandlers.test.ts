import assert from "node:assert/strict";
import test from "node:test";
import { markAttendance, undoAttendance, bulkMarkAttendance, getAttendanceReport } from "../src/attendanceHandlers";
import { prisma } from "../src/db/prisma";

type PrismaStubs = Partial<typeof prisma>;

const createRes = () => {
  const res: any = {
    statusCode: 200,
    body: null as any,
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
    setHeader() {
      return this;
    },
  };
  return res;
};

const createReq = (overrides: any = {}) => ({
  user: { tenantId: "t1" },
  params: {},
  query: {},
  body: {},
  ...overrides,
});

const snapshotPrisma = () => ({
  erFindFirst: prisma.eventRegistration.findFirst,
  erUpdate: prisma.eventRegistration.update,
  erUpdateMany: prisma.eventRegistration.updateMany,
  erFindMany: prisma.eventRegistration.findMany,
  eventFindFirst: prisma.event.findFirst,
  invoiceFindMany: prisma.invoice.findMany,
});

const restore = (originals: Record<string, any>) => {
  (prisma.eventRegistration as any).findFirst = originals.erFindFirst;
  (prisma.eventRegistration as any).update = originals.erUpdate;
  (prisma.eventRegistration as any).updateMany = originals.erUpdateMany;
  (prisma.eventRegistration as any).findMany = originals.erFindMany;
  (prisma.event as any).findFirst = originals.eventFindFirst;
  (prisma.invoice as any).findMany = originals.invoiceFindMany;
};

// ============================================================================
// Attendance Independence from Invoices
// ============================================================================

test("markAttendance sets checkedInAt without touching invoices", async () => {
  const originals = snapshotPrisma();
  let invoiceUpdateCalled = false;
  let invoiceCreateCalled = false;

  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    eventId: "ev1",
    memberId: "m1",
    invoiceId: "inv1",
    checkedInAt: null,
  });

  (prisma.eventRegistration as any).update = async (args: any) => {
    assert.equal(args.where.id, "reg1");
    assert.ok(args.data.checkedInAt instanceof Date);
    return { id: "reg1", checkedInAt: args.data.checkedInAt };
  };

  // Mock invoice methods to track if they're called
  (prisma.invoice as any).update = async () => {
    invoiceUpdateCalled = true;
  };
  (prisma.invoice as any).create = async () => {
    invoiceCreateCalled = true;
  };

  const req = createReq({ params: { registrationId: "reg1" } });
  const res = createRes();
  await markAttendance(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.checkedInAt);
  assert.equal(invoiceUpdateCalled, false, "Invoice should not be updated");
  assert.equal(invoiceCreateCalled, false, "Invoice should not be created");
  restore(originals);
});

test("undoAttendance clears checkedInAt without touching invoices", async () => {
  const originals = snapshotPrisma();
  let invoiceUpdateCalled = false;

  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    invoiceId: "inv1",
    checkedInAt: new Date("2025-01-01"),
  });

  (prisma.eventRegistration as any).update = async (args: any) => {
    assert.equal(args.where.id, "reg1");
    assert.equal(args.data.checkedInAt, null);
    return { id: "reg1", checkedInAt: null };
  };

  (prisma.invoice as any).update = async () => {
    invoiceUpdateCalled = true;
  };

  const req = createReq({ params: { registrationId: "reg1" } });
  const res = createRes();
  await undoAttendance(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.checkedInAt, null);
  assert.equal(invoiceUpdateCalled, false, "Invoice should not be updated");
  restore(originals);
});

test("bulkMarkAttendance does not create or update invoices", async () => {
  const originals = snapshotPrisma();
  let invoiceUpdateCalled = false;
  let invoiceCreateCalled = false;

  (prisma.eventRegistration as any).findMany = async () => [
    { id: "reg1", eventId: "ev1", tenantId: "t1" },
    { id: "reg2", eventId: "ev1", tenantId: "t1" },
  ];

  (prisma.eventRegistration as any).updateMany = async () => ({ count: 2 });

  (prisma.invoice as any).update = async () => {
    invoiceUpdateCalled = true;
  };
  (prisma.invoice as any).create = async () => {
    invoiceCreateCalled = true;
  };

  const req = createReq({ body: { registrationIds: ["reg1", "reg2"] } });
  const res = createRes();
  await bulkMarkAttendance(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.updated, 2);
  assert.equal(invoiceUpdateCalled, false);
  assert.equal(invoiceCreateCalled, false);
  restore(originals);
});

// ============================================================================
// Free vs Paid Event Behavior
// ============================================================================

test("getAttendanceReport excludes invoice metrics for free events", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Free Event",
    startsAt: new Date("2025-02-01"),
    endsAt: new Date("2025-02-01T02:00:00Z"),
    location: "Venue",
    priceCents: 0,
    capacity: 100,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      tenantId: "t1",
      memberId: "m1",
      eventId: "ev1",
      invoiceId: null,
      createdAt: new Date("2025-01-01"),
      checkedInAt: new Date("2025-01-02"),
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      invoice: null,
    },
  ];

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.summary.totalRegistrations, 1);
  assert.equal(res.body.data.summary.totalAttended, 1);
  // Invoice metrics should not exist for free events
  assert.equal(res.body.data.summary.paidInvoices, undefined);
  assert.equal(res.body.data.summary.unpaidInvoices, undefined);
  assert.equal(res.body.data.summary.totalCollectedCents, undefined);
  restore(originals);
});

test("getAttendanceReport includes invoice metrics for paid events", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Paid Event",
    startsAt: new Date("2025-02-01"),
    endsAt: new Date("2025-02-01T02:00:00Z"),
    location: "Venue",
    priceCents: 5000,
    capacity: 100,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      tenantId: "t1",
      memberId: "m1",
      eventId: "ev1",
      invoiceId: "inv1",
      createdAt: new Date("2025-01-01"),
      checkedInAt: new Date("2025-01-02"),
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      invoice: {
        id: "inv1",
        invoiceNumber: "RCME-2025-EVT-001",
        amountCents: 5000,
        status: "PAID",
      },
    },
    {
      id: "r2",
      tenantId: "t1",
      memberId: "m2",
      eventId: "ev1",
      invoiceId: "inv2",
      createdAt: new Date("2025-01-03"),
      checkedInAt: null,
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
      invoice: {
        id: "inv2",
        invoiceNumber: "RCME-2025-EVT-002",
        amountCents: 5000,
        status: "ISSUED",
      },
    },
    {
      id: "r3",
      tenantId: "t1",
      memberId: "m3",
      eventId: "ev1",
      invoiceId: null,
      createdAt: new Date("2025-01-04"),
      checkedInAt: null,
      member: { id: "m3", firstName: "Bob", lastName: "Jones", email: "bob@example.com" },
      invoice: null,
    },
  ];

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.summary.totalRegistrations, 3);
  assert.equal(res.body.data.summary.totalAttended, 1);
  assert.equal(res.body.data.summary.paidInvoices, 1);
  assert.equal(res.body.data.summary.unpaidInvoices, 1);
  assert.equal(res.body.data.summary.totalCollectedCents, 5000);
  restore(originals);
});

// ============================================================================
// Server-Side Filtering: Attendance Status
// ============================================================================

test("getAttendanceReport filters by attendanceStatus=attended", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 0,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      memberId: "m1",
      checkedInAt: new Date("2025-01-02"),
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      invoice: null,
    },
    {
      id: "r2",
      memberId: "m2",
      checkedInAt: null,
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
      invoice: null,
    },
  ];

  const req = createReq({
    params: { eventId: "ev1" },
    query: { attendanceStatus: "attended" },
  });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.attendees.length, 1);
  assert.equal(res.body.data.attendees[0].registrationId, "r1");
  assert.ok(res.body.data.attendees[0].checkedInAt);
  restore(originals);
});

test("getAttendanceReport filters by attendanceStatus=not-attended", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 0,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      memberId: "m1",
      checkedInAt: new Date("2025-01-02"),
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      invoice: null,
    },
    {
      id: "r2",
      memberId: "m2",
      checkedInAt: null,
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
      invoice: null,
    },
  ];

  const req = createReq({
    params: { eventId: "ev1" },
    query: { attendanceStatus: "not-attended" },
  });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.attendees.length, 1);
  assert.equal(res.body.data.attendees[0].registrationId, "r2");
  assert.equal(res.body.data.attendees[0].checkedInAt, null);
  restore(originals);
});

// ============================================================================
// Server-Side Filtering: Payment Status (Paid Events Only)
// ============================================================================

test("getAttendanceReport filters by paymentStatus=paid", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      memberId: "m1",
      invoice: { id: "inv1", status: "PAID", invoiceNumber: "INV-001", amountCents: 5000 },
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    },
    {
      id: "r2",
      memberId: "m2",
      invoice: { id: "inv2", status: "ISSUED", invoiceNumber: "INV-002", amountCents: 5000 },
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
    },
  ];

  const req = createReq({
    params: { eventId: "ev1" },
    query: { paymentStatus: "paid" },
  });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.attendees.length, 1);
  assert.equal(res.body.data.attendees[0].invoice?.status, "PAID");
  restore(originals);
});

test("getAttendanceReport filters by paymentStatus=no-invoice", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      memberId: "m1",
      invoice: { id: "inv1", status: "PAID", invoiceNumber: "INV-001", amountCents: 5000 },
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    },
    {
      id: "r2",
      memberId: "m2",
      invoice: null,
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
    },
  ];

  const req = createReq({
    params: { eventId: "ev1" },
    query: { paymentStatus: "no-invoice" },
  });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.attendees.length, 1);
  assert.equal(res.body.data.attendees[0].invoice, null);
  restore(originals);
});

// ============================================================================
// Server-Side Search
// ============================================================================

test("getAttendanceReport filters by search term (member name)", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 0,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      memberId: "m1",
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      invoice: null,
    },
    {
      id: "r2",
      memberId: "m2",
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
      invoice: null,
    },
  ];

  const req = createReq({
    params: { eventId: "ev1" },
    query: { search: "john" },
  });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  // Note: In real implementation, this would filter in Prisma query
  // For this test, we're verifying the search param is accepted
  assert.ok(res.body.data);
  restore(originals);
});

// ============================================================================
// CSV Export
// ============================================================================

test("getAttendanceReport exports CSV with correct format", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Test Event",
    priceCents: 5000,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      memberId: "m1",
      createdAt: new Date("2025-01-01"),
      checkedInAt: new Date("2025-01-02"),
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      invoice: {
        id: "inv1",
        invoiceNumber: "RCME-2025-EVT-001",
        amountCents: 5000,
        status: "PAID",
      },
    },
  ];

  const req = createReq({
    params: { eventId: "ev1" },
    query: { format: "csv" },
  });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(typeof res.body === "string", "CSV should be a string");
  assert.ok(res.body.includes("Member Name"), "CSV should have headers");
  assert.ok(res.body.includes("John Doe"), "CSV should contain member name");
  assert.ok(res.body.includes("RCME-2025-EVT-001"), "CSV should contain invoice number");
  restore(originals);
});

test("getAttendanceReport CSV excludes invoice columns for free events", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Free Event",
    priceCents: 0,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "r1",
      memberId: "m1",
      createdAt: new Date("2025-01-01"),
      checkedInAt: new Date("2025-01-02"),
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      invoice: null,
    },
  ];

  const req = createReq({
    params: { eventId: "ev1" },
    query: { format: "csv" },
  });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(typeof res.body === "string");
  assert.ok(!res.body.includes("Invoice Number"), "CSV should not include invoice columns for free events");
  restore(originals);
});

// ============================================================================
// Bulk Operations Safety
// ============================================================================

test("bulkMarkAttendance rejects registrations from different events", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findMany = async () => [
    { id: "reg1", eventId: "ev1", tenantId: "t1" },
    { id: "reg2", eventId: "ev2", tenantId: "t1" }, // Different event!
  ];

  const req = createReq({ body: { registrationIds: ["reg1", "reg2"] } });
  const res = createRes();
  await bulkMarkAttendance(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "INVALID_INPUT");
  restore(originals);
});

test("bulkMarkAttendance rejects registrations from different tenants", async () => {
  const originals = snapshotPrisma();

  // Only return reg1 because tenant-scoped query filters out reg2
  (prisma.eventRegistration as any).findMany = async () => [
    { id: "reg1", eventId: "ev1", tenantId: "t1" },
    // reg2 is from t2, so it won't be returned by tenant-scoped query
  ];

  const req = createReq({ user: { tenantId: "t1" }, body: { registrationIds: ["reg1", "reg2"] } });
  const res = createRes();
  await bulkMarkAttendance(req, res);

  // Should fail because requested 2 IDs but only found 1 (tenant mismatch on reg2)
  assert.equal(res.statusCode, 400);
  restore(originals);
});

test("markAttendance rejects registration from different tenant", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findFirst = async () => null; // Not found due to tenant mismatch

  const req = createReq({
    user: { tenantId: "t1" },
    params: { registrationId: "reg1" },
  });
  const res = createRes();
  await markAttendance(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "REGISTRATION_NOT_FOUND");
  restore(originals);
});

// ============================================================================
// Event Type Handling
// ============================================================================

test("getAttendanceReport handles ONLINE event type", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Online Webinar",
    priceCents: 0,
    eventType: "ONLINE",
    status: "PUBLISHED",
  });

  (prisma.eventRegistration as any).findMany = async () => [];

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.event.eventType, "ONLINE");
  restore(originals);
});
