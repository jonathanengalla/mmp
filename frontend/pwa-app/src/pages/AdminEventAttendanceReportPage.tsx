import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listEventAttendanceReport } from "../api/client";
import { useSession } from "../hooks/useSession";
import { Toast } from "../components/Toast";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { Button } from "../components/primitives/Button";
import { EventAttendanceReportItem } from "../../../../libs/shared/src/models";

export const AdminEventAttendanceReportPage: React.FC = () => {
  const { tokens } = useSession();
  const [items, setItems] = useState<EventAttendanceReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [statusFilter, setStatusFilter] = useState("published");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const resp = await listEventAttendanceReport(tokens.access_token, { status: statusFilter });
      setItems(resp.items || []);
    } catch (err: any) {
      setToast({ msg: err?.error?.message || "Failed to load report", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tokens, statusFilter]);

  return (
    <Page title="Event Attendance Report" description="Live view of attendance, payment status, and invoices per event.">
      <Card>
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center", marginBottom: "var(--space-md)" }}>
          <label>Status filter:</label>
          <select className="pr-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="all">All</option>
          </select>
          <Button variant="secondary" onClick={load}>
            Apply
          </Button>
        </div>
        {loading && <div>Loading...</div>}
        {!loading && items.length === 0 && <div>No events found.</div>}
        {!loading && items.length > 0 && (
          <Table>
            <TableHeader>
            <TableRow>
              <TableHeadCell>Title</TableHeadCell>
              <TableHeadCell>Dates</TableHeadCell>
              <TableHeadCell>Tags</TableHeadCell>
              <TableHeadCell>Regs/Capacity</TableHeadCell>
              <TableHeadCell>Paid/Unpaid</TableHeadCell>
              <TableHeadCell>Checked-in</TableHeadCell>
              <TableHeadCell>Invoices</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell align="right">Actions</TableHeadCell>
            </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((ev) => (
                <TableRow key={ev.event_id}>
                  <TableCell>{ev.title}</TableCell>
                  <TableCell>
                    {new Date(ev.startDate).toLocaleString()}
                    {ev.endDate ? ` - ${new Date(ev.endDate).toLocaleString()}` : ""}
                  </TableCell>
                <TableCell>
                  <div style={{ display: "flex", gap: "var(--space-xxs)", flexWrap: "wrap" }}>
                    {(ev.tags || []).map((t) => (
                      <Tag key={t} variant="default">
                        {t}
                      </Tag>
                    ))}
                  </div>
                </TableCell>
                  <TableCell>
                    {ev.registrationsCount}/{ev.capacity ?? "—"}
                  </TableCell>
                <TableCell>
                  <div style={{ display: "flex", gap: "var(--space-xs)", alignItems: "center" }}>
                    <Tag variant="success" size="sm">Paid: {ev.paidCount ?? 0}</Tag>
                    <Tag variant={(ev.unpaidCount ?? 0) > 0 ? "warning" : "default"} size="sm">
                      Unpaid: {ev.unpaidCount ?? 0}
                    </Tag>
                  </div>
                </TableCell>
                <TableCell>{ev.checkInCount ?? 0}</TableCell>
                <TableCell>{(ev.invoiceIds || []).length > 0 ? ev.invoiceIds?.length : "—"}</TableCell>
                <TableCell>
                  <Tag variant={ev.status === "published" ? "success" : ev.status === "draft" ? "warning" : "default"}>{ev.status}</Tag>
                </TableCell>
                <TableCell align="right">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/events/${ev.event_id}`)}>
                    View event
                  </Button>
                </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </Page>
  );
};

