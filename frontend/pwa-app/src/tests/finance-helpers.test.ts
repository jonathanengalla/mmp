import { describe, it, expect } from "vitest";
import { mapFinanceSummaryToDisplay, getDefaultFinanceDisplayData } from "../utils/financeHelpers";
import type { FinanceSummaryResponse } from "../api/client";

describe("financeHelpers", () => {
  describe("mapFinanceSummaryToDisplay", () => {
    it("maps a complete FinanceSummaryResponse to display format", () => {
      const mockResponse: FinanceSummaryResponse = {
        range: {
          type: "YEAR_TO_DATE",
          from: "2025-01-01T00:00:00Z",
          to: "2025-01-14T23:59:59Z",
          label: "Year to Date (Jan 1, 2025 - Jan 14, 2025)",
        },
        totals: {
          outstanding: { count: 5, totalCents: 50000 },
          collected: { count: 10, totalCents: 200000 },
          cancelled: { count: 2, totalCents: 15000 },
        },
        bySource: {
          DUES: {
            outstanding: { count: 3, totalCents: 30000 },
            collected: { count: 8, totalCents: 150000 },
          },
          DONATION: {
            collected: { count: 1, totalCents: 20000 },
          },
          EVENT: {
            outstanding: { count: 2, totalCents: 20000 },
            collected: { count: 1, totalCents: 30000 },
          },
          OTHER: {
            outstanding: { count: 0, totalCents: 0 },
            collected: { count: 0, totalCents: 0 },
          },
        },
        byStatus: {
          OUTSTANDING: { count: 5, totalCents: 50000 },
          PAID: { count: 10, totalCents: 200000 },
          CANCELLED: { count: 2, totalCents: 15000 },
        },
      };

      const result = mapFinanceSummaryToDisplay(mockResponse);

      // Range
      expect(result.range.type).toBe("YEAR_TO_DATE");
      expect(result.range.label).toBe("Year to Date (Jan 1, 2025 - Jan 14, 2025)");
      expect(result.range.from).toBe("2025-01-01T00:00:00Z");
      expect(result.range.to).toBe("2025-01-14T23:59:59Z");

      // Headline cards
      expect(result.headlineCards.outstanding.amount).toBe("₱500.00");
      expect(result.headlineCards.outstanding.count).toBe(5);
      expect(result.headlineCards.outstanding.label).toBe("5 invoices");

      expect(result.headlineCards.collected.amount).toBe("₱2,000.00");
      expect(result.headlineCards.collected.count).toBe(10);
      expect(result.headlineCards.collected.label).toBe("10 invoices");

      expect(result.headlineCards.cancelled.amount).toBe("₱150.00");
      expect(result.headlineCards.cancelled.count).toBe(2);
      expect(result.headlineCards.cancelled.label).toBe("2 invoices");

      // Source breakdown - Dues
      expect(result.sourceBreakdown.dues.outstanding.amount).toBe("₱300.00");
      expect(result.sourceBreakdown.dues.outstanding.count).toBe(3);
      expect(result.sourceBreakdown.dues.collected.amount).toBe("₱1,500.00");
      expect(result.sourceBreakdown.dues.collected.count).toBe(8);

      // Source breakdown - Donations (only collected)
      expect(result.sourceBreakdown.donations.collected.amount).toBe("₱200.00");
      expect(result.sourceBreakdown.donations.collected.count).toBe(1);

      // Source breakdown - Events
      expect(result.sourceBreakdown.events.outstanding.amount).toBe("₱200.00");
      expect(result.sourceBreakdown.events.outstanding.count).toBe(2);
      expect(result.sourceBreakdown.events.collected.amount).toBe("₱300.00");
      expect(result.sourceBreakdown.events.collected.count).toBe(1);

      // Source breakdown - Other (zero values)
      expect(result.sourceBreakdown.other.outstanding.amount).toBe("₱0.00");
      expect(result.sourceBreakdown.other.outstanding.count).toBe(0);
      expect(result.sourceBreakdown.other.collected.amount).toBe("₱0.00");
      expect(result.sourceBreakdown.other.collected.count).toBe(0);

      // Status breakdown
      expect(result.statusBreakdown.outstanding.amount).toBe("₱500.00");
      expect(result.statusBreakdown.outstanding.count).toBe(5);
      expect(result.statusBreakdown.paid.amount).toBe("₱2,000.00");
      expect(result.statusBreakdown.paid.count).toBe(10);
      expect(result.statusBreakdown.cancelled.amount).toBe("₱150.00");
      expect(result.statusBreakdown.cancelled.count).toBe(2);
    });

    it("maps zero values correctly", () => {
      const mockResponse: FinanceSummaryResponse = {
        range: {
          type: "CURRENT_MONTH",
          from: "2025-01-01T00:00:00Z",
          to: "2025-01-31T23:59:59Z",
          label: "Current Month (Jan 1, 2025 - Jan 31, 2025)",
        },
        totals: {
          outstanding: { count: 0, totalCents: 0 },
          collected: { count: 0, totalCents: 0 },
          cancelled: { count: 0, totalCents: 0 },
        },
        bySource: {
          DUES: {
            outstanding: { count: 0, totalCents: 0 },
            collected: { count: 0, totalCents: 0 },
          },
          DONATION: {
            collected: { count: 0, totalCents: 0 },
          },
          EVENT: {
            outstanding: { count: 0, totalCents: 0 },
            collected: { count: 0, totalCents: 0 },
          },
          OTHER: {
            outstanding: { count: 0, totalCents: 0 },
            collected: { count: 0, totalCents: 0 },
          },
        },
        byStatus: {
          OUTSTANDING: { count: 0, totalCents: 0 },
          PAID: { count: 0, totalCents: 0 },
          CANCELLED: { count: 0, totalCents: 0 },
        },
      };

      const result = mapFinanceSummaryToDisplay(mockResponse);

      // All should be zero
      expect(result.headlineCards.outstanding.amount).toBe("₱0.00");
      expect(result.headlineCards.outstanding.count).toBe(0);
      expect(result.headlineCards.outstanding.label).toBe("0 invoices");

      expect(result.headlineCards.collected.amount).toBe("₱0.00");
      expect(result.headlineCards.collected.count).toBe(0);
      expect(result.headlineCards.collected.label).toBe("0 invoices");

      expect(result.headlineCards.cancelled.amount).toBe("₱0.00");
      expect(result.headlineCards.cancelled.count).toBe(0);
      expect(result.headlineCards.cancelled.label).toBe("0 invoices");

      // Range label should be preserved
      expect(result.range.label).toBe("Current Month (Jan 1, 2025 - Jan 31, 2025)");
    });

    it("maps large amounts with correct currency formatting", () => {
      const mockResponse: FinanceSummaryResponse = {
        range: {
          type: "ALL_TIME",
          from: "2000-01-01T00:00:00Z",
          to: "2025-01-14T23:59:59Z",
          label: "All Time (up to Jan 14, 2025)",
        },
        totals: {
          outstanding: { count: 1, totalCents: 12345678 },
          collected: { count: 1, totalCents: 98765432 },
          cancelled: { count: 0, totalCents: 0 },
        },
        bySource: {
          DUES: {
            outstanding: { count: 0, totalCents: 0 },
            collected: { count: 1, totalCents: 98765432 },
          },
          DONATION: {
            collected: { count: 0, totalCents: 0 },
          },
          EVENT: {
            outstanding: { count: 1, totalCents: 12345678 },
            collected: { count: 0, totalCents: 0 },
          },
          OTHER: {
            outstanding: { count: 0, totalCents: 0 },
            collected: { count: 0, totalCents: 0 },
          },
        },
        byStatus: {
          OUTSTANDING: { count: 1, totalCents: 12345678 },
          PAID: { count: 1, totalCents: 98765432 },
          CANCELLED: { count: 0, totalCents: 0 },
        },
      };

      const result = mapFinanceSummaryToDisplay(mockResponse);

      // Large amounts should be formatted with thousand separators
      expect(result.headlineCards.outstanding.amount).toBe("₱123,456.78");
      expect(result.headlineCards.collected.amount).toBe("₱987,654.32");
      expect(result.sourceBreakdown.events.outstanding.amount).toBe("₱123,456.78");
      expect(result.sourceBreakdown.dues.collected.amount).toBe("₱987,654.32");
    });
  });

  describe("getDefaultFinanceDisplayData", () => {
    it("returns zero-filled display data", () => {
      const result = getDefaultFinanceDisplayData();

      expect(result.range.type).toBe("YEAR_TO_DATE");
      expect(result.range.label).toBe("Year to Date");

      expect(result.headlineCards.outstanding.amount).toBe("₱0.00");
      expect(result.headlineCards.outstanding.count).toBe(0);
      expect(result.headlineCards.collected.amount).toBe("₱0.00");
      expect(result.headlineCards.collected.count).toBe(0);
      expect(result.headlineCards.cancelled.amount).toBe("₱0.00");
      expect(result.headlineCards.cancelled.count).toBe(0);

      // All sources should be zero
      expect(result.sourceBreakdown.dues.outstanding.count).toBe(0);
      expect(result.sourceBreakdown.dues.collected.count).toBe(0);
      expect(result.sourceBreakdown.donations.collected.count).toBe(0);
      expect(result.sourceBreakdown.events.outstanding.count).toBe(0);
      expect(result.sourceBreakdown.events.collected.count).toBe(0);
      expect(result.sourceBreakdown.other.outstanding.count).toBe(0);
      expect(result.sourceBreakdown.other.collected.count).toBe(0);

      // All statuses should be zero
      expect(result.statusBreakdown.outstanding.count).toBe(0);
      expect(result.statusBreakdown.paid.count).toBe(0);
      expect(result.statusBreakdown.cancelled.count).toBe(0);
    });
  });
});

