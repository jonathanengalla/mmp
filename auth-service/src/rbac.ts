import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./authMiddleware";

const normalizeRoles = (roles?: string[]) => (roles || []).map((r) => r.toUpperCase());

export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const roles = normalizeRoles(req.user?.roles);
    const platformRoles = normalizeRoles(req.user?.platformRoles);
    if (roles.includes(role) || platformRoles.includes("SUPER_ADMIN")) return next();
    return res.status(403).json({ error: { message: "Forbidden" } });
  };
}

export function requireAnyRole(allowed: string[]) {
  const allowedSet = new Set(allowed.map((r) => r.toUpperCase()));
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const roles = normalizeRoles(req.user?.roles);
    const platformRoles = normalizeRoles(req.user?.platformRoles);
    const hasSuper = platformRoles.includes("SUPER_ADMIN");
    const has = roles.some((r) => allowedSet.has(r));
    if (has || hasSuper) return next();
    return res.status(403).json({ error: { message: "Forbidden" } });
  };
}

export function requirePlatformRole(allowed: Array<"SUPER_ADMIN">) {
  const allowedSet = new Set(allowed.map((r) => r.toUpperCase()));
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const roles = normalizeRoles(req.user?.platformRoles);
    const has = roles.some((r) => allowedSet.has(r));
    if (has) return next();
    return res.status(403).json({ error: { message: "Forbidden" } });
  };
}

