import React from "react";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Table, TableBody, TableCell, TableHeadCell, TableHeader, TableRow } from "../components/ui/Table";
import { Tag } from "../components/primitives/Tag";
import { useSession } from "../hooks/useSession";
import {
  getDuesSummary,
  listMyInvoices,
  listEventAttendanceReport,
  Invoice,
  DuesSummaryResponse,
  EventAttendanceReportItem,
} from "../api/client";

type DashboardDuesRow = DuesSummaryResponse["items"][number];
type DashboardInvoice = Invoice;
type DashboardEventRow = EventAttendanceReportItem & { totalAmountCents?: number; registeredCount?: number };

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
  const { tokens } = useSession();
  const token = tokens?.access_token || null;

  const [duesState, setDuesState] = React.useState<LoadState<DashboardDuesRow[]>>({
    loading: true,
    error: null,
    data: null,
  });
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

  React.useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      if (!token) {
        setDuesState({ loading: false, error: "Not authenticated", data: null });
        setInvoicesState({ loading: false, error: "Not authenticated", data: null });
        setEventsState({ loading: false, error: "Not authenticated", data: null });
        return;
      }
      // dues
      try {
        setDuesState((prev) => ({ ...prev, loading: true, error: null }));
        const duesResp = await getDuesSummary(token);
        if (!cancelled) {
          const rows = (duesResp.items ?? []) as DashboardDuesRow[];
          setDuesState({ loading: false, error: null, data: rows });
        }
      } catch (err: any) {
        if (!cancelled) {
          setDuesState((prev) => ({
            ...prev,
            loading: false,
            error: err?.message || "Unable to load dues summary",
          }));
        }
      }
      // invoices
      try {
        setInvoicesState((prev) => ({ ...prev, loading: true, error: null }));
        const invResp: any = await listMyInvoices(token);
        if (!cancelled) {
          const items: DashboardInvoice[] = (invResp.items ?? invResp) as DashboardInvoice[];
          setInvoicesState({ loading: false, error: null, data: items });
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
  const duesRows = duesState.data ?? [];

  const totalOutstanding = React.useMemo(() => {
    return invoices
      .filter((inv) => inv.status === "unpaid" || inv.status === "pending" || inv.status === "overdue")
      .reduce(
        (acc, inv) => {
          acc.count += 1;
          acc.amountCents += inv.amountCents ?? 0;
          return acc;
        },
        { count: 0, amountCents: 0 }
      );
  }, [invoices]);

  const last30DaysPaid = React.useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return invoices
      .filter((inv) => inv.status === "paid" && inv.paidAt && new Date(inv.paidAt).getTime() >= cutoff)
      .reduce(
        (acc, inv) => {
          acc.count += 1;
          acc.amountCents += inv.amountCents ?? 0;
          return acc;
        },
        { count: 0, amountCents: 0 }
      );
  }, [invoices]);

  const eventVsDues = React.useMemo(() => {
    return invoices.reduce(
      (acc, inv) => {
        const source = inv.source ?? "manual";
        if (source === "event") acc.eventCents += inv.amountCents ?? 0;
        else if (source === "dues") acc.duesCents += inv.amountCents ?? 0;
        else acc.otherCents += inv.amountCents ?? 0;
        return acc;
      },
      { eventCents: 0, duesCents: 0, otherCents: 0 }
    );
  }, [invoices]);

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
                  {formatMoney(totalOutstanding.amountCents, invoices[0]?.currency)}
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
                  {formatMoney(last30DaysPaid.amountCents, invoices[0]?.currency)}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--app-color-text-muted)" }}>
                  {last30DaysPaid.count} invoice{last30DaysPaid.count === 1 ? "" : "s"} paid in the last 30 days
                </div>
              </div>
            )}
          </Card>

          <Card title="Revenue mix">
            {invoicesState.error ? (
              <div style={{ color: "var(--app-color-state-error)" }}>{invoicesState.error}</div>
            ) : (
              <div style={{ display: "grid", gap: "var(--space-xs)", fontSize: "0.9rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Dues</span>
                  <span>{formatMoney(eventVsDues.duesCents, invoices[0]?.currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Events</span>
                  <span>{formatMoney(eventVsDues.eventCents, invoices[0]?.currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Other</span>
                  <span>{formatMoney(eventVsDues.otherCents, invoices[0]?.currency)}</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        <Card title="Dues summary">
          {duesState.loading && <div>Loading dues summary…</div>}
          {duesState.error && <div style={{ color: "var(--app-color-state-error)" }}>{duesState.error}</div>}
          {!duesState.loading && !duesState.error && duesRows.length === 0 && (
            <div style={{ color: "var(--app-color-text-muted)" }}>No dues runs yet.</div>
          )}
          {!duesState.loading && !duesState.error && duesRows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeadCell>Period</TableHeadCell>
                  <TableHeadCell align="right">Members billed</TableHeadCell>
                  <TableHeadCell align="right">Total amount</TableHeadCell>
                  <TableHeadCell align="right">Paid</TableHeadCell>
                  <TableHeadCell align="right">Outstanding</TableHeadCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duesRows.slice(0, 5).map((row) => (
                  <TableRow key={row.periodKey ?? row.label}>
                    <TableCell>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span>{row.label}</span>
                        {row.dueDate && (
                          <span style={{ fontSize: "0.8rem", color: "var(--app-color-text-muted)" }}>Due {row.dueDate}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell align="right">{row.totalCount ?? "–"}</TableCell>
                    <TableCell align="right">{formatMoney(row.amountCentsTotal, row.currency)}</TableCell>
                    <TableCell align="right">{formatMoney(row.amountCentsPaid, row.currency)}</TableCell>
                    <TableCell align="right">{formatMoney(row.amountCentsUnpaid, row.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card title="Recent invoices">
          {invoicesState.loading && <div>Loading invoices…</div>}
          {invoicesState.error && <div style={{ color: "var(--app-color-state-error)" }}>{invoicesState.error}</div>}
          {!invoicesState.loading && !invoicesState.error && recentInvoices.length === 0 && (
            <div style={{ color: "var(--app-color-text-muted)" }}>No invoices found.</div>
          )}
          {!invoicesState.loading && !invoicesState.error && recentInvoices.length > 0 && (
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
          )}
        </Card>

        <Card title="Top events">
          {eventsState.loading && <div>Loading events…</div>}
          {eventsState.error && <div style={{ color: "var(--app-color-state-error)" }}>{eventsState.error}</div>}
          {!eventsState.loading && !eventsState.error && topEvents.length === 0 && (
            <div style={{ color: "var(--app-color-text-muted)" }}>No event data yet.</div>
          )}
          {!eventsState.loading && !eventsState.error && topEvents.length > 0 && (
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
          )}
        </Card>
      </div>
    </Page>
  );
};

export default AdminFinanceDashboardPage;


