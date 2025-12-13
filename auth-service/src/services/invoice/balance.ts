/**
 * Allocation-based balance calculation utilities for PAY-10
 * These helpers use Allocations as the single source of truth for invoice balances
 */

import { prisma } from "../../db/prisma";

/**
 * Get total allocated amount for an invoice
 * @param invoiceId - Invoice ID
 * @param tenantId - Tenant ID (for scoping)
 * @returns Total allocated amount in cents
 */
export async function getInvoiceAllocationsTotalCents(
  invoiceId: string,
  tenantId: string
): Promise<number> {
  const result = await prisma.allocation.aggregate({
    where: {
      invoiceId,
      tenantId,
    },
    _sum: {
      amountCents: true,
    },
  });
  return result._sum.amountCents ?? 0;
}

/**
 * Compute invoice balance from amount and allocations
 * @param invoice - Invoice object with amountCents
 * @param allocationsTotalCents - Sum of all allocations for this invoice
 * @returns Remaining balance in cents (never negative)
 */
export function computeInvoiceBalanceCents(
  invoice: { amountCents: number },
  allocationsTotalCents: number
): number {
  return Math.max(invoice.amountCents - allocationsTotalCents, 0);
}
