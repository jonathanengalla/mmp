/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RegisterPage } from "../pages/RegisterPage";

vi.mock("../api/client", () => ({
  registerMember: vi.fn(),
}));

import { registerMember } from "../api/client";
const mockedRegister = vi.mocked(registerMember);

const renderPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );

describe("RegisterPage", () => {
  beforeEach(() => {
    mockedRegister.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders required and optional fields", () => {
    renderPage();
    // Use placeholders to find inputs since labels may not be properly associated
    expect(screen.getAllByPlaceholderText(/you@example.com/i).length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText(/John/i).length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText(/Doe/i).length).toBeGreaterThan(0);
    expect(screen.getAllByPlaceholderText(/555/i).length).toBeGreaterThan(0); // Phone
    expect(screen.getAllByPlaceholderText(/linkedin.com/i).length).toBeGreaterThan(0);
  });

  it("submits and shows success state", async () => {
    mockedRegister.mockResolvedValue({ id: "reg-1", status: "pendingVerification" });
    
    renderPage();
    
    // Fill required fields only, don't fill LinkedIn
    fireEvent.change(screen.getAllByPlaceholderText(/you@example.com/i)[0], { target: { value: "user@example.com" } });
    fireEvent.change(screen.getAllByPlaceholderText(/John/i)[0], { target: { value: "Ann" } });
    fireEvent.change(screen.getAllByPlaceholderText(/Doe/i)[0], { target: { value: "Lee" } });
    
    // Submit
    fireEvent.click(screen.getAllByRole("button", { name: /Create account/i })[0]);

    await waitFor(() => {
      // Success message is now "Check your email"
      expect(screen.getAllByText(/Check your email/i).length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    
    // Verify API was called
    expect(mockedRegister).toHaveBeenCalledWith({
      email: "user@example.com",
      firstName: "Ann",
      lastName: "Lee",
      phone: undefined,
      address: undefined,
      linkedinUrl: undefined,
      otherSocials: undefined,
    });
  });

  it("shows validation errors for missing required fields and invalid LinkedIn URL", async () => {
    renderPage();
    
    // Submit button says "Create account"
    fireEvent.click(screen.getAllByRole("button", { name: /Create account/i })[0]);
    
    await waitFor(() => {
      expect(screen.getAllByText(/Email is required/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/First name is required/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Last name is required/i).length).toBeGreaterThan(0);

    // Fill in required fields
    fireEvent.change(screen.getAllByPlaceholderText(/you@example.com/i)[0], { target: { value: "user@example.com" } });
    fireEvent.change(screen.getAllByPlaceholderText(/John/i)[0], { target: { value: "Ann" } });
    fireEvent.change(screen.getAllByPlaceholderText(/Doe/i)[0], { target: { value: "Lee" } });
    fireEvent.change(screen.getAllByPlaceholderText(/linkedin.com/i)[0], { target: { value: "not-a-url" } });
    
    fireEvent.click(screen.getAllByRole("button", { name: /Create account/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/LinkedIn URL must start/i).length).toBeGreaterThan(0);
    });
  });
});
