-- Backfill equipment ids for documents ingested before equipment_id existed.
-- Prefer explicit document metadata, then version labels, then chunk content.
UPDATE documents d
SET equipment_id = COALESCE(
  substring(d.title from '([A-Z]{1,4}-[0-9]{2,4})'),
  substring(d.manual_version from '([A-Z]{1,4}-[0-9]{2,4})'),
  chunk_equipment.equipment_id
)
FROM (
  SELECT
    document_id,
    substring(string_agg(content, E'\n') from 'EQUIPMENT:[[:space:]]*([A-Z]{1,4}-[0-9]{2,4})') AS equipment_id
  FROM chunks
  GROUP BY document_id
) chunk_equipment
WHERE d.id = chunk_equipment.document_id
  AND d.equipment_id IS NULL
  AND COALESCE(
    substring(d.title from '([A-Z]{1,4}-[0-9]{2,4})'),
    substring(d.manual_version from '([A-Z]{1,4}-[0-9]{2,4})'),
    chunk_equipment.equipment_id
  ) IS NOT NULL;
