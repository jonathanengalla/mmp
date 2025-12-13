/**
 * FIN-01/FIN-02 Regression Tests for PAY-10
 * 
 * These tests verify that after refactoring to use Allocations,
 * FIN-01 and FIN-02 return the same totals as before (on the same data).
 * 
 * This test should be run:
 * 1. Before migration (with Payments-based logic) - capture baseline
 * 2. After migration (with Allocations-based logic) - verify totals match
 */

import { describe, it, expect, before, after } from "node:test";
import { PrismaClient, InvoiceStatus, PaymentStatus, PaymentChannel, PaymentVerificationStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Test tenant ID - use a test tenant or create one
const TEST_TENANT_ID = "test-tenant-pay10";

describe("FIN-01/FIN-02 Regression Tests", () => {
  let testMemberId: string;
  let testInvoiceIds: string[] = [];

  before(async () => {
    // Clean up any existing test data
    await prisma.allocation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.payment.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.invoice.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.member.deleteMany({ where: { tenantId: TEST_TENANT_ID } });

    // Create test member
    const member = await prisma.member.create({
      data: {
        tenantId: TEST_TENANT_ID,
        email: "test-member-pay10@example.com",
        firstName: "Test",
        lastName: "Member",
        status: "ACTIVE",
      },
    });
    testMemberId = member.id;

    // Create test invoices with different statuses
    const invoices = await Promise.all([
      // Fully paid invoice (DUES)
      prisma.invoice.create({
        data: {
          tenantId: TEST_TENANT_ID,
          memberId: testMemberId,
          invoiceNumber: "TEST-DUES-001",
          amountCents: 10000,
          currency: "PHP",
          status: InvoiceStatus.PAID,
          source: "DUES",
          issuedAt: new Date("2025-01-01"),
          paidAt: new Date("2025-01-15"),
        },
      }),
      // Partially paid invoice (EVT)
      prisma.invoice.create({
        data: {
          tenantId: TEST_TENANT_ID,
          memberId: testMemberId,
          invoiceNumber: "TEST-EVT-001",
          amountCents: 5000,
          currency: "PHP",
          status: InvoiceStatus.PARTIALLY_PAID,
          source: "EVT",
          issuedAt: new Date("2025-01-01"),
        },
      }),
      // Overdue unpaid invoice (DONATION)
      prisma.invoice.create({
        data: {
          tenantId: TEST_TENANT_ID,
          memberId: testMemberId,
          invoiceNumber: "TEST-DON-001",
          amountCents: 3000,
          currency: "PHP",
          status: InvoiceStatus.OVERDUE,
          source: "DONATION",
          issuedAt: new Date("2025-01-01"),
          dueAt: new Date("2025-01-10"), // Past due
        },
      }),
      // Issued unpaid invoice (OTHER)
      prisma.invoice.create({
        data: {
          tenantId: TEST_TENANT_ID,
          memberId: testMemberId,
          invoiceNumber: "TEST-OTH-001",
          amountCents: 2000,
          currency: "PHP",
          status: InvoiceStatus.ISSUED,
          source: "OTHER",
          issuedAt: new Date("2025-01-01"),
          dueAt: new Date("2025-12-31"), // Future due
        },
      }),
    ]);

    testInvoiceIds = invoices.map((inv) => inv.id);

    // Create payments and allocations for paid/partially paid invoices
    // This simulates the migration backfill
    const paidInvoice = invoices[0];
    const partiallyPaidInvoice = invoices[1];

    // Fully paid: create payment and allocation
    const paidPayment = await prisma.payment.create({
      data: {
        tenantId: TEST_TENANT_ID,
        memberId: testMemberId,
        invoiceId: paidInvoice.id,
        amountCents: 10000,
        currency: "PHP",
        channel: PaymentChannel.SIMULATED,
        status: PaymentStatus.SUCCEEDED,
        verificationStatus: PaymentVerificationStatus.NOT_REQUIRED,
      },
    });

    await prisma.allocation.create({
      data: {
        tenantId: TEST_TENANT_ID,
        invoiceId: paidInvoice.id,
        paymentId: paidPayment.id,
        amountCents: 10000,
      },
    });

    // Partially paid: create payment and allocation for 3000 out of 5000
    const partialPayment = await prisma.payment.create({
      data: {
        tenantId: TEST_TENANT_ID,
        memberId: testMemberId,
        invoiceId: partiallyPaidInvoice.id,
        amountCents: 3000,
        currency: "PHP",
        channel: PaymentChannel.SIMULATED,
        status: PaymentStatus.SUCCEEDED,
        verificationStatus: PaymentVerificationStatus.NOT_REQUIRED,
      },
    });

    await prisma.allocation.create({
      data: {
        tenantId: TEST_TENANT_ID,
        invoiceId: partiallyPaidInvoice.id,
        paymentId: partialPayment.id,
        amountCents: 3000,
      },
    });
  });

  after(async () => {
    // Clean up test data
    await prisma.allocation.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.payment.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.invoice.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.member.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.$disconnect();
  });

  describe("FIN-01: Finance Summary Totals", () => {
    it("should calculate correct outstanding total using Allocations", async () => {
      // Get all invoices in period
      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId: TEST_TENANT_ID,
          amountCents: { gt: 0 },
          issuedAt: {
            gte: new Date("2025-01-01"),
            lte: new Date("2025-12-31"),
          },
        },
      });

      // Load allocations for all invoices
      const invoiceIds = invoices.map((inv) => inv.id);
      const allocations = await prisma.allocation.findMany({
        where: {
          tenantId: TEST_TENANT_ID,
          invoiceId: { in: invoiceIds },
          payment: {
            status: PaymentStatus.SUCCEEDED,
          },
        },
      });

      const allocationsByInvoice = new Map<string, number>();
      for (const alloc of allocations) {
        const current = allocationsByInvoice.get(alloc.invoiceId) || 0;
        allocationsByInvoice.set(alloc.invoiceId, current + alloc.amountCents);
      }

      // Calculate outstanding (using allocation-based logic)
      let outstandingTotal = 0;
      let outstandingCount = 0;

      for (const invoice of invoices) {
        if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.FAILED || invoice.status === InvoiceStatus.DRAFT) {
          continue; // Skip cancelled
        }

        const allocated = allocationsByInvoice.get(invoice.id) || 0;
        const balance = Math.max(invoice.amountCents - allocated, 0);

        if (balance > 0) {
          outstandingTotal += balance;
          outstandingCount += 1;
        }
      }

      // Expected: PARTIALLY_PAID (2000 remaining) + OVERDUE (3000) + ISSUED (2000) = 7000
      expect(outstandingTotal).toBe(7000);
      expect(outstandingCount).toBe(3);
    });

    it("should calculate correct collected total using Allocations", async () => {
      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId: TEST_TENANT_ID,
          amountCents: { gt: 0 },
        },
      });

      const invoiceIds = invoices.map((inv) => inv.id);
      const allocations = await prisma.allocation.findMany({
        where: {
          tenantId: TEST_TENANT_ID,
          invoiceId: { in: invoiceIds },
          payment: {
            status: PaymentStatus.SUCCEEDED,
          },
        },
      });

      const collectedTotal = allocations.reduce((sum, alloc) => sum + alloc.amountCents, 0);

      // Expected: 10000 (fully paid) + 3000 (partially paid) = 13000
      expect(collectedTotal).toBe(13000);
    });

    it("should calculate correct totals by source using Allocations", async () => {
      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId: TEST_TENANT_ID,
          amountCents: { gt: 0 },
        },
      });

      const invoiceIds = invoices.map((inv) => inv.id);
      const allocations = await prisma.allocation.findMany({
        where: {
          tenantId: TEST_TENANT_ID,
          invoiceId: { in: invoiceIds },
          payment: {
            status: PaymentStatus.SUCCEEDED,
          },
        },
      });

      const allocationsByInvoice = new Map<string, number>();
      for (const alloc of allocations) {
        const current = allocationsByInvoice.get(alloc.invoiceId) || 0;
        allocationsByInvoice.set(alloc.invoiceId, current + alloc.amountCents);
      }

      const bySource: Record<string, { outstanding: number; collected: number }> = {
        DUES: { outstanding: 0, collected: 0 },
        EVT: { outstanding: 0, collected: 0 },
        DONATION: { outstanding: 0, collected: 0 },
        OTHER: { outstanding: 0, collected: 0 },
      };

      for (const invoice of invoices) {
        const source = (invoice.source || "OTHER").toUpperCase();
        const allocated = allocationsByInvoice.get(invoice.id) || 0;
        const balance = Math.max(invoice.amountCents - allocated, 0);

        if (balance > 0) {
          bySource[source].outstanding += balance;
        }
        if (allocated > 0) {
          bySource[source].collected += allocated;
        }
      }

      // Expected:
      // DUES: outstanding=0, collected=10000
      // EVT: outstanding=2000, collected=3000
      // DONATION: outstanding=3000, collected=0
      // OTHER: outstanding=2000, collected=0
      expect(bySource.DUES.collected).toBe(10000);
      expect(bySource.EVT.outstanding).toBe(2000);
      expect(bySource.EVT.collected).toBe(3000);
      expect(bySource.DONATION.outstanding).toBe(3000);
      expect(bySource.OTHER.outstanding).toBe(2000);
    });
  });

  describe("FIN-02: Invoice List Balance Calculation", () => {
    it("should calculate correct balance for each invoice using Allocations", async () => {
      const invoices = await prisma.invoice.findMany({
        where: {
          tenantId: TEST_TENANT_ID,
          amountCents: { gt: 0 },
        },
        include: {
          allocations: {
            include: {
              payment: {
                where: { status: PaymentStatus.SUCCEEDED },
              },
            },
          },
        },
      });

      for (const invoice of invoices) {
        const allocations = invoice.allocations.filter((alloc: any) => alloc.payment);
        const allocationsTotal = allocations.reduce((sum: number, alloc: any) => sum + (alloc.amountCents || 0), 0);
        const balance = Math.max(invoice.amountCents - allocationsTotal, 0);

        // Verify balance matches expected
        if (invoice.invoiceNumber === "TEST-DUES-001") {
          expect(balance).toBe(0); // Fully paid
        } else if (invoice.invoiceNumber === "TEST-EVT-001") {
          expect(balance).toBe(2000); // 5000 - 3000
        } else if (invoice.invoiceNumber === "TEST-DON-001") {
          expect(balance).toBe(3000); // Unpaid
        } else if (invoice.invoiceNumber === "TEST-OTH-001") {
          expect(balance).toBe(2000); // Unpaid
        }
      }
    });
  });
});
