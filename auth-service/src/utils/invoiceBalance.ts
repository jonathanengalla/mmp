/**
 * Invoice balance calculation utilities for FIN-02
 * Calculates remaining balance from invoice amount and payments
 */

/**
 * Calculate the remaining balance for an invoice
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

