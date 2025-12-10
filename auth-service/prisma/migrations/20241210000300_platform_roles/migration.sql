-- Add platformRoles to User for platform-level roles (e.g., SUPER_ADMIN)
ALTER TABLE "User"
ADD COLUMN "platformRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

