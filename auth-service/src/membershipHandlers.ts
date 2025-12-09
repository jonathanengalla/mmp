import type { Request, Response } from "express";
import { MemberStatus } from "@prisma/client";
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

const sanitizeMember = (m: any) => ({
  id: m.id,
  email: m.email,
  firstName: m.firstName,
  lastName: m.lastName,
  status: m.status,
  phone: m.phone,
  address: m.address,
  roles: m.roles,
  tags: m.tags,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
  tenantId: m.tenantId,
});

async function ensureMemberForUser(req: AuthenticatedRequest) {
  if (!req.user) return null;
  const tenantId = req.user.tenantId;
  if (req.user.memberId) {
    const existing = await getMemberByIdForTenant(tenantId, req.user.memberId);
    if (existing) return existing;
  }
  const email = req.user.email || "user@example.com";
  const firstName = (email.split("@")[0] || "User").split(".")[0] || "User";
  const created = await createMemberForTenant(tenantId, {
    email,
    firstName,
    lastName: "Member",
    phone: null,
    address: null,
  });
  (req.user as any).memberId = created.id;
  return created;
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
    const members = await listMembersForTenant(req.user.tenantId);
    const filtered = q
      ? members.filter((m) => {
          const target = `${m.firstName} ${m.lastName} ${m.email}`.toLowerCase();
          return target.includes(q.toLowerCase());
        })
      : members;
    return res.json({ items: filtered.map(sanitizeMember) });
  } catch (err) {
    console.error("[membership] searchDirectoryMembers error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getProfileCustomFieldSchema = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  return res.json({ sections: [], version: 1 });
};

export const getCurrentMemberCustomFields = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const member = await ensureMemberForUser(req);
    if (!member) return res.status(404).json({ error: "Member not found" });
    return res.json({ memberId: member.id, fields: {} });
  } catch (err) {
    console.error("[membership] getCurrentMemberCustomFields error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

