import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import InvoicesPage from "../pages/InvoicesPage";

vi.mock("../api/client", () => ({
  listMyInvoices: vi.fn(),
  listTenantInvoices: vi.fn(),
  recordInvoicePayment: vi.fn(),
}));

vi.mock("../hooks/useSession", () => ({
  useSession: () => ({
    tokens: { access_token: "t" },
    hasRole: () => true,
  }),
}));

const api = await import("../api/client");

describe("InvoicesPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (api.listMyInvoices as any).mockResolvedValue({
      items: [
        {
          id: "inv-1",
          memberId: "m1",
          amountCents: 2500,
          currency: "PHP",
          status: "unpaid",
          description: "Event: Gala",
          eventId: "e1",
          eventTitle: "Gala Night",
          source: "event",
          dueDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    (api.listTenantInvoices as any).mockResolvedValue({
      items: [
        {
          id: "inv-1",
          memberId: "m1",
          amountCents: 2500,
          currency: "PHP",
          status: "unpaid",
          description: "Event: Gala",
          eventId: "e1",
          eventTitle: "Gala Night",
          source: "event",
          dueDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
  });

  it("renders event context for invoices and shows record payment action", async () => {
    render(
      <MemoryRouter>
        <InvoicesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Gala Night/)).toBeTruthy();
    expect(screen.getByText(/View event/)).toBeTruthy();
    expect(screen.getByText(/Record payment/)).toBeTruthy();
  });
});


