/**
 * Finance period utilities for FIN-01
 * Resolves time windows for finance dashboard queries
 */

export type FinancePeriodType = "YEAR_TO_DATE" | "ALL_TIME" | "LAST_12_MONTHS" | "CURRENT_MONTH" | "CUSTOM";

export interface FinancePeriod {
  type: FinancePeriodType;
  from: Date;
  to: Date;
  label: string;
}

/**
 * Resolve finance period from query params or default to YEAR_TO_DATE
 * @param period - Period preset type
 * @param from - Custom start date (ISO 8601 string)
 * @param to - Custom end date (ISO 8601 string)
 * @param now - Reference date (defaults to current time, injectable for tests)
 * @returns Resolved period with from/to dates and label
 */
export function resolveFinancePeriod(
  period?: string,
  from?: string,
  to?: string,
  now: Date = new Date()
): FinancePeriod {
  // Custom range takes precedence
  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new Error("Invalid date format for from/to. Use ISO 8601 (YYYY-MM-DD)");
    }
    if (fromDate > toDate) {
      throw new Error("from date must be before to date");
    }
    return {
      type: "CUSTOM",
      from: fromDate,
      to: toDate,
      label: `Custom Range (${formatDateLabel(fromDate)} - ${formatDateLabel(toDate)})`,
    };
  }

  // If only one of from/to is provided, it's invalid
  if (from || to) {
    throw new Error("Both from and to must be provided for custom range");
  }

  // Default to YEAR_TO_DATE if no period specified
  const periodType = (period?.toUpperCase() || "YEAR_TO_DATE") as FinancePeriodType;

  switch (periodType) {
    case "ALL_TIME":
      // Use a very early date as "from" (e.g., 2000-01-01)
      return {
        type: "ALL_TIME",
        from: new Date("2000-01-01"),
        to: now,
        label: `All Time (up to ${formatDateLabel(now)})`,
      };

    case "YEAR_TO_DATE": {
      const yearStart = new Date(now.getFullYear(), 0, 1); // January 1
      return {
        type: "YEAR_TO_DATE",
        from: yearStart,
        to: now,
        label: `Year to Date (${formatDateLabel(yearStart)} - ${formatDateLabel(now)})`,
      };
    }

    case "LAST_12_MONTHS": {
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      return {
        type: "LAST_12_MONTHS",
        from: twelveMonthsAgo,
        to: now,
        label: `Last 12 Months (${formatDateLabel(twelveMonthsAgo)} - ${formatDateLabel(now)})`,
      };
    }

    case "CURRENT_MONTH": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        type: "CURRENT_MONTH",
        from: monthStart,
        to: now,
        label: `Current Month (${formatDateLabel(monthStart)} - ${formatDateLabel(now)})`,
      };
    }

    default:
      throw new Error(`Invalid period type: ${periodType}. Must be one of: YEAR_TO_DATE, ALL_TIME, LAST_12_MONTHS, CURRENT_MONTH`);
  }
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

