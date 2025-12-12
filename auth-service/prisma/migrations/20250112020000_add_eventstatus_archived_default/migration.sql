-- Add ARCHIVED to EventStatus enum if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ARCHIVED'
      AND enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'EventStatus'
      )
  ) THEN
    ALTER TYPE "EventStatus" ADD VALUE 'ARCHIVED';
  END IF;
END$$;

-- Set default for Event.status to PUBLISHED
ALTER TABLE "Event" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';

