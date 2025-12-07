import { createRegistration, verify, updateMemberContact, createMember, createMemberAdmin, approveMember, rejectMember, listPendingMembers, listMembers, requestVerification, getCurrentMember, updateCurrentMember, searchDirectoryMembers, getMemberPaymentMethods, createMemberPaymentMethod, updateMemberRoles, __resetPaymentMethods } from "../src/handlers";

const mockRes = () => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const makeReq = (body: any, headers: any = {}) => ({
  body,
  headers,
});

describe("membership registration handler", () => {
  it("creates pending registration with required fields only", () => {
    const req: any = makeReq(
      {
        email: "test@example.com",
        firstName: "Ann",
        lastName: "Lee",
      },
      { "x-tenant-id": "t1" }
    );
    const res = mockRes();

    createRegistration(req as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ status: "pendingVerification", email: "test@example.com" });
    expect(res.body.id).toBeDefined();
  });

  it("accepts optional linkedinUrl and otherSocials", () => {
    const req: any = makeReq(
      {
        email: "social@example.com",
        firstName: "Sam",
        lastName: "Smith",
        linkedinUrl: "https://linkedin.com/in/sam",
        otherSocials: "@sam",
      },
      { "x-tenant-id": "t1" }
    );
    const res = mockRes();

    createRegistration(req as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("pendingVerification");
  });

  it("returns 400 on missing email", () => {
    const req: any = makeReq(
      {
        firstName: "Ann",
        lastName: "Lee",
      },
      { "x-tenant-id": "t1" }
    );
    const res = mockRes();

    createRegistration(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 on invalid linkedinUrl", () => {
    const req: any = makeReq(
      {
        email: "badlink@example.com",
        firstName: "Bad",
        lastName: "Link",
        linkedinUrl: "not-a-url",
      },
      { "x-tenant-id": "t1" }
    );
    const res = mockRes();

    createRegistration(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 409 on duplicate email", () => {
    const base = makeReq({ email: "dup@example.com", firstName: "A", lastName: "B" }, { "x-tenant-id": "t1" });
    const res1 = mockRes();
    createRegistration(base as any, res1 as any);
    const res2 = mockRes();
    createRegistration(base as any, res2 as any);
    expect(res2.statusCode).toBe(409);
  });

  it("verifies with valid token", () => {
    const reqReg: any = makeReq(
      {
        email: "verify@example.com",
        firstName: "Ann",
        lastName: "Lee",
      },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);
    const token = resReg.body.verification_token;

    const reqVerify: any = { params: { token } };
    const resVerify = mockRes();
    verify(reqVerify as any, resVerify as any);

    expect(resVerify.statusCode).toBe(200);
    expect(resVerify.body.status).toBe("verified");
  });

  it("fails verify with invalid token", () => {
    const reqVerify: any = { params: { token: "bad-token" } };
    const resVerify = mockRes();
    verify(reqVerify as any, resVerify as any);
    expect(resVerify.statusCode).toBe(400);
    expect(resVerify.body.error).toBeDefined();
  });

  it("resends verification for pending user", () => {
    const reqReg: any = makeReq(
      {
        email: "resend@example.com",
        firstName: "Ann",
        lastName: "Lee",
      },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);

    const reqResend: any = makeReq({ email: "resend@example.com" });
    const resResend = mockRes();
    requestVerification(reqResend as any, resResend as any);
    expect(resResend.statusCode).toBe(200);
    expect(resResend.body.status).toBe("sent");
  });
});

describe("membership update contact", () => {
  it("updates phone/address for an existing member", () => {
    const reqReg: any = makeReq(
      {
        email: "contact@example.com",
        firstName: "Ann",
        lastName: "Lee",
      },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);
    const memberId = resReg.body.member_id;

    const reqUpdate: any = { params: { id: memberId }, body: { phone: "+123", address: "Main St" } };
    const resUpdate = mockRes();
    updateMemberContact(reqUpdate as any, resUpdate as any);

    expect(resUpdate.statusCode).toBe(200);
    expect(resUpdate.body.phone).toBe("+123");
    expect(resUpdate.body.address).toBe("Main St");
  });

  it("validates field types", () => {
    const reqReg: any = makeReq(
      {
        email: "contact2@example.com",
        firstName: "Ann",
        lastName: "Lee",
      },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);
    const memberId = resReg.body.member_id;

    const reqUpdate: any = { params: { id: memberId }, body: { phone: 123 } };
    const resUpdate = mockRes();
    updateMemberContact(reqUpdate as any, resUpdate as any);

    expect(resUpdate.statusCode).toBe(400);
    expect(resUpdate.body.error).toBeDefined();
  });
});

describe("membership admin create", () => {
  it("creates an active member with required fields", () => {
    const req: any = makeReq(
      { email: "admincreate@example.com", first_name: "Pat", last_name: "Smith", membership_type_id: "basic" },
      { "x-tenant-id": "t1" }
    );
    const res = mockRes();

    createMember(req as any, res as any);

    expect(res.statusCode).toBe(201);
    expect(res.body.member_id).toBeDefined();
    expect(res.body.status).toBe("active");
  });

  it("validates required email", () => {
    const req: any = makeReq({ first_name: "Pat", last_name: "Smith" }, { "x-tenant-id": "t1" });
    const res = mockRes();

    createMember(req as any, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

describe("membership admin approve", () => {
  const adminUser = { user: { tenantId: "t1", roles: ["admin"] }, headers: { "x-tenant-id": "t1" } };
  const nonAdminUser = { user: { tenantId: "t1", roles: ["member"] }, headers: { "x-tenant-id": "t1" } };

  it("approves a pendingApproval member", () => {
    const reqReg: any = makeReq(
      {
        email: "pending-approve1@example.com",
        firstName: "Ann",
        lastName: "Lee",
      },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);
    const memberId = resReg.body.member_id;
    const token = resReg.body.verification_token;

    // Verify to get to pendingApproval status
    const reqVerify: any = { params: { token } };
    const resVerify = mockRes();
    verify(reqVerify as any, resVerify as any);

    const reqApprove: any = { params: { id: memberId }, ...adminUser };
    const resApprove = mockRes();
    approveMember(reqApprove as any, resApprove as any);

    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.body.status).toBe("active");
  });

  it("rejects non-admin", () => {
    const reqApprove: any = { params: { id: "m-999" }, ...nonAdminUser };
    const resApprove = mockRes();
    approveMember(reqApprove as any, resApprove as any);

    expect(resApprove.statusCode).toBe(403);
  });

  it("returns 404 for missing member", () => {
    const reqApprove: any = { params: { id: "m-missing" }, ...adminUser };
    const resApprove = mockRes();
    approveMember(reqApprove as any, resApprove as any);

    expect(resApprove.statusCode).toBe(404);
  });

  it("rejects approving already active member", () => {
    // create active via admin create
    const reqCreate: any = makeReq({ email: "active-approve@example.com", first_name: "A", last_name: "B" }, { "x-tenant-id": "t1" });
    const resCreate = mockRes();
    createMember(reqCreate as any, resCreate as any);
    const memberId = resCreate.body.member_id;

    const reqApprove: any = { params: { id: memberId }, ...adminUser };
    const resApprove = mockRes();
    approveMember(reqApprove as any, resApprove as any);

    expect(resApprove.statusCode).toBe(409);
  });
});

describe("membership admin reject", () => {
  const adminUser = { user: { tenantId: "t1", roles: ["admin"] }, headers: { "x-tenant-id": "t1" } };
  const nonAdminUser = { user: { tenantId: "t1", roles: ["member"] }, headers: { "x-tenant-id": "t1" } };

  it("rejects a pendingApproval member with reason", () => {
    const reqReg: any = makeReq(
      { email: "reject-test1@example.com", firstName: "Reject", lastName: "Test" },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);
    const memberId = resReg.body.member_id;
    const token = resReg.body.verification_token;

    const reqVerify: any = { params: { token } };
    const resVerify = mockRes();
    verify(reqVerify as any, resVerify as any);

    const reqReject: any = { params: { id: memberId }, body: { reason: "Incomplete application" }, ...adminUser };
    const resReject = mockRes();
    rejectMember(reqReject as any, resReject as any);

    expect(resReject.statusCode).toBe(200);
    expect(resReject.body.status).toBe("rejected");
    expect(resReject.body.rejection_reason).toBe("Incomplete application");
  });

  it("rejects without reason", () => {
    const reqReg: any = makeReq(
      { email: "reject-noreason1@example.com", firstName: "No", lastName: "Reason" },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);
    const memberId = resReg.body.member_id;
    const token = resReg.body.verification_token;

    const reqVerify: any = { params: { token } };
    const resVerify = mockRes();
    verify(reqVerify as any, resVerify as any);

    const reqReject: any = { params: { id: memberId }, body: {}, ...adminUser };
    const resReject = mockRes();
    rejectMember(reqReject as any, resReject as any);

    expect(resReject.statusCode).toBe(200);
    expect(resReject.body.status).toBe("rejected");
  });

  it("rejects non-admin access", () => {
    const reqReject: any = { params: { id: "m-999" }, body: {}, ...nonAdminUser };
    const resReject = mockRes();
    rejectMember(reqReject as any, resReject as any);

    expect(resReject.statusCode).toBe(403);
  });

  it("returns 404 for missing member", () => {
    const reqReject: any = { params: { id: "m-missing" }, body: {}, ...adminUser };
    const resReject = mockRes();
    rejectMember(reqReject as any, resReject as any);

    expect(resReject.statusCode).toBe(404);
  });
});

describe("membership pending list", () => {
  const adminUser = { user: { tenantId: "t1", roles: ["admin"] }, headers: { "x-tenant-id": "t1" } };
  const nonAdminUser = { user: { tenantId: "t1", roles: ["member"] }, headers: { "x-tenant-id": "t1" } };

  it("lists pending approval members for admin", () => {
    // Create and verify a registration to get a pendingApproval member
    const reqReg: any = makeReq(
      { email: "pending-list1@example.com", firstName: "Pending", lastName: "User" },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);
    const token = resReg.body.verification_token;

    const reqVerify: any = { params: { token } };
    const resVerify = mockRes();
    verify(reqVerify as any, resVerify as any);

    const reqList: any = { query: {}, ...adminUser };
    const resList = mockRes();
    listPendingMembers(reqList as any, resList as any);

    expect(resList.statusCode).toBe(200);
    expect(resList.body.items.length).toBeGreaterThanOrEqual(1);
    expect(resList.body.items.some((m: any) => m.email === "pending-list1@example.com")).toBe(true);
  });

  it("rejects non-admin access", () => {
    const reqList: any = { query: {}, ...nonAdminUser };
    const resList = mockRes();
    listPendingMembers(reqList as any, resList as any);

    expect(resList.statusCode).toBe(403);
  });

  it("rejects unauthenticated access", () => {
    const reqList: any = { query: {} };
    const resList = mockRes();
    listPendingMembers(reqList as any, resList as any);

    expect(resList.statusCode).toBe(401);
  });

  it("returns only pendingApproval members, not active", () => {
    // Create an active member directly
    const reqCreate: any = makeReq(
      { email: "active-filter@example.com", first_name: "Active", last_name: "User" },
      { "x-tenant-id": "t1" }
    );
    const resCreate = mockRes();
    createMember(reqCreate as any, resCreate as any);

    const reqList: any = { query: {}, ...adminUser };
    const resList = mockRes();
    listPendingMembers(reqList as any, resList as any);

    expect(resList.statusCode).toBe(200);
    // Should not contain the active member
    expect(resList.body.items.some((m: any) => m.email === "active-filter@example.com")).toBe(false);
  });
});

describe("membership directory search", () => {
  const authed = { user: { tenantId: "t1", roles: ["member"] }, headers: { "x-tenant-id": "t1" } };

  const seedMember = (email: string, first: string, last: string, membershipTypeId = "basic") => {
    const reqCreate: any = makeReq({ email, first_name: first, last_name: last, membership_type_id: membershipTypeId }, { "x-tenant-id": "t1" });
    const resCreate = mockRes();
    createMember(reqCreate as any, resCreate as any);
    return resCreate.body.member_id;
  };

  it("returns matches for partial name/email", () => {
    seedMember("alice@example.com", "Alice", "Jones");
    seedMember("bob@example.com", "Bob", "Smith");

    const req: any = { query: { query: "ali" }, ...authed };
    const res = mockRes();
    listMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].email).toBe("alice@example.com");
  });

  it("returns empty items when no matches", () => {
    const req: any = { query: { query: "nomatch" }, ...authed };
    const res = mockRes();
    listMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  it("paginates results", () => {
    seedMember("c1@example.com", "C1", "User");
    seedMember("c2@example.com", "C2", "User");

    const req: any = { query: { query: "c", page: "2", page_size: "1" }, ...authed };
    const res = mockRes();
    listMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.items.length).toBe(1);
  });

  it("rejects missing query", () => {
    const req: any = { query: {}, ...authed };
    const res = mockRes();
    listMembers(req as any, res as any);
    expect(res.statusCode).toBe(400);
  });

  it("rejects unauthenticated access", () => {
    const req: any = { query: { query: "a" } };
    const res = mockRes();
    listMembers(req as any, res as any);
    expect(res.statusCode).toBe(401);
  });
});

describe("membership current member (GET/PATCH /members/me)", () => {
  // Helper to create an active member and return memberId
  const createActiveMember = (email: string, firstName: string, lastName: string) => {
    const reqCreate: any = makeReq(
      { email, first_name: firstName, last_name: lastName },
      { "x-tenant-id": "t1" }
    );
    const resCreate = mockRes();
    createMember(reqCreate as any, resCreate as any);
    return resCreate.body.member_id;
  };

  describe("GET /members/me", () => {
    it("returns current member data for authenticated user", () => {
      const memberId = createActiveMember("profile-get@example.com", "Profile", "User");

      const req: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
      };
      const res = mockRes();
      getCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(memberId);
      expect(res.body.email).toBe("profile-get@example.com");
      expect(res.body.first_name).toBe("Profile");
      expect(res.body.last_name).toBe("User");
    });

    it("rejects unauthenticated access", () => {
      const req: any = { headers: {} };
      const res = mockRes();
      getCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(401);
    });

    it("returns 400 if no memberId in user context", () => {
      const req: any = {
        user: { tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
      };
      const res = mockRes();
      getCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("missing_member_id");
    });

    it("returns 404 if member not found", () => {
      const req: any = {
        user: { memberId: "m-nonexistent", tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
      };
      const res = mockRes();
      getCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /members/me", () => {
    it("updates allowed fields (phone, address, linkedinUrl, otherSocials)", () => {
      const memberId = createActiveMember("profile-patch@example.com", "Patch", "User");

      const req: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: {
          phone: "+1234567890",
          address: "123 Main St",
          linkedinUrl: "https://linkedin.com/in/patchuser",
          otherSocials: "@patchuser",
        },
      };
      const res = mockRes();
      updateCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.phone).toBe("+1234567890");
      expect(res.body.address).toBe("123 Main St");
      expect(res.body.linkedinUrl).toBe("https://linkedin.com/in/patchuser");
      expect(res.body.otherSocials).toBe("@patchuser");
    });

    it("performs partial update (only provided fields)", () => {
      const memberId = createActiveMember("profile-partial@example.com", "Partial", "Update");

      // First update with phone
      const req1: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: { phone: "+111" },
      };
      const res1 = mockRes();
      updateCurrentMember(req1 as any, res1 as any);

      expect(res1.statusCode).toBe(200);
      expect(res1.body.phone).toBe("+111");

      // Second update with address only (phone should persist)
      const req2: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: { address: "New Address" },
      };
      const res2 = mockRes();
      updateCurrentMember(req2 as any, res2 as any);

      expect(res2.statusCode).toBe(200);
      expect(res2.body.phone).toBe("+111"); // Still there
      expect(res2.body.address).toBe("New Address");
    });

    it("rejects updates to disallowed fields (email)", () => {
      const memberId = createActiveMember("profile-reject-email@example.com", "Reject", "Email");

      const req: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: { email: "new@example.com" },
      };
      const res = mockRes();
      updateCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "email" && d.issue === "not_updatable")).toBe(true);
    });

    it("rejects updates to disallowed fields (status)", () => {
      const memberId = createActiveMember("profile-reject-status@example.com", "Reject", "Status");

      const req: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: { status: "admin" },
      };
      const res = mockRes();
      updateCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "status" && d.issue === "not_updatable")).toBe(true);
    });

    it("validates LinkedIn URL format", () => {
      const memberId = createActiveMember("profile-linkedin@example.com", "LinkedIn", "Test");

      const req: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: { linkedinUrl: "not-a-valid-url" },
      };
      const res = mockRes();
      updateCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "linkedinUrl" && d.issue === "invalid_url")).toBe(true);
    });

    it("validates LinkedIn URL must contain linkedin.com", () => {
      const memberId = createActiveMember("profile-linkedin2@example.com", "LinkedIn2", "Test");

      const req: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: { linkedinUrl: "https://example.com/profile" },
      };
      const res = mockRes();
      updateCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "linkedinUrl" && d.issue === "invalid_url")).toBe(true);
    });

    it("accepts valid LinkedIn URL", () => {
      const memberId = createActiveMember("profile-linkedin-valid@example.com", "LinkedInValid", "Test");

      const req: any = {
        user: { memberId, tenantId: "t1", roles: ["member"] },
        headers: { "x-tenant-id": "t1" },
        body: { linkedinUrl: "https://www.linkedin.com/in/validuser" },
      };
      const res = mockRes();
      updateCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.linkedinUrl).toBe("https://www.linkedin.com/in/validuser");
    });

    it("rejects unauthenticated access", () => {
      const req: any = { headers: {}, body: { phone: "+123" } };
      const res = mockRes();
      updateCurrentMember(req as any, res as any);

      expect(res.statusCode).toBe(401);
    });
  });
});

