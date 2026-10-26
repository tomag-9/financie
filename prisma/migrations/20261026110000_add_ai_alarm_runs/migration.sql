CREATE TABLE "AiAlarmRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alarmId" TEXT,
    "alarmLabel" TEXT,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targets" TEXT NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "scheduledFor" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "AiAlarmRun_alarmId_fkey" FOREIGN KEY ("alarmId") REFERENCES "AiAlarm" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AiAlarmRun_alarmId_scheduledFor_trigger_key" ON "AiAlarmRun"("alarmId", "scheduledFor", "trigger");
CREATE INDEX "AiAlarmRun_startedAt_idx" ON "AiAlarmRun"("startedAt");
CREATE INDEX "AiAlarmRun_status_startedAt_idx" ON "AiAlarmRun"("status", "startedAt");
