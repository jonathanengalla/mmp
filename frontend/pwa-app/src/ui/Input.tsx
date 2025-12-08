import React from "react";
import "./ui.css";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, ...rest }, ref) => {
    const classes = ["app-input", error ? "app-input--error" : "", className || ""]
      .filter(Boolean)
      .join(" ");

    return (
      <div style={{ display: "grid", gap: "var(--app-space-xs)" }}>
        {label && <label className="app-input__label">{label}</label>}
        <input ref={ref} className={classes} {...rest} />
        {error ? <div className="app-input__error">{error}</div> : hint ? <div className="app-input__hint">{hint}</div> : null}
      </div>
    );
  }
);

Input.displayName = "Input";

