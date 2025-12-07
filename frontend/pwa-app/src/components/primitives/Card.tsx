import React from "react";

type CardVariant = "default" | "flat" | "elevated";

type CardProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

export const Card: React.FC<CardProps> = ({ 
  title, 
  description,
  actions, 
  variant = "default",
  padding = "md",
  className,
  children 
}) => {
  const classNames = ["pr-card"];
  if (variant !== "default") classNames.push(`pr-card--${variant}`);
  if (className) classNames.push(className);

  // Padding styles
  const paddingMap = {
    none: "0",
    sm: "var(--space-4)",
    md: "var(--space-6)",
    lg: "var(--space-8)",
  };

  const style: React.CSSProperties = padding !== "md" ? { padding: paddingMap[padding] } : {};

  return (
    <div className={classNames.join(" ")} style={style}>
      {(title || actions) && (
        <div className="pr-card__header">
          <div>
            {title && <h3 className="pr-card__title">{title}</h3>}
            {description && <p className="pr-card__description">{description}</p>}
          </div>
          {actions && <div className="pr-card__actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
