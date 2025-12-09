import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db/prisma";
import { verifyToken } from "./lib/jwt";

export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  roles: string[];
  email?: string | null;
  memberId?: string | null;
};

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

const PUBLIC_PATHS = ["/health", "/auth/health", "/auth/login", "/auth/register"];

const isPublicPath = (path: string) => PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (isPublicPath(req.path)) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, tenantId: true, roles: true, memberId: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    if (user.tenantId !== payload.tenantId) {
      return res.status(403).json({ error: "Tenant mismatch" });
    }

    const roles = (user.roles || []).map((r) => r.toUpperCase());
    (req as AuthenticatedRequest).user = {
      userId: user.id,
      tenantId: user.tenantId,
      roles,
      email: user.email,
      memberId: user.memberId ?? null,
    };
    return next();
  } catch (err) {
    console.error("[authMiddleware] Invalid token", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

