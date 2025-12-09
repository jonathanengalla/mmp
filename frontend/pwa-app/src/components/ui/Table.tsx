import React from "react";

type TableRootProps = { 
  children: React.ReactNode; 
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
};

type TableSectionProps = { 
  children: React.ReactNode; 
  className?: string;
};

type TableRowProps = { 
  children: React.ReactNode; 
  className?: string;
  selected?: boolean;
};

type TableCellProps = { 
  children: React.ReactNode; 
  className?: string; 
  colSpan?: number;
  align?: "left" | "center" | "right";
};

type TableCardProps = {
  children: React.ReactNode;
  className?: string;
};

export const Table: React.FC<TableRootProps> = ({ 
  children, 
  className,
  striped,
  hoverable = true,
}) => {
  const classes = ["ui-table"];
  if (striped) classes.push("ui-table--striped");
  if (hoverable) classes.push("ui-table--hoverable");
  if (className) classes.push(className);
  
  return <table className={classes.join(" ")}>{children}</table>;
};

export const TableHeader: React.FC<TableSectionProps> = ({ children, className }) => {
  const classes = [];
  if (className) classes.push(className);
  return <thead className={classes.join(" ")}>{children}</thead>;
};

export const TableBody: React.FC<TableSectionProps> = ({ children, className }) => {
  const classes = [];
  if (className) classes.push(className);
  return <tbody className={classes.join(" ")}>{children}</tbody>;
};

export const TableRow: React.FC<TableRowProps> = ({ children, className, selected }) => {
  const classes = [];
  if (selected) classes.push("ui-table__row--selected");
  if (className) classes.push(className);
  return <tr className={classes.join(" ")}>{children}</tr>;
};

export const TableHeadCell: React.FC<TableCellProps> = ({ 
  children, 
  className, 
  colSpan,
  align = "left",
}) => {
  const classes = [];
  if (className) classes.push(className);
  
  const style: React.CSSProperties = align !== "left" ? { textAlign: align } : {};
  
  return (
    <th className={classes.join(" ")} colSpan={colSpan} style={style}>
      {children}
    </th>
  );
};

export const TableCell: React.FC<TableCellProps> = ({ 
  children, 
  className, 
  colSpan,
  align = "left",
}) => {
  const classes = [];
  if (className) classes.push(className);
  
  const style: React.CSSProperties = align !== "left" ? { textAlign: align } : {};
  
  return (
    <td className={classes.join(" ")} colSpan={colSpan} style={style}>
      {children}
    </td>
  );
};

export const TableCard: React.FC<TableCardProps> = ({ children, className }) => {
  const classes = ["ui-table-card"];
  if (className) classes.push(className);
  return <div className={classes.join(" ")}>{children}</div>;
};
