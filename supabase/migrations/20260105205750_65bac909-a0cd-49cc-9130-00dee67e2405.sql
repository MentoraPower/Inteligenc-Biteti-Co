-- Deletar leads duplicados em "Comprou Guru" (manter apenas o mais antigo por email)
DELETE FROM leads
WHERE id IN (
  SELECT l1.id
  FROM leads l1
  WHERE l1.sub_origin_id = '06828c22-3c33-477a-b9cf-72125b951d59'
  AND l1.pipeline_id = '459f02f0-43b1-42c2-a57b-0f4db0d751d9'
  AND EXISTS (
    SELECT 1 FROM leads l2 
    WHERE l2.email = l1.email 
    AND l2.sub_origin_id = l1.sub_origin_id
    AND l2.pipeline_id = l1.pipeline_id
    AND l2.id != l1.id
    AND l2.created_at < l1.created_at
  )
)