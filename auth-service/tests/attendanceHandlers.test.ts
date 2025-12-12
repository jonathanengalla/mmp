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
  };
  return res;
};

const restore = (originals: Record<string, any>) => {
  (prisma.eventRegistration as any).findFirst = originals.erFindFirst;
  (prisma.eventRegistration as any).update = originals.erUpdate;
  (prisma.eventRegistration as any).updateMany = originals.erUpdateMany;
  (prisma.eventRegistration as any).findMany = originals.erFindMany;
  (prisma.event as any).findFirst = originals.eventFindFirst;
  (prisma.invoice as any).findMany = originals.invoiceFindMany;
};

const snapshotPrisma = () => ({
  erFindFirst: prisma.eventRegistration.findFirst,
  erUpdate: prisma.eventRegistration.update,
  erUpdateMany: prisma.eventRegistration.updateMany,
  erFindMany: prisma.eventRegistration.findMany,
  eventFindFirst: prisma.event.findFirst,
  invoiceFindMany: prisma.invoice.findMany,
});

test("markAttendance sets checkedInAt for valid registration", async () => {
  const originals = snapshotPrisma();
  (prisma.eventRegistration as any).findFirst = async () => ({ id: "reg1", tenantId: "t1" });
  (prisma.eventRegistration as any).update = async () => ({ id: "reg1", checkedInAt: new Date("2025-01-01") });

  const req: any = { user: { tenantId: "t1" }, params: { registrationId: "reg1" } };
  const res = createRes();
  await markAttendance(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.checkedInAt);
  restore(originals);
});

test("undoAttendance returns 404 when registration missing", async () => {
  const originals = snapshotPrisma();
  (prisma.eventRegistration as any).findFirst = async () => null;

  const req: any = { user: { tenantId: "t1" }, params: { registrationId: "missing" } };
  const res = createRes();
  await undoAttendance(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "REGISTRATION_NOT_FOUND");
  restore(originals);
});

test("bulkMarkAttendance validates input", async () => {
  const req: any = { user: { tenantId: "t1" }, body: {} };
  const res = createRes();
  await bulkMarkAttendance(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "INVALID_INPUT");
});

test("getAttendanceReport returns paid/unpaid summary for paid event", async () => {
  const originals = snapshotPrisma();
  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Paid Event",
    startsAt: new Date("2025-02-01"),
    endsAt: new Date("2025-02-01T02:00:00Z"),
    location: "Online",
    priceCents: 5000,
    capacity: 100,
    eventType: "ONLINE",
    status: "PUBLISHED",
  });
  (prisma.eventRegistration as any).findMany = async () => [
    { id: "r1", tenantId: "t1", memberId: "m1", createdAt: new Date("2025-01-01"), checkedInAt: new Date("2025-01-02"), eventId: "ev1" },
    { id: "r2", tenantId: "t1", memberId: "m2", createdAt: new Date("2025-01-03"), checkedInAt: null, eventId: "ev1" },
  ];
  (prisma.invoice as any).findMany = async () => [
    { id: "i1", memberId: "m1", invoiceNumber: "RCME-2025-EVT-001", amountCents: 5000, status: "PAID" },
    { id: "i2", memberId: "m2", invoiceNumber: "RCME-2025-EVT-002", amountCents: 5000, status: "ISSUED" },
  ];

  const req: any = { user: { tenantId: "t1" }, params: { eventId: "ev1" } };
  const res = createRes();
  await getAttendanceReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.summary.paidInvoices, 1);
  assert.equal(res.body.data.summary.unpaidInvoices, 1);
  assert.equal(res.body.data.summary.totalRegistrations, 2);
  restore(originals);
});

