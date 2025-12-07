import { login } from "../src/handlers";
import { setUsers } from "../src/store";

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

const makeReq = (body: any) => ({ body });

describe("auth login", () => {
  beforeEach(() => {
    setUsers([
      {
        id: "u1",
        tenantId: "t1",
        memberId: "m1",
        email: "active@example.com",
        password: "P@ssw0rd!",
        status: "active",
        roles: ["member"],
      },
      {
        id: "u2",
        tenantId: "t1",
        memberId: "m2",
        email: "pending@example.com",
        password: "P@ssw0rd!",
        status: "pending",
        roles: ["member"],
      },
    ]);
  });

  it("returns tokens for active user", () => {
    const req: any = makeReq({ email: "active@example.com", password: "P@ssw0rd!" });
    const res = mockRes();
    login(req as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.member_id).toBe("m1");
  });

  it("rejects invalid credentials", () => {
    const req: any = makeReq({ email: "active@example.com", password: "bad" });
    const res = mockRes();
    login(req as any, res as any);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("rejects inactive/pending users", () => {
    const req: any = makeReq({ email: "pending@example.com", password: "P@ssw0rd!" });
    const res = mockRes();
    login(req as any, res as any);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBeDefined();
  });
});

