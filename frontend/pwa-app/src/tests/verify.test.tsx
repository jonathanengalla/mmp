/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { VerifyPage } from "../pages/VerifyPage";

vi.mock("../api/client", () => ({
  verifyEmail: vi.fn(),
  requestVerification: vi.fn(),
}));

import { verifyEmail, requestVerification } from "../api/client";
const mockedVerify = vi.mocked(verifyEmail);
const mockedResend = vi.mocked(requestVerification);

const renderWithToken = (token?: string) =>
  render(
    <MemoryRouter initialEntries={[token ? `/verify?token=${token}` : "/verify"]}>
      <Routes>
        <Route path="/verify" element={<VerifyPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("VerifyPage", () => {
  beforeEach(() => {
    mockedVerify.mockReset();
    mockedResend.mockReset();
  });

  it("shows success on valid token", async () => {
    mockedVerify.mockResolvedValue({ status: "verified" });
    renderWithToken("good-token");
    expect(await screen.findByText(/Email verified/i)).toBeTruthy();
  });

  it("shows invalid token state", async () => {
    const err = new Error("invalid");
    (err as any).error = { code: "invalid_token" };
    mockedVerify.mockRejectedValue(err);
    renderWithToken("bad-token");
    
    await waitFor(() => {
      expect(screen.getAllByText(/Invalid|Verification Failed/i).length).toBeGreaterThan(0);
    });
  });

  it("shows expired token state", async () => {
    const err = new Error("expired");
    (err as any).error = { code: "expired_token" };
    mockedVerify.mockRejectedValue(err);
    renderWithToken("expired-token");
    
    await waitFor(() => {
      expect(screen.getAllByText(/expired/i).length).toBeGreaterThan(0);
    });
  });

  it("renders resend form when no token", async () => {
    renderWithToken();
    
    // Should show the resend form
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(/you@example.com/i).length).toBeGreaterThan(0);
    });
    
    // The submit button should be present
    expect(screen.getAllByRole("button", { name: /Resend Verification Email/i }).length).toBeGreaterThan(0);
  });

  it("calls requestVerification on form submit", async () => {
    mockedResend.mockResolvedValue({ status: "sent" });
    renderWithToken();
    
    // Wait for form to render
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText(/you@example.com/i).length).toBeGreaterThan(0);
    });
    
    // Use getAllBy to handle StrictMode double renders
    const emailInputs = screen.getAllByPlaceholderText(/you@example.com/i);
    fireEvent.change(emailInputs[0], { target: { value: "user@example.com" } });
    
    // Submit form via the form element directly
    const form = emailInputs[0].closest("form");
    if (form) {
      fireEvent.submit(form);
    }
    
    await waitFor(() => {
      expect(mockedResend).toHaveBeenCalledWith("user@example.com");
    }, { timeout: 2000 });
  });
});
