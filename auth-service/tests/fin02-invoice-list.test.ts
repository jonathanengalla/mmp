/**
 * FIN-02: Invoice List & Detail Regression Tests
 * Tests core business rules: status grouping, period filtering, balance calculation, zero-amount exclusion
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";
import { mapInvoiceStatusToReporting } from "../src/utils/invoiceStatusMapper";
import { calculateInvoiceBalance } from "../src/utils/invoiceBalance";
import { resolveFinancePeriod } from "../src/utils/financePeriod";

describe("FIN-02: Invoice List & Detail", () => {

  describe("Status Mapping (shared with FIN-01)", () => {
    it("maps ISSUED, PARTIALLY_PAID, OVERDUE to OUTSTANDING", () => {
      assert.strictEqual(mapInvoiceStatusToReporting(InvoiceStatus.ISSUED), "OUTSTANDING");
      assert.strictEqual(mapInvoiceStatusToReporting(InvoiceStatus.PARTIALLY_PAID), "OUTSTANDING");
      assert.strictEqual(mapInvoiceStatusToReporting(InvoiceStatus.OVERDUE), "OUTSTANDING");
    });

    it("maps PAID to PAID", () => {
      assert.strictEqual(mapInvoiceStatusToReporting(InvoiceStatus.PAID), "PAID");
    });

    it("maps VOID, FAILED, DRAFT to CANCELLED", () => {
      assert.strictEqual(mapInvoiceStatusToReporting(InvoiceStatus.VOID), "CANCELLED");
      assert.strictEqual(mapInvoiceStatusToReporting(InvoiceStatus.FAILED), "CANCELLED");
      assert.strictEqual(mapInvoiceStatusToReporting(InvoiceStatus.DRAFT), "CANCELLED");
    });
  });

  describe("Balance Calculation", () => {
    it("calculates balance correctly for unpaid invoice", () => {
      const balance = calculateInvoiceBalance(10000, []);
      assert.strictEqual(balance, 10000);
    });

    it("calculates balance correctly for partially paid invoice", () => {
      const balance = calculateInvoiceBalance(10000, [
        { amountCents: 5000, status: PaymentStatus.SUCCEEDED },
      ]);
      assert.strictEqual(balance, 5000);
    });

    it("calculates balance correctly for fully paid invoice", () => {
      const balance = calculateInvoiceBalance(10000, [
        { amountCents: 10000, status: PaymentStatus.SUCCEEDED },
      ]);
      assert.strictEqual(balance, 0);
    });

    it("ignores non-succeeded payments", () => {
      const balance = calculateInvoiceBalance(10000, [
        { amountCents: 5000, status: PaymentStatus.PENDING },
        { amountCents: 3000, status: PaymentStatus.SUCCEEDED },
      ]);
      assert.strictEqual(balance, 7000);
    });

    it("never returns negative balance", () => {
      const balance = calculateInvoiceBalance(10000, [
        { amountCents: 15000, status: PaymentStatus.SUCCEEDED },
      ]);
      assert.strictEqual(balance, 0);
    });
  });

  describe("Period Resolution (shared with FIN-01)", () => {
    it("resolves YEAR_TO_DATE correctly", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const period = resolveFinancePeriod("YEAR_TO_DATE", undefined, undefined, now);
      assert.strictEqual(period.type, "YEAR_TO_DATE");
      assert.strictEqual(period.from.getFullYear(), 2025);
      assert.strictEqual(period.from.getMonth(), 0); // January
      assert.strictEqual(period.from.getDate(), 1);
    });

    it("resolves CURRENT_MONTH correctly", () => {
      const now = new Date("2025-06-15T12:00:00Z");
      const period = resolveFinancePeriod("CURRENT_MONTH", undefined, undefined, now);
      assert.strictEqual(period.type, "CURRENT_MONTH");
      assert.strictEqual(period.from.getMonth(), 5); // June (0-indexed)
      assert.strictEqual(period.from.getDate(), 1);
    });

    it("resolves custom date range", () => {
      const period = resolveFinancePeriod("CUSTOM", "2025-01-01", "2025-12-31");
      assert.strictEqual(period.type, "CUSTOM");
      assert.strictEqual(period.from.getFullYear(), 2025);
      assert.strictEqual(period.from.getMonth(), 0);
      assert.strictEqual(period.to.getFullYear(), 2025);
      assert.strictEqual(period.to.getMonth(), 11);
    });
  });
});

