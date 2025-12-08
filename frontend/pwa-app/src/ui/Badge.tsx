import React from "react";
import "./ui.css";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>;

export const Badge: React.FC<BadgeProps> = ({ variant = "default", children, className, ...rest }) => {
  const classes = ["app-badge", variant !== "default" ? `app-badge--${variant}` : "", className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
};

