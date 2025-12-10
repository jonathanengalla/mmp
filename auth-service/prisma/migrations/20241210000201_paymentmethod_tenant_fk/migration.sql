-- Enforce tenant-scoped FK for Payment -> PaymentMethod
-- Drop existing FK on paymentMethodId (if any)
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_paymentMethodId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_paymentMethodId_tenantId_fkey";

-- Add composite FK to enforce tenant match; null out paymentMethodId if the method is removed
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_paymentMethodId_tenantId_fkey"
  FOREIGN KEY ("paymentMethodId","tenantId")
  REFERENCES "PaymentMethod"("id","tenantId")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

