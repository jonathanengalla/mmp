-- BKS-01: Multi-tenant Prisma schema baseline

-- New enums
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "PaymentMethodStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "MembershipPeriod" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "EventRegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'CHECKED_IN');

-- Extend existing enums (idempotent on reapply)
ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'PENDING_VERIFICATION';
ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "MemberStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "EventStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'VOID';

-- Tenants
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- Membership types (per-tenant)
CREATE TABLE "MembershipType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "period" "MembershipPeriod" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MembershipType_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MembershipType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MembershipType_tenant_name_key" ON "MembershipType"("tenantId", "name");
CREATE UNIQUE INDEX "MembershipType_id_tenant_key" ON "MembershipType"("id", "tenantId");
CREATE INDEX "MembershipType_tenant_name_idx" ON "MembershipType"("tenantId", "name");

-- Existing Member adjustments
ALTER TABLE "Member" DROP COLUMN IF EXISTS "membershipType";
ALTER TABLE "Member" ADD COLUMN     "membershipTypeId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Member_email_tenantId_key" ON "Member"("tenantId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "Member_id_tenantId_key" ON "Member"("id", "tenantId");
CREATE INDEX IF NOT EXISTS "Member_tenant_email_idx" ON "Member"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "Member_tenant_status_idx" ON "Member"("tenantId", "status");

ALTER TABLE "Member" ADD CONSTRAINT "Member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_membershipTypeId_tenantId_fkey" FOREIGN KEY ("membershipTypeId", "tenantId") REFERENCES "MembershipType"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing User adjustments
CREATE UNIQUE INDEX IF NOT EXISTS "User_id_tenantId_key" ON "User"("id", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_tenantId_key" ON "User"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "User_tenant_email_idx" ON "User"("tenantId", "email");
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop and recreate user->member FK to include tenant
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_memberId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_memberId_tenantId_fkey" FOREIGN KEY ("memberId", "tenantId") REFERENCES "Member"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing Event adjustments
ALTER TABLE "Event" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT 't1';
ALTER TABLE "Event" ADD COLUMN     "slug" TEXT;
ALTER TABLE "Event" ADD COLUMN     "priceCents" INTEGER;
ALTER TABLE "Event" DROP COLUMN IF EXISTS "price";

UPDATE "Event" SET "slug" = COALESCE("slug", "id");
ALTER TABLE "Event" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Event_slug_tenantId_key" ON "Event"("tenantId", "slug");
CREATE UNIQUE INDEX "Event_id_tenantId_key" ON "Event"("id", "tenantId");
CREATE INDEX "Event_tenant_status_idx" ON "Event"("tenantId", "status");
ALTER TABLE "Event" ADD CONSTRAINT "Event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing Invoice adjustments
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_memberId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_eventId_fkey";
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_invoiceNumber_key";
ALTER TABLE "Invoice" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT 't1';
ALTER TABLE "Invoice" ADD COLUMN     "amountCents" INTEGER;
UPDATE "Invoice" SET "amountCents" = "amount";
ALTER TABLE "Invoice" ALTER COLUMN "amountCents" SET NOT NULL;
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "amount";

CREATE UNIQUE INDEX "Invoice_invoiceNumber_tenantId_key" ON "Invoice"("tenantId", "invoiceNumber");
CREATE UNIQUE INDEX "Invoice_id_tenantId_key" ON "Invoice"("id", "tenantId");
CREATE INDEX "Invoice_tenant_member_idx" ON "Invoice"("tenantId", "memberId");
CREATE INDEX "Invoice_tenant_status_idx" ON "Invoice"("tenantId", "status");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_memberId_tenantId_fkey" FOREIGN KEY ("memberId", "tenantId") REFERENCES "Member"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_eventId_tenantId_fkey" FOREIGN KEY ("eventId", "tenantId") REFERENCES "Event"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Payment methods
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "label" TEXT,
    "token" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "status" "PaymentMethodStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentMethod_memberId_tenantId_fkey" FOREIGN KEY ("memberId", "tenantId") REFERENCES "Member"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PaymentMethod_tenant_member_idx" ON "PaymentMethod"("tenantId", "memberId");
CREATE INDEX "PaymentMethod_tenant_default_idx" ON "PaymentMethod"("tenantId", "isDefault");
CREATE UNIQUE INDEX "PaymentMethod_id_tenantId_key" ON "PaymentMethod"("id", "tenantId");

-- Payments
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_tenantId_fkey" FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_memberId_tenantId_fkey" FOREIGN KEY ("memberId", "tenantId") REFERENCES "Member"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Payment_tenant_invoice_idx" ON "Payment"("tenantId", "invoiceId");
CREATE INDEX "Payment_tenant_member_idx" ON "Payment"("tenantId", "memberId");

-- Event registrations
CREATE TABLE "EventRegistration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "EventRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "checkInCode" TEXT,
    "checkInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EventRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventRegistration_eventId_tenantId_fkey" FOREIGN KEY ("eventId", "tenantId") REFERENCES "Event"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventRegistration_memberId_tenantId_fkey" FOREIGN KEY ("memberId", "tenantId") REFERENCES "Member"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EventRegistration_invoiceId_tenantId_fkey" FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Registration_tenant_event_member_key" ON "EventRegistration"("tenantId", "eventId", "memberId");
CREATE INDEX "Registration_tenant_status_idx" ON "EventRegistration"("tenantId", "status");

-- Audit logs
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorMemberId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AuditLog_tenant_entity_idx" ON "AuditLog"("tenantId", "entityType");
CREATE INDEX "AuditLog_tenant_created_idx" ON "AuditLog"("tenantId", "createdAt");

-- Org profile and feature flags
CREATE TABLE "OrgProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "timezone" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrgProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrgProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrgProfile_tenantId_key" ON "OrgProfile"("tenantId");

CREATE TABLE "FeatureFlags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payments" BOOLEAN NOT NULL DEFAULT TRUE,
    "events" BOOLEAN NOT NULL DEFAULT TRUE,
    "communications" BOOLEAN NOT NULL DEFAULT TRUE,
    "reporting" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureFlags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeatureFlags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FeatureFlags_tenantId_key" ON "FeatureFlags"("tenantId");

-- Role assignments
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoleAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoleAssignment_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RoleAssignment_tenant_user_role_key" ON "RoleAssignment"("tenantId", "userId", "role");
CREATE INDEX "RoleAssignment_tenant_role_idx" ON "RoleAssignment"("tenantId", "role");


