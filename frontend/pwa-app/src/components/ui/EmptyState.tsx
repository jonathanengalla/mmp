import React from "react";
import { Button } from "../primitives/Button";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  const classNames = ["pr-empty-state"];
  if (className) classNames.push(className);

  return (
    <div className={classNames.join(" ")}>
      {icon && <div className="pr-empty-state__icon">{icon}</div>}
      <h3 className="pr-empty-state__title">{title}</h3>
      {description && <p className="pr-empty-state__description">{description}</p>}
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};

