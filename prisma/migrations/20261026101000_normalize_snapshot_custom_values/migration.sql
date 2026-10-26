-- Typed custom values no longer overload Snapshot.note, which remains available
-- for a human-readable note. Legacy JSON is preserved in note and copied here.
CREATE TABLE "SnapshotCustomValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    CONSTRAINT "SnapshotCustomValue_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SnapshotCustomValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomField" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SnapshotCustomValue_snapshotId_fieldId_key"
ON "SnapshotCustomValue"("snapshotId", "fieldId");

CREATE INDEX "SnapshotCustomValue_fieldId_idx"
ON "SnapshotCustomValue"("fieldId");

INSERT INTO "SnapshotCustomValue" ("id", "snapshotId", "fieldId", "value")
SELECT
    lower(hex(randomblob(12))),
    snapshot."id",
    fields.key,
    CASE fields.type
        WHEN 'text' THEN json_quote(fields.value)
        WHEN 'true' THEN 'true'
        WHEN 'false' THEN 'false'
        WHEN 'null' THEN 'null'
        ELSE CAST(fields.value AS TEXT)
    END
FROM "Snapshot" snapshot, json_each(json_extract(snapshot."note", '$.values')) fields
INNER JOIN "CustomField" definition ON definition."id" = fields.key
WHERE json_valid(snapshot."note") = 1
  AND json_type(snapshot."note", '$.values') = 'object';

UPDATE "Snapshot"
SET "note" = NULL
WHERE json_valid("note") = 1
  AND json_type("note", '$.values') = 'object';
