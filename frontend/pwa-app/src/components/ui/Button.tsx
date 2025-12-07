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
  primary: { bg: "var(--color-primary)", color: "#fff", border: "var(--color-primary)" },
  secondary: { bg: "var(--color-primary-soft)", color: "var(--color-primary)", border: "var(--color-primary-soft)" },
  ghost: { bg: "transparent", color: "var(--color-text)", border: "var(--color-border)" },
  danger: { bg: "var(--color-danger)", color: "#fff", border: "var(--color-danger)" },
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

