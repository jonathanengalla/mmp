import React from "react";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Table, TableBody, TableCell, TableHeadCell, TableHeader, TableRow, TableCard } from "../components/ui/Table";
import { Tag } from "../components/primitives/Tag";
import { useSession } from "../hooks/useSession";
import { listTenantInvoices, getFinanceSummary, type FinancePeriod } from "../api/client";
import { FinancePeriodSelector } from "../components/FinancePeriodSelector";
import { mapFinanceSummaryToDisplay, getDefaultFinanceDisplayData } from "../utils/financeHelpers";
import { formatCurrency } from "../utils/formatters";

type DashboardInvoice = any;

interface LoadState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

const formatMoney = (amountCents: number | null | undefined, currency?: string) => {
  const amount = (amountCents ?? 0) / 100;
  const cur = currency || "PHP";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const AdminFinanceDashboardPage: React.FC = () => {
  const { tokens, hasRole } = useSession();
  const token = tokens?.access_token || null;
  const isAdmin = hasRole?.("admin") || hasRole?.("finance_manager") || hasRole?.("super_admin");

  const [period, setPeriod] = React.useState<FinancePeriod>("YEAR_TO_DATE");
  const [financeSummaryState, setFinanceSummaryState] = React.useState<LoadState<any>>({
    loading: true,
    error: null,
    data: null,
  });
  const [recentInvoicesState, setRecentInvoicesState] = React.useState<LoadState<DashboardInvoice[]>>({
    loading: false,
    error: null,
    data: null,
  });

  // Load finance summary when period changes
  React.useEffect(() => {
    let cancelled = false;

    const loadSummary = async () => {
      if (!token || !isAdmin) {
        setFinanceSummaryState({ loading: false, error: "Not authenticated or insufficient permissions", data: null });
        return;
      }

      setFinanceSummaryState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const summary = await getFinanceSummary(token, { period });
        if (!cancelled) {
          setFinanceSummaryState({ loading: false, error: null, data: summary });
        }
      } catch (err: any) {
        if (!cancelled) {
          setFinanceSummaryState({
            loading: false,
            error: err?.message || "Failed to load finance summary",
            data: null,
          });
        }
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [token, period, isAdmin]);

  // Load recent invoices (keep existing functionality)
  React.useEffect(() => {
    let cancelled = false;

    const loadRecentInvoices = async () => {
      if (!token || !isAdmin) {
        return;
      }

      setRecentInvoicesState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const invResp: any = await listTenantInvoices(token, { pageSize: 5 });
        if (!cancelled) {
          const items: DashboardInvoice[] = (invResp?.invoices ?? invResp?.items ?? []) as DashboardInvoice[];
          setRecentInvoicesState({ loading: false, error: null, data: items });
        }
      } catch (err: any) {
        if (!cancelled) {
          setRecentInvoicesState({
            loading: false,
            error: err?.message || "Unable to load recent invoices",
            data: null,
          });
        }
      }
    };

    loadRecentInvoices();
    return () => {
      cancelled = true;
    };
  }, [token, isAdmin]);

  const displayData = financeSummaryState.data
    ? mapFinanceSummaryToDisplay(financeSummaryState.data)
    : getDefaultFinanceDisplayData();

  if (!isAdmin) {
    return (
      <Page title="Finance Dashboard">
        <Card>
          <div style={{ color: "var(--app-color-state-error)" }}>
            You do not have permission to view the finance dashboard.
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title="Finance Overview"
      description={financeSummaryState.data ? displayData.range.label : "Finance Overview"}
      actions={<FinancePeriodSelector value={period} onChange={setPeriod} />}
    >
      <div style={{ display: "grid", gap: "var(--space-lg)" }}>
        {/* Headline Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          <Card title="Total Outstanding">
            {financeSummaryState.loading ? (
              <div>Loading...</div>
            ) : financeSummaryState.error ? (
              <div style={{ color: "var(--app-color-state-error)" }}>{financeSummaryState.error}</div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{displayData.headlineCards.outstanding.amount}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--app-color-text-muted)" }}>
                  {displayData.headlineCards.outstanding.label}
                </div>
              </div>
            )}
          </Card>

          <Card title="Total Collected">
            {financeSummaryState.loading ? (
              <div>Loading...</div>
            ) : financeSummaryState.error ? (
              <div style={{ color: "var(--app-color-state-error)" }}>{financeSummaryState.error}</div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>{displayData.headlineCards.collected.amount}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--app-color-text-muted)" }}>
                  {displayData.headlineCards.collected.label}
                </div>
              </div>
            )}
          </Card>

          {displayData.headlineCards.cancelled.count > 0 && (
            <Card title="Total Cancelled">
              {financeSummaryState.loading ? (
                <div>Loading...</div>
              ) : financeSummaryState.error ? (
                <div style={{ color: "var(--app-color-state-error)" }}>{financeSummaryState.error}</div>
              ) : (
                <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                  <div
                    style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--app-color-text-muted)" }}
                  >
                    {displayData.headlineCards.cancelled.amount}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--app-color-text-muted)" }}>
                    {displayData.headlineCards.cancelled.label}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Source Breakdown */}
        <Card title="Revenue Breakdown by Source">
          {financeSummaryState.loading ? (
            <div>Loading...</div>
          ) : financeSummaryState.error ? (
            <div style={{ color: "var(--app-color-state-error)" }}>{financeSummaryState.error}</div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-md)" }}>
              {/* Dues */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: "var(--space-xs)" }}>Dues</div>
                <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.9rem", marginLeft: "var(--space-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--app-color-text-muted)" }}>Outstanding:</span>
                    <span
                      style={
                        displayData.sourceBreakdown.dues.outstanding.count === 0
                          ? { color: "var(--app-color-text-muted)" }
                          : {}
                      }
                    >
                      {displayData.sourceBreakdown.dues.outstanding.amount} ({displayData.sourceBreakdown.dues.outstanding.count})
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--app-color-text-muted)" }}>Collected:</span>
                    <span>{displayData.sourceBreakdown.dues.collected.amount} ({displayData.sourceBreakdown.dues.collected.count})</span>
                  </div>
                </div>
              </div>

              {/* Donations */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: "var(--space-xs)" }}>Donations</div>
                <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.9rem", marginLeft: "var(--space-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--app-color-text-muted)" }}>Collected:</span>
                    <span>{displayData.sourceBreakdown.donations.collected.amount} ({displayData.sourceBreakdown.donations.collected.count})</span>
                  </div>
                </div>
              </div>

              {/* Events */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: "var(--space-xs)" }}>Events</div>
                <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.9rem", marginLeft: "var(--space-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--app-color-text-muted)" }}>Outstanding:</span>
                    <span
                      style={
                        displayData.sourceBreakdown.events.outstanding.count === 0
                          ? { color: "var(--app-color-text-muted)" }
                          : {}
                      }
                    >
                      {displayData.sourceBreakdown.events.outstanding.amount} ({displayData.sourceBreakdown.events.outstanding.count})
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--app-color-text-muted)" }}>Collected:</span>
                    <span>{displayData.sourceBreakdown.events.collected.amount} ({displayData.sourceBreakdown.events.collected.count})</span>
                  </div>
                </div>
              </div>

              {/* Other */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: "var(--space-xs)" }}>Other</div>
                <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.9rem", marginLeft: "var(--space-md)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--app-color-text-muted)" }}>Outstanding:</span>
                    <span
                      style={
                        displayData.sourceBreakdown.other.outstanding.count === 0
                          ? { color: "var(--app-color-text-muted)" }
                          : {}
                      }
                    >
                      {displayData.sourceBreakdown.other.outstanding.amount} ({displayData.sourceBreakdown.other.outstanding.count})
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--app-color-text-muted)" }}>Collected:</span>
                    <span>{displayData.sourceBreakdown.other.collected.amount} ({displayData.sourceBreakdown.other.collected.count})</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Status Breakdown */}
        <Card title="Status Breakdown">
          {financeSummaryState.loading ? (
            <div>Loading...</div>
          ) : financeSummaryState.error ? (
            <div style={{ color: "var(--app-color-state-error)" }}>{financeSummaryState.error}</div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.95rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Outstanding:</span>
                <span>{displayData.statusBreakdown.outstanding.amount} ({displayData.statusBreakdown.outstanding.count} invoices)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Paid:</span>
                <span>{displayData.statusBreakdown.paid.amount} ({displayData.statusBreakdown.paid.count} invoices)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Cancelled:</span>
                <span style={{ color: "var(--app-color-text-muted)" }}>
                  {displayData.statusBreakdown.cancelled.amount} ({displayData.statusBreakdown.cancelled.count} invoices)
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* Recent Invoices Table (keep existing functionality) */}
        <Card title="Recent Invoices">
          {recentInvoicesState.loading && <div>Loading invoices…</div>}
          {recentInvoicesState.error && (
            <div style={{ color: "var(--app-color-state-error)" }}>{recentInvoicesState.error}</div>
          )}
          {!recentInvoicesState.loading &&
            !recentInvoicesState.error &&
            (recentInvoicesState.data ?? []).length === 0 && (
              <div style={{ color: "var(--app-color-text-muted)" }}>No invoices found.</div>
            )}
          {!recentInvoicesState.loading &&
            !recentInvoicesState.error &&
            (recentInvoicesState.data ?? []).length > 0 && (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeadCell>Invoice</TableHeadCell>
                      <TableHeadCell>Source</TableHeadCell>
                      <TableHeadCell align="right">Amount</TableHeadCell>
                      <TableHeadCell>Status</TableHeadCell>
                      <TableHeadCell>Created</TableHeadCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recentInvoicesState.data ?? []).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>{inv.description || inv.invoiceNumber || "Invoice"}</span>
                            {inv.eventTitle && (
                              <span style={{ fontSize: "0.8rem", color: "var(--app-color-text-muted)" }}>
                                Event: {inv.eventTitle}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const source = (inv.source || "").toUpperCase();
                            if (source === "DUES") return <Tag variant="info">Dues</Tag>;
                            if (source === "EVT" || source === "EVENT") return <Tag variant="success">Event</Tag>;
                            if (source === "DONATION" || source === "DON") return <Tag variant="info">Donations</Tag>;
                            if (!source) return <Tag variant="default">Manual</Tag>;
                            return <Tag variant="default">{source}</Tag>;
                          })()}
                        </TableCell>
                        <TableCell align="right">{formatMoney(inv.amountCents, inv.currency)}</TableCell>
                        <TableCell>
                          <Tag
                            variant={
                              inv.status === "PAID" || inv.status === "paid"
                                ? "success"
                                : inv.status === "OVERDUE" || inv.status === "overdue"
                                ? "danger"
                                : inv.status === "CANCELLED" ||
                                  inv.status === "cancelled" ||
                                  inv.status === "VOID" ||
                                  inv.status === "void"
                                ? "default"
                                : "warning"
                            }
                          >
                            {inv.status?.toLowerCase?.() ?? inv.status}
                          </Tag>
                        </TableCell>
                        <TableCell>
                          {inv.createdAt ? (
                            <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                          ) : (
                            <span style={{ color: "var(--app-color-text-muted)" }}>–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
        </Card>
      </div>
    </Page>
  );
};

export default AdminFinanceDashboardPage;
