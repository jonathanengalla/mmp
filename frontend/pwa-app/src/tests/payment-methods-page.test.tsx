/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaymentMethodsPage } from "../pages/PaymentMethodsPage";

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
  getMemberPaymentMethods: vi.fn(),
  createMemberPaymentMethod: vi.fn(),
  deleteMemberPaymentMethod: vi.fn(),
}));

import { getMemberPaymentMethods, createMemberPaymentMethod, deleteMemberPaymentMethod } from "../api/client";

const mockedGetMemberPaymentMethods = vi.mocked(getMemberPaymentMethods);
const mockedCreateMemberPaymentMethod = vi.mocked(createMemberPaymentMethod);

const mockPaymentMethods = [
  {
    id: "pm-1",
    memberId: "m-1",
    brand: "Visa",
    last4: "4242",
    expMonth: 12,
    expYear: 2030,
    label: "Personal",
    isDefault: true,
    createdAt: Date.now(),
    token: "dev_tok_pm-1",
  },
  {
    id: "pm-2",
    memberId: "m-1",
    brand: "MasterCard",
    last4: "5555",
    expMonth: 6,
    expYear: 2028,
    label: null,
    isDefault: false,
    createdAt: Date.now() - 1000,
    token: "dev_tok_pm-2",
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <PaymentMethodsPage />
    </MemoryRouter>
  );

describe("PaymentMethodsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initial render", () => {
    it("renders page for authenticated member with empty list", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: [],
        defaultId: null,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Payment Methods/i).length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText(/saved payment methods yet/i).length).toBeGreaterThan(0);
    });

    it("shows loading state initially", async () => {
      // Create a promise that doesn't resolve immediately
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockedGetMemberPaymentMethods.mockReturnValue(pendingPromise as any);

      renderPage();

      expect(screen.getAllByText(/Loading payment methods/i).length).toBeGreaterThan(0);

      // Clean up - resolve the promise
      resolvePromise!({ items: [], defaultId: null });
      await waitFor(() => {
        expect(mockedGetMemberPaymentMethods).toHaveBeenCalled();
      });
    });
  });

  describe("Displaying existing methods", () => {
    it("displays existing payment methods in a list", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: mockPaymentMethods,
        defaultId: "pm-1",
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Visa/i).length).toBeGreaterThan(0);
      });

      // Check for card details
      expect(screen.getAllByText(/4242/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/MasterCard/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/5555/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Personal/i).length).toBeGreaterThan(0);
      
      // Verify Mastercard badge shows "MC" (not "MAST")
      expect(screen.getAllByText("MC").length).toBeGreaterThan(0);
    });

    it("shows Default tag next to the default method", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: mockPaymentMethods,
        defaultId: "pm-1",
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Visa/i).length).toBeGreaterThan(0);
      });

      // Should have at least one "Default" tag (may be more due to StrictMode)
      expect(screen.getAllByText("Default").length).toBeGreaterThan(0);
    });

    it("shows expiration date", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: [mockPaymentMethods[0]],
        defaultId: "pm-1",
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Visa/i).length).toBeGreaterThan(0);
      });

      // Should show expiration with full year (12/2030 format)
      expect(screen.getAllByText(/Expires.*12.*2030/i).length).toBeGreaterThan(0);
    });
  });

  describe("Adding a new method", () => {
    it("submits form and calls API with correct payload", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: [],
        defaultId: null,
      });

      const newMethod = {
        id: "pm-3",
        memberId: "m-1",
        brand: "Visa",
        last4: "1234",
        expMonth: 3,
        expYear: 2029,
        label: "Work",
        isDefault: true,
        createdAt: Date.now(),
        token: "dev_tok_pm-3",
      };

      mockedCreateMemberPaymentMethod.mockResolvedValue({
        items: [newMethod],
        defaultId: "pm-3",
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/saved payment methods yet/i).length).toBeGreaterThan(0);
      });

      // Fill form - use selects for brand, month, year
      const brandSelects = screen.getAllByRole("combobox");
      const brandSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "brand");
      if (brandSelect) fireEvent.change(brandSelect, { target: { value: "Visa" } });

      const last4Inputs = screen.getAllByPlaceholderText(/1234/i);
      fireEvent.change(last4Inputs[0], { target: { value: "1234" } });

      const monthSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expMonth");
      if (monthSelect) fireEvent.change(monthSelect, { target: { value: "3" } });

      const yearSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expYear");
      if (yearSelect) fireEvent.change(yearSelect, { target: { value: "2029" } });

      const labelInputs = screen.getAllByPlaceholderText(/Optional nickname/i);
      fireEvent.change(labelInputs[0], { target: { value: "Work" } });

      // Submit form (button says "Save payment method")
      fireEvent.click(screen.getAllByRole("button", { name: /Save payment method/i })[0]);

      // API should be called with correct payload
      await waitFor(() => {
        expect(mockedCreateMemberPaymentMethod).toHaveBeenCalledWith("test-token", {
          brand: "Visa",
          last4: "1234",
          expMonth: 3,
          expYear: 2029,
          label: "Work",
        });
      });
    });
  });

  describe("Client-side validation", () => {
    it("shows error when brand is not selected", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: [],
        defaultId: null,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/saved payment methods yet/i).length).toBeGreaterThan(0);
      });

      // Only fill last4, leave brand empty
      const last4Inputs = screen.getAllByPlaceholderText(/1234/i);
      fireEvent.change(last4Inputs[0], { target: { value: "1234" } });

      // Fill month and year
      const brandSelects = screen.getAllByRole("combobox");
      const monthSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expMonth");
      if (monthSelect) fireEvent.change(monthSelect, { target: { value: "6" } });

      const yearSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expYear");
      if (yearSelect) fireEvent.change(yearSelect, { target: { value: "2030" } });

      // Submit
      fireEvent.click(screen.getAllByRole("button", { name: /Save payment method/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Brand is required/i).length).toBeGreaterThan(0);
      });

      // API should not be called
      expect(mockedCreateMemberPaymentMethod).not.toHaveBeenCalled();
    });

    it("does not call API when last4 is invalid", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: [],
        defaultId: null,
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/saved payment methods yet/i).length).toBeGreaterThan(0);
      });

      // Fill with invalid last4 (only 3 digits)
      const brandSelects = screen.getAllByRole("combobox");
      const brandSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "brand");
      if (brandSelect) fireEvent.change(brandSelect, { target: { value: "Visa" } });

      const last4Inputs = screen.getAllByPlaceholderText(/1234/i);
      fireEvent.change(last4Inputs[0], { target: { value: "123" } });

      const monthSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expMonth");
      if (monthSelect) fireEvent.change(monthSelect, { target: { value: "6" } });

      const yearSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expYear");
      if (yearSelect) fireEvent.change(yearSelect, { target: { value: "2030" } });

      // Submit
      fireEvent.click(screen.getAllByRole("button", { name: /Save payment method/i })[0]);

      // Wait a bit for any potential API call
      await new Promise((r) => setTimeout(r, 50));

      // API should not be called with invalid data
      expect(mockedCreateMemberPaymentMethod).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("shows error message and retry button when loading fails", async () => {
      mockedGetMemberPaymentMethods.mockRejectedValue({
        error: { message: "Failed to load" },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/Failed to load payment methods/i).length).toBeGreaterThan(0);
      });

      // Retry button says "Try again"
      expect(screen.getAllByRole("button", { name: /Try again/i }).length).toBeGreaterThan(0);
    });

    it("shows error toast when create fails", async () => {
      mockedGetMemberPaymentMethods.mockResolvedValue({
        items: [],
        defaultId: null,
      });

      mockedCreateMemberPaymentMethod.mockRejectedValue({
        error: { message: "Create failed" },
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByText(/saved payment methods yet/i).length).toBeGreaterThan(0);
      });

      // Fill form
      const brandSelects = screen.getAllByRole("combobox");
      const brandSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "brand");
      if (brandSelect) fireEvent.change(brandSelect, { target: { value: "Visa" } });

      const last4Inputs = screen.getAllByPlaceholderText(/1234/i);
      fireEvent.change(last4Inputs[0], { target: { value: "1234" } });

      const monthSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expMonth");
      if (monthSelect) fireEvent.change(monthSelect, { target: { value: "6" } });

      const yearSelect = brandSelects.find(s => (s as HTMLSelectElement).name === "expYear");
      if (yearSelect) fireEvent.change(yearSelect, { target: { value: "2030" } });

      // Submit
      fireEvent.click(screen.getAllByRole("button", { name: /Save payment method/i })[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/Create failed|Failed to add/i).length).toBeGreaterThan(0);
      });
    });
  });
});
