-- Disable Codex only for the existing "AI reset" alarm. Claude and other alarms are unchanged.
UPDATE "AiAlarm"
SET "runCodex" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("label")) = 'ai reset';
