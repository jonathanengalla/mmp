-- Add deletedAt column for soft delete
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Index for filtering by tenant/deletedAt
CREATE INDEX IF NOT EXISTS "Event_tenant_deleted_idx" ON "Event"("tenantId", "deletedAt");

