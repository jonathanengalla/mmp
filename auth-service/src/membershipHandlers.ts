import type { Request, Response } from "express";
import { EventRegistrationStatus, InvoiceStatus, MemberStatus } from "@prisma/client";
import {
  approveMemberForTenant,
  createMemberForTenant,
  getMemberByIdForTenant,
  listMembersForTenant,
  rejectMemberForTenant,
  setVerificationTokenForTenant,
  verifyMemberByToken,
} from "./membershipStore";
import type { AuthenticatedRequest } from "./authMiddleware";
import { prisma } from "./db/prisma";
import { listPaymentMethodsForMember, removePaymentMethod, savePaymentMethod } from "./billingStore";
import type { MemberStatusType, MemberSelfSummary, MembersAdminSummary } from "../../libs/shared/src/models";

const sanitizeMember = (m: any) => {
  const classification = Array.isArray(m.tags) && m.tags.length > 0 ? m.tags[0] : null;
  return {
    id: m.id,
    email: m.email,
    firstName: m.firstName,
    lastName: m.lastName,
    first_name: m.firstName,
    last_name: m.lastName,
    status: m.status,
    phone: m.phone ?? null,
    address: m.address ?? null,
    linkedinUrl: (m as any).linkedinUrl ?? null,
    otherSocials: (m as any).otherSocials ?? null,
    avatarUrl: (m as any).avatarUrl ?? null,
    avatar_url: (m as any).avatarUrl ?? null,
    classification,
    sponsor: null,
    createdAt: m.createdAt,
    created_at: m.createdAt,
  };
};

const saveMemberAvatar = (tenantId: string, memberId: string, avatarUrl: string | null) => {
  return prisma.member.update({
    where: { id_tenantId: { id: memberId, tenantId } },
    data: { avatarUrl },
  });
};

const sanitizePaymentMethod = (pm: any) => ({
  id: pm.id,
  tenantId: pm.tenantId,
  memberId: pm.memberId,
  brand: pm.brand,
  last4: pm.last4,
  expMonth: pm.expMonth,
  expYear: pm.expYear,
  label: pm.label ?? null,
  isDefault: pm.isDefault ?? false,
  status: pm.status ?? "ACTIVE",
  createdAt: pm.createdAt ? new Date(pm.createdAt).getTime() : Date.now(),
  updatedAt: pm.updatedAt ? new Date(pm.updatedAt).getTime() : Date.now(),
  // Do not expose PAN/CVC; token is a non-sensitive reference
  token: pm.token ?? null,
});

async function ensureMemberForUser(req: AuthenticatedRequest) {
  if (!req.user) return null;
  const tenantId = req.user.tenantId;
  const userId = req.user.userId;
  if (req.user.memberId) {
    const existing = await getMemberByIdForTenant(tenantId, req.user.memberId);
    if (existing) return existing;
  }
  const email = req.user.email || "user@example.com";
  const firstName = (email.split("@")[0] || "User").split(".")[0] || "User";
  // Upsert member by tenant/email to avoid P2002 on concurrent requests
  const member = await prisma.$transaction(async (tx) => {
    const m = await tx.member.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: {},
      create: {
        tenantId,
        email,
        firstName,
        lastName: "Member",
        phone: null,
        address: null,
        status: MemberStatus.ACTIVE,
      },
    });
    // Link user to member if not already linked
    if (!req.user?.memberId || req.user.memberId !== m.id) {
      await tx.user.update({ where: { id: userId }, data: { memberId: m.id } });
      (req.user as any).memberId = m.id;
    }
    return m;
  });
  return member;
}

