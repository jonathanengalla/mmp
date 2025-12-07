import { describe, it, expect } from "vitest";
import { validateRegistration, validateLogin, isValidLinkedinUrl } from "../utils/validation";

describe("validation", () => {
  it("registration requires email and names", () => {
    const errors = validateRegistration({ email: "", first_name: "", last_name: "" });
    expect(errors.email).toBeDefined();
    expect(errors.first_name).toBeDefined();
    expect(errors.last_name).toBeDefined();
  });

  it("registration validates email format", () => {
    const errors = validateRegistration({ email: "invalid", first_name: "John", last_name: "Doe" });
    expect(errors.email).toBeDefined();
    expect(errors.first_name).not.toBeDefined();
    expect(errors.last_name).not.toBeDefined();
  });

  it("registration passes with valid data", () => {
    const errors = validateRegistration({ email: "test@example.com", first_name: "John", last_name: "Doe" });
    expect(Object.keys(errors).length).toBe(0);
  });

  it("login requires email/password", () => {
    const errors = validateLogin({ email: "", password: "" });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });

  it("isValidLinkedinUrl accepts valid LinkedIn URLs", () => {
    expect(isValidLinkedinUrl("https://linkedin.com/in/johndoe")).toBe(true);
    expect(isValidLinkedinUrl("http://www.linkedin.com/in/user")).toBe(true);
    expect(isValidLinkedinUrl("")).toBe(true); // Empty is valid (optional)
  });

  it("isValidLinkedinUrl rejects invalid URLs", () => {
    expect(isValidLinkedinUrl("linkedin.com/in/user")).toBe(false); // no http
    expect(isValidLinkedinUrl("https://example.com")).toBe(false); // not linkedin
    expect(isValidLinkedinUrl("not-a-url")).toBe(false);
  });
});
