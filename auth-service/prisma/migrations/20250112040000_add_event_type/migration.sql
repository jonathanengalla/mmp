-- Add EventType enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventType') THEN
    CREATE TYPE "EventType" AS ENUM ('IN_PERSON', 'ONLINE');
  END IF;
END$$;

-- Add eventType column with default
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "eventType" "EventType" NOT NULL DEFAULT 'IN_PERSON';

