import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db/prisma";
import { registerEventHandler } from "../src/eventsHandlers";

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
  user: { tenantId: "t1", memberId: "m1", member_id: "m1" },
  params: {},
  ...overrides,
});

const snapshotPrisma = () => ({
  eventFindFirst: prisma.event.findFirst,
  eventRegistrationFindFirst: prisma.eventRegistration.findFirst,
  eventRegistrationCreate: prisma.eventRegistration.create,
  eventRegistrationUpdate: prisma.eventRegistration.update,
});

const restore = (originals: Record<string, any>) => {
  (prisma.event as any).findFirst = originals.eventFindFirst;
  (prisma.eventRegistration as any).findFirst = originals.eventRegistrationFindFirst;
  (prisma.eventRegistration as any).create = originals.eventRegistrationCreate;
  (prisma.eventRegistration as any).update = originals.eventRegistrationUpdate;
};

// Mock createEventInvoice
const mockCreateEventInvoice = async (tenantId: string, input: any) => {
  return {
    id: `inv-${input.memberId}`,
    invoiceNumber: `RCME-2025-EVT-001`,
    amountCents: input.amountCents,
    status: "ISSUED",
    source: "EVT",
    eventId: input.eventId,
    memberId: input.memberId,
  };
};

const billingStore = require("../src/billingStore");
const originalCreateEventInvoice = billingStore.createEventInvoice;
billingStore.createEventInvoice = mockCreateEventInvoice;

// ============================================================================
// Free Event Registration
// ============================================================================

test("free event registration creates EventRegistration but no invoice", async () => {
  const originals = snapshotPrisma();
  let invoiceCreated = false;
  let registrationCreated = false;

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 0, // Free event
    currency: "PHP",
    title: "Free Event",
    status: "PUBLISHED",
    registrationMode: "RSVP",
    registrations: [],
  });

  // Track if createEventInvoice is called (should not be)
  billingStore.createEventInvoice = async () => {
    invoiceCreated = true;
    throw new Error("Invoice should not be created for free events");
  };

  (prisma.eventRegistration as any).findFirst = async () => null;
  (prisma.eventRegistration as any).create = async (args: any) => {
    registrationCreated = true;
    assert.equal(args.data.invoiceId, null, "Free event registration should have no invoiceId");
    return { id: "reg1", ...args.data };
  };

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(res.statusCode, 200, "Registration should succeed");
  assert.equal(invoiceCreated, false, "No invoice should be created for free events");
  assert.equal(registrationCreated, true, "EventRegistration should be created");
  
  billingStore.createEventInvoice = originalCreateEventInvoice;
  restore(originals);
});

// ============================================================================
// Paid RSVP Event Registration
// ============================================================================

test("paid RSVP event registration creates EventRegistration but no invoice", async () => {
  const originals = snapshotPrisma();
  let invoiceCreated = false;
  let registrationCreated = false;

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    currency: "PHP",
    title: "Paid RSVP Event",
    status: "PUBLISHED",
    registrationMode: "RSVP",
    registrations: [],
  });

  // Track if createEventInvoice is called (should not be for RSVP)
  billingStore.createEventInvoice = async () => {
    invoiceCreated = true;
    throw new Error("Invoice should not be created for RSVP events at registration");
  };

  (prisma.eventRegistration as any).findFirst = async () => null;
  (prisma.eventRegistration as any).create = async (args: any) => {
    registrationCreated = true;
    assert.equal(args.data.invoiceId, null, "RSVP registration should have no invoiceId at registration time");
    return { id: "reg1", ...args.data };
  };

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(res.statusCode, 200, "Registration should succeed");
  assert.equal(invoiceCreated, false, "No invoice should be created for RSVP events at registration");
  assert.equal(registrationCreated, true, "EventRegistration should be created");
  
  billingStore.createEventInvoice = originalCreateEventInvoice;
  restore(originals);
});

// ============================================================================
// Paid PAY_NOW Event Registration
// ============================================================================

