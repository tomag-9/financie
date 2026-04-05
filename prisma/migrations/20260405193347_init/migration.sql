-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "balance" DECIMAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Snapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#378ADD',
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "IncomeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "note" TEXT,
    CONSTRAINT "IncomeEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IncomeSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JojDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" DATETIME NOT NULL,
    "streamCount" INTEGER NOT NULL DEFAULT 0,
    "ratePerStream" DECIMAL NOT NULL DEFAULT 0,
    "tvHonorar" DECIMAL NOT NULL DEFAULT 0,
    "bonus" DECIMAL NOT NULL DEFAULT 0,
    "expectedTotal" DECIMAL NOT NULL,
    "receivedTotal" DECIMAL,
    "diff" DECIMAL
);

-- CreateTable
CREATE TABLE "Liability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "remaining" DECIMAL NOT NULL,
    "dueDate" DATETIME,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "isin" TEXT,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "units" DECIMAL NOT NULL DEFAULT 0,
    "avgPrice" DECIMAL
);

-- CreateTable
CREATE TABLE "InvestmentEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investmentId" TEXT NOT NULL,
    "month" DATETIME NOT NULL,
    "unitsAdded" DECIMAL NOT NULL DEFAULT 0,
    "amountAdded" DECIMAL NOT NULL DEFAULT 0,
    "priceAtTime" DECIMAL,
    CONSTRAINT "InvestmentEntry_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "data" JSONB NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_accountId_month_key" ON "Snapshot"("accountId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "IncomeEntry_sourceId_month_key" ON "IncomeEntry"("sourceId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "JojDetail_month_key" ON "JojDetail"("month");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentEntry_investmentId_month_key" ON "InvestmentEntry"("investmentId", "month");
