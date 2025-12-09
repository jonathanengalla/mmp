import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: Variant;
    fullWidth?: boolean;
    as?: "button" | "a";
    href?: string;
  };

const colors: Record<Variant, { bg: string; color: string; border: string }> = {
  primary: { bg: "var(--app-color-primary)", color: "var(--app-color-on-primary)", border: "var(--app-color-primary)" },
  secondary: { bg: "var(--app-color-primary-soft)", color: "var(--app-color-primary)", border: "var(--app-color-primary-soft)" },
  ghost: { bg: "transparent", color: "var(--app-color-text-primary)", border: "var(--app-color-border-subtle)" },
  danger: { bg: "var(--app-color-state-error)", color: "var(--app-color-on-primary)", border: "var(--app-color-state-error)" },
};

export const Button: React.FC<ButtonProps> = ({ variant = "primary", fullWidth, style, children, as = "button", href, ...props }) => {
  const palette = colors[variant];
  const sharedStyle: React.CSSProperties = {
    background: palette.bg,
    color: palette.color,
    border: `1px solid ${palette.border}`,
    borderRadius: "var(--radius)",
    padding: "12px 14px",
    fontWeight: 600,
    cursor: (props as any).disabled ? "not-allowed" : "pointer",
    width: fullWidth ? "100%" : undefined,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    textDecoration: "none",
    ...style,
  };

  if (as === "a") {
    return (
      <a href={href} {...(props as any)} style={sharedStyle}>
        {children}
      </a>
    );
  }

  return (
    <button {...(props as any)} style={sharedStyle}>
      {children}
    </button>
  );
};

