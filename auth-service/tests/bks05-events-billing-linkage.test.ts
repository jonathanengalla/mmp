/**
 * BKS-05: Events Persistence with Billing Linkage Regression Tests
 * Tests invariants for event ↔ registration ↔ invoice relationships
 */

import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/db/prisma";
import { InvoiceStatus } from "@prisma/client";

// Mock createEventInvoice
const mockCreateEventInvoice = async (tenantId: string, input: any) => {
  return {
    id: `inv-${input.memberId}-${Date.now()}`,
    invoiceNumber: `RCME-2025-EVT-001`,
    amountCents: input.amountCents,
    status: InvoiceStatus.ISSUED,
    source: "EVT",
    eventId: input.eventId,
    memberId: input.memberId,
    tenantId,
    currency: input.currency,
    description: input.description,
    dueAt: input.dueDate ? new Date(input.dueDate) : null,
  };
};

// Replace the import with our mock before importing handlers
const billingStore = require("../src/billingStore");
const originalCreateEventInvoice = billingStore.createEventInvoice;
billingStore.createEventInvoice = mockCreateEventInvoice;

// Import handlers after mocking
import { registerEventHandler } from "../src/eventsHandlers";
import { bulkGenerateEventInvoices, generateRegistrationInvoice } from "../src/eventInvoiceHandlers";
import { deleteEventHandler, cancelEventHandler } from "../src/eventsHandlers";

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
  eventFindMany: prisma.event.findMany,
  eventCreate: prisma.event.create,
  eventUpdate: prisma.event.update,
  eventDelete: prisma.event.delete,
  eventCount: prisma.event.count,
  eventRegistrationFindFirst: prisma.eventRegistration.findFirst,
  eventRegistrationFindMany: prisma.eventRegistration.findMany,
  eventRegistrationCreate: prisma.eventRegistration.create,
  eventRegistrationUpdate: prisma.eventRegistration.update,
  invoiceFindFirst: prisma.invoice.findFirst,
  invoiceCount: prisma.invoice.count,
});

const restore = (originals: Record<string, any>) => {
  (prisma.event as any).findFirst = originals.eventFindFirst;
  (prisma.event as any).findMany = originals.eventFindMany;
  (prisma.event as any).create = originals.eventCreate;
  (prisma.event as any).update = originals.eventUpdate;
  (prisma.event as any).delete = originals.eventDelete;
  (prisma.event as any).count = originals.eventCount;
  (prisma.eventRegistration as any).findFirst = originals.eventRegistrationFindFirst;
  (prisma.eventRegistration as any).findMany = originals.eventRegistrationFindMany;
  (prisma.eventRegistration as any).create = originals.eventRegistrationCreate;
  (prisma.eventRegistration as any).update = originals.eventRegistrationUpdate;
  (prisma.invoice as any).findFirst = originals.invoiceFindFirst;
  (prisma.invoice as any).count = originals.invoiceCount;
};

// ============================================================================
// Free Event Protection
// ============================================================================

test("PAY_NOW registration on free event does not create invoice", async () => {
  const originals = snapshotPrisma();
  let invoiceCreated = false;

  // First call: load event for registration check
  // Second call: reload event after registration
  let callCount = 0;
  (prisma.event as any).findFirst = async (query: any) => {
    callCount++;
    if (callCount === 1) {
      // Initial load - check for existing registrations
      return {
        id: "ev1",
        tenantId: "t1",
        priceCents: 0, // Free event
        currency: "PHP",
        title: "Free Event",
        status: "PUBLISHED",
        registrationMode: "PAY_NOW",
        startsAt: new Date(),
        capacity: null,
        registrations: [], // No existing registrations
      };
    }
    // After registration - reload
    return {
      id: "ev1",
      tenantId: "t1",
      priceCents: 0,
      currency: "PHP",
      title: "Free Event",
      status: "PUBLISHED",
      registrationMode: "PAY_NOW",
      startsAt: new Date(),
      registrations: [
        {
          id: "reg1",
          memberId: "m1",
          invoiceId: null,
          status: "PENDING",
          member: { id: "m1", firstName: "Test", lastName: "Member" },
          invoice: null,
        },
      ],
    };
  };

  billingStore.createEventInvoice = async () => {
    invoiceCreated = true;
    throw new Error("Should not be called for free event");
  };

  (prisma.eventRegistration as any).findFirst = async () => null; // No existing registration
  (prisma.eventRegistration as any).create = async (data: any) => ({
    id: "reg1",
    ...data,
    invoiceId: null,
  });

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(invoiceCreated, false, "Invoice should not be created for free event");
  assert.equal(res.statusCode, 200, "Registration should succeed without invoice");
  restore(originals);
  billingStore.createEventInvoice = originalCreateEventInvoice;
});

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