describe("membership directory search (GET /members/search)", () => {
  const authed = { user: { tenantId: "t1", roles: ["member"] }, headers: { "x-tenant-id": "t1" } };

  // Helper to create active members for directory search tests
  const createDirectoryMember = (email: string, firstName: string, lastName: string) => {
    const reqCreate: any = makeReq(
      { email, first_name: firstName, last_name: lastName },
      { "x-tenant-id": "t1" }
    );
    const resCreate = mockRes();
    createMember(reqCreate as any, resCreate as any);
    return resCreate.body.member_id;
  };

  it("returns active members matching name fragment", () => {
    createDirectoryMember("dir-alice@example.com", "Alice", "Wonderland");
    createDirectoryMember("dir-bob@example.com", "Bob", "Builder");

    const req: any = { query: { q: "alice" }, ...authed };
    const res = mockRes();
    searchDirectoryMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items.some((m: any) => m.email === "dir-alice@example.com")).toBe(true);
    expect(res.body.items.some((m: any) => m.email === "dir-bob@example.com")).toBe(false);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("returns active members matching email fragment", () => {
    createDirectoryMember("dir-carol@test.org", "Carol", "Singer");

    const req: any = { query: { q: "carol@test" }, ...authed };
    const res = mockRes();
    searchDirectoryMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items.some((m: any) => m.email === "dir-carol@test.org")).toBe(true);
  });

  it("excludes pending and rejected members from results", () => {
    // Create a pendingVerification member via registration (not yet verified)
    const reqReg: any = makeReq(
      { email: "dir-pending@example.com", firstName: "Pending", lastName: "Person" },
      { "x-tenant-id": "t1" }
    );
    const resReg = mockRes();
    createRegistration(reqReg as any, resReg as any);

    // Search for it
    const req: any = { query: { q: "pending" }, ...authed };
    const res = mockRes();
    searchDirectoryMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    // Should not find the pending member
    expect(res.body.items.some((m: any) => m.email === "dir-pending@example.com")).toBe(false);
  });

  it("returns all active members when query is empty", () => {
    createDirectoryMember("dir-empty-test@example.com", "EmptyTest", "User");

    const req: any = { query: {}, ...authed };
    const res = mockRes();
    searchDirectoryMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("respects limit and offset for pagination", () => {
    // Create several members
    createDirectoryMember("dir-page1@example.com", "PageOne", "User");
    createDirectoryMember("dir-page2@example.com", "PageTwo", "User");
    createDirectoryMember("dir-page3@example.com", "PageThree", "User");

    // Request with limit 2, offset 0
    const req1: any = { query: { limit: "2", offset: "0" }, ...authed };
    const res1 = mockRes();
    searchDirectoryMembers(req1 as any, res1 as any);

    expect(res1.statusCode).toBe(200);
    expect(res1.body.limit).toBe(2);
    expect(res1.body.offset).toBe(0);
    expect(res1.body.items.length).toBeLessThanOrEqual(2);

    // Request with offset 2
    const req2: any = { query: { limit: "2", offset: "2" }, ...authed };
    const res2 = mockRes();
    searchDirectoryMembers(req2 as any, res2 as any);

    expect(res2.statusCode).toBe(200);
    expect(res2.body.offset).toBe(2);
  });

  it("returns empty items when no matches found", () => {
    const req: any = { query: { q: "xyznonexistent123" }, ...authed };
    const res = mockRes();
    searchDirectoryMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it("rejects unauthenticated access", () => {
    const req: any = { query: { q: "test" }, headers: {} };
    const res = mockRes();
    searchDirectoryMembers(req as any, res as any);

    expect(res.statusCode).toBe(401);
  });

  it("returns proper member DTO fields (no sensitive data)", () => {
    createDirectoryMember("dir-dto-test@example.com", "DtoTest", "Fields");

    const req: any = { query: { q: "dto-test" }, ...authed };
    const res = mockRes();
    searchDirectoryMembers(req as any, res as any);

    expect(res.statusCode).toBe(200);
    const member = res.body.items.find((m: any) => m.email === "dir-dto-test@example.com");
    expect(member).toBeDefined();
    expect(member.first_name).toBe("DtoTest");
    expect(member.last_name).toBe("Fields");
    expect(member.status).toBe("active");
    // Should NOT have sensitive fields
    expect(member.roles).toBeUndefined();
    expect(member.rejectionReason).toBeUndefined();
    expect(member.tenantId).toBeUndefined();
  });
});

describe("member payment methods (P-1)", () => {
  // Reset payment methods before each test
  beforeEach(() => {
    __resetPaymentMethods();
  });

  // Helper to create an active member and return memberId
  const createActiveMember = (email: string, firstName: string, lastName: string) => {
    const reqCreate: any = makeReq(
      { email, first_name: firstName, last_name: lastName },
      { "x-tenant-id": "t1" }
    );
    const resCreate = mockRes();
    createMember(reqCreate as any, resCreate as any);
    return resCreate.body.member_id;
  };

  const makeAuthReq = (memberId: string, body?: any, query?: any) => ({
    user: { memberId, tenantId: "t1", roles: ["member"] },
    headers: { "x-tenant-id": "t1" },
    body,
    query: query || {},
  });

  describe("GET /members/me/payment-methods", () => {
    it("returns empty list when no payment methods", () => {
      const memberId = createActiveMember("pm-empty@example.com", "PM", "Empty");

      const req: any = makeAuthReq(memberId);
      const res = mockRes();
      getMemberPaymentMethods(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.defaultId).toBe(null);
    });

    it("returns payment methods for current member", () => {
      const memberId = createActiveMember("pm-list@example.com", "PM", "List");

      // Add a payment method first
      const reqCreate: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "1234",
        expMonth: 12,
        expYear: 2030,
        label: "Personal",
      });
      const resCreate = mockRes();
      createMemberPaymentMethod(reqCreate as any, resCreate as any);

      // Now list
      const reqList: any = makeAuthReq(memberId);
      const resList = mockRes();
      getMemberPaymentMethods(reqList as any, resList as any);

      expect(resList.statusCode).toBe(200);
      expect(resList.body.items.length).toBe(1);
      expect(resList.body.items[0].brand).toBe("Visa");
      expect(resList.body.items[0].last4).toBe("1234");
      expect(resList.body.defaultId).toBe(resList.body.items[0].id);
    });

    it("does not return other members payment methods", () => {
      const member1 = createActiveMember("pm-member1@example.com", "Member", "One");
      const member2 = createActiveMember("pm-member2@example.com", "Member", "Two");

      // Add payment method for member1
      const reqCreate: any = makeAuthReq(member1, {
        brand: "MasterCard",
        last4: "5678",
        expMonth: 6,
        expYear: 2028,
      });
      const resCreate = mockRes();
      createMemberPaymentMethod(reqCreate as any, resCreate as any);

      // List for member2 - should be empty
      const reqList: any = makeAuthReq(member2);
      const resList = mockRes();
      getMemberPaymentMethods(reqList as any, resList as any);

      expect(resList.statusCode).toBe(200);
      expect(resList.body.items.length).toBe(0);
    });

    it("rejects unauthenticated access", () => {
      const req: any = { headers: {} };
      const res = mockRes();
      getMemberPaymentMethods(req as any, res as any);

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /members/me/payment-methods", () => {
    it("creates first payment method with isDefault = true", () => {
      const memberId = createActiveMember("pm-create1@example.com", "PM", "Create");

      const req: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "4242",
        expMonth: 12,
        expYear: 2030,
        label: "Work Card",
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].brand).toBe("Visa");
      expect(res.body.items[0].last4).toBe("4242");
      expect(res.body.items[0].expMonth).toBe(12);
      expect(res.body.items[0].expYear).toBe(2030);
      expect(res.body.items[0].label).toBe("Work Card");
      expect(res.body.items[0].isDefault).toBe(true);
      expect(res.body.defaultId).toBe(res.body.items[0].id);
      expect(res.body.items[0].devPaymentToken).toMatch(/^dev_tok_pm-/);
    });

    it("creates additional payment methods with isDefault = false", () => {
      const memberId = createActiveMember("pm-create2@example.com", "PM", "Multiple");

      // First method
      const req1: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "1111",
        expMonth: 1,
        expYear: 2029,
      });
      const res1 = mockRes();
      createMemberPaymentMethod(req1 as any, res1 as any);
      const firstMethodId = res1.body.items[0].id;

      // Second method
      const req2: any = makeAuthReq(memberId, {
        brand: "MasterCard",
        last4: "2222",
        expMonth: 6,
        expYear: 2031,
      });
      const res2 = mockRes();
      createMemberPaymentMethod(req2 as any, res2 as any);

      expect(res2.statusCode).toBe(201);
      expect(res2.body.items.length).toBe(2);
      // First method should still be default
      expect(res2.body.defaultId).toBe(firstMethodId);
      // New method should not be default
      const newMethod = res2.body.items.find((m: any) => m.last4 === "2222");
      expect(newMethod.isDefault).toBe(false);
    });

    it("validates brand is required", () => {
      const memberId = createActiveMember("pm-val-brand@example.com", "PM", "Brand");

      const req: any = makeAuthReq(memberId, {
        last4: "1234",
        expMonth: 12,
        expYear: 2030,
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "brand" && d.issue === "required")).toBe(true);
    });

    it("validates last4 must be exactly 4 digits", () => {
      const memberId = createActiveMember("pm-val-last4@example.com", "PM", "Last4");

      const req: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "123", // Only 3 digits
        expMonth: 12,
        expYear: 2030,
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "last4" && d.issue === "must_be_4_digits")).toBe(true);
    });

    it("validates last4 must be digits only", () => {
      const memberId = createActiveMember("pm-val-last4b@example.com", "PM", "Last4B");

      const req: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "12ab",
        expMonth: 12,
        expYear: 2030,
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "last4" && d.issue === "must_be_4_digits")).toBe(true);
    });

    it("validates expMonth must be 1-12", () => {
      const memberId = createActiveMember("pm-val-month@example.com", "PM", "Month");

      const req: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "1234",
        expMonth: 13,
        expYear: 2030,
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "expMonth" && d.issue === "invalid_range")).toBe(true);
    });

    it("validates expMonth 0 is invalid", () => {
      const memberId = createActiveMember("pm-val-month0@example.com", "PM", "Month0");

      const req: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "1234",
        expMonth: 0,
        expYear: 2030,
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "expMonth" && d.issue === "invalid_range")).toBe(true);
    });

    it("validates expYear cannot be in the past", () => {
      const memberId = createActiveMember("pm-val-year@example.com", "PM", "Year");

      const req: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "1234",
        expMonth: 12,
        expYear: 2020, // In the past
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.details.some((d: any) => d.field === "expYear" && d.issue === "expired_or_invalid")).toBe(true);
    });

    it("accepts current year as valid expYear", () => {
      const memberId = createActiveMember("pm-val-year-ok@example.com", "PM", "YearOK");
      const currentYear = new Date().getFullYear();

      const req: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "1234",
        expMonth: 12,
        expYear: currentYear,
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.items[0].expYear).toBe(currentYear);
    });

    it("accepts optional label as null", () => {
      const memberId = createActiveMember("pm-no-label@example.com", "PM", "NoLabel");

      const req: any = makeAuthReq(memberId, {
        brand: "Amex",
        last4: "9999",
        expMonth: 6,
        expYear: 2035,
      });
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.items[0].label).toBe(null);
    });

    it("rejects unauthenticated access", () => {
      const req: any = {
        headers: {},
        body: { brand: "Visa", last4: "1234", expMonth: 12, expYear: 2030 },
      };
      const res = mockRes();
      createMemberPaymentMethod(req as any, res as any);

      expect(res.statusCode).toBe(401);
    });

    it("returns methods sorted by createdAt (newest first)", () => {
      const memberId = createActiveMember("pm-sorted@example.com", "PM", "Sorted");

      // Create first method
      const req1: any = makeAuthReq(memberId, {
        brand: "Visa",
        last4: "0001",
        expMonth: 1,
        expYear: 2030,
        label: "First",
      });
      const res1 = mockRes();
      createMemberPaymentMethod(req1 as any, res1 as any);

      // Create second method
      const req2: any = makeAuthReq(memberId, {
        brand: "MasterCard",
        last4: "0002",
        expMonth: 2,
        expYear: 2030,
        label: "Second",
      });
      const res2 = mockRes();
      createMemberPaymentMethod(req2 as any, res2 as any);

      // The newest (Second) should be first in the list
      expect(res2.body.items[0].label).toBe("Second");
      expect(res2.body.items[1].label).toBe("First");
    });
  });
});

