import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./authMiddleware";

const normalizeRoles = (roles?: string[]) => (roles || []).map((r) => r.toUpperCase());

export function requireRole(role: "ADMIN" | "OFFICER" | "MEMBER" | "GUEST") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const roles = normalizeRoles(req.user?.roles);
    if (roles.includes(role)) return next();
    return res.status(403).json({ error: { message: "Forbidden" } });
  };
}

export function requireAnyRole(allowed: Array<"ADMIN" | "OFFICER" | "MEMBER" | "GUEST">) {
  const allowedSet = new Set(allowed.map((r) => r.toUpperCase()));
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const roles = normalizeRoles(req.user?.roles);
    const has = roles.some((r) => allowedSet.has(r));
    if (has) return next();
    return res.status(403).json({ error: { message: "Forbidden" } });
  };
}