test("paid PAY_NOW event registration creates EventRegistration and invoice", async () => {
  const originals = snapshotPrisma();
  let invoiceCreated = false;
  let invoiceAmount = 0;
  let invoiceSource = "";
  let registrationCreated = false;
  let registrationInvoiceId: string | null = null;

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    currency: "PHP",
    title: "Paid PAY_NOW Event",
    status: "PUBLISHED",
    registrationMode: "PAY_NOW",
    startsAt: new Date("2025-02-01"),
    registrations: [],
  });

  // Track invoice creation
  billingStore.createEventInvoice = async (tenantId: string, input: any) => {
    invoiceCreated = true;
    invoiceAmount = input.amountCents;
    invoiceSource = "EVT"; // Should be set by createEventInvoice
    assert.equal(input.amountCents, 5000, "Invoice amount should match event price");
    assert.equal(input.eventId, "ev1", "Invoice should be linked to event");
    return {
      id: "inv1",
      invoiceNumber: "RCME-2025-EVT-001",
      amountCents: input.amountCents,
      status: "ISSUED",
      source: "EVT",
      eventId: input.eventId,
      memberId: input.memberId,
    };
  };

  (prisma.eventRegistration as any).findFirst = async () => null;
  (prisma.eventRegistration as any).create = async (args: any) => {
    registrationCreated = true;
    registrationInvoiceId = args.data.invoiceId;
    assert.ok(args.data.invoiceId, "PAY_NOW registration should have invoiceId");
    return { id: "reg1", ...args.data };
  };

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(res.statusCode, 200, "Registration should succeed");
  assert.equal(invoiceCreated, true, "Invoice should be created for PAY_NOW events");
  assert.equal(invoiceAmount, 5000, "Invoice amount should match event price");
  assert.equal(registrationCreated, true, "EventRegistration should be created");
  assert.equal(registrationInvoiceId, "inv1", "Registration should be linked to invoice");
  
  billingStore.createEventInvoice = originalCreateEventInvoice;
  restore(originals);
});

test("paid PAY_NOW event registration never creates zero-amount invoices", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000, // Positive price
    currency: "PHP",
    title: "Paid Event",
    status: "PUBLISHED",
    registrationMode: "PAY_NOW",
    startsAt: new Date("2025-02-01"),
    registrations: [],
  });

  billingStore.createEventInvoice = async (tenantId: string, input: any) => {
    // Verify amount is never zero
    assert.ok(input.amountCents > 0, "Invoice amount must be greater than zero");
    return {
      id: "inv1",
      amountCents: input.amountCents,
      status: "ISSUED",
      source: "EVT",
    };
  };

  (prisma.eventRegistration as any).findFirst = async () => null;
  (prisma.eventRegistration as any).create = async (args: any) => ({ id: "reg1", ...args.data });

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(res.statusCode, 200, "Registration should succeed");
  
  billingStore.createEventInvoice = originalCreateEventInvoice;
  restore(originals);
});

// ============================================================================
// Tenant Safety
// ============================================================================

test("registration respects tenant boundaries - cannot register for another tenant's event", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async (args: any) => {
    // Event belongs to tenant t2, but request is from tenant t1
    if (args.where.tenantId === "t1" && args.where.id === "ev1") {
      return null; // Event not found in tenant t1's scope
    }
    return null;
  };

  const req = createReq({ 
    user: { tenantId: "t1", memberId: "m1", member_id: "m1" },
    params: { id: "ev1" } 
  });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(res.statusCode, 404, "Should return 404 for event not in tenant scope");
  
  restore(originals);
});

test("free event with PAY_NOW mode is treated as RSVP (no invoice created)", async () => {
  const originals = snapshotPrisma();
  let invoiceCreated = false;

  // Edge case: event has registrationMode=PAY_NOW but price=0
  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 0, // Free event
    currency: "PHP",
    title: "Free Event",
    status: "PUBLISHED",
    registrationMode: "PAY_NOW", // Mode set to PAY_NOW, but price is 0
    registrations: [],
  });

  billingStore.createEventInvoice = async () => {
    invoiceCreated = true;
    throw new Error("Should not create invoice for free events even if mode is PAY_NOW");
  };

  (prisma.eventRegistration as any).findFirst = async () => null;
  (prisma.eventRegistration as any).create = async (args: any) => {
    assert.equal(args.data.invoiceId, null, "Free event should not have invoiceId");
    return { id: "reg1", ...args.data };
  };

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  // Business rule: if price = 0, no invoice regardless of mode
  assert.equal(res.statusCode, 200, "Registration should succeed");
  assert.equal(invoiceCreated, false, "Free events never create invoices, even with PAY_NOW mode");
  
  billingStore.createEventInvoice = originalCreateEventInvoice;
  restore(originals);
});