// =============================================================================
// Admin Manual Member Creation (M-3)
// =============================================================================
describe("admin creates member manually (M-3)", () => {
  const makeAdminReq = (body: any) => ({
    user: { memberId: "admin-1", tenantId: "t1", roles: ["admin", "member"] },
    headers: { "x-tenant-id": "t1" },
    body,
  });

  const makeMemberReq = (body: any) => ({
    user: { memberId: "member-1", tenantId: "t1", roles: ["member"] },
    headers: { "x-tenant-id": "t1" },
    body,
  });

  describe("POST /members/admin", () => {
    it("creates member with required fields only", () => {
      const req: any = makeAdminReq({
        email: "admin-create-1@example.com",
        first_name: "John",
        last_name: "Doe",
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.email).toBe("admin-create-1@example.com");
      expect(res.body.first_name).toBe("John");
      expect(res.body.last_name).toBe("Doe");
      expect(res.body.status).toBe("active");
      expect(res.body.id).toBeDefined();
      expect(res.body.created_at).toBeDefined();
      expect(res.body.phone).toBe(null);
      expect(res.body.address).toBe(null);
      expect(res.body.linkedinUrl).toBe(null);
      expect(res.body.otherSocials).toBe(null);
    });

    it("creates member with all optional fields", () => {
      const req: any = makeAdminReq({
        email: "admin-create-2@example.com",
        first_name: "Jane",
        last_name: "Smith",
        phone: "555-1234",
        address: "123 Main St",
        linkedinUrl: "https://linkedin.com/in/janesmith",
        otherSocials: "@janesmith",
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.phone).toBe("555-1234");
      expect(res.body.address).toBe("123 Main St");
      expect(res.body.linkedinUrl).toBe("https://linkedin.com/in/janesmith");
      expect(res.body.otherSocials).toBe("@janesmith");
    });

    it("returns 403 for non-admin user", () => {
      const req: any = makeMemberReq({
        email: "not-admin@example.com",
        first_name: "Not",
        last_name: "Admin",
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe("forbidden");
    });

    it("returns 401 for unauthenticated user", () => {
      const req: any = { headers: {}, body: { email: "unauth@example.com", first_name: "No", last_name: "Auth" } };
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(401);
    });

    it("returns 409 for duplicate email", () => {
      // Create first member
      const req1: any = makeAdminReq({
        email: "admin-dup@example.com",
        first_name: "First",
        last_name: "User",
      });
      const res1 = mockRes();
      createMemberAdmin(req1 as any, res1 as any);
      expect(res1.statusCode).toBe(201);

      // Try to create another with same email
      const req2: any = makeAdminReq({
        email: "admin-dup@example.com",
        first_name: "Second",
        last_name: "User",
      });
      const res2 = mockRes();
      createMemberAdmin(req2 as any, res2 as any);

      expect(res2.statusCode).toBe(409);
      expect(res2.body.error.code).toBe("conflict");
      expect(res2.body.error.message).toBe("A member with this email already exists");
    });

    it("returns 400 for missing required fields", () => {
      const req: any = makeAdminReq({
        email: "missing@example.com",
        // missing first_name and last_name
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details).toContainEqual({ field: "first_name", issue: "required" });
      expect(res.body.error.details).toContainEqual({ field: "last_name", issue: "required" });
    });

    it("returns 400 for invalid email format", () => {
      const req: any = makeAdminReq({
        email: "not-an-email",
        first_name: "Test",
        last_name: "User",
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details).toContainEqual({ field: "email", issue: "invalid" });
    });

    it("returns 400 for invalid LinkedIn URL", () => {
      const req: any = makeAdminReq({
        email: "bad-linkedin@example.com",
        first_name: "Bad",
        last_name: "LinkedIn",
        linkedinUrl: "not-a-linkedin-url",
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details).toContainEqual({ field: "linkedinUrl", issue: "invalid_url" });
    });

    it("accepts LinkedIn URL that starts with http and contains linkedin.com", () => {
      const req: any = makeAdminReq({
        email: "good-linkedin@example.com",
        first_name: "Good",
        last_name: "LinkedIn",
        linkedinUrl: "http://www.linkedin.com/in/gooduser",
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.linkedinUrl).toBe("http://www.linkedin.com/in/gooduser");
    });

    it("creates member with custom roles", () => {
      const req: any = makeAdminReq({
        email: "admin-roles@example.com",
        first_name: "Roles",
        last_name: "Test",
        roles: ["member", "event_manager"],
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.roles).toEqual(["member", "event_manager"]);
    });

    it("creates member with multiple roles including admin", () => {
      const req: any = makeAdminReq({
        email: "admin-multi-roles@example.com",
        first_name: "Multi",
        last_name: "Roles",
        roles: ["admin", "member", "finance_manager", "communications_manager"],
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.roles).toContain("admin");
      expect(res.body.roles).toContain("member");
      expect(res.body.roles).toContain("finance_manager");
      expect(res.body.roles).toContain("communications_manager");
    });

    it("defaults to member role when no roles specified", () => {
      const req: any = makeAdminReq({
        email: "admin-default-role@example.com",
        first_name: "Default",
        last_name: "Role",
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.body.roles).toEqual(["member"]);
    });

    it("returns 400 for empty roles array", () => {
      const req: any = makeAdminReq({
        email: "admin-empty-roles@example.com",
        first_name: "Empty",
        last_name: "Roles",
        roles: [],
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details).toContainEqual({ field: "roles", issue: "cannot_be_empty" });
    });

    it("returns 400 for invalid role value", () => {
      const req: any = makeAdminReq({
        email: "admin-invalid-role@example.com",
        first_name: "Invalid",
        last_name: "Role",
        roles: ["member", "superadmin"],
      });
      const res = mockRes();
      createMemberAdmin(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details.some((d: any) => d.field === "roles" && d.issue.includes("superadmin"))).toBe(true);
    });
  });
});

// =============================================================================
// Admin Role Management (M-13)
// =============================================================================
describe("admin updates member roles (M-13)", () => {
  const makeAdminReq = (memberId: string, body: any) => ({
    user: { memberId: "admin-1", tenantId: "t1", roles: ["admin", "member"] },
    headers: { "x-tenant-id": "t1" },
    params: { id: memberId },
    body,
  });

  const makeMemberReq = (memberId: string, body: any) => ({
    user: { memberId: "member-1", tenantId: "t1", roles: ["member"] },
    headers: { "x-tenant-id": "t1" },
    params: { id: memberId },
    body,
  });

  // Helper to create a member for role tests
  const createTestMember = (email: string, firstName: string, lastName: string) => {
    const req: any = {
      user: { memberId: "admin-1", tenantId: "t1", roles: ["admin", "member"] },
      headers: { "x-tenant-id": "t1" },
      body: { email, first_name: firstName, last_name: lastName },
    };
    const res = mockRes();
    createMemberAdmin(req as any, res as any);
    return res.body.id;
  };

  describe("PUT /members/:id/roles", () => {
    it("updates member roles successfully", () => {
      const memberId = createTestMember("role-update-1@example.com", "Role", "Update");

      const req: any = makeAdminReq(memberId, {
        roles: ["member", "event_manager", "finance_manager"],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.roles).toContain("member");
      expect(res.body.roles).toContain("event_manager");
      expect(res.body.roles).toContain("finance_manager");
      expect(res.body.id).toBe(memberId);
      expect(res.body.email).toBe("role-update-1@example.com");
    });

    it("can add admin role to a member", () => {
      const memberId = createTestMember("role-add-admin@example.com", "Add", "Admin");

      const req: any = makeAdminReq(memberId, {
        roles: ["admin", "member"],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.roles).toContain("admin");
      expect(res.body.roles).toContain("member");
    });

    it("can remove admin role from a member", () => {
      // First create member with admin role
      const createReq: any = {
        user: { memberId: "admin-1", tenantId: "t1", roles: ["admin", "member"] },
        headers: { "x-tenant-id": "t1" },
        body: { 
          email: "role-remove-admin@example.com", 
          first_name: "Remove", 
          last_name: "Admin",
          roles: ["admin", "member"]
        },
      };
      const createRes = mockRes();
      createMemberAdmin(createReq as any, createRes as any);
      const memberId = createRes.body.id;

      // Now remove admin role
      const req: any = makeAdminReq(memberId, {
        roles: ["member"],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.roles).not.toContain("admin");
      expect(res.body.roles).toContain("member");
    });

    it("can set all available roles", () => {
      const memberId = createTestMember("role-all@example.com", "All", "Roles");

      const req: any = makeAdminReq(memberId, {
        roles: ["admin", "member", "event_manager", "finance_manager", "communications_manager"],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.body.roles.length).toBe(5);
      expect(res.body.roles).toContain("admin");
      expect(res.body.roles).toContain("member");
      expect(res.body.roles).toContain("event_manager");
      expect(res.body.roles).toContain("finance_manager");
      expect(res.body.roles).toContain("communications_manager");
    });

    it("returns 400 when roles array is empty", () => {
      const memberId = createTestMember("role-empty@example.com", "Empty", "Roles");

      const req: any = makeAdminReq(memberId, {
        roles: [],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details).toContainEqual({ field: "roles", issue: "cannot_be_empty" });
    });

    it("returns 400 when roles is not an array", () => {
      const memberId = createTestMember("role-notarray@example.com", "Not", "Array");

      const req: any = makeAdminReq(memberId, {
        roles: "admin",
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details).toContainEqual({ field: "roles", issue: "must_be_array" });
    });

    it("returns 400 when roles is missing", () => {
      const memberId = createTestMember("role-missing@example.com", "Missing", "Roles");

      const req: any = makeAdminReq(memberId, {});
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details).toContainEqual({ field: "roles", issue: "required" });
    });

    it("returns 400 when roles contain invalid values", () => {
      const memberId = createTestMember("role-invalid@example.com", "Invalid", "Role");

      const req: any = makeAdminReq(memberId, {
        roles: ["member", "superuser", "god_mode"],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("validation_failed");
      expect(res.body.error.details.some((d: any) => d.field === "roles" && d.issue.includes("superuser"))).toBe(true);
    });

    it("returns 404 when member not found", () => {
      const req: any = makeAdminReq("m-nonexistent", {
        roles: ["member"],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe("not_found");
    });

    it("returns 403 for non-admin user", () => {
      const memberId = createTestMember("role-nonadmin@example.com", "Non", "Admin");

      const req: any = makeMemberReq(memberId, {
        roles: ["admin", "member"],
      });
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe("forbidden");
    });

    it("returns 401 for unauthenticated user", () => {
      const req: any = {
        headers: {},
        params: { id: "m-any" },
        body: { roles: ["member"] },
      };
      const res = mockRes();
      updateMemberRoles(req as any, res as any);

      expect(res.statusCode).toBe(401);
    });
  });
});

