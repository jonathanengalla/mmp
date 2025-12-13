import { MemberStatus } from "@prisma/client";
import { prisma } from "./db/prisma";

export type CreateMemberInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  address?: string | null;
  linkedinUrl?: string | null;
  otherSocials?: string | null;
};

export function listMembersForTenant(tenantId: string, status?: MemberStatus) {
  return prisma.member.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getMemberByIdForTenant(tenantId: string, memberId: string) {
  return prisma.member.findFirst({
    where: { id: memberId, tenantId },
  });
}

export function createMemberForTenant(tenantId: string, payload: CreateMemberInput) {
  return prisma.member.create({
    data: {
      tenantId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      linkedinUrl: payload.linkedinUrl ?? null,
      otherSocials: payload.otherSocials ?? null,
      status: MemberStatus.PENDING_VERIFICATION,
    },
  });
}

export function upsertMemberByTenantEmail(tenantId: string, payload: CreateMemberInput) {
  return prisma.member.upsert({
    where: { tenantId_email: { tenantId, email: payload.email } },
    update: {},
    create: {
      tenantId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone ?? null,
      address: payload.address ?? null,
      status: MemberStatus.ACTIVE,
    },
  });
}

export function approveMemberForTenant(tenantId: string, memberId: string, approverUserId?: string) {
  return prisma.member.update({
    where: { id_tenantId: { id: memberId, tenantId } },
    data: {
      status: MemberStatus.ACTIVE,
      // approverUserId could be stored here if the schema supports it in future
    },
  });
}

export function rejectMemberForTenant(tenantId: string, memberId: string) {
  return prisma.member.update({
    where: { id_tenantId: { id: memberId, tenantId } },
    data: { status: MemberStatus.INACTIVE },
  });
}

export function setVerificationTokenForTenant(tenantId: string, memberId: string, token: string, expiresAt: Date) {
  return prisma.member.update({
    where: { id_tenantId: { id: memberId, tenantId } },
    data: {
      verificationToken: token,
      verificationExpires: expiresAt,
    },
  });
}

export function verifyMemberByToken(tenantId: string, token: string) {
  return prisma.member.updateMany({
    where: {
      tenantId,
      verificationToken: token,
      verificationExpires: { gt: new Date() },
    },
    data: {
      status: MemberStatus.ACTIVE,
      verificationToken: null,
      verificationExpires: null,
    },
  });
}

