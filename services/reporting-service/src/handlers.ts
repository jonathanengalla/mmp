import { Request, Response } from "express";
import { prisma } from "../../auth-service/src/db/prisma";
import { getUserFromAuthHeader } from "../../auth-service/src/utils/auth";
import { MemberStatus } from "@prisma/client";

const errorResponse = (res: Response, code: string, message: string, details?: { field: string; issue: string }[], status = 400) =>
  res.status(status).json({ error: { code, message, details: details || [] }, trace_id: "trace-" + Date.now() });

export const listMembersReport = async (req: Request, res: Response) => {
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: { code: "unauthorized", message: "Auth required", details: [] } });
    const roles: string[] = user.roles || [];
    if (!roles.includes("admin")) return errorResponse(res, "forbidden", "Admin role required", [], 403);

    const tenantId = user.tenantId || "t1";
    const statusFilter = (req.query.status as string | undefined) || undefined;
    const page = Math.max(parseInt((req.query.page as string) || "1", 10), 1);
    const pageSize = Math.max(Math.min(parseInt((req.query.page_size as string) || "20", 10), 100), 1);

    const where: any = { tenantId };
    if (statusFilter) {
      const normalized = statusFilter.toUpperCase();
      if (["ACTIVE", "INACTIVE", "ARCHIVED"].includes(normalized)) {
        where.status = normalized as MemberStatus;
      }
    }

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
      member_id: m.id,
      first_name: m.firstName,
      last_name: m.lastName,
      email: m.email,
      status: m.status,
      membershipTypeId: m.membershipType,
      createdAt: m.createdAt ? new Date(m.createdAt).getTime() : null,
    }));

    return res.json({
      items,
      page,
      page_size: pageSize,
      total_items: totalItems,
      total_pages: Math.max(1, Math.ceil(totalItems / pageSize)),
    });
  } catch (err) {
    console.error("[reports/members] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Keep placeholders for other reports; still in-memory stubs unless wired later
export const duesSummaryReport = (_req: Request, res: Response) => {
  return res.status(501).json({ error: "Not implemented" });
};

export const eventAttendanceReport = (_req: Request, res: Response) => {
  return res.status(501).json({ error: "Not implemented" });
};

