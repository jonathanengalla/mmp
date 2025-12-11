-- Strip "-DEV" from invoiceNumber prefixes for rcme-dev tenant, but only when the
-- resulting invoiceNumber does NOT already exist (to avoid unique conflicts).
UPDATE "Invoice" i
SET "invoiceNumber" = REPLACE(i."invoiceNumber", 'RCME-DEV-', 'RCME-')
WHERE i."tenantId" IN (SELECT id FROM "Tenant" WHERE slug = 'rcme-dev')
  AND i."invoiceNumber" LIKE 'RCME-DEV-%'
  AND NOT EXISTS (
    SELECT 1
    FROM "Invoice" i2
    WHERE i2."invoiceNumber" = REPLACE(i."invoiceNumber", 'RCME-DEV-', 'RCME-')
  );

