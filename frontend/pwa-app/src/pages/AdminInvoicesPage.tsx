import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { listTenantInvoices, InvoiceListItem, InvoiceReportingStatus, InvoiceSource, FinancePeriod } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Card, Button, PageShell, Input } from "../ui";
import { FinancePeriodSelector } from "../components/FinancePeriodSelector";
import { formatCurrency } from "../utils/formatters";
import { Tag } from "../components/primitives/Tag";

const AdminInvoicesPage: React.FC = () => {
  const { tokens } = useSession();
  const token = tokens?.access_token || null;
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [period, setPeriod] = useState<FinancePeriod>("ALL_TIME");
  const [statusFilter, setStatusFilter] = useState<InvoiceReportingStatus[]>([]);
  const [sourceFilter, setSourceFilter] = useState<InvoiceSource[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"issuedAt" | "dueAt" | "amountCents" | "memberName">("issuedAt");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Debounced search
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [searchValue, setSearchValue] = useState("");

  const loadInvoices = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Debug: Log filters being sent
      console.log("[AdminInvoicesPage] Loading invoices with filters:", {
        status: statusFilter,
        source: sourceFilter,
        period,
        search,
      });
      
      const resp = await listTenantInvoices(token, {
        status: statusFilter.length > 0 ? statusFilter : undefined,
        source: sourceFilter.length > 0 ? sourceFilter : undefined,
        period,
        search: search || undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
      });
      
      // Debug: Log response
      console.log("[AdminInvoicesPage] Received invoices:", {
        count: resp.invoices?.length || 0,
        statuses: resp.invoices?.map((inv) => inv.status),
        sources: resp.invoices?.map((inv) => inv.source),
      });
      
      setInvoices(resp.invoices || []);
      setPagination(resp.pagination || null);
      setError(null);
    } catch (e: any) {
      console.error("[AdminInvoicesPage] Error loading invoices:", e);
      setError(e?.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [token, period, statusFilter, sourceFilter, search, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // Debounce search input
  useEffect(() => {
    if (searchDebounce) clearTimeout(searchDebounce);
    const timer = setTimeout(() => {
      setSearch(searchValue);
      setPage(1);
    }, 300);
    setSearchDebounce(timer);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchValue]);

  const handleStatusToggle = (status: InvoiceReportingStatus) => {
    setStatusFilter((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
    setPage(1);
  };

  const handleSourceToggle = (source: InvoiceSource) => {
    setSourceFilter((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));
    setPage(1);
  };

  const getStatusBadgeVariant = (status: InvoiceReportingStatus): "success" | "default" | "danger" => {
    if (status === "PAID") return "success";
    if (status === "OUTSTANDING") return "default";
    return "danger";
  };

  const getSourceLabel = (source: InvoiceSource): string => {
    const labels: Record<InvoiceSource, string> = {
      DUES: "Dues",
      DONATION: "Donation",
      EVENT: "Event",
      OTHER: "Other",
    };
    return labels[source];
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <PageShell
      title="Invoices"
      description="Manage and view all tenant invoices with advanced filtering and search."
    >
      <div style={{ display: "grid", gap: "var(--app-space-lg)" }}>
        {error && (
          <Card>
            <div style={{ color: "var(--app-color-state-error)", padding: "var(--app-space-md)" }}>{error}</div>
          </Card>
        )}

        {/* Filter Bar */}
        <Card elevation="sm" padding="md">
          <div style={{ display: "grid", gap: "var(--app-space-md)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--app-space-sm)" }}>
              {/* Period Selector */}
              <div>
                <label style={{ display: "block", marginBottom: "var(--app-space-xs)", fontSize: "var(--app-font-label)", fontWeight: 500 }}>
                  Period
                </label>
                <FinancePeriodSelector value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />
              </div>

              {/* Status Filter */}
              <div>
                <label style={{ display: "block", marginBottom: "var(--app-space-xs)", fontSize: "var(--app-font-label)", fontWeight: 500 }}>
                  Status
                </label>
                <div style={{ display: "flex", gap: "var(--app-space-xs)", flexWrap: "nowrap" }}>
                  {(["OUTSTANDING", "PAID", "CANCELLED"] as InvoiceReportingStatus[]).map((s) => {
                    const isSelected = statusFilter.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusToggle(s)}
                        style={{
                          padding: "6px 12px",
                          border: isSelected ? "2px solid #3b82f6" : "2px solid var(--app-color-border)",
                          borderRadius: "var(--app-radius-md)",
                          backgroundColor: isSelected ? "#3b82f6" : "var(--app-color-surface-2)",
                          color: isSelected ? "#ffffff" : "var(--app-color-text-primary)",
                          cursor: "pointer",
                          fontSize: "var(--app-font-body)",
                          fontWeight: isSelected ? 600 : 500,
                          transition: "all 0.2s ease",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                          textAlign: "center",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = "var(--app-color-surface-3)";
                            e.currentTarget.style.borderColor = "#3b82f6";
                          } else {
                            // Keep blue when selected, even on hover
                            e.currentTarget.style.backgroundColor = "#3b82f6";
                            e.currentTarget.style.borderColor = "#3b82f6";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = "var(--app-color-surface-2)";
                            e.currentTarget.style.borderColor = "var(--app-color-border)";
                          } else {
                            // Keep blue when selected
                            e.currentTarget.style.backgroundColor = "#3b82f6";
                            e.currentTarget.style.borderColor = "#3b82f6";
                          }
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source Filter */}
              <div>
                <label style={{ display: "block", marginBottom: "var(--app-space-xs)", fontSize: "var(--app-font-label)", fontWeight: 500 }}>
                  Source
                </label>
                <div style={{ display: "flex", gap: "var(--app-space-xs)", flexWrap: "wrap" }}>
                  {(["DUES", "DONATION", "EVENT", "OTHER"] as InvoiceSource[]).map((s) => {
                    const isSelected = sourceFilter.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => handleSourceToggle(s)}
                        style={{
                          padding: "6px 12px",
                          border: isSelected ? "2px solid #3b82f6" : "2px solid var(--app-color-border)",
                          borderRadius: "var(--app-radius-md)",
                          backgroundColor: isSelected ? "#3b82f6" : "var(--app-color-surface-2)",
                          color: isSelected ? "#ffffff" : "var(--app-color-text-primary)",
                          cursor: "pointer",
                          fontSize: "var(--app-font-body)",
                          fontWeight: isSelected ? 600 : 500,
                          transition: "all 0.2s ease",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                          textAlign: "center",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = "var(--app-color-surface-3)";
                            e.currentTarget.style.borderColor = "#3b82f6";
                          } else {
                            // Keep blue when selected, even on hover
                            e.currentTarget.style.backgroundColor = "#3b82f6";
                            e.currentTarget.style.borderColor = "#3b82f6";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = "var(--app-color-surface-2)";
                            e.currentTarget.style.borderColor = "var(--app-color-border)";
                          } else {
                            // Keep blue when selected
                            e.currentTarget.style.backgroundColor = "#3b82f6";
                            e.currentTarget.style.borderColor = "#3b82f6";
                          }
                        }}
                      >
                        {getSourceLabel(s)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Search and Sort */}
            <div style={{ display: "flex", gap: "var(--app-space-sm)", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 300px" }}>
                <label style={{ display: "block", marginBottom: "var(--app-space-xs)", fontSize: "var(--app-font-label)", fontWeight: 500 }}>
                  Search
                </label>
                <Input
                  placeholder="Invoice number, member name, email, event..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "var(--app-space-xs)", fontSize: "var(--app-font-label)", fontWeight: 500 }}>
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
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
                  <option value="issuedAt">Issued Date</option>
                  <option value="dueAt">Due Date</option>
                  <option value="amountCents">Amount</option>
                  <option value="memberName">Member Name</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "var(--app-space-xs)", fontSize: "var(--app-font-label)", fontWeight: 500 }}>
                  Order
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value as "ASC" | "DESC");
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
                  <option value="DESC">Newest First</option>
                  <option value="ASC">Oldest First</option>
                </select>
              </div>
            </div>
          </div>
        </Card>

        {/* Summary Metrics */}
        {!loading && pagination && (
          <Card elevation="sm" padding="md">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--app-space-md)" }}>
              <div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>
                  Filtered Invoices
                </div>
                <div style={{ fontSize: "var(--app-font-heading-sm)", fontWeight: 600, color: "var(--app-color-text-primary)" }}>
                  {pagination.total.toLocaleString()}
                </div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginTop: "2px" }}>
                  {invoices.length < pagination.total && `(${invoices.length} on this page)`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>
                  Outstanding (This Page)
                </div>
                <div style={{ fontSize: "var(--app-font-heading-sm)", fontWeight: 600, color: "var(--app-color-state-warning)" }}>
                  {formatCurrency(
                    invoices
                      .filter((inv) => inv.status === "OUTSTANDING")
                      .reduce((sum, inv) => sum + (inv.balanceCents || 0), 0)
                  )}
                </div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginTop: "2px" }}>
                  {invoices.filter((inv) => inv.status === "OUTSTANDING").length} invoices
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>
                  Collected (This Page)
                </div>
                <div style={{ fontSize: "var(--app-font-heading-sm)", fontWeight: 600, color: "var(--app-color-state-success)" }}>
                  {formatCurrency(
                    invoices
                      .filter((inv) => inv.status === "PAID")
                      .reduce((sum, inv) => sum + inv.amountCents, 0)
                  )}
                </div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginTop: "2px" }}>
                  {invoices.filter((inv) => inv.status === "PAID").length} invoices
                </div>
              </div>
              <div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginBottom: "4px" }}>
                  Total Amount (This Page)
                </div>
                <div style={{ fontSize: "var(--app-font-heading-sm)", fontWeight: 600, color: "var(--app-color-text-primary)" }}>
                  {formatCurrency(invoices.reduce((sum, inv) => sum + inv.amountCents, 0))}
                </div>
                <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)", marginTop: "2px" }}>
                  {invoices.length} invoices
                </div>
              </div>
            </div>
            {invoices.length < pagination.total && (
              <div style={{ marginTop: "var(--app-space-sm)", paddingTop: "var(--app-space-sm)", borderTop: "1px solid var(--app-color-border-subtle)", fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)" }}>
                💡 Tip: Amounts shown are for the current page only. Use the Finance Dashboard to see totals for all filtered invoices.
              </div>
            )}
          </Card>
        )}

        {/* Invoice Table */}
        <Card>
          {loading && <div style={{ padding: "var(--app-space-lg)", textAlign: "center" }}>Loading invoices...</div>}
          {!loading && invoices.length === 0 && !error && (
            <div style={{ padding: "var(--app-space-lg)", textAlign: "center", color: "var(--app-color-text-muted)" }}>
              No invoices found
            </div>
          )}
          {!loading && !error && invoices.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid var(--app-color-border-subtle)" }}>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Invoice #</th>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Member</th>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Source</th>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Amount</th>
                    <th style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>Balance</th>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Issued</th>
                    <th style={{ padding: "12px", fontWeight: 600 }}>Due</th>
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
                      onClick={() => navigate(`/admin/invoices/${inv.id}`)}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--app-color-surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent";
                      }}
                    >
                      <td style={{ padding: "12px", fontFamily: "monospace", fontSize: "var(--app-font-body)" }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: 500 }}>
                          {inv.member?.firstName} {inv.member?.lastName}
                        </div>
                        <div style={{ fontSize: "var(--app-font-caption)", color: "var(--app-color-text-muted)" }}>
                          {inv.member?.email}
                        </div>
                      </td>
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
                      <td style={{ padding: "12px" }}>
                        <Tag variant={getStatusBadgeVariant(inv.status)} size="sm">
                          {inv.status}
                        </Tag>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: 500 }}>
                        {formatCurrency(inv.amountCents)}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: inv.balanceCents > 0 ? 600 : 400 }}>
                        {inv.balanceCents > 0 ? formatCurrency(inv.balanceCents) : "—"}
                      </td>
                      <td style={{ padding: "12px", fontSize: "var(--app-font-body)" }}>{formatDate(inv.issuedAt)}</td>
                      <td style={{ padding: "12px", fontSize: "var(--app-font-body)" }}>{formatDate(inv.dueAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
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
              <div style={{ display: "flex", gap: "var(--app-space-xs)", alignItems: "center" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
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

export default AdminInvoicesPage;

