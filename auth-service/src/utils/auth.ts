import type { Request } from "express";
import { prisma } from "../db/prisma";
import { verifyToken } from "../lib/jwt";
import { applyTenantScope } from "../tenantGuard";

export async function getUserFromAuthHeader(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const payload = verifyToken(token);
  return prisma.user.findFirst(
    applyTenantScope(
      {
        where: {
          id: payload.userId,
        },
      },
      payload.tenantId
    )
  );
}

