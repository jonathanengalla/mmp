import React from "react";
import "./ui.css";

type Elevation = "none" | "sm" | "md" | "lg";
type Padding = "sm" | "md" | "lg";

type CardProps = {
  elevation?: Elevation;
  padding?: Padding;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const paddingClass: Record<Padding, string> = {
  sm: "app-card--pad-sm",
  md: "",
  lg: "app-card--pad-lg",
};

const elevationClass: Record<Elevation, string> = {
  none: "app-card--elev-none",
  sm: "app-card--elev-sm",
  md: "app-card--elev-md",
  lg: "app-card--elev-lg",
};

export const Card: React.FC<CardProps> = ({
  elevation = "md",
  padding = "md",
  className,
  children,
  ...rest
}) => {
  const classes = ["app-card", paddingClass[padding], elevationClass[elevation], className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
};

