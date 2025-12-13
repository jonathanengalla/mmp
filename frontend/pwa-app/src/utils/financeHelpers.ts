import type { FinanceSummaryResponse } from "../api/client";
import { formatCurrency } from "./formatters";

/**
 * Maps FIN-01 finance summary response to display-ready UI data
 */
export interface FinanceDisplayData {
  range: {
    type: string;
    label: string;
    from: string;
    to: string;
  };
  headlineCards: {
    outstanding: { amount: string; count: number; label: string };
    collected: { amount: string; count: number; label: string };
    cancelled: { amount: string; count: number; label: string };
  };
  sourceBreakdown: {
    dues: { outstanding: { amount: string; count: number }; collected: { amount: string; count: number } };
    donations: { collected: { amount: string; count: number } };
    events: { outstanding: { amount: string; count: number }; collected: { amount: string; count: number } };
    other: { outstanding: { amount: string; count: number }; collected: { amount: string; count: number } };
  };
  statusBreakdown: {
    outstanding: { amount: string; count: number };
    paid: { amount: string; count: number };
    cancelled: { amount: string; count: number };
  };
}

/**
 * Convert FIN-01 API response to display-ready format
 */
export function mapFinanceSummaryToDisplay(data: FinanceSummaryResponse): FinanceDisplayData {
  return {
    range: {
      type: data.range.type,
      label: data.range.label,
      from: data.range.from,
      to: data.range.to,
    },
    headlineCards: {
      outstanding: {
        amount: formatCurrency(data.totals.outstanding.totalCents),
        count: data.totals.outstanding.count,
        label: `${data.totals.outstanding.count} invoice${data.totals.outstanding.count === 1 ? "" : "s"}`,
      },
      collected: {
        amount: formatCurrency(data.totals.collected.totalCents),
        count: data.totals.collected.count,
        label: `${data.totals.collected.count} invoice${data.totals.collected.count === 1 ? "" : "s"}`,
      },
      cancelled: {
        amount: formatCurrency(data.totals.cancelled.totalCents),
        count: data.totals.cancelled.count,
        label: `${data.totals.cancelled.count} invoice${data.totals.cancelled.count === 1 ? "" : "s"}`,
      },
    },
    sourceBreakdown: {
      dues: {
        outstanding: {
          amount: formatCurrency(data.bySource.DUES.outstanding.totalCents),
          count: data.bySource.DUES.outstanding.count,
        },
        collected: {
          amount: formatCurrency(data.bySource.DUES.collected.totalCents),
          count: data.bySource.DUES.collected.count,
        },
      },
      donations: {
        collected: {
          amount: formatCurrency(data.bySource.DONATION.collected.totalCents),
          count: data.bySource.DONATION.collected.count,
        },
      },
      events: {
        outstanding: {
          amount: formatCurrency(data.bySource.EVENT.outstanding.totalCents),
          count: data.bySource.EVENT.outstanding.count,
        },
        collected: {
          amount: formatCurrency(data.bySource.EVENT.collected.totalCents),
          count: data.bySource.EVENT.collected.count,
        },
      },
      other: {
        outstanding: {
          amount: formatCurrency(data.bySource.OTHER.outstanding.totalCents),
          count: data.bySource.OTHER.outstanding.count,
        },
        collected: {
          amount: formatCurrency(data.bySource.OTHER.collected.totalCents),
          count: data.bySource.OTHER.collected.count,
        },
      },
    },
    statusBreakdown: {
      outstanding: {
        amount: formatCurrency(data.byStatus.OUTSTANDING.totalCents),
        count: data.byStatus.OUTSTANDING.count,
      },
      paid: {
        amount: formatCurrency(data.byStatus.PAID.totalCents),
        count: data.byStatus.PAID.count,
      },
      cancelled: {
        amount: formatCurrency(data.byStatus.CANCELLED.totalCents),
        count: data.byStatus.CANCELLED.count,
      },
    },
  };
}

/**
 * Default finance summary data (for loading/empty states)
 */
export function getDefaultFinanceDisplayData(): FinanceDisplayData {
  return {
    range: { type: "YEAR_TO_DATE", label: "Year to Date", from: "", to: "" },
    headlineCards: {
      outstanding: { amount: formatCurrency(0), count: 0, label: "0 invoices" },
      collected: { amount: formatCurrency(0), count: 0, label: "0 invoices" },
      cancelled: { amount: formatCurrency(0), count: 0, label: "0 invoices" },
    },
    sourceBreakdown: {
      dues: { outstanding: { amount: formatCurrency(0), count: 0 }, collected: { amount: formatCurrency(0), count: 0 } },
      donations: { collected: { amount: formatCurrency(0), count: 0 } },
      events: { outstanding: { amount: formatCurrency(0), count: 0 }, collected: { amount: formatCurrency(0), count: 0 } },
      other: { outstanding: { amount: formatCurrency(0), count: 0 }, collected: { amount: formatCurrency(0), count: 0 } },
    },
    statusBreakdown: {
      outstanding: { amount: formatCurrency(0), count: 0 },
      paid: { amount: formatCurrency(0), count: 0 },
      cancelled: { amount: formatCurrency(0), count: 0 },
    },
  };
}

