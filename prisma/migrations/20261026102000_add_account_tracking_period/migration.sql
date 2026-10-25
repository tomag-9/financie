ALTER TABLE "Account" ADD COLUMN "trackingStartMonth" DATETIME;
ALTER TABLE "Account" ADD COLUMN "closedAt" DATETIME;

UPDATE "Account"
SET "trackingStartMonth" = COALESCE(
  (SELECT MIN(snapshot."month") FROM "Snapshot" snapshot WHERE snapshot."accountId" = "Account"."id"),
  CAST(strftime('%s', datetime("createdAt" / 1000, 'unixepoch', 'start of month')) AS INTEGER) * 1000
);

UPDATE "Account"
SET "closedAt" = (
  SELECT CAST(strftime('%s', datetime(MAX(snapshot."month") / 1000, 'unixepoch', '+1 month', 'start of month')) AS INTEGER) * 1000
  FROM "Snapshot" snapshot
  WHERE snapshot."accountId" = "Account"."id"
)
WHERE "isActive" = false;
