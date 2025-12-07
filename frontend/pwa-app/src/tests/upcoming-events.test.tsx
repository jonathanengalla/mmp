import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UpcomingEventsPage } from "../pages/UpcomingEventsPage";

vi.mock("../api/client", () => ({
  listUpcomingEvents: vi.fn(),
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

const renderUpcoming = () =>
  render(
    <MemoryRouter initialEntries={["/events/upcoming"]}>
      <Routes>
        <Route path="/events/upcoming" element={<UpcomingEventsPage />} />
        <Route path="/events/:slugOrId" element={<div data-testid="detail-route" />} />
      </Routes>
    </MemoryRouter>
  );

describe("UpcomingEventsPage registration hints", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows registration mode badges and routes to detail", async () => {
    (api.listUpcomingEvents as any).mockResolvedValue([
      {
        event_id: "e1",
        slug: "rsvp-event",
        title: "RSVP Event",
        startDate: new Date().toISOString(),
        endDate: null,
        registrationsCount: 0,
        priceCents: null,
        currency: "PHP",
        status: "published",
        registrationMode: "rsvp",
        isRegistered: false,
        tags: ["service"],
      },
      {
        event_id: "e2",
        slug: "pay-event",
        title: "Pay Event",
        startDate: new Date().toISOString(),
        endDate: null,
        registrationsCount: 0,
        priceCents: 5000,
        currency: "PHP",
        status: "published",
        registrationMode: "pay_now",
        isRegistered: false,
        tags: ["fundraiser"],
      },
    ]);

    renderUpcoming();

    expect(await screen.findByText("RSVP Event")).toBeTruthy();
    expect(screen.getAllByText(/Invoice required/i)[0]).toBeTruthy();
    expect(screen.getAllByText(/RSVP/i)[0]).toBeTruthy();

    const primaryButtons = screen.getAllByRole("button", { name: /Register/i });
    await userEvent.click(primaryButtons[0]);
    expect(navigateMock).toHaveBeenCalledWith("/events/pay-event/checkout");
  });
});