test("generateRegistrationInvoice rejects free event registrations", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    eventId: "ev1",
    memberId: "m1",
    invoiceId: null,
    event: {
      id: "ev1",
      tenantId: "t1",
      priceCents: 0, // Free event
      currency: "PHP",
      title: "Free Event",
      startsAt: new Date(),
    },
    member: { id: "m1", firstName: "Test", lastName: "Member", email: "test@example.com" },
    invoice: null,
  });

  const req = createReq({ params: { registrationId: "reg1" } });
  const res = createRes();
  await generateRegistrationInvoice(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "FREE_EVENT_NO_INVOICES");
  restore(originals);
});

// ============================================================================
// RSVP Registration Behavior
// ============================================================================

test("RSVP registration does not create invoice", async () => {
  const originals = snapshotPrisma();
  let invoiceCreated = false;

  // First call: load event with registrations (empty)
  // Second call: reload event after registration
  let callCount = 0;
  (prisma.event as any).findFirst = async (query: any) => {
    callCount++;
    if (callCount === 1) {
      // Initial load - check for existing registrations
      return {
        id: "ev1",
        tenantId: "t1",
        priceCents: 5000, // Paid event
        currency: "PHP",
        title: "Paid RSVP Event",
        status: "PUBLISHED",
        registrationMode: "RSVP", // RSVP mode
        startsAt: new Date(),
        registrations: [], // No existing registrations
      };
    }
    // After registration - reload
    return {
      id: "ev1",
      tenantId: "t1",
      priceCents: 5000,
      currency: "PHP",
      title: "Paid RSVP Event",
      status: "PUBLISHED",
      registrationMode: "RSVP",
      startsAt: new Date(),
      registrations: [
        {
          id: "reg1",
          memberId: "m1",
          invoiceId: null,
          status: "PENDING",
          member: { id: "m1", firstName: "Test", lastName: "Member" },
          invoice: null,
        },
      ],
    };
  };

  billingStore.createEventInvoice = async () => {
    invoiceCreated = true;
    throw new Error("Should not be called for RSVP");
  };

  (prisma.eventRegistration as any).findFirst = async () => null; // No existing registration
  (prisma.eventRegistration as any).create = async (data: any) => ({
    id: "reg1",
    ...data,
    invoiceId: null,
  });

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(invoiceCreated, false, "Invoice should not be created for RSVP registration");
  assert.equal(res.statusCode, 200);
  restore(originals);
  billingStore.createEventInvoice = originalCreateEventInvoice;
});

// ============================================================================
// PAY_NOW Registration Behavior
// ============================================================================

test("PAY_NOW registration creates invoice atomically", async () => {
  const originals = snapshotPrisma();
  let invoiceCreated = false;
  let createdInvoice: any = null;

  // First call: event exists, no registration
  // Second call: after registration, reload event
  let callCount = 0;
  (prisma.event as any).findFirst = async () => {
    callCount++;
    if (callCount === 1) {
      // Initial load
      return {
        id: "ev1",
        tenantId: "t1",
        priceCents: 5000,
        currency: "PHP",
        title: "Paid PAY_NOW Event",
        status: "PUBLISHED",
        registrationMode: "PAY_NOW",
        startsAt: new Date(),
        registrations: [],
      };
    }
    // After registration - reload
    return {
      id: "ev1",
      tenantId: "t1",
      priceCents: 5000,
      currency: "PHP",
      title: "Paid PAY_NOW Event",
      status: "PUBLISHED",
      registrationMode: "PAY_NOW",
      startsAt: new Date(),
      registrations: [
        {
          id: "reg1",
          memberId: "m1",
          invoiceId: createdInvoice?.id || null,
          status: "PENDING",
          member: { id: "m1", firstName: "Test", lastName: "Member" },
          invoice: createdInvoice,
        },
      ],
    };
  };

  billingStore.createEventInvoice = async (tenantId: string, input: any) => {
    invoiceCreated = true;
    createdInvoice = await mockCreateEventInvoice(tenantId, input);
    return createdInvoice;
  };

  (prisma.eventRegistration as any).findFirst = async () => null; // No existing registration
  (prisma.eventRegistration as any).create = async (data: any) => ({
    id: "reg1",
    ...data,
    invoiceId: createdInvoice?.id || null,
  });

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(invoiceCreated, true, "Invoice should be created for PAY_NOW registration");
  assert.equal(createdInvoice?.source, "EVT", "Invoice source should be EVT");
  assert.equal(createdInvoice?.eventId, "ev1", "Invoice should have eventId");
  assert.equal(res.statusCode, 200);
  restore(originals);
  billingStore.createEventInvoice = originalCreateEventInvoice;
});

