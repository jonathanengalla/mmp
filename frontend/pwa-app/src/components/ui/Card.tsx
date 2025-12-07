import React from "react";

type CardProps = {
  children: React.ReactNode;
  padding?: number;
  title?: string;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
};

export const Card: React.FC<CardProps> = ({ children, padding = 16, title, actions, style }) => (
  <div
    style={{
      background: "var(--color-surface)",
      borderRadius: "var(--radius)",
      border: "1px solid var(--color-border)",
      boxShadow: "var(--card-shadow)",
      padding,
      ...style,
    }}
  >
    {(title || actions) && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        {title && <div style={{ fontWeight: 600, fontSize: "var(--font-h3)" }}>{title}</div>}
        {actions}
      </div>
    )}
    {children}
  </div>
);

