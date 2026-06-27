-- Corrige TODOS os leads que ainda têm estimated_revenue inventado
UPDATE leads 
SET 
  estimated_revenue = NULL,
  is_mql = NULL,
  ai_analysis = NULL,
  analysis_created_at = NULL
WHERE 
  estimated_revenue IS NOT NULL
  AND (
    weekly_attendance IS NULL 
    OR weekly_attendance = '' 
    OR average_ticket IS NULL 
    OR average_ticket <= 0
  );