import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "./authMiddleware";

export function applyTenantScope<T extends { where?: Record<string, any> }>(query: T, tenantId: string): T {
  return {
    ...query,
    where: {
      ...(query.where || {}),
      tenantId,
    },
  };
}

export function ensureTenantMatch(paramKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const pathTenant = (req.params as any)[paramKey];
    if (!authReq.user) return res.status(401).json({ error: "Unauthorized" });
    if (pathTenant && pathTenant !== authReq.user.tenantId) {
      return res.status(403).json({ error: "Tenant mismatch" });
    }
    return next();
  };
}

