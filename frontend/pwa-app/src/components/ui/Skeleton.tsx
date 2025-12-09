import React from "react";

type SkeletonProps = {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  className?: string;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "rectangular",
  width,
  height,
  className,
}) => {
  const classNames = ["pr-skeleton"];
  if (variant === "text") classNames.push("pr-skeleton--text");
  if (variant === "circular") classNames.push("pr-skeleton--circle");
  if (className) classNames.push(className);

  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return <div className={classNames.join(" ")} style={style} />;
};

// Common skeleton patterns
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3,
  className,
}) => {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          width={i === lines - 1 ? "60%" : "100%"} 
          height="1em" 
        />
      ))}
    </div>
  );
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div 
      className={className}
      style={{ 
        padding: "var(--space-6)", 
        background: "var(--app-color-surface-1)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--app-color-border-subtle)",
      }}
    >
      <Skeleton width="40%" height="1.5rem" style={{ marginBottom: "var(--space-4)" }} />
      <SkeletonText lines={3} />
    </div>
  );
};

