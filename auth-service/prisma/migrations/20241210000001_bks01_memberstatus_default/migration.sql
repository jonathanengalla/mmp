-- BKS-01 follow-up: set defaults after enum values exist

-- Member status default to PENDING_VERIFICATION
ALTER TABLE "Member" ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

-- Invoice status default to UNPAID
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'UNPAID';


