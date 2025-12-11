-- InvoiceStatus enum update:
-- Existing values: UNPAID, PAID, OVERDUE, CANCELLED
-- Target values: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, VOID, FAILED

-- 1) Create new enum with target values
CREATE TYPE "InvoiceStatus_new" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'FAILED');

-- 2) Invoice number column already exists in prod; do NOT re-add. Leave as-is.

-- 3) Convert status column to new enum
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING (
  CASE
    WHEN status::text = 'UNPAID' THEN 'ISSUED'::"InvoiceStatus_new"
    WHEN status::text = 'PAID' THEN 'PAID'::"InvoiceStatus_new"
    WHEN status::text = 'OVERDUE' THEN 'OVERDUE'::"InvoiceStatus_new"
    WHEN status::text = 'CANCELLED' THEN 'VOID'::"InvoiceStatus_new"
    ELSE 'ISSUED'::"InvoiceStatus_new"
  END
);

-- 4) Drop old enum and rename new
DROP TYPE "InvoiceStatus";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";

-- 5) Set defaults and constraints
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'ISSUED';

-- 6) Backfill invoiceNumber with a temporary placeholder only if null (will be replaced by backfill script)
UPDATE "Invoice"
SET "invoiceNumber" = CONCAT('TEMP-', "tenantId", '-', id)
WHERE "invoiceNumber" IS NULL;

-- 7) Ensure invoiceNumber is not null (column already exists)
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumber" SET NOT NULL;

-- 8) Add indexes if not present
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_tenant_idx" ON "Invoice"("tenantId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX IF NOT EXISTS "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_dueAt_idx" ON "Invoice"("dueAt");

