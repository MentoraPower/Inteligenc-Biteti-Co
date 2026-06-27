-- Remove duplicate lead_tracking entries for grupo_entrada/grupo_saida
-- Keep only the first (oldest) entry per lead_id + titulo + tipo combination
DELETE FROM lead_tracking
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY lead_id, titulo, tipo ORDER BY created_at ASC) as rn
    FROM lead_tracking
    WHERE tipo IN ('grupo_entrada', 'grupo_saida')
  ) ranked
  WHERE rn > 1
);

-- Create a unique index to prevent future duplicates for grupo_entrada/grupo_saida
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_tracking_unique_group_event 
ON lead_tracking (lead_id, tipo, titulo) 
WHERE tipo IN ('grupo_entrada', 'grupo_saida');