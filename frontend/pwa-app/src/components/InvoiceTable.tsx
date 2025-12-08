import React from "react";
import { Badge, Button, Table } from "../ui";
import { Invoice } from "../../../../libs/shared/src/models";
import { useNavigate } from "react-router-dom";

const getStatusVariant = (status: Invoice["status"]): "success" | "warning" | "error" | "info" | "default" => {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "info";
    case "cancelled":
    case "draft":
      return "default";
    default:
      return "error";
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
    <div
      style={{
        border: "1px solid var(--app-color-border-subtle)",
        borderRadius: "var(--app-radius-md)",
        overflow: "hidden",
      }}
    >
      <Table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Description</th>
            <th>Event</th>
            <th>Due Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const isPaid = inv.status === "paid";
            return (
              <tr key={inv.id}>
                <td>
                  <span style={{ fontWeight: 600 }}>{inv.id}</span>
                </td>
                <td>{inv.description || (inv.eventTitle ? `Event: ${inv.eventTitle}` : "Invoice")}</td>
                <td>
                  {inv.eventTitle ? (
                    <span style={{ color: "var(--app-color-text-primary)" }}>{inv.eventTitle}</span>
                  ) : (
                    <span style={{ color: "var(--app-color-text-muted)" }}>—</span>
                  )}
                </td>
                <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "N/A"}</td>
                <td>
                  <span style={{ fontWeight: 600 }}>{formatAmount(inv.amountCents, inv.currency)}</span>
                </td>
                <td>
                  <Badge variant={getStatusVariant(inv.status)}>{inv.status}</Badge>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "var(--app-space-xs)", justifyContent: "flex-end", flexWrap: "wrap" }}>
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
                    {isPaid && <Badge variant="success">Paid</Badge>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
};

