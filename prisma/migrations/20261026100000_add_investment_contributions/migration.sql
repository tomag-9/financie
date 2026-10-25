-- Separate monthly savings contributions from legacy portfolio trades.
CREATE TABLE "InvestmentContribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'RECURRING',
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentContribution_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InvestmentContribution_accountId_month_key"
ON "InvestmentContribution"("accountId", "month");

CREATE INDEX "InvestmentContribution_month_idx"
ON "InvestmentContribution"("month");

-- Preserve contributions created by the previous synthetic-investment flow.
INSERT INTO "InvestmentContribution" ("id", "accountId", "month", "mode", "amount", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(12))),
    substr(entry."investmentId", length('account-invest:') + 1),
    entry."month",
    CASE WHEN entry."entryType" = 'ONE_OFF' THEN 'ONE_OFF' ELSE 'RECURRING' END,
    entry."amountAdded",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "InvestmentEntry" entry
INNER JOIN "Account" account
    ON account."id" = substr(entry."investmentId", length('account-invest:') + 1)
WHERE entry."investmentId" LIKE 'account-invest:%';
