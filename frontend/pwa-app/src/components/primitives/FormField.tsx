import React from "react";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

export const FormField: React.FC<FormFieldProps> = ({ 
  label, 
  htmlFor,
  hint, 
  error,
  required,
  className,
  children 
}) => {
  const classNames = ["pr-form-field"];
  if (className) classNames.push(className);

  return (
    <div className={classNames.join(" ")}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span style={{ color: "var(--color-error)", marginLeft: "var(--space-1)" }}>*</span>}
      </label>
      {children}
      {hint && !error && <div className="pr-form-hint">{hint}</div>}
      {error && <div className="pr-form-error">{error}</div>}
    </div>
  );
};
