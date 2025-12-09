import React from "react";
import "./ui.css";

type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  children: React.ReactNode;
};

type TableCardProps = {
  children: React.ReactNode;
  className?: string;
};

export const Table: React.FC<TableProps> = ({ children, className, ...rest }) => {
  const classes = ["app-table", className || ""].filter(Boolean).join(" ");
  return (
    <table className={classes} {...rest}>
      {children}
    </table>
  );
};

export const TableCard: React.FC<TableCardProps> = ({ children, className }) => {
  const classes = ["app-table-card", className || ""].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
};

