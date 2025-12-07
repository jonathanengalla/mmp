import React from "react";

type TagVariant = "default" | "success" | "warning" | "danger" | "info";
type TagSize = "sm" | "md" | "lg";

type TagProps = {
  children: React.ReactNode;
  variant?: TagVariant;
  size?: TagSize;
  className?: string;
};

export const Tag: React.FC<TagProps> = ({ 
  children, 
  variant = "default", 
  size = "md", 
  className 
}) => {
  const classNames = [
    "ui-tag",
    `ui-tag--${variant}`,
    `ui-tag--${size}`,
  ];
  if (className) classNames.push(className);

  return <span className={classNames.join(" ")}>{children}</span>;
};
