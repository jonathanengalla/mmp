/**
 * FIN-01 Regression Tests
 * Tests finance dashboard summary handler business rules:
 * - Zero-amount exclusion
 * - Source breakdown (DUES, DONATION, EVENT, OTHER)
 * - Status mapping (OUTSTANDING, PAID, CANCELLED)
 * - Time window filtering
 * - Tenant isolation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { getFinanceSummaryHandler } from "../src/billingHandlers";
import { resolveFinancePeriod } from "../src/utils/financePeriod";
import { mapInvoiceStatusToReporting, isOutstandingStatus, isPaidStatus, isCancelledStatus } from "../src/utils/invoiceStatusMapper";

const { prisma } = require("../src/db/prisma");

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
  user: { tenantId: "t1", roles: ["ADMIN"] },
  query: {},
  ...overrides,
});

const snapshotPrisma = () => ({
  invoiceFindMany: prisma.invoice.findMany,
});

const restore = (originals: Record<string, any>) => {
  (prisma.invoice as any).findMany = originals.invoiceFindMany;
};

// Helper to create mock invoice
const mockInvoice = (overrides: any = {}) => ({
  id: `inv-${Date.now()}-${Math.random()}`,
  tenantId: "t1",
  invoiceNumber: "INV-001",
  memberId: "m1",
  amountCents: 10000,
  currency: "PHP",
  status: InvoiceStatus.ISSUED,
  source: "DUES",
  issuedAt: new Date(),
  dueAt: null,
  paidAt: null,
  description: "Test invoice",
  eventId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  payments: [],
  ...overrides,
});

// ============================================================================
// Utility Tests
// ============================================================================

test("resolveFinancePeriod - YEAR_TO_DATE default", () => {
  const now = new Date("2025-06-15T12:00:00Z");
  const period = resolveFinancePeriod(undefined, undefined, undefined, now);
  assert.equal(period.type, "YEAR_TO_DATE");
  assert.equal(period.from.getFullYear(), 2025);
  assert.equal(period.from.getMonth(), 0); // January
  assert.equal(period.from.getDate(), 1);
  assert.equal(period.to.getTime(), now.getTime());
});

test("resolveFinancePeriod - ALL_TIME", () => {
  const now = new Date("2025-06-15T12:00:00Z");
  const period = resolveFinancePeriod("ALL_TIME", undefined, undefined, now);
  assert.equal(period.type, "ALL_TIME");
  assert.ok(period.from < now);
  assert.equal(period.to.getTime(), now.getTime());
});

test("resolveFinancePeriod - CUSTOM range", () => {
  const period = resolveFinancePeriod(undefined, "2025-01-01", "2025-12-31");
  assert.equal(period.type, "CUSTOM");
  assert.equal(period.from.toISOString().substring(0, 10), "2025-01-01");
  assert.equal(period.to.toISOString().substring(0, 10), "2025-12-31");
});

test("resolveFinancePeriod - rejects invalid custom range", () => {
  assert.throws(() => {
    resolveFinancePeriod(undefined, "2025-01-01", "2024-12-31"); // from > to
  }, /from date must be before to date/);
});

test("mapInvoiceStatusToReporting - maps correctly", () => {
  assert.equal(mapInvoiceStatusToReporting(InvoiceStatus.ISSUED), "OUTSTANDING");
  assert.equal(mapInvoiceStatusToReporting(InvoiceStatus.PARTIALLY_PAID), "OUTSTANDING");
  assert.equal(mapInvoiceStatusToReporting(InvoiceStatus.OVERDUE), "OUTSTANDING");
  assert.equal(mapInvoiceStatusToReporting(InvoiceStatus.PAID), "PAID");
  assert.equal(mapInvoiceStatusToReporting(InvoiceStatus.VOID), "CANCELLED");
  assert.equal(mapInvoiceStatusToReporting(InvoiceStatus.FAILED), "CANCELLED");
  assert.equal(mapInvoiceStatusToReporting(InvoiceStatus.DRAFT), "CANCELLED");
});

// ============================================================================
// Handler Tests
// ============================================================================

test("getFinanceSummaryHandler - excludes zero-amount invoices", async () => {
  const originals = snapshotPrisma();

  (prisma.invoice as any).findMany = async () => [
    mockInvoice({ amountCents: 10000, source: "DUES" }),
    mockInvoice({ amountCents: 0, source: "DUES" }), // Zero-amount - should be excluded
    mockInvoice({ amountCents: 5000, source: "EVT" }),
  ];

  const req = createReq();
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body);
  // Total should only include non-zero invoices
  assert.equal(res.body.totals.outstanding.totalCents, 15000); // 10000 + 5000, not 25000
  restore(originals);
});

test("getFinanceSummaryHandler - breaks down by source", async () => {
  const originals = snapshotPrisma();

  (prisma.invoice as any).findMany = async () => [
    mockInvoice({ amountCents: 10000, source: "DUES", status: InvoiceStatus.PAID }),
    mockInvoice({ amountCents: 5000, source: "EVT", status: InvoiceStatus.PAID }),
    mockInvoice({ amountCents: 3000, source: "DONATION", status: InvoiceStatus.PAID }),
    mockInvoice({ amountCents: 2000, source: "OTHER", status: InvoiceStatus.PAID }),
  ];

  const req = createReq();
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.bySource);
  assert.equal(res.body.bySource.DUES.collected.totalCents, 10000);
  assert.equal(res.body.bySource.EVENT.collected.totalCents, 5000);
  assert.equal(res.body.bySource.DONATION.collected.totalCents, 3000);
  assert.equal(res.body.bySource.OTHER.collected.totalCents, 2000);
  restore(originals);
});

test("getFinanceSummaryHandler - maps statuses correctly", async () => {
  const originals = snapshotPrisma();

  (prisma.invoice as any).findMany = async () => [
    mockInvoice({ amountCents: 10000, status: InvoiceStatus.ISSUED }),
    mockInvoice({ amountCents: 5000, status: InvoiceStatus.PAID }),
    mockInvoice({ amountCents: 3000, status: InvoiceStatus.VOID }),
  ];

  const req = createReq();
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.byStatus);
  assert.equal(res.body.byStatus.OUTSTANDING.count, 1);
  assert.equal(res.body.byStatus.PAID.count, 1);
  assert.equal(res.body.byStatus.CANCELLED.count, 1);
  restore(originals);
});

test("getFinanceSummaryHandler - filters by time window", async () => {
  const originals = snapshotPrisma();

  const now = new Date("2025-06-15T12:00:00Z");
  const inRange = new Date("2025-03-15T12:00:00Z");
  const outOfRange = new Date("2024-12-15T12:00:00Z");

  (prisma.invoice as any).findMany = async (args: any) => {
    // Verify the where clause includes time filter
    assert.ok(args.where.issuedAt);
    assert.ok(args.where.issuedAt.gte);
    assert.ok(args.where.issuedAt.lte);
    return [
      mockInvoice({ amountCents: 10000, issuedAt: inRange }),
      // outOfRange invoice should be filtered by query, but we're mocking so we return it
      // The test verifies the query structure, not the actual filtering
    ];
  };

  const req = createReq({ query: { period: "YEAR_TO_DATE" } });
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.range);
  assert.equal(res.body.range.type, "YEAR_TO_DATE");
  restore(originals);
});

test("getFinanceSummaryHandler - tenant isolation", async () => {
  const originals = snapshotPrisma();

  (prisma.invoice as any).findMany = async (args: any) => {
    // Verify tenant filter is applied
    assert.equal(args.where.tenantId, "t1");
    return [
      mockInvoice({ tenantId: "t1", amountCents: 10000 }),
    ];
  };

  const req = createReq({ user: { tenantId: "t1", roles: ["ADMIN"] } });
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  restore(originals);
});

test("getFinanceSummaryHandler - calculates outstanding for partially paid", async () => {
  const originals = snapshotPrisma();

  (prisma.invoice as any).findMany = async () => [
    mockInvoice({
      amountCents: 10000,
      status: InvoiceStatus.PARTIALLY_PAID,
      payments: [
        { amountCents: 3000, status: PaymentStatus.SUCCEEDED },
        { amountCents: 2000, status: PaymentStatus.SUCCEEDED },
      ],
    }),
  ];

  const req = createReq();
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  // Outstanding = 10000 - (3000 + 2000) = 5000
  assert.equal(res.body.totals.outstanding.totalCents, 5000);
  // Collected = 3000 + 2000 = 5000
  assert.equal(res.body.totals.collected.totalCents, 0); // Collected is only for PAID status
  restore(originals);
});

test("getFinanceSummaryHandler - excludes cancelled from revenue", async () => {
  const originals = snapshotPrisma();

  (prisma.invoice as any).findMany = async () => [
    mockInvoice({ amountCents: 10000, status: InvoiceStatus.PAID }),
    mockInvoice({ amountCents: 5000, status: InvoiceStatus.VOID }),
    mockInvoice({ amountCents: 3000, status: InvoiceStatus.FAILED }),
  ];

  const req = createReq();
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  // Only PAID invoice counts toward collected
  assert.equal(res.body.totals.collected.totalCents, 10000);
  // Cancelled invoices counted separately
  assert.equal(res.body.totals.cancelled.totalCents, 8000);
  restore(originals);
});

test("getFinanceSummaryHandler - returns self-describing range", async () => {
  const originals = snapshotPrisma();

  (prisma.invoice as any).findMany = async () => [];

  const req = createReq({ query: { period: "LAST_12_MONTHS" } });
  const res = createRes();
  await getFinanceSummaryHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.range);
  assert.equal(res.body.range.type, "LAST_12_MONTHS");
  assert.ok(res.body.range.from);
  assert.ok(res.body.range.to);
  assert.ok(res.body.range.label);
  restore(originals);
});

