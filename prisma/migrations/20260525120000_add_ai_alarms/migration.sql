-- CreateTable
CREATE TABLE "AiAlarm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT,
    "time" TEXT NOT NULL,
    "date" DATETIME,
    "days" TEXT,
    "isRepeat" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "runClaude" BOOLEAN NOT NULL DEFAULT true,
    "runCodex" BOOLEAN NOT NULL DEFAULT false,
    "lastTriggeredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AiAlarm_isEnabled_time_idx" ON "AiAlarm"("isEnabled", "time");
