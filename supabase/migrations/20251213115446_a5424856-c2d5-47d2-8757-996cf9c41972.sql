-- Corrige lead específico com dados inventados
UPDATE leads 
SET 
  estimated_revenue = NULL,
  is_mql = NULL,
  ai_analysis = NULL,
  analysis_created_at = NULL
WHERE email = 'amandaegc25@icloud.com';