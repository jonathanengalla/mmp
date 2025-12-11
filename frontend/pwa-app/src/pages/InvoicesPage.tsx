import React, { useEffect, useState } from "react";
import { listMyInvoices, listTenantInvoices } from "../api/client";
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
        const resp = await listTenantInvoices(token, {
          status: statusFilter === "all" ? undefined : statusFilter,
          search: search || undefined,
          page,
          pageSize,
        });
        setInvoices(resp.invoices || resp.items || []);
        setPagination(resp.pagination || null);
        setSummary(resp.summary || null);
      } else {
        const resp = await listMyInvoices(token, { status: statusFilter as MemberStatus, page, pageSize });
        setInvoices(resp.invoices || resp.items || []);
        setPagination(resp.pagination || null);
        setSummary(resp.summary || null);
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
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            }}
          >
            <Card>
              <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>
                {isAdminFinance ? "Outstanding balance" : "My outstanding balance"}
              </div>
              <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700 }}>
                {formatCurrency(summary.outstanding?.totalCents || 0)}
              </div>
              <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                {summary.outstanding?.count || 0} invoices
              </div>
            </Card>
            {isAdminFinance && summary.overdue && (
              <Card>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Overdue</div>
                <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700, color: "var(--app-color-state-error)" }}>
                  {formatCurrency(summary.overdue.totalCents || 0)}
                </div>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                  {summary.overdue.count || 0} invoices
                </div>
              </Card>
            )}
            {isAdminFinance && summary.paidLast30Days && (
              <Card>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-label)" }}>Paid (last 30 days)</div>
                <div style={{ fontSize: "var(--app-font-title)", fontWeight: 700, color: "var(--app-color-state-success)" }}>
                  {formatCurrency(summary.paidLast30Days.totalCents || 0)}
                </div>
                <div style={{ color: "var(--app-color-text-muted)", fontSize: "var(--app-font-body)" }}>
                  {summary.paidLast30Days.count || 0} invoices
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
                    const typeLabel = inv.event ? "Event" : "Dues";
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
import React, { useEffect, useState } from "react";
import { listMyInvoices, listTenantInvoices } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Card, Button, PageShell, Input } from "../ui";

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
        const resp = await listTenantInvoices(token, {
          status: statusFilter === "all" ? undefined : statusFilter,
          search: search || undefined,
          page,
          pageSize,
        });
        setInvoices(resp.invoices || resp.items || []);
        setPagination(resp.pagination || null);
        setSummary(resp.summary || null);
      } else {
        const resp = await listMyInvoices(token, { status: statusFilter as any, page, pageSize });
        setInvoices(resp.invoices || resp.items || []);
        setPagination(resp.pagination || null);
        setSummary(resp.summary || null);
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

  const filteredInvoices = invoices.filter((inv) => {
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      inv.id.toLowerCase().includes(q) ||
      (inv.description || "").toLowerCase().includes(q) ||
      (inv.eventTitle || "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const handleRefresh = () => {
    setPage(1);
    loadInvoices();
  };

  return (
    <PageShell
      title="Invoices"
      description="View your recent invoices and payment status."
      actions={
        <Button variant="secondary" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      }
    >
      {/* Main layout area */}
      <div className="invoices-layout" style={{ display: "grid", gap: "var(--app-space-lg)" }}>
        {error && renderError(error)}

        {/* Filters row */}
        <Card elevation="sm" padding="sm">
          <div style={{ display: "flex", gap: "var(--app-space-sm)", flexWrap: "wrap", alignItems: "center" }}>
            <Input
              placeholder="Search invoices or events"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Invoice["status"] | "all")}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--app-radius-md)",
                border: "1px solid var(--app-color-border-subtle)",
                background: "var(--app-color-surface-0)",
                color: "var(--app-color-text-primary)",
                minWidth: 160,
              }}
            >
              <option value="all">Status: All</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="draft">Draft</option>
            </select>
            <Button variant="ghost" onClick={loadInvoices}>
              Refresh
            </Button>
          </div>
        </Card>

        {/* Summary cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--app-space-md)",
          }}
        >
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Total invoices</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.total}</div>
          </Card>
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Paid</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.paidCount}</div>
            <div style={{ color: "var(--app-color-text-secondary)", marginTop: "var(--app-space-xs)" }}>
              ₱{metrics.paidAmount.toFixed(2)}
            </div>
          </Card>
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Pending</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.pendingCount}</div>
            <div style={{ color: "var(--app-color-text-secondary)", marginTop: "var(--app-space-xs)" }}>
              ₱{metrics.pendingAmount.toFixed(2)}
            </div>
          </Card>
          <Card elevation="sm" padding="md">
            <div style={{ color: "var(--app-color-text-muted)", marginBottom: "var(--app-space-xs)" }}>Other statuses</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{metrics.failedCount}</div>
          </Card>
        </div>

        {/* Table container */}
        <Card elevation="md" padding="md">
          {loading && renderLoading()}
          {!loading && filteredInvoices.length === 0 && renderEmpty("No invoices match the current filters.")}
          {!loading && filteredInvoices.length > 0 && (
            <InvoiceTable invoices={filteredInvoices} onRecordPayment={canRecordPayments ? openRecordPayment : undefined} />
          )}
        </Card>

        <Modal
          open={paymentModalOpen && !!selectedInvoice}
          onClose={closePaymentModal}
          title="Record payment"
          size="md"
          footer={
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--rcme-space-sm)" }}>
              <Button variant="secondary" disabled={submittingPayment} onClick={closePaymentModal}>
                Cancel
              </Button>
              <Button disabled={submittingPayment} onClick={handleRecordPayment}>
                {submittingPayment ? "Saving..." : "Mark as paid"}
              </Button>
            </div>
          }
        >
          {selectedInvoice && (
            <div style={{ display: "grid", gap: "var(--rcme-space-md)" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{selectedInvoice.description}</div>
                {selectedInvoice.eventTitle && (
                  <div style={{ color: "var(--rcme-color-text-muted)" }}>Event: {selectedInvoice.eventTitle}</div>
                )}
                <div style={{ marginTop: "var(--rcme-space-xs)", fontSize: "0.9rem" }}>
                  Amount: {(selectedInvoice.amountCents / 100).toFixed(2)} {selectedInvoice.currency}
                </div>
              </div>
              <FormField label="Payment method">
                <select
                  className="pr-input"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="gcash">GCash</option>
                  <option value="card">Card</option>
                </select>
              </FormField>
              <FormField label="Reference / notes (optional)">
                <input
                  className="pr-input"
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Receipt number, bank ref, or note"
                  style={{ width: "100%" }}
                />
              </FormField>
            </div>
          )}
        </Modal>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </PageShell>
  );
};

export default InvoicesPage;