export const listMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const statusFilter = req.query.status as MemberStatus | undefined;
    const members = await listMembersForTenant(req.user.tenantId, statusFilter);
    return res.json({ items: members.map(sanitizeMember) });
  } catch (err) {
    console.error("[membership] listMembers error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const listPendingMembers = async (req: AuthenticatedRequest, res: Response) => {
  req.query.status = MemberStatus.PENDING_VERIFICATION;
  return listMembers(req, res);
};

export const getMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id;
    const member = await getMemberByIdForTenant(req.user.tenantId, memberId);
    if (!member) return res.status(404).json({ error: "Member not found" });
    return res.json(sanitizeMember(member));
  } catch (err) {
    console.error("[membership] getMember error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getCurrentMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    return res.json(sanitizeMember(member));
  } catch (err) {
    console.error("[membership] getCurrentMember error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createRegistration = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { email, firstName, lastName, phone, address } = req.body || {};
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: "email, firstName, lastName are required" });
    }
    const member = await createMemberForTenant(req.user.tenantId, { email, firstName, lastName, phone, address });
    return res.status(201).json(sanitizeMember(member));
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Member already exists for this tenant" });
    }
    console.error("[membership] createRegistration error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const normalizeOptional = (value: any) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

export const updateCurrentMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const { phone, address, linkedinUrl, otherSocials, firstName, lastName } = req.body || {};
    const updated = await prisma.member.update({
      where: { id_tenantId: { id: member.id, tenantId: req.user.tenantId } },
      data: {
        firstName: normalizeOptional(firstName) ?? member.firstName,
        lastName: normalizeOptional(lastName) ?? member.lastName,
        phone: normalizeOptional(phone),
        address: normalizeOptional(address),
        linkedinUrl: normalizeOptional(linkedinUrl),
        otherSocials: normalizeOptional(otherSocials),
      },
    });
    return res.json(sanitizeMember(updated));
  } catch (err) {
    console.error("[membership] updateCurrentMember error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateMemberContact = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id || req.user.memberId;
    if (!memberId) return res.status(404).json({ error: "Member not found" });
    const { phone, address } = req.body || {};
    const updated = await prisma.member.update({
      where: { id_tenantId: { id: memberId, tenantId: req.user.tenantId } },
      data: {
        phone: phone ?? undefined,
        address: address ?? undefined,
      },
    });
    return res.json(sanitizeMember(updated));
  } catch (err) {
    console.error("[membership] updateMemberContact error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateMemberRoles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id;
    if (!memberId) return res.status(400).json({ error: "memberId is required" });
    const roles = Array.isArray(req.body?.roles) ? req.body.roles : [];
    const updated = await prisma.member.update({
      where: { id_tenantId: { id: memberId, tenantId: req.user.tenantId } },
      data: { roles },
    });
    return res.json(sanitizeMember(updated));
  } catch (err) {
    console.error("[membership] updateMemberRoles error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deactivateMemberAccount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id;
    if (!memberId) return res.status(400).json({ error: "memberId is required" });
    const updated = await prisma.member.update({
      where: { id_tenantId: { id: memberId, tenantId: req.user.tenantId } },
      data: { status: MemberStatus.INACTIVE },
    });
    return res.json(sanitizeMember(updated));
  } catch (err) {
    console.error("[membership] deactivateMemberAccount error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const adminUpdateAvatar = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id;
    if (!memberId) return res.status(400).json({ error: "memberId is required" });
    const avatarUrl = req.body?.avatarUrl ?? null;
    const updated = await saveMemberAvatar(req.user.tenantId, memberId, avatarUrl);
    return res.json({ memberId: updated.id, avatarUrl: updated.avatarUrl ?? null, success: true });
  } catch (err) {
    console.error("[membership] adminUpdateAvatar error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const importMembersPlaceholder = async (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ imported: 0, skipped: 0 });
};

export const auditMemberPlaceholder = async (_req: AuthenticatedRequest, res: Response) => {
  return res.json({ items: [] });
};

export const approveMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id;
    const existing = await getMemberByIdForTenant(req.user.tenantId, memberId);
    if (!existing) return res.status(404).json({ error: "Member not found" });
    const updated = await approveMemberForTenant(req.user.tenantId, memberId, req.user.userId);
    return res.json(sanitizeMember(updated));
  } catch (err) {
    console.error("[membership] approveMember error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const rejectMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id;
    const existing = await getMemberByIdForTenant(req.user.tenantId, memberId);
    if (!existing) return res.status(404).json({ error: "Member not found" });
    const updated = await rejectMemberForTenant(req.user.tenantId, memberId);
    return res.json(sanitizeMember(updated));
  } catch (err) {
    console.error("[membership] rejectMember error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const requestVerification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.user.memberId;
    if (!memberId) return res.status(404).json({ error: "Member not found" });
    const token = `v-${Math.random().toString(36).slice(2, 10)}`;
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updated = await setVerificationTokenForTenant(req.user.tenantId, memberId, token, expires);
    return res.json({ ...sanitizeMember(updated), verificationToken: token, verificationExpires: expires });
  } catch (err) {
    console.error("[membership] requestVerification error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const verify = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const token = (req.params.token as string) || (req.body?.token as string);
    if (!token) return res.status(400).json({ error: "Verification token is required" });
    const result = await verifyMemberByToken(req.user.tenantId, token);
    if ((result as any).count === 0) {
      return res.status(404).json({ error: "Invalid or expired token" });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("[membership] verify error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const searchDirectoryMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const q = (req.query.q as string | undefined)?.trim();
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const members = await listMembersForTenant(req.user.tenantId);
    const filtered = q
      ? members.filter((m) => {
          const target = `${m.firstName} ${m.lastName} ${m.email} ${(Array.isArray(m.tags) && m.tags[0]) || ""}`.toLowerCase();
          return target.includes(q.toLowerCase());
        })
      : members;

    const total = filtered.length;
    const page = filtered.slice(offset, offset + limit);

    return res.json({
      items: page.map(sanitizeMember),
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[membership] searchDirectoryMembers error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getProfileCustomFieldSchema = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  console.log("[membership] profile custom-field schema returned (empty)", { tenantId: req.user.tenantId });
  return res.json({ groups: [], fields: [], updatedAt: Date.now() });
};

export const getCurrentMemberCustomFields = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    console.log("[membership] current member custom-fields returned (empty)", {
      tenantId: req.user.tenantId,
      memberId: member.id,
    });
    return res.json({ memberId: member.id, fields: {} });
  } catch (err) {
    console.error("[membership] getCurrentMemberCustomFields error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMemberPaymentMethods = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const methods = await listPaymentMethodsForMember(req.user.tenantId, member.id);
    const sanitized = methods.map(sanitizePaymentMethod);
    const defaultId = sanitized.find((m) => m.isDefault)?.id ?? null;
    return res.json({ items: sanitized, defaultId });
  } catch (err) {
    console.error("[membership] getMemberPaymentMethods error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createMemberPaymentMethod = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const { brand, last4, expMonth, expYear, label } = req.body || {};
    if (!brand || !last4 || !expMonth || !expYear) {
      return res.status(400).json({ error: "brand, last4, expMonth, expYear are required" });
    }
    if (!/^\d{4}$/.test(String(last4))) {
      return res.status(400).json({ error: "last4 must be exactly 4 digits" });
    }

    // Generate a non-sensitive token placeholder. No PAN/CVC is stored.
    const token = `dev-token-${brand}-${last4}-${Date.now()}`;

    await savePaymentMethod(req.user.tenantId, {
      memberId: member.id,
      token,
      brand,
      last4: String(last4),
      expiryMonth: Number(expMonth),
      expiryYear: Number(expYear),
      label: label ?? null,
    });

    const methods = await listPaymentMethodsForMember(req.user.tenantId, member.id);
    const sanitized = methods.map(sanitizePaymentMethod);
    const defaultId = sanitized.find((m) => m.isDefault)?.id ?? null;
    return res.status(201).json({ items: sanitized, defaultId });
  } catch (err) {
    console.error("[membership] createMemberPaymentMethod error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMemberPaymentMethod = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "paymentMethodId is required" });

    // Delete within tenant/member scope. Payments will retain history via FK ON DELETE SET NULL.
    await removePaymentMethod(req.user.tenantId, member.id, id);

    const methods = await listPaymentMethodsForMember(req.user.tenantId, member.id);
    const sanitized = methods.map(sanitizePaymentMethod);
    const defaultId = sanitized.find((m) => m.isDefault)?.id ?? null;
    return res.json({ items: sanitized, defaultId });
  } catch (err: any) {
    const message = err?.message || "";
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Payment method not found" });
    }
    console.error("[membership] deleteMemberPaymentMethod error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateMyAvatar = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const avatarUrl = req.body?.avatarUrl ?? null;
    const updated = await saveMemberAvatar(req.user.tenantId, member.id, avatarUrl);
    return res.json({ memberId: updated.id, avatarUrl: updated.avatarUrl ?? null, success: true });
  } catch (err) {
    console.error("[membership] updateMyAvatar error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const uploadPhoto = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.params.id;
    const member = memberId
      ? await getMemberByIdForTenant(req.user.tenantId, memberId)
      : await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    const avatarUrl = req.body?.avatarUrl ?? null;
    const updated = await saveMemberAvatar(req.user.tenantId, member.id, avatarUrl);
    return res.json({ memberId: updated.id, avatarUrl: updated.avatarUrl ?? null, success: true });
  } catch (err) {
    console.error("[membership] uploadPhoto error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProfileCustomFieldSchema = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  console.log("[membership] updateProfileCustomFieldSchema placeholder", { tenantId: req.user.tenantId });
  return res.json({ groups: [], fields: [], updatedAt: Date.now() });
};

export const updateCurrentMemberCustomFields = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    console.log("[membership] updateCurrentMemberCustomFields placeholder", {
      tenantId: req.user.tenantId,
      memberId: member.id,
    });
    return res.json({ memberId: member.id, fields: req.body?.customFields || {} });
  } catch (err) {
    console.error("[membership] updateCurrentMemberCustomFields error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const adminGetMemberCustomFields = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  console.log("[membership] adminGetMemberCustomFields placeholder");
  return res.json({ schema: { groups: [], fields: [], updatedAt: Date.now() }, customFields: {} });
};

export const adminUpdateMemberCustomFields = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  console.log("[membership] adminUpdateMemberCustomFields placeholder");
  return res.json({ schema: { groups: [], fields: [], updatedAt: Date.now() }, customFields: req.body?.customFields || {} });
};

const hasAnyRole = (userRoles: string[] | undefined, allowed: string[]) => {
  const roles = userRoles || [];
  return allowed.some((role) => roles.includes(role));
};

const mapMemberStatus = (status: MemberStatus): MemberStatusType => {
  switch (status) {
    case MemberStatus.ACTIVE:
      return "ACTIVE";
    case MemberStatus.PENDING_VERIFICATION:
      return "PENDING_VERIFICATION";
    case MemberStatus.SUSPENDED:
      return "SUSPENDED";
    case MemberStatus.INACTIVE:
    default:
      return "INACTIVE";
  }
};

export const getMembershipAdminSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const allowedRoles = ["ADMIN", "FINANCE_MANAGER", "EVENT_MANAGER", "COMMUNICATIONS_MANAGER", "SUPER_ADMIN"];
    if (!hasAnyRole(req.user.roles, allowedRoles)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const tenantId = req.user.tenantId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const members = await prisma.member.findMany({
      where: { tenantId },
      select: { status: true, createdAt: true, tags: true },
    });

    const summary: MembersAdminSummary = {
      totalActive: 0,
      pendingApproval: 0,
      inactiveOrSuspended: 0,
      joinedLast30Days: 0,
      supporterOnlyCount: 0,
    };

    members.forEach((m) => {
      if (m.status === MemberStatus.ACTIVE) {
        summary.totalActive += 1;
        if (m.createdAt && m.createdAt >= thirtyDaysAgo) {
          summary.joinedLast30Days += 1;
        }
      } else if (m.status === MemberStatus.PENDING_VERIFICATION) {
        summary.pendingApproval += 1;
      } else if (m.status === MemberStatus.INACTIVE || m.status === MemberStatus.SUSPENDED) {
        summary.inactiveOrSuspended += 1;
      }

      const tags = Array.isArray(m.tags) ? m.tags : [];
      const hasSupporterTag = tags.some(
        (tag) => typeof tag === "string" && tag.toLowerCase().includes("supporter")
      );
      if (hasSupporterTag) {
        summary.supporterOnlyCount = (summary.supporterOnlyCount || 0) + 1;
      }
    });

    return res.json(summary);
  } catch (err) {
    console.error("[membership] getMembershipAdminSummary error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMembershipSelfSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const memberId = req.user.memberId;
    if (!memberId) return res.status(400).json({ error: "Member ID missing" });

    const tenantId = req.user.tenantId;
    const member = await prisma.member.findFirst({
      where: { tenantId, id: memberId },
      select: { status: true, createdAt: true },
    });
    if (!member) return res.status(404).json({ error: "Member not found" });

    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const eventsAttendedThisYear = await prisma.eventRegistration.count({
      where: {
        tenantId,
        memberId,
        event: {
          startsAt: {
            gte: startOfYear,
            lte: now,
          },
        },
        OR: [
          { status: EventRegistrationStatus.CHECKED_IN },
          { checkInAt: { not: null } },
        ],
      },
    });

    const outstanding = await prisma.invoice.aggregate({
      where: {
        tenantId,
        memberId,
        source: "DUES",
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      _sum: { amountCents: true },
    });

    const response: MemberSelfSummary = {
      status: mapMemberStatus(member.status),
      memberSince: member.createdAt?.toISOString(),
      eventsAttendedThisYear,
      outstandingDuesCents: outstanding._sum.amountCents ?? 0,
    };

    return res.json(response);
  } catch (err) {
    console.error("[membership] getMembershipSelfSummary error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

