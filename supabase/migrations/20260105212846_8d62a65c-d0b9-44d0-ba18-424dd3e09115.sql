-- Deletar webhooks duplicados (manter apenas o mais antigo por sub_origin_id + type)
DELETE FROM crm_webhooks
WHERE id IN (
  SELECT w1.id
  FROM crm_webhooks w1
  WHERE w1.type = 'receive'
  AND w1.sub_origin_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM crm_webhooks w2 
    WHERE w2.sub_origin_id = w1.sub_origin_id
    AND w2.type = w1.type
    AND w2.id != w1.id
    AND w2.created_at < w1.created_at
  )
)