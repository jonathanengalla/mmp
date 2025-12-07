import React from "react";

type SurfaceVariant = "default" | "muted" | "elevated";

type SurfaceProps = {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  variant?: SurfaceVariant;
  padding?: "none" | "sm" | "md" | "lg";
  rounded?: "none" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

export const Surface: React.FC<SurfaceProps> = ({ 
  children, 
  as: Component = "div", 
  variant = "default", 
  padding = "none",
  rounded = "lg",
  className 
}) => {
  const classes = ["ui-surface"];
  if (variant !== "default") classes.push(`ui-surface--${variant}`);
  if (className) classes.push(className);

  const paddingMap = {
    none: "0",
    sm: "var(--space-3)",
    md: "var(--space-4)",
    lg: "var(--space-6)",
  };

  const radiusMap = {
    none: "0",
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    xl: "var(--radius-xl)",
  };

  const style: React.CSSProperties = {
    padding: paddingMap[padding],
    borderRadius: radiusMap[rounded],
  };

  return <Component className={classes.join(" ")} style={style}>{children}</Component>;
};
