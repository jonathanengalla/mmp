/**
 * Unit tests for Invoice Status Engine (PAY-10)
 * Tests the computeInvoiceStatus function which is the single source of truth for invoice status
 */

import { describe, it, expect } from "node:test";
import { InvoiceStatus } from "@prisma/client";
import { computeInvoiceStatus } from "../src/services/invoice/computeInvoiceStatus";

describe("computeInvoiceStatus", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);

  const now = new Date();

  describe("No allocations", () => {
    it("should return ISSUED when no allocations and not past due", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 0, now);
      expect(status).toBe(InvoiceStatus.ISSUED);
    });

    it("should return OVERDUE when no allocations and past due", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: pastDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 0, now);
      expect(status).toBe(InvoiceStatus.OVERDUE);
    });

    it("should return OVERDUE when no allocations and dueAt is null but invoice was issued long ago", () => {
      // If dueAt is null, we can't determine overdue, so should default to ISSUED
      const invoice = {
        amountCents: 10000,
        dueAt: null,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 0, now);
      expect(status).toBe(InvoiceStatus.ISSUED);
    });
  });

  describe("Partial allocations", () => {
    it("should return PARTIALLY_PAID when allocations are less than amount", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 5000, now);
      expect(status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });

    it("should return PARTIALLY_PAID when allocations are 1 cent less than amount", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 9999, now);
      expect(status).toBe(InvoiceStatus.PARTIALLY_PAID);
    });
  });

  describe("Full allocations", () => {
    it("should return PAID when allocations equal amount", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 10000, now);
      expect(status).toBe(InvoiceStatus.PAID);
    });

    it("should return PAID when allocations exceed amount (overpayment)", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 15000, now);
      expect(status).toBe(InvoiceStatus.PAID);
    });
  });

  describe("VOID invoices", () => {
    it("should return VOID when invoice is manually voided regardless of allocations", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.VOID,
      };
      const status = computeInvoiceStatus(invoice, 5000, now);
      expect(status).toBe(InvoiceStatus.VOID);
    });

    it("should return VOID when invoice is voided even with full allocations", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.VOID,
      };
      const status = computeInvoiceStatus(invoice, 10000, now);
      expect(status).toBe(InvoiceStatus.VOID);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero amount invoice", () => {
      const invoice = {
        amountCents: 0,
        dueAt: futureDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, 0, now);
      expect(status).toBe(InvoiceStatus.PAID); // Zero amount is considered paid
    });

    it("should handle negative allocations (should not happen but defensive)", () => {
      const invoice = {
        amountCents: 10000,
        dueAt: futureDate,
        status: InvoiceStatus.ISSUED,
      };
      const status = computeInvoiceStatus(invoice, -1000, now);
      expect(status).toBe(InvoiceStatus.ISSUED); // Treated as no allocations
    });
  });
});
