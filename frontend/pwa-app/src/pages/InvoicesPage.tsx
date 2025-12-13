import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyInvoices, InvoiceListItem, InvoiceReportingStatus, FinancePeriod } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Card, PageShell } from "../ui";
import { Tag } from "../components/primitives/Tag";
import { formatCurrency } from "../utils/formatters";

type MemberTab = "outstanding" | "history";

const InvoicesPage: React.FC = () => {
  const { tokens, hasRole } = useSession();
  const navigate = useNavigate();
  const token = tokens?.access_token || null;
  const isAdminFinance =
    hasRole?.("admin") || hasRole?.("finance_manager") || hasRole?.("officer") || hasRole?.("super_admin");

  // Redirect admins to admin invoice page
  React.useEffect(() => {
    if (isAdminFinance) {
      navigate("/admin/invoices", { replace: true });
    }
  }, [isAdminFinance, navigate]);

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Member tab state
  const [memberTab, setMemberTab] = useState<MemberTab>("outstanding");
  const [memberPeriod, setMemberPeriod] = useState<FinancePeriod>("ALL_TIME");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadInvoices = async () => {
    if (!token || isAdminFinance) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // FIN-02: Member invoice list with tab support
      const resp = await listMyInvoices(token, {
        tab: memberTab,
        period: memberPeriod,
        page,
        pageSize,
      });
      setInvoices(resp.items || resp.invoices || []);
      setPagination(resp.pagination || null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, memberTab, memberPeriod]);

  const getStatusBadgeVariant = (status: InvoiceReportingStatus): "success" | "default" | "danger" => {
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
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };



  if (isAdminFinance) {
    return null; // Will redirect
  }

  return (
    <PageShell
      title="My Invoices"
      description="View your outstanding invoices and payment history."
    >
      <div className="invoices-layout" style={{ display: "grid", gap: "var(--app-space-lg)" }}>
        {error && (
          <Card>
            <div style={{ padding: "var(--app-space-md)", color: "var(--app-color-state-error)" }}>{error}</div>
          </Card>
        )}

        {/* Member Tabs */}
        <Card elevation="sm" padding="md">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--app-space-md)" }}>
            <div style={{ display: "flex", gap: "var(--app-space-xs)", borderBottom: "2px solid var(--app-color-border-subtle)" }}>
              <button
                onClick={() => {
                  setMemberTab("outstanding");
                  setPage(1);
                }}
                style={{
                  padding: "var(--app-space-sm) var(--app-space-md)",
                  border: "none",
                  background: "transparent",
                  borderBottom: memberTab === "outstanding" ? "2px solid var(--app-color-primary)" : "2px solid transparent",
                  color: memberTab === "outstanding" ? "var(--app-color-primary)" : "var(--app-color-text-muted)",
                  fontWeight: memberTab === "outstanding" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Outstanding
              </button>
              <button
                onClick={() => {
                  setMemberTab("history");
                  setPage(1);
                }}
                style={{
                  padding: "var(--app-space-sm) var(--app-space-md)",
                  border: "none",
                  background: "transparent",
                  borderBottom: memberTab === "history" ? "2px solid var(--app-color-primary)" : "2px solid transparent",
                  color: memberTab === "history" ? "var(--app-color-primary)" : "var(--app-color-text-muted)",
                  fontWeight: memberTab === "history" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                History
              </button>
            </div>
            <select
              value={memberPeriod}
              onChange={(e) => {
                setMemberPeriod(e.target.value as FinancePeriod);
                setPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--app-radius-md)",
                border: "1px solid var(--app-color-border-subtle)",
                background: "var(--app-color-surface-1)",
                color: "var(--app-color-text-primary)",
              }}
            >
              <option value="ALL_TIME">All Time</option>
              <option value="YEAR_TO_DATE">This Year</option>
              <option value="LAST_12_MONTHS">Last 12 Months</option>
            </select>
          </div>
        </Card>

        <Card>
          {loading && (
            <div style={{ padding: "var(--app-space-lg)", textAlign: "center" }}>Loading invoices...</div>
          )}
          {!loading && invoices.length === 0 && !error && (
            <div style={{ padding: "var(--app-space-lg)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
              {memberTab === "outstanding" ? "You have no outstanding invoices" : "You have no invoice history"}
            </div>
          )}
          {!loading && !error && invoices.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--app-color-border-subtle)" }}>
                    <th style={{ padding: "12px" }}>Invoice #</th>
                    <th style={{ padding: "12px" }}>Source</th>
                    <th style={{ padding: "12px" }}>Due date</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>Amount</th>
                    {memberTab === "outstanding" && <th style={{ padding: "12px", textAlign: "right" }}>Balance</th>}
                    <th style={{ padding: "12px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: "1px solid var(--app-color-border-subtle)",
                        cursor: "pointer",
                      }}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--app-color-surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent";
                      }}
                    >
                      <td style={{ padding: "12px", fontFamily: "monospace" }}>{inv.invoiceNumber}</td>
                      <td style={{ padding: "12px" }}>
                        <Tag variant="default" size="sm">
                          {getSourceLabel(inv.source)}
                        </Tag>
                        {inv.event?.title && (
                          <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginTop: "4px" }}>
                            {inv.event.title}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px" }}>{formatDate(inv.dueAt)}</td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>
                        {formatCurrency(inv.amountCents)}
                      </td>
                      {memberTab === "outstanding" && (
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 600, color: "var(--app-color-state-error)" }}>
                          {inv.balanceCents > 0 ? formatCurrency(inv.balanceCents) : "—"}
                        </td>
                      )}
                      <td style={{ padding: "12px" }}>
                        <Tag variant={getStatusBadgeVariant(inv.status)} size="sm">
                          {inv.status}
                        </Tag>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination && (
            <div
              style={{
                padding: "var(--app-space-sm) var(--app-space-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid var(--app-color-border-subtle)",
              }}
            >
              <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                Showing {invoices.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
              </div>
              <div style={{ display: "flex", gap: "var(--app-space-xs)" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <div style={{ alignSelf: "center", color: "var(--app-color-text-muted)" }}>
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PageShell>
  );
};

export default InvoicesPage;