test("PAY_NOW duplicate registration does not double-bill", async () => {
  const originals = snapshotPrisma();
  let invoiceCreatedCount = 0;

  // Event already has a registration for this member
  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    currency: "PHP",
    title: "Paid PAY_NOW Event",
    status: "PUBLISHED",
    registrationMode: "PAY_NOW",
    startsAt: new Date(),
    registrations: [
      {
        id: "reg1",
        memberId: "m1",
        invoiceId: "inv1",
        status: "PENDING", // Existing, non-cancelled registration
      },
    ],
  });

  billingStore.createEventInvoice = async () => {
    invoiceCreatedCount++;
    throw new Error("Should not create duplicate invoice");
  };

  const req = createReq({ params: { id: "ev1" } });
  const res = createRes();
  await registerEventHandler(req, res);

  assert.equal(invoiceCreatedCount, 0, "Should not create invoice for existing registration");
  assert.equal(res.statusCode, 400, "Should reject duplicate registration");
  assert.equal(res.body.error?.message, "Already registered for this event");
  restore(originals);
  billingStore.createEventInvoice = originalCreateEventInvoice;
});

// ============================================================================
// Invoice Linkage Integrity
// ============================================================================

test("createEventInvoice always sets source to EVT", async () => {
  const invoice = await mockCreateEventInvoice("t1", {
    memberId: "m1",
    amountCents: 5000,
    currency: "PHP",
    description: "Test",
    eventId: "ev1",
  });

  assert.equal(invoice.source, "EVT", "Invoice source must be EVT");
  assert.equal(invoice.eventId, "ev1", "Invoice must have eventId");
});

test("bulkGenerateEventInvoices creates invoices with correct linkage", async () => {
  const originals = snapshotPrisma();
  const createdInvoices: any[] = [];

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    currency: "PHP",
    title: "Paid RSVP Event",
    startsAt: new Date(),
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "reg1",
      tenantId: "t1",
      eventId: "ev1",
      memberId: "m1",
      invoiceId: null,
      member: { id: "m1", firstName: "Test", lastName: "Member", email: "test@example.com" },
    },
  ];

  (prisma.eventRegistration as any).findFirst = async () => null; // No existing invoice
  (prisma.eventRegistration as any).update = async (data: any) => data.data;

  billingStore.createEventInvoice = async (tenantId: string, input: any) => {
    const invoice = await mockCreateEventInvoice(tenantId, input);
    createdInvoices.push(invoice);
    return invoice;
  };

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await bulkGenerateEventInvoices(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createdInvoices.length, 1);
  assert.equal(createdInvoices[0].source, "EVT");
  assert.equal(createdInvoices[0].eventId, "ev1");
  assert.equal(createdInvoices[0].amountCents, 5000);

  restore(originals);
  billingStore.createEventInvoice = originalCreateEventInvoice;
});

test("generateRegistrationInvoice creates invoice with correct linkage", async () => {
  const originals = snapshotPrisma();
  let createdInvoice: any = null;

  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    eventId: "ev1",
    memberId: "m1",
    invoiceId: null,
    event: {
      id: "ev1",
      tenantId: "t1",
      priceCents: 5000,
      currency: "PHP",
      title: "Paid RSVP Event",
      startsAt: new Date(),
    },
    member: { id: "m1", firstName: "Test", lastName: "Member", email: "test@example.com" },
    invoice: null,
  });

  (prisma.eventRegistration as any).update = async (data: any) => data.data;

  billingStore.createEventInvoice = async (tenantId: string, input: any) => {
    createdInvoice = await mockCreateEventInvoice(tenantId, input);
    return createdInvoice;
  };

  const req = createReq({ params: { registrationId: "reg1" } });
  const res = createRes();
  await generateRegistrationInvoice(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createdInvoice?.source, "EVT");
  assert.equal(createdInvoice?.eventId, "ev1");
  assert.equal(createdInvoice?.memberId, "m1");

  restore(originals);
  billingStore.createEventInvoice = originalCreateEventInvoice;
});

// ============================================================================
// Duplicate Prevention
// ============================================================================

