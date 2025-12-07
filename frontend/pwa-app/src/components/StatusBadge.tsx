import React from "react";

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
}

// Color palette using CSS variables from theme system
const toneStyles: Record<StatusTone, { bg: string; text: string }> = {
  success: { bg: "rgba(34, 197, 94, 0.12)", text: "var(--color-success, #22c55e)" },
  warning: { bg: "rgba(245, 158, 11, 0.12)", text: "var(--color-warning, #f59e0b)" },
  danger: { bg: "rgba(239, 68, 68, 0.12)", text: "var(--color-error, #ef4444)" },
  info: { bg: "rgba(37, 99, 235, 0.12)", text: "var(--color-info, #2563eb)" },
  neutral: { bg: "var(--color-surface2, #f1f5f9)", text: "var(--color-text-secondary, #64748b)" },
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

