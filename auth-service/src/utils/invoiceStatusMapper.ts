/**
 * Invoice status mapping utilities for FIN-01
 * Maps database InvoiceStatus enum to business reporting buckets
 */

import { InvoiceStatus } from "@prisma/client";

export type ReportingStatus = "OUTSTANDING" | "PAID" | "CANCELLED";

/**
 * Map database InvoiceStatus to reporting bucket
 * @param status - Database invoice status
 * @returns Reporting status bucket
 */
export function mapInvoiceStatusToReporting(status: InvoiceStatus): ReportingStatus {
  switch (status) {
    case InvoiceStatus.ISSUED:
    case InvoiceStatus.PARTIALLY_PAID:
    case InvoiceStatus.OVERDUE:
      return "OUTSTANDING";
    case InvoiceStatus.PAID:
      return "PAID";
    case InvoiceStatus.VOID:
    case InvoiceStatus.FAILED:
    case InvoiceStatus.DRAFT:
      return "CANCELLED";
    default:
      // Fallback for any unknown statuses
      return "CANCELLED";
  }
}

/**
 * Check if an invoice status is considered "outstanding" for revenue calculations
 * @param status - Database invoice status
 * @returns true if status represents outstanding balance
 */
export function isOutstandingStatus(status: InvoiceStatus): boolean {
  return (
    status === InvoiceStatus.ISSUED ||
    status === InvoiceStatus.PARTIALLY_PAID ||
    status === InvoiceStatus.OVERDUE
  );
}

/**
 * Check if an invoice status is considered "paid" for revenue calculations
 * @param status - Database invoice status
 * @returns true if status represents fully paid invoice
 */
export function isPaidStatus(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.PAID;
}

/**
 * Check if an invoice status should be excluded from revenue (cancelled/void)
 * @param status - Database invoice status
 * @returns true if status should be excluded from revenue totals
 */
export function isCancelledStatus(status: InvoiceStatus): boolean {
  return (
    status === InvoiceStatus.VOID ||
    status === InvoiceStatus.FAILED ||
    status === InvoiceStatus.DRAFT
  );
}

