import { Router, Request, Response } from "express";
import { prisma } from "./db/prisma";
import { signToken } from "./lib/jwt";
import { applyTenantScope } from "./tenantGuard";
import type { AuthenticatedRequest } from "./authMiddleware";
import { verifyPassword } from "./utils/password";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    console.log("[auth-service] POST /auth/login headers:", req.headers);
    console.log("[auth-service] POST /auth/login body:", req.body);

    const { email, password, tenantId } = (req.body || {}) as {
      email?: string;
      password?: string;
      tenantId?: string;
    };

    if (!email || !password || !tenantId) {
      console.warn("[auth-service] Missing email, password, or tenantId", {
        email,
        passwordPresent: !!password,
        tenantId,
      });
      return res.status(400).json({ success: false, error: "Email, password, and tenantId are required" });
    }

    const user = (await prisma.user.findFirst({
      where: { email, tenantId },
      include: { roleAssignments: true },
    })) as any;

    console.log("[auth-service] login lookup result", {
      email,
      tenantId,
      userFound: !!user,
      userId: user?.id,
      status: user?.status,
      roles: user?.roles,
      memberId: user?.memberId,
    });

    if (!user) {
      console.warn("[auth-service] Invalid credentials for", email);
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const passwordMatches = await verifyPassword(user.passwordHash, password);
    console.log("[auth-service] login password compare", {
      email,
      tenantId,
      userId: user.id,
      passwordMatches,
    });

    if (!passwordMatches) {
      console.warn("[auth-service] Invalid credentials for", email);
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isActive = (user as any).status ? (user as any).status === "ACTIVE" : true;
    if (!isActive) {
      console.warn("[auth-service] Inactive user", { email, tenantId, userId: user.id, status: (user as any).status });
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const legacyRoles = (user.roles || []).map((r) => r.toUpperCase());
    const assignmentRoles = Array.isArray(user.roleAssignments)
      ? (user.roleAssignments as Array<{ role: string }>).map((r) => (r.role || "").toUpperCase())
      : [];
    const mapOfficer = (r: string) => (r === "OFFICER" ? "ADMIN" : r);
    const combinedRoles = Array.from(
      new Set([...legacyRoles, ...assignmentRoles].map(mapOfficer).filter((r) => !!r))
    ) as string[];

    const platformRoles = Array.from(
      new Set(((user.platformRoles || []) as string[]).map((r) => r.toUpperCase()))
    );
    const token = signToken({
      userId: user.id,
      tenantId: user.tenantId,
      roles: combinedRoles,
      platformRoles,
    });
    console.log("[auth-service] Login OK for", email, "tenant", tenantId);

    return res.json({
      success: true,
      token,
      roles: combinedRoles,
      user: {
        id: user.id,
        email: user.email,
        roles: combinedRoles,
        tenantId: user.tenantId,
        platformRoles,
      },
      tenant_id: user.tenantId,
      member_id: user.memberId || null,
    });
  } catch (err) {
    console.error("[auth/login] error", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/me", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const user = (await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { roleAssignments: true },
    })) as any;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const legacyRoles = (user.roles || []).map((r) => r.toUpperCase());
    const assignmentRoles = Array.isArray(user.roleAssignments)
      ? user.roleAssignments.map((r) => (r.role || "").toUpperCase())
      : [];
    const mapOfficer = (r: string) => (r === "OFFICER" ? "ADMIN" : r);
    const roles = Array.from(
      new Set([...legacyRoles, ...assignmentRoles].map(mapOfficer).filter(Boolean))
    ) as string[];
    const platformRoles = Array.from(
      new Set(((user.platformRoles || []) as string[]).map((r) => r.toUpperCase()))
    );
    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles,
        platformRoles,
      },
      tenant_id: user.tenantId,
      member_id: user.memberId || null,
    });
  } catch (err) {
    console.error("[auth-service] Unexpected error in /auth/me:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;