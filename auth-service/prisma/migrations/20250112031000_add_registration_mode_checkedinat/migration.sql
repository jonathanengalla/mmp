-- Add RegistrationMode enum if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RegistrationMode') THEN
    CREATE TYPE "RegistrationMode" AS ENUM ('RSVP', 'PAY_NOW');
  END IF;
END$$;

-- Add registrationMode to Event (default RSVP)
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "registrationMode" "RegistrationMode" NOT NULL DEFAULT 'RSVP';

-- Add checkedInAt to EventRegistration
ALTER TABLE "EventRegistration"
ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);

