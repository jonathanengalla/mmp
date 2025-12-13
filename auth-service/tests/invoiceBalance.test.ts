/**
 * Unit tests for Invoice Balance Helpers (PAY-10)
 * Tests allocation-based balance calculation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { computeInvoiceBalanceCents } from "../src/services/invoice/balance";

test("computeInvoiceBalanceCents - No allocations - returns full amount", () => {
  const invoice = { amountCents: 10000 };
  const balance = computeInvoiceBalanceCents(invoice, 0);
  assert.equal(balance, 10000);
});

test("computeInvoiceBalanceCents - Partial allocations - returns remaining balance", () => {
  const invoice = { amountCents: 10000 };
  const balance = computeInvoiceBalanceCents(invoice, 3000);
  assert.equal(balance, 7000);
});

test("computeInvoiceBalanceCents - Partial allocations - returns 1 cent when 1 cent remains", () => {
  const invoice = { amountCents: 10000 };
  const balance = computeInvoiceBalanceCents(invoice, 9999);
  assert.equal(balance, 1);
});

test("computeInvoiceBalanceCents - Full allocations - returns 0 when fully allocated", () => {
  const invoice = { amountCents: 10000 };
  const balance = computeInvoiceBalanceCents(invoice, 10000);
  assert.equal(balance, 0);
});

test("computeInvoiceBalanceCents - Full allocations - returns 0 when over-allocated", () => {
  const invoice = { amountCents: 10000 };
  const balance = computeInvoiceBalanceCents(invoice, 15000);
  assert.equal(balance, 0);
});

test("computeInvoiceBalanceCents - Edge case - zero amount invoice", () => {
  const invoice = { amountCents: 0 };
  const balance = computeInvoiceBalanceCents(invoice, 0);
  assert.equal(balance, 0);
});

test("computeInvoiceBalanceCents - Edge case - negative allocations", () => {
  const invoice = { amountCents: 10000 };
  const balance = computeInvoiceBalanceCents(invoice, -1000);
  assert.equal(balance, 10000); // Treated as no allocations
});
