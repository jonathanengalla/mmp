import React from "react";
import "./ui.css";

type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  children: React.ReactNode;
};

export const Table: React.FC<TableProps> = ({ children, className, ...rest }) => {
  const classes = ["app-table", className || ""].filter(Boolean).join(" ");
  return (
    <table className={classes} {...rest}>
      {children}
    </table>
  );
};

