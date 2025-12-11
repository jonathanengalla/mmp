-- Normalize legacy donation sources to canonical 'DONATION'
UPDATE "Invoice"
SET "source" = 'DONATION'
WHERE "source" = 'DON';

-- Scope-safe cleanup for rcme-dev tenant where older donation test rows may have used OTHER with donation descriptions
UPDATE "Invoice"
SET "source" = 'DONATION'
WHERE "source" = 'OTHER'
  AND "tenantId" IN (SELECT id FROM "Tenant" WHERE slug = 'rcme-dev')
  AND (
    "description" ILIKE '%donation%'
    OR "description" ILIKE '%donor%'
  );

