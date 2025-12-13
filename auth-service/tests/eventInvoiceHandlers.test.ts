import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db/prisma";

// Mock createEventInvoice before importing handlers
import * as billingStoreModule from "../src/billingStore";
const originalCreateEventInvoice = billingStoreModule.createEventInvoice;

(billingStoreModule as any).createEventInvoice = async (tenantId: string, input: any) => {
  return {
    id: `inv-${input.memberId}-${Date.now()}`,
    invoiceNumber: `RCME-2025-EVT-001`,
    amountCents: input.amountCents,
    status: "ISSUED",
    source: "EVT",
    eventId: input.eventId,
    memberId: input.memberId,
  };
};

// Import handlers after mocking
import { bulkGenerateEventInvoices, generateRegistrationInvoice } from "../src/eventInvoiceHandlers";

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

const createReq = (overrides: any = {}) => ({
  user: { tenantId: "t1" },
  params: {},
  ...overrides,
});

const snapshotPrisma = () => ({
  eventFindFirst: prisma.event.findFirst,
  eventRegistrationFindMany: prisma.eventRegistration.findMany,
  eventRegistrationFindFirst: prisma.eventRegistration.findFirst,
  eventRegistrationUpdate: prisma.eventRegistration.update,
});

const restore = (originals: Record<string, any>) => {
  (prisma.event as any).findFirst = originals.eventFindFirst;
  (prisma.eventRegistration as any).findMany = originals.eventRegistrationFindMany;
  (prisma.eventRegistration as any).findFirst = originals.eventRegistrationFindFirst;
  (prisma.eventRegistration as any).update = originals.eventRegistrationUpdate;
};


// ============================================================================
// Bulk Invoice Generation
// ============================================================================

test("bulkGenerateEventInvoices rejects free events", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 0, // Free event
    title: "Free Event",
  });

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await bulkGenerateEventInvoices(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "FREE_EVENT_NO_INVOICES");
  restore(originals);
});

test("bulkGenerateEventInvoices creates invoices for registrations without invoices", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    currency: "PHP",
    title: "Paid Event",
    startsAt: new Date("2025-02-01"),
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "reg1",
      tenantId: "t1",
      eventId: "ev1",
      memberId: "m1",
      invoiceId: null,
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    },
    {
      id: "reg2",
      tenantId: "t1",
      eventId: "ev1",
      memberId: "m2",
      invoiceId: null,
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
    },
  ];

  let updateCalls: any[] = [];
  (prisma.eventRegistration as any).findFirst = async (args: any) => {
    // Simulate double-check that registration doesn't have invoice
    if (args.where.invoiceId?.not !== null) {
      return null; // Registration doesn't have invoice
    }
    return null;
  };
  (prisma.eventRegistration as any).update = async (args: any) => {
    updateCalls.push(args);
    return { id: args.where.id, invoiceId: `inv-${args.where.id}` };
  };

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await bulkGenerateEventInvoices(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.created, 2);
  assert.equal(res.body.data.skipped, 0);
  assert.equal(updateCalls.length, 2);
  restore(originals);
});

test("bulkGenerateEventInvoices skips registrations that already have invoices", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    currency: "PHP",
    title: "Paid Event",
    startsAt: new Date("2025-02-01"),
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "reg1",
      tenantId: "t1",
      eventId: "ev1",
      memberId: "m1",
      invoiceId: "inv1", // Already has invoice
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    },
  ];

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await bulkGenerateEventInvoices(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.created, 0);
  assert.equal(res.body.data.skipped, 0);
  assert.equal(res.body.data.message, "All registrations already have invoices");
  restore(originals);
});

// ============================================================================
// Individual Invoice Generation
// ============================================================================

test("generateRegistrationInvoice rejects free events", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    memberId: "m1",
    invoiceId: null,
    event: {
      id: "ev1",
      priceCents: 0, // Free event
      title: "Free Event",
    },
    member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    invoice: null,
  });

  const req = createReq({ params: { registrationId: "reg1" } });
  const res = createRes();
  await generateRegistrationInvoice(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "FREE_EVENT_NO_INVOICES");
  restore(originals);
});

test("generateRegistrationInvoice creates invoice for registration without invoice", async () => {
  const originals = snapshotPrisma();

  let updateCalled = false;
  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    memberId: "m1",
    invoiceId: null,
    event: {
      id: "ev1",
      priceCents: 5000,
      currency: "PHP",
      title: "Paid Event",
      startsAt: new Date("2025-02-01"),
    },
    member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    invoice: null,
  });

  (prisma.eventRegistration as any).update = async (args: any) => {
    updateCalled = true;
    assert.equal(args.where.id, "reg1");
    assert.ok(args.data.invoiceId);
    return { id: "reg1", invoiceId: args.data.invoiceId };
  };

  const req = createReq({ params: { registrationId: "reg1" } });
  const res = createRes();
  await generateRegistrationInvoice(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.data.invoice);
  assert.equal(res.body.data.invoice.amountCents, 5000);
  assert.equal(updateCalled, true);
  restore(originals);
});

test("generateRegistrationInvoice rejects registration that already has invoice", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    memberId: "m1",
    invoiceId: "inv1",
    event: {
      id: "ev1",
      priceCents: 5000,
      title: "Paid Event",
    },
    member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
    invoice: {
      id: "inv1",
      invoiceNumber: "RCME-2025-EVT-001",
    },
  });

  const req = createReq({ params: { registrationId: "reg1" } });
  const res = createRes();
  await generateRegistrationInvoice(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, "INVOICE_ALREADY_EXISTS");
  assert.equal(res.body.error.invoiceNumber, "RCME-2025-EVT-001");
  restore(originals);
});

test("generateRegistrationInvoice returns 404 for non-existent registration", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findFirst = async () => null;

  const req = createReq({ params: { registrationId: "missing" } });
  const res = createRes();
  await generateRegistrationInvoice(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "REGISTRATION_NOT_FOUND");
  restore(originals);
});

