import type { Request } from "express";
import { prisma } from "../db/prisma";

export async function getUserFromAuthHeader(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  const userId = token.startsWith("user-") ? token.slice("user-".length) : token;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

