import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, bulkGenerateEventInvoices, generateRegistrationInvoice } from "../api/client";
import { formatCurrency } from "../utils/formatters";
import { useSession } from "../hooks/useSession";

interface AttendanceReport {
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
    priceCents: number | null;
    capacity: number | null;
    eventType: "IN_PERSON" | "ONLINE";
    registrationMode?: "RSVP" | "PAY_NOW";
    status: string;
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
  const [search, setSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "attended" | "not-attended">("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid" | "no-invoice">("all");

  const isPaidEvent = (priceCents: number | null | undefined): boolean => {
    return (priceCents || 0) > 0;
  };

  const buildQueryParams = (isPaid: boolean) => {
    const params = new URLSearchParams();
    if (attendanceFilter !== "all") params.set("attendanceStatus", attendanceFilter);
    if (isPaid && paymentFilter !== "all") {
      params.set("paymentStatus", paymentFilter);
    }
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["attendance", eventId, attendanceFilter, paymentFilter, search],
    enabled: !!eventId,
    queryFn: async () => {
      // Build query params (payment filter will be handled by backend for paid events)
      const params = new URLSearchParams();
      if (attendanceFilter !== "all") params.set("attendanceStatus", attendanceFilter);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      if (search.trim()) params.set("search", search.trim());
      const queryString = params.toString();
      
      const url = `${API_BASE_URL}/admin/events/${eventId}/attendance${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
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

  const { tokens } = useSession();
  const bulkGenerateInvoicesMutation = useMutation({
    mutationFn: async () => {
      if (!eventId || !tokens?.access_token) throw new Error("Missing event ID or token");
      return bulkGenerateEventInvoices(tokens.access_token, eventId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", eventId] });
      alert(`Created ${result.created} invoice(s), skipped ${result.skipped} registration(s).${result.errors && result.errors.length > 0 ? `\nErrors: ${result.errors.map((e: any) => e.error).join(", ")}` : ""}`);
    },
    onError: (error: any) => {
      alert(`Failed to generate invoices: ${error.message || error.error?.message || "Unknown error"}`);
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      if (!tokens?.access_token) throw new Error("Missing token");
      return generateRegistrationInvoice(tokens.access_token, registrationId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", eventId] });
      alert(`Invoice created: ${result.invoice.invoiceNumber}`);
    },
    onError: (error: any) => {
      const errorMsg = error.error?.message || error.message || "Unknown error";
      if (error.status === 409) {
        alert(`Invoice already exists: ${error.error?.invoiceNumber || "N/A"}`);
      } else {
        alert(`Failed to generate invoice: ${errorMsg}`);
      }
    },
  });

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(data?.attendees.map((a) => a.registrationId) || []));
  };

  const handleDeselectAll = () => setSelectedIds(new Set());

  const handleBulkMark = () => {
    if (selectedIds.size === 0) return;
    bulkMarkMutation.mutate(Array.from(selectedIds));
  };

  const handleExportCsv = () => {
    if (!eventId || !data) return;
    const isPaid = isPaidEvent(data.event.priceCents);
    const queryString = buildQueryParams(isPaid);
    const url = `${API_BASE_URL}/admin/events/${eventId}/attendance?${queryString}&format=csv`;
    window.open(url, "_blank");
  };

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

  const { event, summary } = data;
  const paidEvent = isPaidEvent(event.priceCents);
  const isRsvpEvent = event.registrationMode === "RSVP" || !event.registrationMode; // Default to RSVP if not specified
  const canGenerateInvoices = paidEvent && isRsvpEvent; // Only show invoice generation for paid RSVP events
  const isOnlineEvent = event.eventType === "ONLINE";
  const actionLabel = isOnlineEvent ? "Mark attended" : "Check in";
  const bulkActionLabel = isOnlineEvent ? "Mark as attended" : "Check in";
  const undoLabel = isOnlineEvent ? "Undo attendance" : "Undo check-in";

  // Count registrations without invoices (for bulk generation)
  const registrationsWithoutInvoices = data.attendees.filter((a) => !a.invoice).length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDateFull = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate("/admin/events")} className="text-blue-600 hover:text-blue-800 mb-4 text-sm font-medium">
            ← Back to Events
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Attendance Report</h1>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{event.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 font-medium text-gray-900">{isOnlineEvent ? "Online Event" : "In-Person Event"}</span>
            </div>
            <div>
              <span className="text-gray-500">When:</span>
              <span className="ml-2 font-medium text-gray-900">{formatDateFull(event.startsAt)}</span>
            </div>
            <div>
              <span className="text-gray-500">Location:</span>
              <span className="ml-2 font-medium text-gray-900">{event.location || "TBD"}</span>
            </div>
            {summary.capacity !== null && (
              <div>
                <span className="text-gray-500">Capacity:</span>
                <span className="ml-2 font-medium text-gray-900">{summary.capacity} seats</span>
              </div>
            )}
            <div>
              <span className="text-gray-500">Registrations:</span>
              <span className="ml-2 font-medium text-gray-900">{summary.totalRegistrations}</span>
            </div>
            <div>
              <span className="text-gray-500">Attended:</span>
              <span className="ml-2 font-medium text-gray-900">
                {summary.totalAttended} ({summary.attendanceRate}%)
              </span>
            </div>
            {paidEvent && (
              <>
                <div>
                  <span className="text-gray-500">Paid Invoices:</span>
                  <span className="ml-2 font-medium text-gray-900">{summary.paidInvoices ?? 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Unpaid Invoices:</span>
                  <span className="ml-2 font-medium text-gray-900">{summary.unpaidInvoices ?? 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Total Collected:</span>
                  <span className="ml-2 font-medium text-green-600">{formatCurrency((summary.totalCollectedCents || 0) / 100)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
            <div className="flex gap-2 flex-1 flex-wrap">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email..."
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full md:w-auto md:min-w-[240px]"
              />
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Registrations</option>
                <option value="attended">Attended</option>
                <option value="not-attended">Not Attended</option>
              </select>
              {paidEvent && (
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="all">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="no-invoice">No Invoice</option>
                </select>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSelectAllFiltered} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Select All Filtered
              </button>
              <button onClick={handleDeselectAll} className="text-sm text-gray-600 hover:text-gray-800 font-medium">
                Deselect All
              </button>
              <button
                onClick={handleExportCsv}
                className="text-sm text-gray-700 border border-gray-300 rounded px-3 py-2 hover:bg-gray-50 font-medium"
              >
                Export CSV
              </button>
              {canGenerateInvoices && registrationsWithoutInvoices > 0 && (
                <button
                  onClick={() => {
                    if (confirm(`Generate invoices for ${registrationsWithoutInvoices} registration(s) without invoices?`)) {
                      bulkGenerateInvoicesMutation.mutate();
                    }
                  }}
                  disabled={bulkGenerateInvoicesMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 font-medium text-sm"
                >
                  {bulkGenerateInvoicesMutation.isPending ? "Generating..." : `Generate Invoices (${registrationsWithoutInvoices})`}
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkMark}
                  disabled={bulkMarkMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 font-medium text-sm"
                >
                  {bulkMarkMutation.isPending ? "Processing..." : `${bulkActionLabel} ${selectedIds.size}`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Detail Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Select</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Registration</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Attendance</th>
                  {paidEvent && <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice</th>}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.attendees.length > 0 ? (
                  data.attendees.map((attendee) => (
                    <tr key={attendee.registrationId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(attendee.registrationId)}
                          onChange={() => handleToggleSelect(attendee.registrationId)}
                          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {attendee.member.firstName} {attendee.member.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{attendee.member.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Registered</div>
                        <div className="text-sm text-gray-500">{formatDate(attendee.registeredAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {attendee.checkedInAt ? (
                          <div>
                            <div className="text-sm font-medium text-green-600">✓ Attended</div>
                            <div className="text-sm text-gray-500">{formatDate(attendee.checkedInAt)}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">Not attended</div>
                        )}
                      </td>
                      {paidEvent && (
                        <td className="px-6 py-4">
                          {attendee.invoice ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">{attendee.invoice.invoiceNumber}</div>
                              <div className="text-sm">
                                <span className={attendee.invoice.status === "PAID" ? "text-green-600 font-medium" : "text-yellow-600 font-medium"}>
                                  {attendee.invoice.status}
                                </span>
                                {" · "}
                                {formatCurrency(attendee.invoice.amountCents / 100)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500">No invoice</div>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-2">
                          {attendee.checkedInAt ? (
                            <button
                              onClick={() => undoAttendanceMutation.mutate(attendee.registrationId)}
                              disabled={undoAttendanceMutation.isPending}
                              className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400 font-medium text-left"
                            >
                              {undoLabel}
                            </button>
                          ) : (
                            <button
                              onClick={() => markAttendanceMutation.mutate(attendee.registrationId)}
                              disabled={markAttendanceMutation.isPending}
                              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 font-medium text-left"
                            >
                              {actionLabel}
                            </button>
                          )}
                          {canGenerateInvoices && !attendee.invoice && (
                            <button
                              onClick={() => {
                                if (confirm(`Generate invoice for ${attendee.member.firstName} ${attendee.member.lastName}?`)) {
                                  generateInvoiceMutation.mutate(attendee.registrationId);
                                }
                              }}
                              disabled={generateInvoiceMutation.isPending}
                              className="text-sm text-indigo-600 hover:text-indigo-800 disabled:text-gray-400 font-medium text-left"
                            >
                              {generateInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={paidEvent ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                      {search || attendanceFilter !== "all" || paymentFilter !== "all" ? "No registrations match your filters." : "No registrations for this event yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminEventAttendanceReportPage;
