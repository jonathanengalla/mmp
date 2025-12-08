-- Enums already exist from initial migration

-- Add columns to Member
ALTER TABLE "Member"
  ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 't1',
  ADD COLUMN "linkedinUrl" TEXT,
  ADD COLUMN "otherSocials" TEXT,
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "verificationToken" TEXT,
  ADD COLUMN "verificationExpires" TIMESTAMP(3),
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add tags to Event
ALTER TABLE "Event"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add event link and source to Invoice
ALTER TABLE "Invoice"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "source" TEXT;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create User table
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tenantId" TEXT NOT NULL DEFAULT 't1',
  "memberId" TEXT,
  "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_memberId_key" ON "User"("memberId");

