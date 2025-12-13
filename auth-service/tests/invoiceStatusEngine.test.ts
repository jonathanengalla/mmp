/**
 * Unit tests for Invoice Status Engine (PAY-10)
 * Tests the computeInvoiceStatus function which is the single source of truth for invoice status
 */

import assert from "node:assert/strict";
import test from "node:test";
import { InvoiceStatus } from "@prisma/client";
import { computeInvoiceStatus } from "../src/services/invoice/computeInvoiceStatus";

test("computeInvoiceStatus - No allocations - ISSUED when not past due", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 0, now);
  assert.equal(status, InvoiceStatus.ISSUED);
});

test("computeInvoiceStatus - No allocations - OVERDUE when past due", () => {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 10);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: pastDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 0, now);
  assert.equal(status, InvoiceStatus.OVERDUE);
});

test("computeInvoiceStatus - No allocations - ISSUED when dueAt is null", () => {
  const now = new Date();
  const invoice = {
    amountCents: 10000,
    dueAt: null,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 0, now);
  assert.equal(status, InvoiceStatus.ISSUED);
});

test("computeInvoiceStatus - Partial allocations - PARTIALLY_PAID", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 5000, now);
  assert.equal(status, InvoiceStatus.PARTIALLY_PAID);
});

test("computeInvoiceStatus - Partial allocations - PARTIALLY_PAID when 1 cent less", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 9999, now);
  assert.equal(status, InvoiceStatus.PARTIALLY_PAID);
});

test("computeInvoiceStatus - Full allocations - PAID when equal", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 10000, now);
  assert.equal(status, InvoiceStatus.PAID);
});

test("computeInvoiceStatus - Full allocations - PAID when overpayment", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 15000, now);
  assert.equal(status, InvoiceStatus.PAID);
});

test("computeInvoiceStatus - VOID invoices - stays VOID with partial allocations", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.VOID,
  };
  const status = computeInvoiceStatus(invoice, 5000, now);
  assert.equal(status, InvoiceStatus.VOID);
});

test("computeInvoiceStatus - VOID invoices - stays VOID with full allocations", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.VOID,
  };
  const status = computeInvoiceStatus(invoice, 10000, now);
  assert.equal(status, InvoiceStatus.VOID);
});

test("computeInvoiceStatus - Edge case - zero amount invoice", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 0,
    dueAt: futureDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, 0, now);
  assert.equal(status, InvoiceStatus.PAID); // Zero amount is considered paid
});

test("computeInvoiceStatus - Edge case - negative allocations", () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const now = new Date();

  const invoice = {
    amountCents: 10000,
    dueAt: futureDate,
    status: InvoiceStatus.ISSUED,
  };
  const status = computeInvoiceStatus(invoice, -1000, now);
  assert.equal(status, InvoiceStatus.ISSUED); // Treated as no allocations
});
