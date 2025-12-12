import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { Table, TableHeader, TableBody, TableRow, TableHeadCell, TableCell, TableCard } from "../components/ui/Table";
import { Tag } from "../components/ui/Tag";
import { useSession } from "../hooks/useSession";
import { EventDetailDto } from "../../../../libs/shared/src/models";
import { formatEventDateRange } from "../utils/eventDate";
import { listEventsAdmin, publishEvent } from "../api/client";
// @ts-ignore react-query types not in this project; using fetch fallbacks
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const priceLabel = (ev: EventDetailDto) => {
  if (ev.priceCents == null) return "Free";
  return `${ev.currency || "PHP"} ${(ev.priceCents / 100).toLocaleString()}`;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const AdminEventsDashboardPage: React.FC = () => {
  const { tokens } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [eventToCancel, setEventToCancel] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: () => listEventsAdmin(tokens?.access_token || ""),
    enabled: !!tokens?.access_token,
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => fetch("/admin/events/" + eventId, { method: "DELETE", headers: { Authorization: `Bearer ${tokens?.access_token || ""}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      setDeleteModalOpen(false);
      setEventToDelete(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (eventId: string) =>
      fetch("/admin/events/" + eventId + "/cancel", { method: "POST", headers: { Authorization: `Bearer ${tokens?.access_token || ""}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      setCancelModalOpen(false);
      setEventToCancel(null);
    },
  });

  const handleDeleteClick = (eventId: string) => {
    setEventToDelete(eventId);
    setDeleteModalOpen(true);
  };

  const handleCancelClick = (eventId: string) => {
    setEventToCancel(eventId);
    setCancelModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (eventToDelete) {
      deleteMutation.mutate(eventToDelete);
    }
  };

  const handleCancelConfirm = () => {
    if (eventToCancel) {
      cancelMutation.mutate(eventToCancel);
    }
  };

  const canDelete = (ev: any) => (ev.registrationsCount || 0) === 0 && (ev.invoicesCount || 0) === 0;

  const onPublish = async (id: string) => {
    if (!tokens?.access_token) return;
    try {
      await publishEvent(tokens.access_token, id);
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
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
        {isLoading && <div>Loading...</div>}
        {!isLoading && (!data?.events || data.events.length === 0) && <div>No events found.</div>}
        {!isLoading && data?.events && data.events.length > 0 && (
          <TableCard>
            <div style={{ overflowX: "auto", paddingRight: "16px" }}>
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
                {data.events.map((ev: any) => {
                  const remaining =
                    ev.capacity != null ? Math.max(ev.capacity - (ev.registrationsCount || 0), 0) : null;
                  return (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <Button onClick={() => navigate(`/events/${ev.slug || ev.id}`)}>
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
                        {formatEventDateRange(ev.startDate, ev.endDate)}
                      </TableCell>
                      <TableCell>
                        {ev.registrationsCount}/{ev.capacity ?? "—"}
                        {remaining != null && <div style={{ color: "var(--app-color-text-muted)" }}>{remaining} remaining</div>}
                      </TableCell>
                      <TableCell>{priceLabel(ev)}</TableCell>
                      <TableCell align="right">
                        <div
                          style={{
                            display: "flex",
                            gap: "var(--space-2xs)",
                            justifyContent: "flex-end",
                            paddingRight: "4px",
                          }}
                        >
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
                          {canDelete(ev) ? (
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(ev.id)}>
                              Delete
                            </Button>
                          ) : ev.status !== "CANCELLED" ? (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelClick(ev.id)}>
                              Cancel
                            </Button>
                          ) : (
                            <Tag variant="default" size="sm">
                              Cancelled
                            </Tag>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </TableCard>
        )}
      </Card>

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 50 }}>
          <div className="bg-white rounded-lg p-6 max-w-md" style={{ width: "90%", maxWidth: 420 }}>
            <h3 className="text-lg font-semibold mb-4">Delete Event</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this event? This action cannot be undone.</p>
            {deleteMutation.isError && (
              <div className="mb-4 p-3" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
                <p style={{ color: "#b91c1c", fontSize: 14 }}>
                  {(deleteMutation.error as any)?.response?.data?.error?.message || "Failed to delete event"}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting..." : "Delete Event"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 50 }}>
          <div className="bg-white rounded-lg p-6 max-w-md" style={{ width: "90%", maxWidth: 420 }}>
            <h3 className="text-lg font-semibold mb-4">Cancel Event</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this event? Existing registrations and invoices will remain intact, but no new
              registrations will be accepted.
            </p>
            {cancelMutation.isError && (
              <div className="mb-4 p-3" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8 }}>
                <p style={{ color: "#b91c1c", fontSize: 14 }}>
                  {(cancelMutation.error as any)?.response?.data?.error?.message || "Failed to cancel event"}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)} disabled={cancelMutation.isPending}>
                No, Keep Event
              </Button>
              <Button onClick={handleCancelConfirm} disabled={cancelMutation.isPending} variant="secondary">
                {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Event"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
};

export default AdminEventsDashboardPage;

