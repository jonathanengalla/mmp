/**
 * Invoice Status Engine for PAY-10
 * 
 * This is the SINGLE SOURCE OF TRUTH for invoice status computation.
 * No other code path is allowed to update Invoice.status directly.
 * 
 * Status is derived from:
 * - Allocations (how much has been paid)
 * - Invoice amount (how much is owed)
 * - Due date (for overdue logic)
 * - Manual void state (separate admin action)
 */

import { InvoiceStatus } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { getInvoiceAllocationsTotalCents } from "./balance";

/**
 * Compute invoice status from allocations and due date
 * This is the single source of truth for invoice status computation
 * 
 * @param invoice - Invoice object with amountCents, dueAt, status
 * @param allocationsTotalCents - Sum of all allocations for this invoice
 * @param now - Current date/time (defaults to new Date())
 * @returns Computed InvoiceStatus
 */
export function computeInvoiceStatus(
  invoice: {
    amountCents: number;
    dueAt: Date | null;
    status: InvoiceStatus; // Current stored status
  },
  allocationsTotalCents: number,
  now: Date = new Date()
): InvoiceStatus {
  // If manually voided, keep VOID (separate admin action)
  if (invoice.status === InvoiceStatus.VOID) {
    return InvoiceStatus.VOID;
  }

  // Handle negative allocations (defensive - should not happen)
  const allocated = Math.max(allocationsTotalCents, 0);
  const due = invoice.dueAt;

  // Zero amount invoice is considered paid
  if (invoice.amountCents === 0) {
    return InvoiceStatus.PAID;
  }

  // No allocations
  if (allocated <= 0) {
    if (due && due < now) {
      return InvoiceStatus.OVERDUE;
    }
    return InvoiceStatus.ISSUED;
  }

  // Partial allocations
  if (allocated > 0 && allocated < invoice.amountCents) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  // Full or over-allocated
  if (allocated >= invoice.amountCents) {
    return InvoiceStatus.PAID;
  }

  // Fallback (should not reach here)
  return InvoiceStatus.ISSUED;
}

/**
 * Recompute and persist invoice status
 * This function must be called whenever allocations change
 * 
 * @param invoiceId - Invoice ID
 * @param tenantId - Tenant ID (for scoping)
 * @param now - Current date/time (defaults to new Date())
 * @returns Updated invoice status
 */
export async function recomputeAndPersistInvoiceStatus(
  invoiceId: string,
  tenantId: string,
  now: Date = new Date()
): Promise<InvoiceStatus> {
  // Load invoice and allocations in transaction
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
  });

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const allocationsTotalCents = await getInvoiceAllocationsTotalCents(
    invoiceId,
    tenantId
  );

  const newStatus = computeInvoiceStatus(
    invoice,
    allocationsTotalCents,
    now
  );

  // Only update if status changed
  if (newStatus !== invoice.status) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus },
    });
  }

  return newStatus;
}
