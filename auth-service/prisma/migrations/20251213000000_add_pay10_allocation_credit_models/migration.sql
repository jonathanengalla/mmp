-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('SIMULATED', 'TRAXION', 'MANUAL_CASH', 'MANUAL_BANK', 'MANUAL_OTHER');

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('AVAILABLE', 'APPLIED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentAuditAction" AS ENUM ('CREATED', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED', 'ALLOCATED', 'REVERSED', 'REFUNDED', 'STATUS_CHANGED');

-- AlterEnum (extend PaymentStatus)
-- Note: These must be added before they can be used in ALTER TABLE
-- PostgreSQL requires enum values to be committed before use in the same transaction
-- We add them first, then use them in subsequent statements
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'INITIATED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentStatus')) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'INITIATED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'REVERSED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentStatus')) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'REVERSED';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'REFUNDED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PaymentStatus')) THEN
    ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';
  END IF;
END $$;

-- AlterTable: Make Payment.invoiceId nullable and add new fields
-- Note: We use 'PENDING' as default for status initially, then change to 'INITIATED' after enum is ready
ALTER TABLE "Payment" 
  ALTER COLUMN "invoiceId" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "channel" "PaymentChannel" NOT NULL DEFAULT 'SIMULATED',
  ADD COLUMN IF NOT EXISTS "verificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "externalReference" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "proofUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
  ALTER COLUMN "currency" SET DEFAULT 'PHP';

-- Now set status default to INITIATED (enum value is now available)
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'INITIATED';

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_tenant_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Payment_tenant_channel_idx" ON "Payment"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "Payment_tenant_verification_idx" ON "Payment"("tenantId", "verificationStatus");

-- CreateIndex
CREATE INDEX "Payment_external_ref_idx" ON "Payment"("externalReference");

-- CreateTable: Allocation
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Credit
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sourcePaymentId" TEXT,
    "status" "CreditStatus" NOT NULL DEFAULT 'AVAILABLE',
    "appliedToInvoiceId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaymentAuditLog
CREATE TABLE "PaymentAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "action" "PaymentAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousState" JSONB,
    "newState" JSONB,
    "notes" TEXT,

    CONSTRAINT "PaymentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Allocation
CREATE INDEX "Allocation_tenant_invoice_idx" ON "Allocation"("tenantId", "invoiceId");
CREATE INDEX "Allocation_tenant_payment_idx" ON "Allocation"("tenantId", "paymentId");
CREATE INDEX "Allocation_invoice_payment_idx" ON "Allocation"("invoiceId", "paymentId");
CREATE UNIQUE INDEX "Allocation_id_tenantId_key" ON "Allocation"("id", "tenantId");

-- CreateIndex: Credit
CREATE INDEX "Credit_tenant_member_idx" ON "Credit"("tenantId", "memberId");
CREATE INDEX "Credit_tenant_status_idx" ON "Credit"("tenantId", "status");
CREATE INDEX "Credit_tenant_applied_invoice_idx" ON "Credit"("tenantId", "appliedToInvoiceId");
CREATE UNIQUE INDEX "Credit_id_tenantId_key" ON "Credit"("id", "tenantId");

-- CreateIndex: PaymentAuditLog
CREATE INDEX "PaymentAuditLog_tenant_payment_idx" ON "PaymentAuditLog"("tenantId", "paymentId");
CREATE INDEX "PaymentAuditLog_tenant_timestamp_idx" ON "PaymentAuditLog"("tenantId", "timestamp");
CREATE UNIQUE INDEX "PaymentAuditLog_id_tenantId_key" ON "PaymentAuditLog"("id", "tenantId");

-- AddForeignKey: Allocation -> Invoice
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_invoiceId_tenantId_fkey" FOREIGN KEY ("invoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Allocation -> Payment
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_paymentId_tenantId_fkey" FOREIGN KEY ("paymentId", "tenantId") REFERENCES "Payment"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Allocation -> Tenant
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Credit -> Payment (sourcePayment)
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_sourcePaymentId_tenantId_fkey" FOREIGN KEY ("sourcePaymentId", "tenantId") REFERENCES "Payment"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Credit -> Member
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_memberId_tenantId_fkey" FOREIGN KEY ("memberId", "tenantId") REFERENCES "Member"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Credit -> Tenant
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Credit -> Invoice (appliedToInvoice)
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_appliedToInvoiceId_tenantId_fkey" FOREIGN KEY ("appliedToInvoiceId", "tenantId") REFERENCES "Invoice"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PaymentAuditLog -> Payment
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_paymentId_tenantId_fkey" FOREIGN KEY ("paymentId", "tenantId") REFERENCES "Payment"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PaymentAuditLog -> Tenant
ALTER TABLE "PaymentAuditLog" ADD CONSTRAINT "PaymentAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
