import React from "react";

type Variant = "primary" | "secondary" | "subtle" | "ghost" | "outline" | "danger" | "success";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  as?: "button" | "a";
  href?: string;
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth,
  disabled,
  children,
  className,
  as = "button",
  href,
  ...props
}) => {
  const classNames = [
    "pr-button",
    `pr-button--${variant}`,
    `pr-button--${size}`,
  ];
  
  if (fullWidth) classNames.push("w-full");
  if (loading) classNames.push("pr-button--loading");
  if (className) classNames.push(className);
  
  const isDisabled = disabled || loading;

  // Content to display - hide text when loading (CSS handles spinner)
  const content = loading ? (
    <>
      <span style={{ visibility: "hidden" }}>{children}</span>
    </>
  ) : (
    children
  );

  if (as === "a" && href) {
    return (
      <a 
        href={href} 
        className={classNames.join(" ")}
        aria-disabled={isDisabled}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button 
      className={classNames.join(" ")} 
      disabled={isDisabled} 
      aria-busy={loading}
      {...props}
    >
      {content}
    </button>
  );
};
