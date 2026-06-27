-- Corrige leads com estimated_revenue inventado: zera onde não tem dados suficientes
-- Um lead só pode ter estimated_revenue se tiver weekly_attendance E average_ticket válidos

UPDATE leads 
SET 
  estimated_revenue = NULL,
  is_mql = NULL,
  ai_analysis = NULL,
  analysis_created_at = NULL
WHERE 
  (weekly_attendance IS NULL OR weekly_attendance = '' OR weekly_attendance = '0')
  OR (average_ticket IS NULL OR average_ticket = 0 OR average_ticket < 1);

-- Para leads com average_ticket muito baixo (ex: 0.01, 10, 12) que parecem erros de input
-- recalcula corretamente baseado nos dados reais
UPDATE leads 
SET 
  estimated_revenue = CAST(weekly_attendance AS INTEGER) * 4 * average_ticket,
  is_mql = CASE 
    WHEN CAST(weekly_attendance AS INTEGER) * 4 * average_ticket >= 5091 THEN true 
    ELSE false 
  END
WHERE 
  weekly_attendance IS NOT NULL 
  AND weekly_attendance != '' 
  AND weekly_attendance != '0'
  AND average_ticket IS NOT NULL 
  AND average_ticket >= 1;