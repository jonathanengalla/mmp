import React from "react";
import "./ui.css";

type PageShellProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export const PageShell: React.FC<PageShellProps> = ({ title, description, actions, children }) => {
  return (
    <div className="app-page-shell">
      {(title || description || actions) && (
        <div className="app-page-shell__header">
          <div>
            {title && <h1 className="app-page-shell__title">{title}</h1>}
            {description && <p className="app-page-shell__description">{description}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

