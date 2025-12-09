import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell, TableCard } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { useSession } from "../hooks/useSession";
import { EventDetailDto } from "../../../../libs/shared/src/models";
import { listEventsAdmin, publishEvent } from "../api/client";

const priceLabel = (ev: EventDetailDto) => {
  if (ev.priceCents == null) return "Free";
  return `${ev.currency || "PHP"} ${(ev.priceCents / 100).toLocaleString()}`;
};

export const AdminEventsDashboardPage: React.FC = () => {
  const { tokens } = useSession();
  const navigate = useNavigate();
  const [items, setItems] = useState<EventDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    if (!tokens?.access_token) {
      setLoading(false);
      return;
    }
    try {
      const data = await listEventsAdmin(tokens.access_token);
      setItems(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.access_token]);

  const onPublish = async (id: string) => {
    if (!tokens?.access_token) return;
    try {
      await publishEvent(tokens.access_token, id);
      await load();
    } catch (err) {
      console.error(err);
      setError("Publish failed");
    }
  };

  return (
    <Page
      title="Events Dashboard"
      description="Overview of all events. Publish drafts, edit details, and jump to member view."
      actions={
        <Button onClick={() => navigate("/admin/events/new")} variant="secondary">
          Create event
        </Button>
      }
    >
      <Card>
        {error && <div style={{ color: "var(--app-color-state-error)", marginBottom: "var(--space-sm)" }}>{error}</div>}
        {loading && <div>Loading...</div>}
        {!loading && items.length === 0 && <div>No events found.</div>}
        {!loading && items.length > 0 && (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHeadCell>Title</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell>Mode</TableHeadCell>
                  <TableHeadCell>Start</TableHeadCell>
                  <TableHeadCell>Capacity</TableHeadCell>
                  <TableHeadCell>Price</TableHeadCell>
                  <TableHeadCell align="right">Actions</TableHeadCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((ev) => {
                  const remaining =
                    ev.capacity != null ? Math.max(ev.capacity - (ev.registrationsCount || 0), 0) : null;
                  return (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <Button variant="link" onClick={() => navigate(`/events/${ev.slug || ev.id}`)}>
                          {ev.title}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Tag variant={ev.status === "published" ? "success" : ev.status === "draft" ? "warning" : "default"}>
                          {ev.status}
                        </Tag>
                      </TableCell>
                      <TableCell>
                        <Tag variant={ev.registrationMode === "pay_now" ? "warning" : "info"} size="sm">
                          {ev.registrationMode === "pay_now" ? "Pay-now" : "RSVP"}
                        </Tag>
                      </TableCell>
                      <TableCell>
                        {new Date(ev.startDate).toLocaleString()}
                        {ev.endDate ? ` - ${new Date(ev.endDate).toLocaleString()}` : ""}
                      </TableCell>
                      <TableCell>
                        {ev.registrationsCount}/{ev.capacity ?? "—"}
                        {remaining != null && <div style={{ color: "var(--app-color-text-muted)" }}>{remaining} remaining</div>}
                      </TableCell>
                      <TableCell>{priceLabel(ev)}</TableCell>
                      <TableCell align="right">
                        <div style={{ display: "flex", gap: "var(--space-xs)", justifyContent: "flex-end" }}>
                          {ev.status === "draft" && (
                            <Button size="sm" onClick={() => onPublish(ev.id)}>
                              Publish
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/events/${ev.id}/edit`)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/events/${ev.slug || ev.id}`)}>
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </Card>
    </Page>
  );
};

export default AdminEventsDashboardPage;

