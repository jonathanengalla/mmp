import React from "react";
import type { FinancePeriod } from "../api/client";

interface FinancePeriodSelectorProps {
  value: FinancePeriod;
  onChange: (period: FinancePeriod) => void;
}

export const FinancePeriodSelector: React.FC<FinancePeriodSelectorProps> = ({ value, onChange }) => {
  const periods: { value: FinancePeriod; label: string }[] = [
    { value: "YEAR_TO_DATE", label: "Year to Date" },
    { value: "CURRENT_MONTH", label: "Current Month" },
    { value: "LAST_12_MONTHS", label: "Last 12 Months" },
    { value: "ALL_TIME", label: "All Time" },
  ];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FinancePeriod)}
      style={{
        padding: "var(--space-2) var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--app-color-border-subtle)",
        fontSize: "var(--font-body)",
        backgroundColor: "var(--app-color-surface-1)",
        color: "var(--app-color-text-primary)",
        cursor: "pointer",
      }}
    >
      {periods.map((period) => (
        <option key={period.value} value={period.value}>
          {period.label}
        </option>
      ))}
    </select>
  );
};

