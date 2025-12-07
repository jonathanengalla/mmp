import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventCheckoutPage from "../pages/EventCheckoutPage";

vi.mock("../api/client", () => ({
  eventCheckout: vi.fn(),
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

const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={["/events/e1/checkout"]}>
      <Routes>
        <Route path="/events/:slugOrId/checkout" element={<EventCheckoutPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("EventCheckoutPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    navigateMock.mockReset();
  });

  it("renders RSVP confirmation without invoice", async () => {
    (api.eventCheckout as any).mockResolvedValue({
      event: {
        id: "e1",
        event_id: "e1",
        slug: "rsvp-event",
        title: "RSVP Event",
        status: "published",
        startDate: new Date().toISOString(),
        registrationMode: "rsvp",
        isRegistered: true,
      },
      invoice: null,
    });

    renderCheckout();

    expect(await screen.findByText(/RSVP confirmed/i)).toBeTruthy();
    expect(screen.getByText(/does not require payment/i)).toBeTruthy();
  });

  it("shows invoice details for pay-now event", async () => {
    (api.eventCheckout as any).mockResolvedValue({
      event: {
        id: "e2",
        event_id: "e2",
        slug: "pay-event",
        title: "Pay Event",
        status: "published",
        startDate: new Date().toISOString(),
        registrationMode: "pay_now",
        priceCents: 5000,
        currency: "PHP",
        isRegistered: true,
      },
      invoice: {
        id: "inv-1",
        memberId: "m1",
        amountCents: 5000,
        currency: "PHP",
        status: "unpaid",
        description: "Event: Pay Event",
        eventId: "e2",
        eventTitle: "Pay Event",
        dueDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });

    renderCheckout();

    expect(await screen.findByText(/Invoice ID: inv-1/i)).toBeTruthy();
    expect(screen.getAllByText(/Pay Event/i).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByText(/Go to Invoices/i));
    expect(navigateMock).toHaveBeenCalledWith("/invoices");
  });
});


