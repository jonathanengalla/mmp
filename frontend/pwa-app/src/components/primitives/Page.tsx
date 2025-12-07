import React from "react";

type PageProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export const Page: React.FC<PageProps> = ({ 
  title, 
  description, 
  actions,
  className,
  children 
}) => {
  const classNames = ["pr-page"];
  if (className) classNames.push(className);

  return (
    <div className={classNames.join(" ")}>
      {(title || actions) && (
        <div style={{ 
          display: "flex", 
          alignItems: "flex-start", 
          justifyContent: "space-between",
          gap: "var(--space-4)",
          marginBottom: description ? "0" : "var(--space-6)",
        }}>
          <div>
            {title && <h1 className="pr-page__title">{title}</h1>}
          </div>
          {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
        </div>
      )}
      {description && <p className="pr-page__description">{description}</p>}
      {children}
    </div>
  );
};
