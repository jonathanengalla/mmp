import React, { useEffect, useState } from "react";
import { listMyInvoices, listTenantInvoices, getFinanceSummary } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Card, Button, PageShell, Input } from "../ui";

type AdminStatus = "all" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "DRAFT" | "VOID" | "FAILED";
type MemberStatus = "all" | "outstanding" | "paid";

const InvoicesPage: React.FC = () => {
  const { tokens, hasRole } = useSession();
  const token = tokens?.access_token || null;
  const isAdminFinance =
    hasRole?.("admin") || hasRole?.("finance_manager") || hasRole?.("officer") || hasRole?.("super_admin");

  const [invoices, setInvoices] = useState<any[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(
    null
  );
  const [summary, setSummary] = useState<any>(null);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const loadInvoices = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      if (isAdminFinance) {
        const [invoiceResp, summaryResp] = await Promise.all([
          listTenantInvoices(token, {
            status: statusFilter === "all" ? undefined : statusFilter,
            search: search || undefined,
            page,
            pageSize,
          }),
          getFinanceSummary(token),
        ]);
        setInvoices(invoiceResp.invoices || invoiceResp.items || []);
        setPagination(invoiceResp.pagination || null);
        setSummary(invoiceResp.summary || null);
        setFinanceSummary(summaryResp || null);
      } else {
        const resp = await listMyInvoices(token, { status: statusFilter as MemberStatus, page, pageSize });
        setInvoices(resp.invoices || resp.items || []);
        setPagination(resp.pagination || null);
        setSummary(resp.summary || null);
        setFinanceSummary(null);
      }
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
  }, [token, statusFilter, search, page]);

  const formatCurrency = (cents: number, currency = "PHP") =>
    `${currency} ${(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const statusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "PAID") return { label: "paid", cls: "bg-green-100 text-green-800" };
    if (s === "ISSUED") return { label: "issued", cls: "bg-yellow-100 text-yellow-800" };
    if (s === "PARTIALLY_PAID") return { label: "partially paid", cls: "bg-blue-100 text-blue-800" };
    if (s === "OVERDUE") return { label: "overdue", cls: "bg-red-100 text-red-800" };
    if (s === "DRAFT") return { label: "draft", cls: "bg-gray-100 text-gray-800" };
    if (s === "VOID") return { label: "void", cls: "bg-gray-200 text-gray-700" };
    if (s === "FAILED") return { label: "failed", cls: "bg-red-100 text-red-800" };
    return { label: s.toLowerCase(), cls: "bg-gray-100 text-gray-800" };
  };

  const handleRefresh = () => {
    setPage(1);
    loadInvoices();
  };

  return (
    <PageShell
      title="Invoices"
      description={isAdminFinance ? "All tenant invoices with filters and metrics." : "Your invoices and balance."}
      actions={
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      }
    >
      <div className="invoices-layout" style={{ display: "grid", gap: "var(--app-space-lg)" }}>
        {error && (
          <div
            style={{
              padding: "var(--rcme-space-md)",
              background: "var(--rcme-color-surface-2)",
              border: "1px solid var(--rcme-color-border-strong)",
              borderRadius: "var(--rcme-radius-md)",
              color: "var(--rcme-color-state-error)",
            }}
          >
            {error}
          </div>
        )}

        {summary && (
          <div
            style={{
              display: "grid",
              gap: "var(--app-space-sm)",
              gridTemplateColumns: isAdminFinance ? "repeat(auto-fit, minmax(200px, 1fr))" : "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <Card>
              <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>
                {isAdminFinance ? "Outstanding balance" : "My outstanding balance"}
              </div>
              <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700 }}>
                {formatCurrency((financeSummary?.outstanding?.totalCents ?? summary.outstanding?.totalCents) || 0)}
              </div>
              <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                {(financeSummary?.outstanding?.count ?? summary.outstanding?.count) || 0} invoices
              </div>
            </Card>
            {isAdminFinance && (
              <Card>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Overdue</div>
                <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700, color: "var(--app-color-state-error)" }}>
                  {formatCurrency((financeSummary?.overdue?.totalCents ?? summary.overdue?.totalCents) || 0)}
                </div>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                  {(financeSummary?.overdue?.count ?? summary.overdue?.count) || 0} invoices
                </div>
              </Card>
            )}
            {isAdminFinance && (
              <Card>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Paid (last 30 days)</div>
                <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700, color: "var(--app-color-state-success)" }}>
                  {formatCurrency((financeSummary?.paidLast30Days?.totalCents ?? summary.paidLast30Days?.totalCents) || 0)}
                </div>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                  {(financeSummary?.paidLast30Days?.count ?? summary.paidLast30Days?.count) || 0} invoices
                </div>
              </Card>
            )}
            {isAdminFinance && financeSummary && (
              <Card>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Total donations</div>
                <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700, color: "var(--app-color-text-primary)" }}>
                  {formatCurrency(financeSummary.totalDonations?.totalCents || 0)}
                </div>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                  {financeSummary.totalDonations?.count || 0} donations
                </div>
              </Card>
            )}
            {isAdminFinance && financeSummary && (
              <Card>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Donations (last 30 days)</div>
                <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700, color: "var(--app-color-text-primary)" }}>
                  {formatCurrency(financeSummary.donationsLast30Days?.totalCents || 0)}
                </div>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                  {financeSummary.donationsLast30Days?.count || 0} donations
                </div>
              </Card>
            )}
          </div>
        )}

        <Card elevation="sm" padding="sm">
          <div style={{ display: "flex", gap: "var(--app-space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <Input
              placeholder="Search invoices (number, member, email, event)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ minWidth: 240, flex: "1 1 240px" }}
              disabled={!isAdminFinance}
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--app-radius-md)",
                border: "1px solid var(--app-color-border-subtle)",
                background: "var(--app-color-surface-0)",
                color: "var(--app-color-text-primary)",
                minWidth: 180,
              }}
            >
              <option value="all">All statuses</option>
              {isAdminFinance ? (
                <>
                  <option value="ISSUED">Issued</option>
                  <option value="PARTIALLY_PAID">Partially paid</option>
                  <option value="PAID">Paid</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="DRAFT">Draft</option>
                  <option value="VOID">Void</option>
                  <option value="FAILED">Failed</option>
                </>
              ) : (
                <>
                  <option value="outstanding">Outstanding</option>
                  <option value="paid">Paid</option>
                </>
              )}
            </select>
            <Button variant="ghost" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
        </Card>

        <Card>
          {loading && (
            <div style={{ padding: "var(--app-space-lg)", textAlign: "center" }}>Loading invoices...</div>
          )}
          {!loading && invoices.length === 0 && !error && (
            <div style={{ padding: "var(--app-space-lg)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
              No invoices found
            </div>
          )}
          {!loading && !error && invoices.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--app-color-border-subtle)" }}>
                    {isAdminFinance && <th style={{ padding: "12px" }}>Member</th>}
                    <th style={{ padding: "12px" }}>Invoice #</th>
                    <th style={{ padding: "12px" }}>Type</th>
                    <th style={{ padding: "12px" }}>Due date</th>
                    <th style={{ padding: "12px", textAlign: "right" }}>Amount</th>
                    <th style={{ padding: "12px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const source = (inv.source || "").toUpperCase();
                    const typeLabel =
                      source === "EVT"
                        ? "Event"
                        : source === "DONATION" || source === "DON"
                        ? "Donations"
                        : source === "DUES"
                        ? "Dues"
                        : "Other";
                    const due = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-PH") : "-";
                    const badge = statusBadge(inv.status);
                    return (
                      <tr key={inv.id} style={{ borderBottom: "1px solid var(--app-color-border-subtle)" }}>
                        {isAdminFinance && (
                          <td style={{ padding: "12px", verticalAlign: "top" }}>
                            <div style={{ fontWeight: 600 }}>
                              {inv.member?.firstName} {inv.member?.lastName}
                            </div>
                            <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)" }}>
                              {inv.member?.email}
                            </div>
                          </td>
                        )}
                        <td style={{ padding: "12px", fontFamily: "monospace" }}>{inv.invoiceNumber}</td>
                        <td style={{ padding: "12px" }}>
                          <div>{typeLabel}</div>
                          {inv.event?.title && (
                            <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)" }}>
                              {inv.event.title}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>{due}</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>
                          {formatCurrency(inv.amountCents, inv.currency)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            className={badge.cls}
                            style={{ display: "inline-block", padding: "4px 8px", borderRadius: "12px", fontSize: "12px" }}
                          >
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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


