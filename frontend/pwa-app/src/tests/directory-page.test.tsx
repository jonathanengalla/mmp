/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DirectoryPage } from "../pages/DirectoryPage";

// Mock session context - values inside factory for hoisting
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
  searchDirectoryMembers: vi.fn(),
}));

import { searchDirectoryMembers } from "../api/client";

const mockedSearchDirectoryMembers = vi.mocked(searchDirectoryMembers);

const mockMembers = [
  {
    id: "m-1",
    first_name: "Alice",
    last_name: "Wonderland",
    email: "alice@example.com",
    phone: "+1234567890",
    status: "active",
    created_at: Date.now(),
    linkedinUrl: null,
    otherSocials: null,
  },
  {
    id: "m-2",
    first_name: "Bob",
    last_name: "Builder",
    email: "bob@example.com",
    phone: null,
    status: "active",
    created_at: Date.now(),
    linkedinUrl: null,
    otherSocials: null,
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <DirectoryPage />
    </MemoryRouter>
  );

describe("DirectoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial render", () => {
    it("renders directory page with search input", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Member Directory/i).length).toBeGreaterThan(0);
      });

      // Search input should be present
      expect(screen.getAllByPlaceholderText(/name or email/i).length).toBeGreaterThan(0);
    });

    it("shows initial state prompting user to search", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Type a name or email/i).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Search functionality", () => {
    it("shows 'No members found' when search returns empty with query", async () => {
      mockedSearchDirectoryMembers.mockResolvedValue({
        items: [],
        total: 0,
        limit: 20,
        offset: 0,
      });

      renderPage();

      // Type a query in the search input
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      await waitFor(
        () => {
          expect(screen.getAllByText(/No members found/i).length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );
    });

    it("shows clear button when query is not empty", async () => {
      mockedSearchDirectoryMembers.mockResolvedValue({
        items: mockMembers,
        total: 2,
        limit: 20,
        offset: 0,
      });

      renderPage();

      // Type search query
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Clear/i }).length).toBeGreaterThan(0);
      });
    });

    it("calls searchDirectoryMembers API when query is entered", async () => {
      mockedSearchDirectoryMembers.mockResolvedValue({
        items: mockMembers,
        total: 2,
        limit: 20,
        offset: 0,
      });

      renderPage();

      // Type search query
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(mockedSearchDirectoryMembers).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it("displays search results after query", async () => {
      mockedSearchDirectoryMembers.mockResolvedValue({
        items: mockMembers,
        total: 2,
        limit: 20,
        offset: 0,
      });

      renderPage();

      // Type search query
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "Alice" } });

      await waitFor(
        () => {
          expect(screen.getAllByText(/Alice Wonderland/i).length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );

      expect(screen.getAllByText(/Bob Builder/i).length).toBeGreaterThan(0);
    });
  });

  describe("Error handling", () => {
    it("shows error message when search fails", async () => {
      mockedSearchDirectoryMembers.mockRejectedValueOnce({
        error: { message: "Search failed" },
      });

      renderPage();

      // Type search query to trigger search
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(() => {
        expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });
  });

  describe("Pagination", () => {
    it("shows pagination controls when results exceed page size", async () => {
      mockedSearchDirectoryMembers.mockResolvedValue({
        items: mockMembers,
        total: 50, // More than page size
        limit: 20,
        offset: 0,
      });

      renderPage();

      // Type search query to get results
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "test" } });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Next/i }).length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Page indicator should show
      expect(screen.getAllByText(/Page 1 of/i).length).toBeGreaterThan(0);
    });
  });

  describe("Member display", () => {
    it("displays member name, email, phone, and status badge", async () => {
      mockedSearchDirectoryMembers.mockResolvedValue({
        items: mockMembers,
        total: 2,
        limit: 20,
        offset: 0,
      });

      renderPage();

      // Type search query to get results
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "Alice" } });

      await waitFor(
        () => {
          expect(screen.getAllByText(/Alice Wonderland/i).length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );

      // Check Bob is shown
      expect(screen.getAllByText(/Bob Builder/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/bob@example.com/i).length).toBeGreaterThan(0);

      // Status badges
      const activeBadges = screen.getAllByText("active");
      expect(activeBadges.length).toBeGreaterThan(0);
    });

    it("shows dash for missing phone", async () => {
      mockedSearchDirectoryMembers.mockResolvedValue({
        items: [mockMembers[1]], // Bob has no phone
        total: 1,
        limit: 20,
        offset: 0,
      });

      renderPage();

      // Type search query to get results
      const searchInput = screen.getAllByPlaceholderText(/name or email/i)[0];
      fireEvent.change(searchInput, { target: { value: "Bob" } });

      await waitFor(
        () => {
          expect(screen.getAllByText(/Bob Builder/i).length).toBeGreaterThan(0);
        },
        { timeout: 2000 }
      );

      // Bob has no phone so should show dash
      expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    });
  });
});
