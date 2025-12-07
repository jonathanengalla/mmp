import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import AdminEmailLogPage from "../pages/AdminEmailLogPage";

vi.mock("../api/client", () => ({
  fetchDevEmailLog: vi.fn(),
}));

vi.mock("../hooks/useSession", () => ({
  useSession: () => ({
    tokens: { access_token: "t" },
    hasRole: () => true,
  }),
}));

const api = await import("../api/client");

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/dev/email-log"]}>
      <Routes>
        <Route path="/admin/dev/email-log" element={<AdminEmailLogPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("AdminEmailLogPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders email log with rows", async () => {
    (api.fetchDevEmailLog as any).mockResolvedValue([
      {
        id: "m1",
        to: "user@example.com",
        subject: "Test email",
        template: "dues_invoice_created",
        payload: { foo: "bar" },
        createdAt: new Date().toISOString(),
      },
      {
        id: "m2",
        to: "user2@example.com",
        subject: "Event email",
        template: "event_invoice_created",
        payload: { event: "E1" },
        createdAt: new Date().toISOString(),
      },
    ]);

    renderPage();

    expect(await screen.findByText(/Email Log/i)).toBeTruthy();
    expect(screen.getByText("Test email")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
    expect(screen.getAllByText(/View JSON/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Subject/i)).toBeTruthy();
    expect(screen.getByText(/Sent At/i)).toBeTruthy();
  });

  it("shows empty state", async () => {
    (api.fetchDevEmailLog as any).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No emails logged yet/i)).toBeTruthy();
  });

  it("shows error and retry", async () => {
    const mock = api.fetchDevEmailLog as any;
    mock.mockRejectedValueOnce(new Error("boom"));
    mock.mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText(/Failed to load email log/i)).toBeTruthy();
    const retry = screen.getByText(/Retry/i);
    await retry.click();
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2));
  });
});


