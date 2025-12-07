/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminCreateMemberPage } from "../pages/AdminCreateMemberPage";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock session context with admin role
vi.mock("../hooks/useSession", () => ({
  useSession: () => ({
    authed: true,
    tokens: { access_token: "admin-token", tenant_id: "t1", member_id: "admin-1" },
    user: { id: "admin-1", email: "admin@test.local", roles: ["admin", "member"] },
    logout: vi.fn(),
  }),
}));

// Mock API client
vi.mock("../api/client", () => ({
  createMemberAdmin: vi.fn(),
}));

import { createMemberAdmin } from "../api/client";

const mockedCreateMemberAdmin = vi.mocked(createMemberAdmin);

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminCreateMemberPage />
    </MemoryRouter>
  );

describe("AdminCreateMemberPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockedCreateMemberAdmin.mockReset();
  });

  describe("Initial render", () => {
    it("renders the page with form fields and buttons", () => {
      renderPage();
      
      // Page title
      expect(screen.getAllByText(/Add Member/i).length).toBeGreaterThan(0);
      
      // Form fields (via placeholders)
      expect(screen.getAllByPlaceholderText(/member@example.com/i).length).toBeGreaterThan(0);
      expect(screen.getAllByPlaceholderText(/^John$/i).length).toBeGreaterThan(0);
      expect(screen.getAllByPlaceholderText(/^Doe$/i).length).toBeGreaterThan(0);
      
      // Buttons
      expect(screen.getAllByRole("button", { name: /Create Member/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /Cancel/i }).length).toBeGreaterThan(0);
    });
  });

  describe("Form validation", () => {
    it("shows error when required fields are missing", async () => {
      renderPage();

      // Submit empty form
      fireEvent.click(screen.getAllByRole("button", { name: /Create Member/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Email is required/i).length).toBeGreaterThan(0);
      });

      // API should NOT be called
      expect(mockedCreateMemberAdmin).not.toHaveBeenCalled();
    });

    it("shows error for invalid LinkedIn URL", async () => {
      renderPage();

      // Fill required fields
      fireEvent.change(screen.getAllByPlaceholderText(/member@example.com/i)[0], { target: { value: "test@example.com" } });
      fireEvent.change(screen.getAllByPlaceholderText(/^John$/i)[0], { target: { value: "John" } });
      fireEvent.change(screen.getAllByPlaceholderText(/^Doe$/i)[0], { target: { value: "Doe" } });
      
      // Enter invalid LinkedIn URL
      fireEvent.change(screen.getAllByPlaceholderText(/linkedin.com\/in\/johndoe/i)[0], { target: { value: "not-valid" } });

      fireEvent.click(screen.getAllByRole("button", { name: /Create Member/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/LinkedIn URL must start with/i).length).toBeGreaterThan(0);
      });

      expect(mockedCreateMemberAdmin).not.toHaveBeenCalled();
    });
  });

  describe("Navigation", () => {
    it("navigates to pending members on cancel", () => {
      renderPage();

      fireEvent.click(screen.getAllByRole("button", { name: /Cancel/i })[0]);

      expect(mockNavigate).toHaveBeenCalledWith("/admin/pending-members");
    });
  });
});
