/**
 * Unit tests for Invoice Balance Helpers (PAY-10)
 * Tests allocation-based balance calculation
 */

import { describe, it, expect } from "node:test";
import { computeInvoiceBalanceCents } from "../src/services/invoice/balance";

describe("computeInvoiceBalanceCents", () => {
  describe("No allocations", () => {
    it("should return full amount when no allocations", () => {
      const invoice = { amountCents: 10000 };
      const balance = computeInvoiceBalanceCents(invoice, 0);
      expect(balance).toBe(10000);
    });
  });

  describe("Partial allocations", () => {
    it("should return remaining balance when partially allocated", () => {
      const invoice = { amountCents: 10000 };
      const balance = computeInvoiceBalanceCents(invoice, 3000);
      expect(balance).toBe(7000);
    });

    it("should return 1 cent when 1 cent remains", () => {
      const invoice = { amountCents: 10000 };
      const balance = computeInvoiceBalanceCents(invoice, 9999);
      expect(balance).toBe(1);
    });
  });

  describe("Full allocations", () => {
    it("should return 0 when fully allocated", () => {
      const invoice = { amountCents: 10000 };
      const balance = computeInvoiceBalanceCents(invoice, 10000);
      expect(balance).toBe(0);
    });

    it("should return 0 when over-allocated (never negative)", () => {
      const invoice = { amountCents: 10000 };
      const balance = computeInvoiceBalanceCents(invoice, 15000);
      expect(balance).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero amount invoice", () => {
      const invoice = { amountCents: 0 };
      const balance = computeInvoiceBalanceCents(invoice, 0);
      expect(balance).toBe(0);
    });

    it("should handle negative allocations (defensive)", () => {
      const invoice = { amountCents: 10000 };
      const balance = computeInvoiceBalanceCents(invoice, -1000);
      expect(balance).toBe(10000); // Treated as no allocations
    });
  });
});
