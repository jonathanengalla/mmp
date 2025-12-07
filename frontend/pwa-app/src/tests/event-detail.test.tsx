import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { EventDetailPage } from "../pages/EventDetailPage";

vi.mock("../api/client", () => ({
  getEventDetail: vi.fn(),
  registerForEvent: vi.fn(),
  cancelEventRegistration: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual: any = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../hooks/useSession", () => ({
  useSession: () => ({ tokens: { access_token: "t" } }),
}));

const api = await import("../api/client");

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={["/events/sample-slug"]}>
      <Routes>
        <Route path="/events/:slugOrId" element={<EventDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("EventDetailPage RSVP vs Pay-now", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    navigateMock.mockReset();
  });

  it("shows RSVP messaging for rsvp events and registered state", async () => {
    (api.getEventDetail as any).mockResolvedValue({
      id: "e1",
      event_id: "e1",
      slug: "sample-slug",
      title: "RSVP Event",
      description: "Desc",
      status: "published",
      startDate: new Date().toISOString(),
      endDate: null,
      location: "HQ",
      capacity: 10,
      registrationsCount: 1,
      priceCents: 1000,
      currency: "PHP",
      registrationMode: "rsvp",
      isRegistered: true,
      registrationStatus: "registered",
      ticketCode: "EVT-1",
      paymentStatus: "unpaid",
      tags: ["rsvp"],
    });

    renderDetail();

    expect(await screen.findByText("RSVP")).toBeTruthy();
    expect(screen.getByText(/You’re registered/i)).toBeTruthy();
    expect(screen.getAllByText(/Ticket code/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Payment: Unpaid/i)).toBeTruthy();
  });

  it("shows pay-now messaging and helper text", async () => {
    (api.getEventDetail as any).mockResolvedValue({
      id: "e2",
      event_id: "e2",
      slug: "pay-now",
      title: "Pay Now Event",
      description: "Desc",
      status: "published",
      startDate: new Date().toISOString(),
      endDate: null,
      location: "HQ",
      capacity: 10,
      registrationsCount: 0,
      priceCents: 2000,
      currency: "PHP",
      registrationMode: "pay_now",
      isRegistered: false,
      registrationStatus: null,
      ticketCode: null,
      paymentStatus: null,
      tags: ["paid"],
    });

    renderDetail();

    expect(await screen.findByText("Register (invoice will be created)")).toBeTruthy();
    expect(screen.getByText(/invoice you can pay before the event/i)).toBeTruthy();
  });

  it("pay-now register button navigates to checkout", async () => {
    (api.getEventDetail as any).mockResolvedValue({
      id: "e3",
      event_id: "e3",
      slug: "pay-now",
      title: "Pay Now Event",
      description: "Desc",
      status: "published",
      startDate: new Date().toISOString(),
      endDate: null,
      location: "HQ",
      capacity: 10,
      registrationsCount: 0,
      priceCents: 2000,
      currency: "PHP",
      registrationMode: "pay_now",
      isRegistered: false,
      registrationStatus: null,
      ticketCode: null,
      paymentStatus: null,
      tags: ["paid"],
    });

    renderDetail();
    const btn = await screen.findByText("Register (invoice will be created)");
    await userEvent.click(btn);
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/events/pay-now/checkout"));
  });
});

