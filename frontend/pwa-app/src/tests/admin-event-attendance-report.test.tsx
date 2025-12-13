import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminEventAttendanceReportPage } from "../pages/AdminEventAttendanceReportPage";

// Mock fetch
const mockFetch = vi.fn((url: string | Request | URL, init?: RequestInit) => {
  return Promise.resolve({
    ok: true,
    json: async () => ({ data: createMockAttendanceReport() }),
  } as Response);
});
global.fetch = mockFetch as any;

// Mock useNavigate
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual: any = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ eventId: "ev1" }),
  };
});

// Mock useSession
vi.mock("../hooks/useSession", () => ({
  useSession: () => ({ tokens: { access_token: "token" } }),
}));

const createMockAttendanceReport = (overrides: any = {}) => ({
  event: {
    id: "ev1",
    title: "Test Event",
    startsAt: "2025-02-01T10:00:00Z",
    endsAt: "2025-02-01T12:00:00Z",
    location: "Test Venue",
    priceCents: 0,
    capacity: 100,
    eventType: "IN_PERSON",
    status: "PUBLISHED",
    ...overrides.event,
  },
  summary: {
    capacity: 100,
    totalRegistrations: 2,
    totalAttended: 1,
    attendanceRate: 50,
    ...overrides.summary,
  },
  attendees: [
    {
      registrationId: "reg1",
      member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
      registeredAt: "2025-01-01T10:00:00Z",
      checkedInAt: "2025-01-02T10:00:00Z",
      invoice: null,
    },
    {
      registrationId: "reg2",
      member: { id: "m2", firstName: "Jane", lastName: "Smith", email: "jane@example.com" },
      registeredAt: "2025-01-03T10:00:00Z",
      checkedInAt: null,
      invoice: null,
    },
    ...(overrides.attendees || []),
  ],
});

const renderWithQuery = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/events/ev1/attendance"]}>
        <Routes>
          <Route path="/admin/events/:eventId/attendance" element={component} />
          <Route path="/admin/events" element={<div data-testid="events-list" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("AdminEventAttendanceReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string | Request | URL) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      // Return default mock data
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: createMockAttendanceReport() }),
      } as Response);
    });
  });

  // ============================================================================
  // Event Type Labels
  // ============================================================================

  it("renders 'Check in' labels for IN_PERSON events", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: createMockAttendanceReport({
            event: { eventType: "IN_PERSON" },
            attendees: [
              {
                registrationId: "reg1",
                member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
                registeredAt: "2025-01-01T10:00:00Z",
                checkedInAt: null,
                invoice: null,
              },
            ],
          }),
        }),
      } as Response);
    });

    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Check in")).toBeTruthy();
    }, { timeout: 5000 });
  });

  it("renders 'Mark attended' labels for ONLINE events", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: createMockAttendanceReport({
            event: { eventType: "ONLINE" },
            attendees: [
              {
                registrationId: "reg1",
                member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
                registeredAt: "2025-01-01T10:00:00Z",
                checkedInAt: null,
                invoice: null,
              },
            ],
          }),
        }),
      } as Response);
    });

    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Mark attended")).toBeTruthy();
    }, { timeout: 5000 });
  });

  // ============================================================================
  // Free vs Paid Visual Behavior
  // ============================================================================

  it("hides payment filter for free events", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: createMockAttendanceReport({
            event: { priceCents: 0 },
          }),
        }),
      } as Response);
    });

    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Event")).toBeTruthy();
    }, { timeout: 5000 });

    expect(screen.queryByText("All Payments")).toBeNull();
  });

  it("shows invoice columns and payment filter for paid events", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: createMockAttendanceReport({
            event: { priceCents: 5000 },
            summary: {
              capacity: 100,
              totalRegistrations: 1,
              totalAttended: 0,
              attendanceRate: 0,
              paidInvoices: 1,
              unpaidInvoices: 0,
              totalCollectedCents: 5000,
            },
            attendees: [
              {
                registrationId: "reg1",
                member: { id: "m1", firstName: "John", lastName: "Doe", email: "john@example.com" },
                registeredAt: "2025-01-01T10:00:00Z",
                checkedInAt: null,
                invoice: {
                  id: "inv1",
                  invoiceNumber: "RCME-2025-EVT-001",
                  amountCents: 5000,
                  status: "PAID",
                },
              },
            ],
          }),
        }),
      } as Response);
    });

    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Invoice")).toBeTruthy();
      expect(screen.getByText("All Payments")).toBeTruthy();
    }, { timeout: 5000 });
  });

  // ============================================================================
  // Filtering and Search UX
  // ============================================================================

  it("renders filter controls", async () => {
    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Select All Filtered")).toBeTruthy();
      expect(screen.getByPlaceholderText("Search name or email...")).toBeTruthy();
      expect(screen.getByText("Export CSV")).toBeTruthy();
    }, { timeout: 5000 });
  });

  it("updates filter select value when changed", async () => {
    const user = userEvent.setup();

    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("All Registrations")).toBeTruthy();
    }, { timeout: 5000 });

    const filterSelect = screen.getByDisplayValue("All Registrations");
    await user.selectOptions(filterSelect, "attended");

    expect(filterSelect).toHaveValue("attended");
  });

  // ============================================================================
  // Summary Display
  // ============================================================================

  it("displays event summary information", async () => {
    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Event")).toBeTruthy();
      expect(screen.getByText("Registrations:")).toBeTruthy();
      expect(screen.getByText("Attended:")).toBeTruthy();
    }, { timeout: 5000 });
  });

  it("displays invoice metrics only for paid events", async () => {
    mockFetch.mockImplementation(() => {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: createMockAttendanceReport({
            event: { priceCents: 5000 },
            summary: {
              capacity: 100,
              totalRegistrations: 2,
              totalAttended: 1,
              attendanceRate: 50,
              paidInvoices: 1,
              unpaidInvoices: 1,
              totalCollectedCents: 5000,
            },
          }),
        }),
      } as Response);
    });

    renderWithQuery(<AdminEventAttendanceReportPage />);

    await waitFor(() => {
      expect(screen.getByText("Paid Invoices:")).toBeTruthy();
      expect(screen.getByText("Unpaid Invoices:")).toBeTruthy();
      expect(screen.getByText("Total Collected:")).toBeTruthy();
    }, { timeout: 5000 });
  });
});
