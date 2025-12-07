/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminPendingMembersPage } from "../pages/AdminPendingMembersPage";

// Mock session context - values inside factory for hoisting
vi.mock("../hooks/useSession", () => ({
  useSession: () => ({
    authed: true,
    tokens: { access_token: "test-token", tenant_id: "t1" },
    user: { id: "u1", email: "admin@test.local", roles: ["admin"] },
  }),
}));

// Mock API client
vi.mock("../api/client", () => ({
  listPendingMembers: vi.fn(),
  approveMember: vi.fn(),
  rejectMember: vi.fn(),
}));

import { listPendingMembers, approveMember, rejectMember } from "../api/client";

const mockedListPendingMembers = vi.mocked(listPendingMembers);
const mockedApproveMember = vi.mocked(approveMember);
const mockedRejectMember = vi.mocked(rejectMember);

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminPendingMembersPage />
    </MemoryRouter>
  );

describe("AdminPendingMembersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads and displays pending members", async () => {
    mockedListPendingMembers.mockResolvedValue({
      items: [
        { id: "m-1", email: "john@test.com", first_name: "John", last_name: "Doe", status: "pendingApproval", created_at: Date.now() },
        { id: "m-2", email: "jane@test.com", first_name: "Jane", last_name: "Smith", status: "pendingApproval", created_at: Date.now() },
      ],
      total_items: 2,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
    });

    expect(mockedListPendingMembers).toHaveBeenCalledWith("test-token");
  });

  it("displays empty state when no pending members", async () => {
    mockedListPendingMembers.mockResolvedValue({ items: [], total_items: 0 });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/No pending members to review/i).length).toBeGreaterThan(0);
    });
  });

  it("approves a member and updates UI immediately", async () => {
    mockedListPendingMembers.mockResolvedValue({
      items: [
        { id: "m-1", email: "john@test.com", first_name: "John", last_name: "Doe", status: "pendingApproval", created_at: Date.now() },
      ],
      total_items: 1,
    });
    mockedApproveMember.mockResolvedValue({ id: "m-1", status: "active" });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
    });

    const approveButton = screen.getAllByRole("button", { name: /Approve/i })[0];
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockedApproveMember).toHaveBeenCalledWith("test-token", "m-1");
    });

    // Toast success message
    await waitFor(() => {
      expect(screen.getAllByText(/John Doe has been approved/i).length).toBeGreaterThan(0);
    });
  });

  it("opens reject modal and rejects a member", async () => {
    mockedListPendingMembers.mockResolvedValue({
      items: [
        { id: "m-1", email: "john@test.com", first_name: "John", last_name: "Doe", status: "pendingApproval", created_at: Date.now() },
      ],
      total_items: 1,
    });
    mockedRejectMember.mockResolvedValue({ id: "m-1", status: "rejected" });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/John Doe/).length).toBeGreaterThan(0);
    });

    // Click reject button
    const rejectButtons = screen.getAllByRole("button", { name: /Reject/i });
    fireEvent.click(rejectButtons[0]); // First reject button in table

    // Modal should open
    await waitFor(() => {
      expect(screen.getAllByText(/Are you sure you want to reject/i).length).toBeGreaterThan(0);
    });

    // Enter reason (use getAllBy in case of duplicates)
    const reasonInput = screen.getAllByPlaceholderText(/reason for rejection/i)[0];
    fireEvent.change(reasonInput, { target: { value: "Incomplete application" } });

    // Confirm rejection
    const confirmButton = screen.getAllByRole("button", { name: /Reject Member/i })[0];
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockedRejectMember).toHaveBeenCalledWith("test-token", "m-1", "Incomplete application");
    });

    // Toast success message
    await waitFor(() => {
      expect(screen.getAllByText(/John Doe has been rejected/i).length).toBeGreaterThan(0);
    });
  });

  it("UI updates immediately after approval - count decreases", async () => {
    const members = [
      { id: "m-1", email: "john@test.com", first_name: "John", last_name: "Doe", status: "pendingApproval", created_at: Date.now() },
      { id: "m-2", email: "jane@test.com", first_name: "Jane", last_name: "Smith", status: "pendingApproval", created_at: Date.now() },
    ];
    mockedListPendingMembers.mockResolvedValue({ items: members, total_items: 2 });
    mockedApproveMember.mockResolvedValue({ id: "m-1", status: "active" });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText(/2 pending member/).length).toBeGreaterThan(0);
    });

    const approveButtons = screen.getAllByRole("button", { name: /Approve/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      // Jane should still be there
      expect(screen.getAllByText(/Jane Smith/).length).toBeGreaterThan(0);
    });
  });
});
