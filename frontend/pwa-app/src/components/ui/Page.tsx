import React from "react";

type PageProps = {
  title?: string;
  description?: string;
  maxWidth?: number;
  children: React.ReactNode;
};

export const Page: React.FC<PageProps> = ({ title, description, maxWidth, children }) => (
  <div style={{ maxWidth: maxWidth || 760, margin: "0 auto", padding: "24px 16px" }}>
    {title && <h1 style={{ fontSize: "var(--font-h2)", margin: "0 0 8px 0" }}>{title}</h1>}
    {description && <p style={{ color: "var(--color-text-muted)", marginTop: 0 }}>{description}</p>}
    {children}
  </div>
);

