import { describe, it, expect, beforeEach } from "vitest";
import { setSessionTokens, getSessionTokens, clearSessionTokens, isAuthenticated } from "../session";

describe("session storage", () => {
  beforeEach(() => {
    clearSessionTokens();
  });

  it("stores and retrieves tokens", () => {
    setSessionTokens({ access_token: "jwt", refresh_token: "rjwt", tenant_id: "t1", member_id: "m1" });
    const tokens = getSessionTokens();
    expect(tokens?.access_token).toBe("jwt");
    expect(isAuthenticated()).toBe(true);
  });

  it("clears tokens", () => {
    setSessionTokens({ access_token: "jwt", refresh_token: "rjwt", tenant_id: "t1" });
    clearSessionTokens();
    expect(getSessionTokens()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});

