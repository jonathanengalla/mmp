import React from "react";
import { Tag } from "./primitives/Tag";
import { Button } from "./primitives/Button";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell } from "./ui/Table";
import { Invoice } from "../../../../libs/shared/src/models";
import { useNavigate } from "react-router-dom";

const getStatusVariant = (status: Invoice["status"]): "success" | "warning" | "danger" | "default" => {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "cancelled":
    case "draft":
      return "default";
    default:
      return "danger";
  }
};

const formatAmount = (amountCents: number, currency?: string) => {
  const unit = currency || "PHP";
  return `${unit} ${(amountCents / 100).toFixed(2)}`;
};

export const InvoiceTable: React.FC<{ invoices: Invoice[]; onRecordPayment?: (invoice: Invoice) => void }> = ({
  invoices,
  onRecordPayment,
}) => {
  const navigate = useNavigate();
  return (
    <div style={{ 
      border: "1px solid var(--color-border-default)", 
      borderRadius: "var(--radius-medium)", 
      overflow: "hidden" 
    }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHeadCell>Invoice</TableHeadCell>
            <TableHeadCell>Description</TableHeadCell>
            <TableHeadCell>Event</TableHeadCell>
            <TableHeadCell>Due Date</TableHeadCell>
            <TableHeadCell>Amount</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
            <TableHeadCell align="right">Actions</TableHeadCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const isPaid = inv.status === "paid";
            return (
              <TableRow key={inv.id}>
                <TableCell>
                  <span style={{ fontWeight: "var(--font-weight-medium)" }}>{inv.id}</span>
                </TableCell>
                <TableCell>{inv.description || (inv.eventTitle ? `Event: ${inv.eventTitle}` : "Invoice")}</TableCell>
                <TableCell>
                  {inv.eventTitle ? (
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                      <Tag variant="info" size="sm">Event</Tag>
                      <span>{inv.eventTitle}</span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)" }}>—</span>
                  )}
                </TableCell>
                <TableCell>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "N/A"}</TableCell>
                <TableCell>
                  <span style={{ fontWeight: "var(--font-weight-medium)" }}>
                    {formatAmount(inv.amountCents, inv.currency)}
                  </span>
                </TableCell>
                <TableCell>
                  <Tag variant={getStatusVariant(inv.status)} size="sm">
                    {inv.status}
                  </Tag>
                </TableCell>
                <TableCell align="right">
                  <div style={{ display: "flex", gap: "var(--space-xs)", justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {inv.eventId && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${inv.eventId}`)}>
                        View event
                      </Button>
                    )}
                    {onRecordPayment && !isPaid && (
                      <Button variant="secondary" size="sm" onClick={() => onRecordPayment(inv)}>
                        Record payment
                      </Button>
                    )}
                    {isPaid && (
                      <Tag variant="success" size="sm">
                        Paid
                      </Tag>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