test("generateRegistrationInvoice rejects registration with existing invoice", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findFirst = async () => ({
    id: "reg1",
    tenantId: "t1",
    eventId: "ev1",
    memberId: "m1",
    invoiceId: "inv1",
    event: {
      id: "ev1",
      tenantId: "t1",
      priceCents: 5000,
      currency: "PHP",
      title: "Paid RSVP Event",
      startsAt: new Date(),
    },
    member: { id: "m1", firstName: "Test", lastName: "Member", email: "test@example.com" },
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
  restore(originals);
});

test("bulkGenerateEventInvoices skips registrations with existing invoices", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    priceCents: 5000,
    currency: "PHP",
    title: "Paid RSVP Event",
    startsAt: new Date(),
  });

  (prisma.eventRegistration as any).findMany = async () => [
    {
      id: "reg1",
      tenantId: "t1",
      eventId: "ev1",
      memberId: "m1",
      invoiceId: "inv1", // Already has invoice
      member: { id: "m1", firstName: "Test", lastName: "Member", email: "test@example.com" },
    },
    {
      id: "reg2",
      tenantId: "t1",
      eventId: "ev1",
      memberId: "m2",
      invoiceId: null, // No invoice
      member: { id: "m2", firstName: "Test2", lastName: "Member2", email: "test2@example.com" },
    },
  ];

  (prisma.eventRegistration as any).findFirst = async (query: any) => {
    // Return existing invoice for reg1, null for reg2
    if (query.where.id === "reg1") {
      return { id: "reg1", invoiceId: "inv1" };
    }
    return null;
  };

  let invoiceCreatedCount = 0;
  billingStore.createEventInvoice = async () => {
    invoiceCreatedCount++;
    return await mockCreateEventInvoice("t1", {
      memberId: "m2",
      amountCents: 5000,
      currency: "PHP",
      eventId: "ev1",
    });
  };

  (prisma.eventRegistration as any).update = async (data: any) => data.data;

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await bulkGenerateEventInvoices(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.created, 1, "Should create invoice only for reg2");
  assert.equal(res.body.data.skipped, 1, "Should skip reg1");
  assert.equal(invoiceCreatedCount, 1, "Should create only one invoice");

  restore(originals);
  billingStore.createEventInvoice = originalCreateEventInvoice;
});

// ============================================================================
// Delete/Cancel Behavior
// ============================================================================

test("deleteEventHandler blocks deletion when event has invoices", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Event with Invoices",
  });

  (prisma.invoice as any).count = async () => 1; // Has invoices
  (prisma.eventRegistration as any).count = async () => 0;

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await deleteEventHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "EVENT_HAS_ACTIVITY");
  restore(originals);
});

test("deleteEventHandler blocks deletion when event has registrations", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Event with Registrations",
  });

  (prisma.invoice as any).count = async () => 0;
  (prisma.eventRegistration as any).count = async () => 1; // Has registrations

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await deleteEventHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "EVENT_HAS_ACTIVITY");
  restore(originals);
});

test("cancelEventHandler preserves invoices", async () => {
  const originals = snapshotPrisma();
  let updateCalled = false;
  let updateData: any = null;

  (prisma.event as any).findFirst = async () => ({
    id: "ev1",
    tenantId: "t1",
    title: "Event to Cancel",
    status: "PUBLISHED",
  });

  (prisma.event as any).update = async (data: any) => {
    updateCalled = true;
    updateData = data;
    return { id: "ev1", ...data.data };
  };

  const req = createReq({ params: { eventId: "ev1" } });
  const res = createRes();
  await cancelEventHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(updateCalled, true);
  assert.equal(updateData.data.status, "CANCELLED");
  // Verify no invoice modifications
  assert.equal(updateData.data.invoices, undefined, "Should not modify invoices");
  restore(originals);
});

// ============================================================================
// Tenant Isolation
// ============================================================================

test("cross-tenant event access returns 404", async () => {
  const originals = snapshotPrisma();

  (prisma.event as any).findFirst = async () => null; // Event not found (cross-tenant)

  const req = createReq({ params: { eventId: "ev1" }, user: { tenantId: "t2" } });
  const res = createRes();
  await bulkGenerateEventInvoices(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "EVENT_NOT_FOUND");
  restore(originals);
});

test("cross-tenant registration access returns 404", async () => {
  const originals = snapshotPrisma();

  (prisma.eventRegistration as any).findFirst = async () => null; // Registration not found (cross-tenant)

  const req = createReq({ params: { registrationId: "reg1" }, user: { tenantId: "t2" } });
  const res = createRes();
  await generateRegistrationInvoice(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "REGISTRATION_NOT_FOUND");
  restore(originals);
});

