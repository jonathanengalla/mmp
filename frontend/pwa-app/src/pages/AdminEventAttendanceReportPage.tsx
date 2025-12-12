import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../api/client";
import { formatCurrency } from "../utils/formatters";

interface AttendanceReport {
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string;
    priceCents: number;
    capacity: number | null;
    eventType: "IN_PERSON" | "ONLINE";
  };
  summary: {
    capacity: number | null;
    totalRegistrations: number;
    totalAttended: number;
    attendanceRate: number;
    paidInvoices?: number;
    unpaidInvoices?: number;
    totalCollectedCents?: number;
  };
  attendees: Array<{
    registrationId: string;
    member: { id: string; firstName: string; lastName: string; email: string };
    registeredAt: string;
    checkedInAt: string | null;
    invoice: { id: string; invoiceNumber: string; amountCents: number; status: string } | null;
  }>;
}

export const AdminEventAttendanceReportPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ["attendance", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}/attendance`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load attendance report");
      const body = await res.json();
      return body.data as AttendanceReport;
    },
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const res = await fetch(`${API_BASE_URL}/admin/attendance/${registrationId}/mark`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark attendance");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance", eventId] }),
  });

  const undoAttendanceMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const res = await fetch(`${API_BASE_URL}/admin/attendance/${registrationId}/undo`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to undo attendance");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance", eventId] }),
  });

  const bulkMarkMutation = useMutation({
    mutationFn: async (registrationIds: string[]) => {
      const res = await fetch(`${API_BASE_URL}/admin/attendance/bulk-mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ registrationIds }),
      });
      if (!res.ok) throw new Error("Failed to bulk mark attendance");
    },
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["attendance", eventId] });
    },
  });

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };
  const handleSelectAll = () => data && setSelectedIds(new Set(data.attendees.map((a) => a.registrationId)));
  const handleDeselectAll = () => setSelectedIds(new Set());
  const handleBulkMark = () => selectedIds.size > 0 && bulkMarkMutation.mutate(Array.from(selectedIds));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-center py-12">Loading attendance report...</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-center py-12 text-red-600">Failed to load attendance report</div>
      </div>
    );
  }

  const { event, summary, attendees } = data;
  const isPaidEvent = (event.priceCents || 0) > 0;
  const isOnlineEvent = event.eventType === "ONLINE";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button onClick={() => navigate("/admin/events")} className="text-blue-600 hover:text-blue-800 mb-4">
            ← Back to Events
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Report</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{event.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 font-medium">{isOnlineEvent ? "Online Event" : "In-Person Event"}</span>
            </div>
            <div>
              <span className="text-gray-500">When:</span>
              <span className="ml-2 font-medium">
                {new Date(event.startsAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Location:</span>
              <span className="ml-2 font-medium">{event.location || "TBD"}</span>
            </div>
            {summary.capacity !== null && (
              <div>
                <span className="text-gray-500">Capacity:</span>
                <span className="ml-2 font-medium">{summary.capacity} seats</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Registrations:</span>
              <span className="ml-2 font-medium">{summary.totalRegistrations}</span>
            </div>
            <div>
              <span className="text-gray-500">Attended:</span>
              <span className="ml-2 font-medium">
                {summary.totalAttended} ({summary.attendanceRate}%)
              </span>
            </div>
            {isPaidEvent && (
              <>
                <div>
                  <span className="text-gray-500">Paid Invoices:</span>
                  <span className="ml-2 font-medium">{summary.paidInvoices ?? 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unpaid Invoices:</span>
                  <span className="ml-2 font-medium">{summary.unpaidInvoices ?? 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Collected:</span>
                  <span className="ml-2 font-medium text-green-600">{formatCurrency(summary.totalCollectedCents || 0)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center gap-4">
            <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-800">
              Select All
            </button>
            <button onClick={handleDeselectAll} className="text-sm text-gray-600 hover:text-gray-800">
              Deselect All
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkMark}
                disabled={bulkMarkMutation.isPending}
                className="ml-auto px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {bulkMarkMutation.isPending ? "Marking..." : `Mark ${selectedIds.size} as Attended`}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Select</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attendance</th>
                  {isPaidEvent && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendees.map((attendee) => (
                  <tr key={attendee.registrationId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(attendee.registrationId)}
                        onChange={() => handleToggleSelect(attendee.registrationId)}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {attendee.member.firstName} {attendee.member.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{attendee.member.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">Registered</div>
                      <div className="text-sm text-gray-500">
                        {new Date(attendee.registeredAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {attendee.checkedInAt ? (
                        <div>
                          <div className="text-sm font-medium text-green-600">✓ Attended</div>
                          <div className="text-sm text-gray-500">
                            {new Date(attendee.checkedInAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">Not attended</div>
                      )}
                    </td>
                    {isPaidEvent && (
                      <td className="px-6 py-4">
                        {attendee.invoice ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{attendee.invoice.invoiceNumber}</div>
                            <div className="text-sm">
                              <span className={attendee.invoice.status === "PAID" ? "text-green-600" : "text-yellow-600"}>
                                {attendee.invoice.status}
                              </span>
                              {" - "}
                              {formatCurrency(attendee.invoice.amountCents)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No invoice</div>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      {attendee.checkedInAt ? (
                        <button
                          onClick={() => undoAttendanceMutation.mutate(attendee.registrationId)}
                          disabled={undoAttendanceMutation.isPending}
                          className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => markAttendanceMutation.mutate(attendee.registrationId)}
                          disabled={markAttendanceMutation.isPending}
                          className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                        >
                          {isOnlineEvent ? "Mark attended" : "Check in"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {attendees.length === 0 && <div className="text-center py-12 text-gray-500">No registrations for this event yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default AdminEventAttendanceReportPage;

