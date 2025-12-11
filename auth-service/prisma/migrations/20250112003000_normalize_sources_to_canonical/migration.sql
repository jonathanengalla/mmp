-- Normalize legacy/lowercase sources into canonical upper values
UPDATE "Invoice" SET "source" = 'DUES' WHERE "source" IN ('dues', 'DUES', 'manual');
UPDATE "Invoice" SET "source" = 'EVT' WHERE "source" IN ('event', 'EVT');
UPDATE "Invoice" SET "source" = 'DONATION' WHERE "source" IN ('donation', 'DON', 'DONATION');

-- Everything else that is null or empty stays as-is (treated as OTHER at read time)

