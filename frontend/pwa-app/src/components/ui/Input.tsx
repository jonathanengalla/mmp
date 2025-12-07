import React, { forwardRef } from "react";

type InputSize = "sm" | "md" | "lg";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  inputSize?: InputSize;
  error?: boolean;
  fullWidth?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  inputSize = "md",
  error,
  fullWidth = true,
  className,
  ...props
}, ref) => {
  const classNames = ["pr-input"];
  if (error) classNames.push("pr-input--error");
  if (fullWidth) classNames.push("w-full");
  if (className) classNames.push(className);

  const sizeStyles: Record<InputSize, React.CSSProperties> = {
    sm: { padding: "var(--space-1) var(--space-2)", fontSize: "var(--font-body-sm)" },
    md: { padding: "var(--space-2) var(--space-3)", fontSize: "var(--font-body-md)" },
    lg: { padding: "var(--space-3) var(--space-4)", fontSize: "var(--font-body-lg)" },
  };

  return (
    <input
      ref={ref}
      className={classNames.join(" ")}
      style={inputSize !== "md" ? sizeStyles[inputSize] : undefined}
      {...props}
    />
  );
});

Input.displayName = "Input";

