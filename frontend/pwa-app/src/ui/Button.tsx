import React from "react";
import "./ui.css";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type Props<T extends React.ElementType = "button"> = {
  as?: T;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children" | "color">;

export const Button = <T extends React.ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  fullWidth,
  children,
  className,
  ...rest
}: Props<T>) => {
  const Component = (as || "button") as React.ElementType;

  const classes = [
    "app-button",
    `app-button--${variant}`,
    `app-button--${size}`,
    fullWidth ? "app-button--full" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
};

