import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "./db/prisma";
import { getUserFromAuthHeader } from "./utils/auth";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
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
      return res.status(400).json({ success: false, error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.warn("[auth-service] Invalid credentials for", email);
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      console.warn("[auth-service] Invalid credentials for", email);
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = `user-${user.id}`;
    console.log("[auth-service] Login OK for", email);

    return res.json({
      success: true,
      token,
      roles: user.roles,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
      tenant_id: user.tenantId || "t1",
      member_id: user.memberId || null,
    });
  } catch (err) {
    console.error("[auth/login] error", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/me", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
      tenant_id: user.tenantId || "t1",
      member_id: user.memberId || null,
    });
  } catch (err) {
    console.error("[auth-service] Unexpected error in /auth/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;