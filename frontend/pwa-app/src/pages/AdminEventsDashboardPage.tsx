import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Page } from "../components/primitives/Page";
import { Card } from "../components/primitives/Card";
import { Button } from "../components/primitives/Button";
import { useSession } from "../hooks/useSession";
import { API_BASE_URL } from "../api/client";
import { formatCurrency, formatEventDateRange, getEventStateLabels } from "../utils/eventHelpers";

type AdminEvent = {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  startsAt?: string;
  endsAt?: string;
  startDate?: string;
  endDate?: string | null;
  capacity?: number | null;
  priceCents?: number | null;
  registrationsCount?: number;
  invoicesCount?: number;
  revenueCents?: number | null;
  revenue?: number | null;
};

const fetchAdminEvents = async (token?: string, tenantId?: string): Promise<{ events: AdminEvent[] }> => {
  if (!token) return { events: [] };
  const res = await fetch(`${API_BASE_URL}/admin/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Failed to load events");
  }
  return res.json();
};

export const AdminEventsDashboardPage: React.FC = () => {
  const { tokens } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [eventToCancel, setEventToCancel] = useState<string | null>(null);

  const adminEventsQuery = useQuery({
    queryKey: ["admin-events", tokens?.access_token],
    enabled: !!tokens?.access_token,
    queryFn: () => fetchAdminEvents(tokens?.access_token, tokens?.tenant_id),
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokens?.access_token || ""}`,
          ...(tokens?.tenant_id ? { "X-Tenant-Id": tokens.tenant_id } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          body?.error?.message ||
          "This event already has registrations or invoices, so it can't be deleted. Please cancel it instead.";
        throw new Error(message);
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      setDeleteModalOpen(false);
      setEventToDelete(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens?.access_token || ""}`,
          ...(tokens?.tenant_id ? { "X-Tenant-Id": tokens.tenant_id } : {}),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Failed to cancel event");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      setCancelModalOpen(false);
      setEventToCancel(null);
    },
  });

  const events: AdminEvent[] = useMemo(() => adminEventsQuery.data?.events || [], [adminEventsQuery.data]);

  const handleDeleteClick = (eventId: string) => {
    setEventToDelete(eventId);
    setDeleteModalOpen(true);
  };

  const handleCancelClick = (eventId: string) => {
    setEventToCancel(eventId);
    setCancelModalOpen(true);
  };

  const isLoading = adminEventsQuery.isLoading;
  const error = adminEventsQuery.error as Error | undefined;

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
      <div className="px-6 py-6 max-w-screen-xl mx-auto">
        <Card>
          {error && <div className="text-red-600 mb-4">{error.message}</div>}
          {isLoading && <div>Loading events...</div>}
          {!isLoading && events.length === 0 && <div>No events found.</div>}

          {!isLoading && events.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left w-[30%]">Title</th>
                    <th className="px-4 py-3 text-left w-[20%]">When</th>
                  <th className="px-4 py-3 text-left w-[12%]">Capacity</th>
                  <th className="px-4 py-3 text-right w-[10%]">Price</th>
                  <th className="px-4 py-3 text-right w-[10%]">Revenue</th>
                  <th className="px-4 py-3 text-right w-[16%] whitespace-nowrap min-w-[220px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => {
                    const startsAt = ev.startsAt || ev.startDate || "";
                    const endsAt = ev.endsAt || ev.endDate || startsAt;
                    const labels = getEventStateLabels({
                      status: ev.status || undefined,
                      startsAt,
                      endsAt,
                      priceCents: ev.priceCents ?? 0,
                      capacity: ev.capacity ?? null,
                      registrations: ev.registrationsCount ?? 0,
                    });
                    const isDeletable = (ev.registrationsCount || 0) === 0 && (ev.invoicesCount || 0) === 0;
                    const priceValue = ev.priceCents != null ? formatCurrency((ev.priceCents || 0) / 100) : "Free";
                    const revenueValue =
                      ev.revenueCents != null
                        ? formatCurrency((ev.revenueCents || 0) / 100)
                        : ev.revenue != null
                        ? formatCurrency(ev.revenue || 0)
                        : "—";

                    return (
                      <tr key={ev.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium truncate mb-1" title={ev.title}>
                            {ev.title}
                          </div>
                          <div className="flex gap-2">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs rounded ${
                                labels.eventStatusLabel === "Upcoming"
                                  ? "bg-blue-100 text-blue-800"
                                  : labels.eventStatusLabel === "Past event"
                                  ? "bg-gray-100 text-gray-800"
                                  : labels.eventStatusLabel === "Cancelled"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {labels.eventStatusLabel}
                            </span>
                            <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
                              {labels.modeLabel}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm align-top">{formatEventDateRange(startsAt, endsAt)}</td>

                        <td className="px-4 py-3 text-sm align-top">
                          <span
                            className={
                              labels.capacityLabel.startsWith("Over capacity") ? "text-red-600 font-medium" : undefined
                            }
                          >
                            {labels.capacityLabel}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right text-sm align-top">{priceValue}</td>

                        <td className="px-4 py-3 text-right text-sm font-medium align-top">{revenueValue}</td>

                        <td className="px-4 py-3 text-right align-top whitespace-nowrap min-w-[220px]">
                          <div className="flex flex-nowrap gap-1 justify-end items-center">
                            <button
                              title="Edit"
                              aria-label="Edit"
                              className="h-8 w-8 shrink-0 rounded-full border border-gray-200 bg-white text-blue-600 hover:bg-blue-50 inline-flex items-center justify-center"
                              onClick={() => navigate(`/admin/events/${ev.id}/edit`)}
                            >
                              <span aria-hidden>✏️</span>
                            </button>
                            <button
                              title="Attendance"
                              aria-label="Attendance"
                              className="h-8 w-8 shrink-0 rounded-full border border-gray-200 bg-white text-blue-600 hover:bg-blue-50 inline-flex items-center justify-center"
                              onClick={() => navigate(`/admin/events/${ev.id}/attendance`)}
                            >
                              <span aria-hidden>📋</span>
                            </button>
                            <button
                              title="View"
                              aria-label="View"
                              className="h-8 w-8 shrink-0 rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 inline-flex items-center justify-center"
                              onClick={() => navigate(`/events/${ev.slug || ev.id}`)}
                            >
                              <span aria-hidden>👁️</span>
                            </button>
                            {isDeletable ? (
                              <button
                                onClick={() => handleDeleteClick(ev.id)}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Delete
                              </button>
                            ) : ev.status !== "CANCELLED" ? (
                              <button
                                title="Cancel event"
                                aria-label="Cancel event"
                                onClick={() => handleCancelClick(ev.id)}
                                className="h-8 w-8 rounded-full border border-gray-200 bg-white text-orange-600 hover:bg-orange-50 flex items-center justify-center"
                              >
                                <span aria-hidden>⛔</span>
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">Cancelled</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-[90%]">
            <h3 className="text-lg font-semibold mb-4">Delete Event</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this event? This action cannot be undone.</p>
            {deleteMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm font-medium">{deleteMutation.error?.message || "Failed to delete event"}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => eventToDelete && deleteMutation.mutate(eventToDelete)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Deleting..." : "Delete Event"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-[90%]">
            <h3 className="text-lg font-semibold mb-4">Cancel Event</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to cancel this event? Existing registrations and invoices will remain intact, but no new
              registrations will be accepted.
            </p>
            {cancelMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-600 text-sm font-medium">{cancelMutation.error?.message || "Failed to cancel event"}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setCancelModalOpen(false)} disabled={cancelMutation.isPending}>
                No, Keep Event
              </Button>
              <Button
                onClick={() => eventToCancel && cancelMutation.mutate(eventToCancel)}
                disabled={cancelMutation.isPending}
                variant="secondary"
              >
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

