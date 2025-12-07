import React from "react";

type TagVariant = "default" | "success" | "warning" | "danger" | "info";
type TagSize = "sm" | "md" | "lg";

type TagProps = {
  children: React.ReactNode;
  variant?: TagVariant;
  /** @deprecated Use variant instead */
  tone?: TagVariant;
  size?: TagSize;
  className?: string;
};

export const Tag: React.FC<TagProps> = ({ 
  children, 
  variant, 
  tone,
  size = "md", 
  className 
}) => {
  // Support both variant and tone (deprecated) props
  const resolvedVariant = variant || tone || "default";
  
  const classNames = [
    "pr-tag",
    `pr-tag--${resolvedVariant}`,
    `pr-tag--${size}`,
  ];
  if (className) classNames.push(className);

  return <span className={classNames.join(" ")}>{children}</span>;
};
