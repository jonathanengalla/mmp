import { Router, Request, Response } from "express";

const router = Router();

interface User {
  id: string;
  email: string;
  password: string;
  roles: string[];
  tenantId?: string;
  memberId?: string;
}

// Simple in-memory dev user
const users: User[] = [
  {
    id: "1",
    email: "admin@test.local",
    password: "password123",
    roles: ["admin", "member", "event_manager", "finance_manager", "communications_manager"],
    tenantId: "t1",
    memberId: "m-dev",
  },
];

router.post("/login", (req: Request, res: Response) => {
  try {
    console.log("[auth-service] POST /auth/login headers:", req.headers);
    console.log("[auth-service] POST /auth/login body:", req.body);

    const { email, password } = (req.body || {}) as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      console.warn("[auth-service] Missing email or password", {
        email,
        passwordPresent: !!password,
      });
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const user = users.find((u) => u.email === email);

    if (!user || user.password !== password) {
      console.warn("[auth-service] Invalid credentials for", email);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log("[auth-service] Login OK for", email);

    return res.json({
      success: true,
      token: "dev-token-123",
    roles: user.roles,
      user: {
        id: user.id,
        email: user.email,
      roles: user.roles,
      },
    tenant_id: user.tenantId || "t1",
    member_id: user.memberId || "m-dev",
    });
  } catch (err) {
    console.error("[auth-service] Unexpected error in /auth/login:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;