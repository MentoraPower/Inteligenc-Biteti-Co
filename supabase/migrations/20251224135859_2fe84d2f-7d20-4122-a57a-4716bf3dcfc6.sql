-- Delete duplicate automations, keeping only the most recent one per sub_origin_id
DELETE FROM email_automations 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY sub_origin_id ORDER BY created_at DESC) as rn
    FROM email_automations
    WHERE sub_origin_id IS NOT NULL
  ) t WHERE rn > 1
)