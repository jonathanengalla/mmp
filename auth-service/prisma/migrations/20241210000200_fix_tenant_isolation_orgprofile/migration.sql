-- Fix Payment -> PaymentMethod tenant-scoped FK
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_paymentMethodId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_tenantId_fkey"
  FOREIGN KEY ("paymentMethodId", "tenantId") REFERENCES "PaymentMethod"("id", "tenantId")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Fix AuditLog -> Invoice tenant-scoped FK
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_invoiceId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_invoiceId_tenantId_fkey"
  FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Expand OrgProfile with required tenant identity/billing fields
ALTER TABLE "OrgProfile"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "type" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "billingContactName" TEXT,
  ADD COLUMN "billingContactEmail" TEXT,
  ADD COLUMN "billingContactPhone" TEXT,
  ADD COLUMN "billingAddressLine1" TEXT,
  ADD COLUMN "billingAddressLine2" TEXT,
  ADD COLUMN "billingCity" TEXT,
  ADD COLUMN "billingState" TEXT,
  ADD COLUMN "billingPostalCode" TEXT,
  ADD COLUMN "billingCountry" TEXT;

-- Backfill existing OrgProfile rows with safe defaults
UPDATE "OrgProfile" SET "displayName" = COALESCE("displayName", "name");
UPDATE "OrgProfile" SET "legalName" = COALESCE("legalName", "name");
UPDATE "OrgProfile" SET "type" = COALESCE("type", 'other');

-- Enforce non-null on key identity fields
ALTER TABLE "OrgProfile"
  ALTER COLUMN "displayName" SET NOT NULL,
  ALTER COLUMN "legalName" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL;

