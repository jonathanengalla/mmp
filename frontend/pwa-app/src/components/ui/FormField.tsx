import React from "react";

type FormFieldProps = {
  label: string;
  helpText?: string;
  error?: string;
  children: React.ReactNode;
};

export const FormField: React.FC<FormFieldProps> = ({ label, helpText, error, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
    <label style={{ fontWeight: 600 }}>{label}</label>
    {children}
    {helpText && <small style={{ color: "var(--color-text-muted)" }}>{helpText}</small>}
    {error && <small style={{ color: "var(--color-danger)" }}>{error}</small>}
  </div>
);

