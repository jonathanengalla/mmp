/**
 * Invoice balance calculation utilities for FIN-02
 * PAY-10: Updated to use Allocations as single source of truth
 */

/**
 * Calculate the remaining balance for an invoice using allocations
 * PAY-10: This is the preferred method - uses Allocations as source of truth
 * @param amountCents - Original invoice amount in cents
 * @param allocations - Array of allocation objects with amountCents
 * @returns Remaining balance in cents (0 for fully paid or cancelled)
 */
export function calculateInvoiceBalanceFromAllocations(
  amountCents: number,
  allocations: Array<{ amountCents: number }>
): number {
  const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.amountCents || 0), 0);
  return Math.max(amountCents - totalAllocated, 0);
}

/**
 * Calculate the remaining balance for an invoice (legacy method using payments)
 * @deprecated Use calculateInvoiceBalanceFromAllocations instead. This is kept for backward compatibility during migration.
 * @param amountCents - Original invoice amount in cents
 * @param payments - Array of payment objects with amountCents
 * @returns Remaining balance in cents (0 for fully paid or cancelled)
 */
export function calculateInvoiceBalance(
  amountCents: number,
  payments: Array<{ amountCents: number; status?: string }>
): number {
  const totalPaid = payments
    .filter((p) => !p.status || p.status === "SUCCEEDED") // Only count succeeded payments
    .reduce((sum, p) => sum + (p.amountCents || 0), 0);
  return Math.max(amountCents - totalPaid, 0);
}

