/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfilePage } from "../pages/ProfilePage";

// Mock session context - values must be inside the factory function for hoisting
vi.mock("../hooks/useSession", () => ({
  useSession: () => ({
    authed: true,
    tokens: { access_token: "test-token", tenant_id: "t1", member_id: "m-1" },
    user: { id: "u1", email: "test@example.com", roles: ["member"] },
    logout: vi.fn(),
  }),
}));

// Mock API client
vi.mock("../api/client", () => ({
  getCurrentMember: vi.fn(),
  updateCurrentMember: vi.fn(),
  listInvoices: vi.fn(),
  downloadInvoicePdf: vi.fn(),
}));

import { getCurrentMember, updateCurrentMember, listInvoices } from "../api/client";

const mockedGetCurrentMember = vi.mocked(getCurrentMember);
const mockedUpdateCurrentMember = vi.mocked(updateCurrentMember);
const mockedListInvoices = vi.mocked(listInvoices);

const mockProfile = {
  id: "m-1",
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
  phone: "+1234567890",
  address: "123 Main St",
  linkedinUrl: "https://linkedin.com/in/testuser",
  otherSocials: "@testuser",
  status: "active",
  membership_type_id: "basic",
  created_at: Date.now(),
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListInvoices.mockResolvedValue({ items: [] });
  });

  describe("Loading and displaying profile", () => {
    it("shows loading skeleton initially", () => {
      mockedGetCurrentMember.mockImplementation(() => new Promise(() => {})); // Never resolves
      renderPage();
      // The loading state now shows a skeleton, check for the skeleton class
      expect(document.querySelector(".pr-skeleton")).toBeTruthy();
    });

    it("loads and displays member data", async () => {
      mockedGetCurrentMember.mockResolvedValue(mockProfile);
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      expect(screen.getAllByDisplayValue("123 Main St").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("https://linkedin.com/in/testuser").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("@testuser").length).toBeGreaterThan(0);
    });

    it("shows error state and retry button on load failure", async () => {
      mockedGetCurrentMember.mockRejectedValue({ error: { message: "Failed to load" } });
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Failed to load profile/i).length).toBeGreaterThan(0);
      });

      // Retry button now says "Try again"
      expect(screen.getAllByRole("button", { name: /Try again/i }).length).toBeGreaterThan(0);
    });

    it("retries loading when retry button is clicked", async () => {
      // Setup mock to fail first, then succeed on retry
      mockedGetCurrentMember.mockRejectedValue({ error: { message: "Failed" } });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Failed to load profile/i).length).toBeGreaterThan(0);
      });

      // Reset mock and set up for success
      mockedGetCurrentMember.mockResolvedValue(mockProfile);

      // Click the retry button
      fireEvent.click(screen.getAllByRole("button", { name: /Try again/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      // Just verify it was called (multiple times due to StrictMode is expected)
      expect(mockedGetCurrentMember).toHaveBeenCalled();
    });
  });

  describe("Updating profile", () => {
    it("updates profile successfully on save", async () => {
      mockedGetCurrentMember.mockResolvedValue(mockProfile);
      const updatedProfile = { ...mockProfile, phone: "+9999999999" };
      mockedUpdateCurrentMember.mockResolvedValue(updatedProfile);

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      // Update phone on first input
      const phoneInput = screen.getAllByDisplayValue("+1234567890")[0];
      fireEvent.change(phoneInput, { target: { value: "+9999999999" } });

      // Click first save button (now says "Save changes")
      fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);

      await waitFor(() => {
        expect(mockedUpdateCurrentMember).toHaveBeenCalledWith("test-token", {
          phone: "+9999999999",
          address: "123 Main St",
          linkedinUrl: "https://linkedin.com/in/testuser",
          otherSocials: "@testuser",
        });
      });

      // Success toast
      await waitFor(() => {
        expect(screen.getAllByText(/Profile updated/i).length).toBeGreaterThan(0);
      });
    });

    it("shows error toast on save failure", async () => {
      mockedGetCurrentMember.mockResolvedValue(mockProfile);
      mockedUpdateCurrentMember.mockRejectedValue({ error: { message: "Server error" } });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Server error/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe("LinkedIn URL validation", () => {
    it("shows validation error for invalid LinkedIn URL (no http)", async () => {
      mockedGetCurrentMember.mockResolvedValue({ ...mockProfile, linkedinUrl: "" });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      // Enter invalid URL on first LinkedIn input
      const linkedinInput = screen.getAllByPlaceholderText(/linkedin.com/i)[0];
      fireEvent.change(linkedinInput, { target: { value: "linkedin.com/in/user" } });

      // Try to save
      fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/LinkedIn URL must start with/i).length).toBeGreaterThan(0);
      });

      // updateCurrentMember should NOT be called
      expect(mockedUpdateCurrentMember).not.toHaveBeenCalled();
    });

    it("shows validation error for URL without linkedin.com", async () => {
      mockedGetCurrentMember.mockResolvedValue({ ...mockProfile, linkedinUrl: "" });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      // Enter URL without linkedin.com
      const linkedinInput = screen.getAllByPlaceholderText(/linkedin.com/i)[0];
      fireEvent.change(linkedinInput, { target: { value: "https://example.com/profile" } });

      // Try to save
      fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/LinkedIn URL must contain linkedin.com/i).length).toBeGreaterThan(0);
      });

      // updateCurrentMember should NOT be called
      expect(mockedUpdateCurrentMember).not.toHaveBeenCalled();
    });

    it("accepts empty LinkedIn URL (optional field)", async () => {
      mockedGetCurrentMember.mockResolvedValue({ ...mockProfile, linkedinUrl: "" });
      mockedUpdateCurrentMember.mockResolvedValue({ ...mockProfile, linkedinUrl: "" });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      // Leave LinkedIn URL empty and save
      fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);

      await waitFor(() => {
        expect(mockedUpdateCurrentMember).toHaveBeenCalled();
      });
    });

    it("accepts valid LinkedIn URL", async () => {
      mockedGetCurrentMember.mockResolvedValue({ ...mockProfile, linkedinUrl: "" });
      const updatedProfile = { ...mockProfile, linkedinUrl: "https://www.linkedin.com/in/newuser" };
      mockedUpdateCurrentMember.mockResolvedValue(updatedProfile);

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      // Enter valid URL
      const linkedinInput = screen.getAllByPlaceholderText(/linkedin.com/i)[0];
      fireEvent.change(linkedinInput, { target: { value: "https://www.linkedin.com/in/newuser" } });

      // Save
      fireEvent.click(screen.getAllByRole("button", { name: /Save/i })[0]);

      await waitFor(() => {
        expect(mockedUpdateCurrentMember).toHaveBeenCalledWith("test-token", expect.objectContaining({
          linkedinUrl: "https://www.linkedin.com/in/newuser",
        }));
      });
    });
  });

  describe("Read-only fields", () => {
    it("displays name and email as read-only text (not inputs)", async () => {
      mockedGetCurrentMember.mockResolvedValue(mockProfile);

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByDisplayValue("+1234567890").length).toBeGreaterThan(0);
      });

      // Name should be displayed as text, not editable
      expect(screen.queryByLabelText(/^Name$/i)).toBeNull();

      // Email should be displayed as text
      const emailElements = screen.getAllByText("test@example.com");
      expect(emailElements[0].tagName).not.toBe("INPUT");
    });
  });
});
