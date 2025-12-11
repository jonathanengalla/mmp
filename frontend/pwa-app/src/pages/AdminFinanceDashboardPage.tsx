import React from "react";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Table, TableBody, TableCell, TableHeadCell, TableHeader, TableRow, TableCard } from "../components/ui/Table";
import { Tag } from "../components/primitives/Tag";
import { useSession } from "../hooks/useSession";
import { listMyInvoices, listEventAttendanceReport, listTenantInvoices, getFinanceSummary } from "../api/client";

type DashboardInvoice = any;
type DashboardEventRow = any;

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

  const [invoicesState, setInvoicesState] = React.useState<LoadState<DashboardInvoice[]>>({
    loading: true,
    error: null,
    data: null,
  });
  const [eventsState, setEventsState] = React.useState<LoadState<DashboardEventRow[]>>({
    loading: true,
    error: null,
    data: null,
  });
  const [financeSummary, setFinanceSummary] = React.useState<any>(null);
  const [duesInvoicesState, setDuesInvoicesState] = React.useState<LoadState<DashboardInvoice[]>>({
    loading: true,
    error: null,
    data: null,
  });

  React.useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      if (!token) {
        setInvoicesState({ loading: false, error: "Not authenticated", data: null });
        setEventsState({ loading: false, error: "Not authenticated", data: null });
        setDuesInvoicesState({ loading: false, error: "Not authenticated", data: null });
        setFinanceSummary(null);
        return;
      }
      // invoices
      try {
        setInvoicesState((prev) => ({ ...prev, loading: true, error: null }));
        const useTenantScope = hasRole?.("admin") || hasRole?.("finance_manager") || hasRole?.("super_admin");
        const invResp: any = useTenantScope ? await listTenantInvoices(token, { pageSize: 200 }) : await listMyInvoices(token);
        if (!cancelled) {
          const items: DashboardInvoice[] = (invResp?.invoices ?? invResp?.items ?? []) as DashboardInvoice[];
          setInvoicesState({ loading: false, error: null, data: items });
        }
        if (useTenantScope) {
          try {
            const summary = await getFinanceSummary(token);
            if (!cancelled) setFinanceSummary(summary);
          } catch (err) {
            if (!cancelled) setFinanceSummary(null);
          }
          try {
            setDuesInvoicesState((prev) => ({ ...prev, loading: true, error: null }));
            const duesResp: any = await listTenantInvoices(token, { pageSize: 5, source: "DUES" });
            if (!cancelled) {
              const duesItems: DashboardInvoice[] = (duesResp?.invoices ?? duesResp?.items ?? []) as DashboardInvoice[];
              setDuesInvoicesState({ loading: false, error: null, data: duesItems });
            }
          } catch (err: any) {
            if (!cancelled) {
              setDuesInvoicesState((prev) => ({
                ...prev,
                loading: false,
                error: err?.message || "Unable to load dues invoices",
              }));
            }
          }
        } else {
          setFinanceSummary(null);
          setDuesInvoicesState({ loading: false, error: null, data: null });
        }
      } catch (err: any) {
        if (!cancelled) {
          setInvoicesState((prev) => ({
            ...prev,
            loading: false,
            error: err?.message || "Unable to load invoices",
          }));
        }
      }
      // events
      try {
        setEventsState((prev) => ({ ...prev, loading: true, error: null }));
        const evtResp: any = await listEventAttendanceReport(token, { status: "published" });
        if (!cancelled) {
          const items: DashboardEventRow[] = (evtResp.items ?? []) as DashboardEventRow[];
          setEventsState({ loading: false, error: null, data: items });
        }
      } catch (err: any) {
        if (!cancelled) {
          setEventsState((prev) => ({
            ...prev,
            loading: false,
            error: err?.message || "Unable to load event metrics",
          }));
        }
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const invoices = invoicesState.data ?? [];
  const events = eventsState.data ?? [];

  const totalOutstanding = financeSummary?.outstanding || { count: 0, totalCents: 0 };
  const last30DaysPaid = financeSummary?.paidLast30Days || { count: 0, totalCents: 0 };
  const revenueMix = financeSummary?.revenueMix || {
    DUES: { totalCents: 0, count: 0 },
    EVT: { totalCents: 0, count: 0 },
    DONATION: { totalCents: 0, count: 0 },
    OTHER: { totalCents: 0, count: 0 },
  };

  const recentInvoices = React.useMemo(() => {
    return [...invoices]
      .sort((a, b) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 5);
  }, [invoices]);

  const topEvents = React.useMemo(() => {
    return [...events]
      .map((ev) => {
        const revenueCents = (ev as any).totalAmountCents ?? 0;
        const registrations = (ev as any).registrationsCount ?? 0;
        return { ...ev, revenueCents, registrations };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 5);
  }, [events]);

  return (
    <Page
      title="Finance Dashboard"
      description="High level view of dues, invoices, and event revenue for admin and finance roles."
    >
      <div style={{ display: "grid", gap: "var(--space-lg)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          <Card title="Outstanding invoices">
            {invoicesState.error ? (
              <div style={{ color: "var(--app-color-state-error)" }}>{invoicesState.error}</div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
                  {formatMoney(totalOutstanding.totalCents, invoices[0]?.currency)}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--app-color-text-muted)" }}>
                  {totalOutstanding.count} open invoice{totalOutstanding.count === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </Card>

          <Card title="Paid last 30 days">
            {invoicesState.error ? (
              <div style={{ color: "var(--app-color-state-error)" }}>{invoicesState.error}</div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
                  {formatMoney(last30DaysPaid.totalCents, invoices[0]?.currency)}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--app-color-text-muted)" }}>
                  {last30DaysPaid.count} invoice{last30DaysPaid.count === 1 ? "" : "s"} paid in the last 30 days
                </div>
              </div>
            )}
          </Card>

          <Card title="Revenue mix (paid)">
            {invoicesState.error ? (
              <div style={{ color: "var(--app-color-state-error)" }}>{invoicesState.error}</div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Dues</span>
                  <span>{formatMoney(revenueMix.DUES.totalCents, invoices[0]?.currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Events</span>
                  <span>{formatMoney(revenueMix.EVT.totalCents, invoices[0]?.currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Donations</span>
                  <span>{formatMoney(revenueMix.DONATION.totalCents, invoices[0]?.currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Other</span>
                  <span>{formatMoney(revenueMix.OTHER.totalCents, invoices[0]?.currency)}</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card title="Dues summary">
          {financeSummary ? (
            <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.95rem" }}>
              <div>Total billed: {formatMoney(financeSummary.duesSummary?.billedTotalCents || 0, invoices[0]?.currency)}</div>
              <div>Collected: {formatMoney(financeSummary.duesSummary?.paidTotalCents || 0, invoices[0]?.currency)}</div>
              <div>
                Outstanding:{" "}
                {formatMoney(financeSummary.duesSummary?.outstandingCents || 0, invoices[0]?.currency)}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--app-color-state-error)" }}>Unable to load dues summary right now.</div>
          )}
        </Card>

        <Card title="Recent dues invoices">
          {duesInvoicesState.loading && <div>Loading dues invoices…</div>}
          {duesInvoicesState.error && (
            <div style={{ color: "var(--app-color-state-error)" }}>{duesInvoicesState.error}</div>
          )}
          {!duesInvoicesState.loading &&
            !duesInvoicesState.error &&
            (duesInvoicesState.data ?? []).length === 0 && (
              <div style={{ color: "var(--app-color-text-muted)" }}>No dues invoices yet.</div>
            )}
          {!duesInvoicesState.loading &&
            !duesInvoicesState.error &&
            (duesInvoicesState.data ?? []).length > 0 && (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeadCell>Invoice #</TableHeadCell>
                      <TableHeadCell>Member</TableHeadCell>
                      <TableHeadCell align="right">Amount</TableHeadCell>
                      <TableHeadCell>Status</TableHeadCell>
                      <TableHeadCell>Created</TableHeadCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(duesInvoicesState.data ?? []).map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.invoiceNumber || inv.description || "Invoice"}</TableCell>
                        <TableCell>
                          {inv.member?.firstName || inv.member?.lastName
                            ? `${inv.member?.firstName ?? ""} ${inv.member?.lastName ?? ""}`.trim()
                            : inv.member?.email ?? "—"}
                        </TableCell>
                        <TableCell align="right">{formatMoney(inv.amountCents, inv.currency)}</TableCell>
                        <TableCell>
                          <Tag
                            variant={
                              inv.status === "PAID"
                                ? "success"
                                : inv.status === "OVERDUE"
                                ? "danger"
                                : inv.status === "CANCELLED" || inv.status === "VOID" || inv.status === "FAILED"
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

        <Card title="Recent invoices">
          {invoicesState.loading && <div>Loading invoices…</div>}
          {invoicesState.error && <div style={{ color: "var(--app-color-state-error)" }}>{invoicesState.error}</div>}
          {!invoicesState.loading && !invoicesState.error && recentInvoices.length === 0 && (
            <div style={{ color: "var(--app-color-text-muted)" }}>No invoices found.</div>
          )}
          {!invoicesState.loading && !invoicesState.error && recentInvoices.length > 0 && (
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
                  {recentInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{inv.description || "Invoice"}</span>
                          {inv.eventTitle && (
                            <span style={{ fontSize: "0.8rem", color: "var(--app-color-text-muted)" }}>Event: {inv.eventTitle}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {inv.source === "dues" && <Tag variant="info">Dues</Tag>}
                        {inv.source === "event" && <Tag variant="success">Event</Tag>}
                        {!inv.source && <Tag variant="default">Manual</Tag>}
                        {inv.source && inv.source !== "dues" && inv.source !== "event" && (
                          <Tag variant="default">{inv.source}</Tag>
                        )}
                      </TableCell>
                      <TableCell align="right">{formatMoney(inv.amountCents, inv.currency)}</TableCell>
                      <TableCell>
                        <Tag
                          variant={
                            inv.status === "paid"
                              ? "success"
                              : inv.status === "overdue"
                              ? "danger"
                              : inv.status === "cancelled" || inv.status === "void"
                              ? "default"
                              : "warning"
                          }
                        >
                          {inv.status}
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

        <Card title="Top events">
          {eventsState.loading && <div>Loading events…</div>}
          {eventsState.error && <div style={{ color: "var(--app-color-state-error)" }}>{eventsState.error}</div>}
          {!eventsState.loading && !eventsState.error && topEvents.length === 0 && (
            <div style={{ color: "var(--app-color-text-muted)" }}>No event data yet.</div>
          )}
          {!eventsState.loading && !eventsState.error && topEvents.length > 0 && (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeadCell>Event</TableHeadCell>
                    <TableHeadCell align="right">Registrations</TableHeadCell>
                    <TableHeadCell align="right">Revenue</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEvents.map((ev) => (
                    <TableRow key={ev.event_id ?? ev.title}>
                      <TableCell>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{ev.title}</span>
                          {ev.startDate && (
                            <span style={{ fontSize: "0.8rem", color: "var(--app-color-text-muted)" }}>
                              {new Date(ev.startDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell align="right">{(ev as any).registrationsCount ?? 0}</TableCell>
                      <TableCell align="right">
                        {formatMoney((ev as any).totalAmountCents ?? 0, invoices[0]?.currency)}
                      </TableCell>
                      <TableCell>
                        <Tag
                          variant={
                            ev.status === "completed"
                              ? "success"
                              : ev.status === "cancelled"
                              ? "danger"
                              : ev.status === "published"
                              ? "info"
                              : "default"
                          }
                        >
                          {ev.status}
                        </Tag>
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


