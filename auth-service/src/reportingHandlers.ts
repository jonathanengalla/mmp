import { Request, Response } from "express";
import { MemberStatus } from "@prisma/client";
import { prisma } from "./db/prisma";
import type { AuthenticatedRequest } from "./authMiddleware";

const normalizeStatus = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  return ["ACTIVE", "INACTIVE", "PENDING_VERIFICATION"].includes(normalized)
    ? (normalized as MemberStatus)
    : undefined;
};

export async function listMembersReport(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const tenantId = req.user.tenantId;
    const statusRaw = (req.query.status as string | undefined) || undefined;
    const statusFilter = normalizeStatus(statusRaw);
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);

    const where: any = { tenantId };
    if (statusFilter) where.status = statusFilter;

    const [totalItems, members] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = members.map((m) => ({
      memberId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      status: m.status,
      membershipTypeId: (m as any).membershipType ?? null,
      createdAt: m.createdAt ? new Date(m.createdAt).getTime() : null,
    }));

    return res.json({
      items,
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch (err) {
    console.error("[reporting] listMembersReport error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

