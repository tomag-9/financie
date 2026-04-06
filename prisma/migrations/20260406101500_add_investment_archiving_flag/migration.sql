PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Investment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticker" TEXT NOT NULL,
  "isin" TEXT,
  "name" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "assetType" TEXT NOT NULL DEFAULT 'ETF',
  "units" DECIMAL NOT NULL DEFAULT 0,
  "avgPrice" DECIMAL,
  CONSTRAINT "Investment_ticker_platform_isArchived_key" UNIQUE ("ticker", "platform", "isArchived")
);

INSERT INTO "new_Investment" (
  "id",
  "ticker",
  "isin",
  "name",
  "platform",
  "isArchived",
  "assetType",
  "units",
  "avgPrice"
)
SELECT
  "id",
  "ticker",
  "isin",
  "name",
  CASE
    WHEN "platform" LIKE 'ARCHIVED:%' THEN SUBSTR("platform", LENGTH('ARCHIVED:') + 1)
    ELSE "platform"
  END,
  CASE
    WHEN "platform" LIKE 'ARCHIVED:%' THEN true
    ELSE false
  END,
  "assetType",
  "units",
  "avgPrice"
FROM "Investment";

DROP TABLE "Investment";
ALTER TABLE "new_Investment" RENAME TO "Investment";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
