import React from "react";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
}

// Color palette using CSS variables from theme system
const toneStyles: Record<StatusTone, { bg: string; text: string }> = {
  success: { bg: "var(--app-color-success-soft)", text: "var(--app-color-state-success)" },
  warning: { bg: "var(--app-color-warning-soft)", text: "var(--app-color-state-warning)" },
  danger: { bg: "var(--app-color-error-soft)", text: "var(--app-color-state-error)" },
  info: { bg: "var(--app-color-info-soft)", text: "var(--app-color-state-info)" },
  neutral: { bg: "var(--app-color-surface-2)", text: "var(--app-color-text-secondary)" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ tone, label }) => {
  const palette = toneStyles[tone] || toneStyles.neutral;

  const badgeStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "var(--space-1, 4px) var(--space-3, 12px)",
    borderRadius: "var(--radius-full, 9999px)",
    fontSize: "var(--font-caption, 0.75rem)",
    fontWeight: "var(--font-weight-semibold, 600)",
    backgroundColor: palette.bg,
    color: palette.text,
  };

  return <span style={badgeStyles}>{label}</span>;
};

