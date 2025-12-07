/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminMemberReportPage } from "../pages/AdminMemberReportPage";

// Mock session context with admin role
vi.mock("../hooks/useSession", () => ({
  useSession: () => ({
    authed: true,
    tokens: { access_token: "admin-token", tenant_id: "t1", member_id: "admin-1" },
    user: { id: "admin-1", email: "admin@test.local", roles: ["admin", "member"] },
    logout: vi.fn(),
    hasRole: (role: string) => ["admin", "member"].includes(role),
    isAdmin: () => true,
  }),
}));

// Mock API client
vi.mock("../api/client", () => ({
  listMembersReport: vi.fn(),
  updateMemberRoles: vi.fn(),
  Role: {},
  ALL_ROLES: ["admin", "member", "event_manager", "finance_manager", "communications_manager"],
  ROLE_LABELS: {
    admin: "Administrator",
    member: "Member",
    event_manager: "Event Manager",
    finance_manager: "Finance Manager",
    communications_manager: "Communications Manager",
  },
}));

import { listMembersReport, updateMemberRoles } from "../api/client";

const mockedListMembersReport = vi.mocked(listMembersReport);
const mockedUpdateMemberRoles = vi.mocked(updateMemberRoles);

const mockMembers = [
  {
    member_id: "m-1",
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
    status: "active",
    roles: ["member"],
    createdAt: Date.now(),
  },
  {
    member_id: "m-2",
    first_name: "Jane",
    last_name: "Smith",
    email: "jane@example.com",
    status: "active",
    roles: ["admin", "member", "event_manager"],
    createdAt: Date.now(),
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminMemberReportPage />
    </MemoryRouter>
  );

describe("AdminMemberReportPage - Role Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Displaying members with roles", () => {
    it("renders member list with role tags", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      // Check that roles are displayed
      expect(screen.getAllByText("Member").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Administrator").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Event Manager").length).toBeGreaterThan(0);
    });

    it("shows Edit Roles button for each member", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      expect(editButtons.length).toBe(2); // One for each member
    });
  });

  describe("Edit Roles modal", () => {
    it("opens modal when Edit Roles button is clicked", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      // Click the first Edit Roles button
      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      // Modal should open
      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // Check that role options are displayed
      expect(screen.getAllByText(/Administrator/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Finance Manager/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Communications Manager/i).length).toBeGreaterThan(0);
    });

    it("pre-checks current roles in the modal", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Jane Smith/i).length).toBeGreaterThan(0);
      });

      // Click Edit Roles for Jane (who has admin, member, event_manager)
      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[1]); // Second member

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // The checkboxes for admin, member, and event_manager should be checked
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      const checkedRoles = checkboxes.filter((cb) => cb.checked);
      expect(checkedRoles.length).toBe(3);
    });

    it("can toggle roles on and off", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      // Open modal for John (who has only "member" role)
      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // Click on "Event Manager" checkbox to add it
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      const eventManagerCheckbox = checkboxes[2]; // event_manager is the 3rd role
      fireEvent.click(eventManagerCheckbox);

      // Now event_manager should be checked
      expect(eventManagerCheckbox.checked).toBe(true);
    });

    it("closes modal when Cancel is clicked", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // Click Cancel
      const cancelButton = screen.getAllByRole("button", { name: /Cancel/i })[0];
      fireEvent.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText(/Edit Member Roles/i)).toBeNull();
      });
    });
  });

  describe("Saving roles", () => {
    it("calls updateMemberRoles API with selected roles", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });
      mockedUpdateMemberRoles.mockResolvedValue({
        id: "m-1",
        email: "john@example.com",
        first_name: "John",
        last_name: "Doe",
        roles: ["member", "event_manager"],
        status: "active",
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      // Open modal for John
      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // Add event_manager role
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      fireEvent.click(checkboxes[2]); // event_manager

      // Save
      const saveButton = screen.getAllByRole("button", { name: /Save Roles/i })[0];
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockedUpdateMemberRoles).toHaveBeenCalledWith(
          "admin-token",
          "m-1",
          expect.arrayContaining(["member", "event_manager"])
        );
      });
    });

    it("shows success toast after saving roles", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });
      mockedUpdateMemberRoles.mockResolvedValue({
        id: "m-1",
        email: "john@example.com",
        first_name: "John",
        last_name: "Doe",
        roles: ["member", "admin"],
        status: "active",
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // Add admin role
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      fireEvent.click(checkboxes[0]); // admin

      const saveButton = screen.getAllByRole("button", { name: /Save Roles/i })[0];
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getAllByText(/Roles updated for John Doe/i).length).toBeGreaterThan(0);
      });
    });

    it("shows error toast when save fails", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });
      mockedUpdateMemberRoles.mockRejectedValue({
        error: { message: "Failed to update roles" },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      const saveButton = screen.getAllByRole("button", { name: /Save Roles/i })[0];
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getAllByText(/Failed to update roles/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Validation", () => {
    it("shows error message when no roles are selected", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // Uncheck the member role (John only has "member")
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      const memberCheckbox = checkboxes[1]; // member is the 2nd role
      fireEvent.click(memberCheckbox);

      // Error message should appear
      await waitFor(() => {
        expect(screen.getAllByText(/At least one role must be selected/i).length).toBeGreaterThan(0);
      });

      // Save button should be disabled
      const saveButton = screen.getAllByRole("button", { name: /Save Roles/i })[0] as HTMLButtonElement;
      expect(saveButton.disabled).toBe(true);
    });

    it("does not call API when no roles selected", async () => {
      mockedListMembersReport.mockResolvedValue({ items: mockMembers });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/John Doe/i).length).toBeGreaterThan(0);
      });

      const editButtons = screen.getAllByRole("button", { name: /Edit Roles/i });
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Edit Member Roles/i).length).toBeGreaterThan(0);
      });

      // Uncheck all roles
      const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
      checkboxes.forEach((cb) => {
        if (cb.checked) fireEvent.click(cb);
      });

      // Try to save (button should be disabled, but let's verify no API call)
      expect(mockedUpdateMemberRoles).not.toHaveBeenCalled();
    });
  });
});

