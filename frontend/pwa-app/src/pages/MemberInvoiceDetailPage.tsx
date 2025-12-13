import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getMemberInvoiceDetail, InvoiceDetail } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Card, Button, PageShell } from "../ui";
import { Tag } from "../components/primitives/Tag";
import { formatCurrency } from "../utils/formatters";

const MemberInvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tokens } = useSession();
  const token = tokens?.access_token || null;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvoice = async () => {
      if (!token || !id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await getMemberInvoiceDetail(token, id);
        setInvoice(data);
        setError(null);
      } catch (e: any) {
        setError(e?.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };
    loadInvoice();
  }, [token, id]);

  const getStatusBadgeVariant = (status: string): "success" | "default" | "danger" => {
    if (status === "PAID") return "success";
    if (status === "OUTSTANDING") return "default";
    return "danger";
  };

  const getSourceLabel = (source: string): string => {
    const labels: Record<string, string> = {
      DUES: "Dues",
      DONATION: "Donation",
      EVENT: "Event",
      OTHER: "Other",
    };
    return labels[source] || source;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <PageShell title="Invoice Detail">
        <Card>
          <div style={{ padding: "var(--app-space-lg)", textAlign: "center" }}>Loading invoice...</div>
        </Card>
      </PageShell>
    );
  }

  if (error || !invoice) {
    return (
      <PageShell title="Invoice Detail">
        <Card>
          <div style={{ padding: "var(--app-space-lg)", color: "var(--app-color-state-error)" }}>
            {error || "Invoice not found"}
          </div>
          <div style={{ padding: "var(--app-space-md)" }}>
            <Button variant="secondary" onClick={() => navigate("/invoices")}>
              Back to Invoices
            </Button>
          </div>
        </Card>
      </PageShell>
    );
  }

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <PageShell
      title={`Invoice ${invoice.invoiceNumber}`}
      description={`View invoice details and payment history`}
      actions={
        <Button variant="secondary" onClick={() => navigate("/invoices")}>
          Back to Invoices
        </Button>
      }
    >
      <div style={{ display: "grid", gap: "var(--app-space-lg)" }}>
        {/* Header Section */}
        <Card>
          <div style={{ display: "grid", gap: "var(--app-space-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--app-space-md)" }}>
              <div>
                <h2 style={{ fontSize: "var(--app-font-title)", fontWeight: 700, marginBottom: "var(--app-space-xs)" }}>
                  {invoice.invoiceNumber}
                </h2>
                <div style={{ display: "flex", gap: "var(--app-space-sm)", alignItems: "center", flexWrap: "wrap" }}>
                  <Tag variant={getStatusBadgeVariant(invoice.status)}>{invoice.status}</Tag>
                  <Tag variant="default">{getSourceLabel(invoice.source)}</Tag>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "var(--app-font-label)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>
                  Total Amount
                </div>
                <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700 }}>
                  {formatCurrency(invoice.amountCents)}
                </div>
                {invoice.balanceCents > 0 && (
                  <div style={{ marginTop: "var(--app-space-md)", padding: "var(--app-space-md)", backgroundColor: "var(--app-color-state-error)", color: "white", borderRadius: "var(--app-radius-md)" }}>
                    <div style={{ fontSize: "var(--app-font-label)", marginBottom: "4px", opacity: 0.9 }}>Amount Due</div>
                    <div style={{ fontSize: "var(--app-font-heading)", fontWeight: 700 }}>
                      {formatCurrency(invoice.balanceCents)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Source Context */}
            {invoice.sourceContext && (
              <div style={{ paddingTop: "var(--app-space-md)", borderTop: "1px solid var(--app-color-border-subtle)" }}>
                <div style={{ fontSize: "var(--app-font-label)", fontWeight: 600, marginBottom: "var(--app-space-xs)" }}>
                  {invoice.sourceContext.event ? "Event" : invoice.sourceContext.membershipYear ? "Membership" : "Description"}
                </div>
                {invoice.sourceContext.event && (
                  <div>
                    <div style={{ fontWeight: 500 }}>{invoice.sourceContext.event.eventTitle}</div>
                    {invoice.sourceContext.event.eventDate && (
                      <div style={{ fontSize: "var(--app-font-body)", color: "var(--app-color-text-muted)", marginTop: "4px" }}>
                        {formatDate(invoice.sourceContext.event.eventDate)}
                      </div>
                    )}
                  </div>
                )}
                {invoice.sourceContext.membershipYear && (
                  <div>
                    <div style={{ fontWeight: 500 }}>Membership Year: {invoice.sourceContext.membershipYear}</div>
                  </div>
                )}
                {invoice.description && !invoice.sourceContext.event && !invoice.sourceContext.membershipYear && (
                  <div>{invoice.description}</div>
                )}
              </div>
            )}

            {/* Dates */}
            <div style={{ paddingTop: "var(--app-space-md)", borderTop: "1px solid var(--app-color-border-subtle)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--app-space-md)" }}>
              <div>
                <div style={{ fontSize: "var(--app-font-label)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>Issued</div>
                <div>{formatDate(invoice.issuedAt)}</div>
              </div>
              <div>
                <div style={{ fontSize: "var(--app-font-label)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>Due Date</div>
                <div>{formatDate(invoice.dueAt)}</div>
              </div>
              {invoice.paidAt && (
                <div>
                  <div style={{ fontSize: "var(--app-font-label)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>Paid</div>
                  <div>{formatDate(invoice.paidAt)}</div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Line Items */}
        <Card>
          <h3 style={{ fontSize: "var(--app-font-heading)", fontWeight: 600, marginBottom: "var(--app-space-md)" }}>Invoice Items</h3>
          <div className="overflow-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--app-color-border-subtle)" }}>
                  <th style={{ padding: "12px", fontWeight: 600 }}>Description</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Quantity</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Unit Price</th>
                  <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--app-color-border-subtle)" }}>
                    <td style={{ padding: "12px" }}>{item.description}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ padding: "12px", textAlign: "right" }}>{formatCurrency(item.unitAmountCents)}</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>{formatCurrency(item.totalAmountCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--app-color-border-subtle)" }}>
                  <td colSpan={3} style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Total</td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, fontSize: "var(--app-font-heading)" }}>
                    {formatCurrency(invoice.amountCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Payment History */}
        {invoice.payments.length > 0 && (
          <Card>
            <h3 style={{ fontSize: "var(--app-font-heading)", fontWeight: 600, marginBottom: "var(--app-space-md)" }}>Payment History</h3>
            <div className="overflow-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid var(--app-color-border-subtle)" }}>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Method</th>
                    <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: "1px solid var(--app-color-border-subtle)" }}>
                      <td style={{ padding: "12px" }}>{formatDate(payment.processedAt || payment.createdAt)}</td>
                      <td style={{ padding: "12px" }}>
                        {payment.paymentMethod ? (
                          <div>
                            <div>{payment.paymentMethod.brand}</div>
                            <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)" }}>
                              •••• {payment.paymentMethod.last4}
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>{formatCurrency(payment.amountCents)}</td>
                      <td style={{ padding: "12px" }}>
                        <Tag variant={payment.status === "SUCCEEDED" ? "success" : payment.status === "FAILED" ? "danger" : "default"} size="sm">
                          {payment.status}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid var(--app-color-border-subtle)" }}>
                    <td colSpan={2} style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Total Paid</td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, fontSize: "var(--app-font-heading)" }}>
                      {formatCurrency(totalPaid)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* Pay Now Action */}
        {invoice.balanceCents > 0 && (
          <Card>
            <div style={{ textAlign: "center", padding: "var(--app-space-lg)" }}>
              <div style={{ fontSize: "var(--app-font-heading)", fontWeight: 600, marginBottom: "var(--app-space-md)" }}>
                Amount Due: {formatCurrency(invoice.balanceCents)}
              </div>
              <Button variant="primary" size="lg">
                Pay Now
              </Button>
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
};

export default MemberInvoiceDetailPage;

