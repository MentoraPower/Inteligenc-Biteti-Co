-- Clear MQL status for incomplete leads (missing weekly_attendance or average_ticket)
UPDATE public.leads
SET 
  is_mql = NULL,
  estimated_revenue = NULL,
  analysis_created_at = NULL
WHERE 
  weekly_attendance IS NULL 
  OR weekly_attendance = '' 
  OR weekly_attendance = '0'
  OR average_ticket IS NULL 
  OR average_ticket <= 0;

-- Recalculate MQL for complete leads
UPDATE public.leads
SET 
  estimated_revenue = (CAST(weekly_attendance AS INTEGER) * 4 * average_ticket),
  is_mql = ((CAST(weekly_attendance AS INTEGER) * 4 * average_ticket) * 0.55 >= 2800),
  analysis_created_at = NOW()
WHERE 
  weekly_attendance IS NOT NULL 
  AND weekly_attendance != '' 
  AND weekly_attendance != '0'
  AND average_ticket IS NOT NULL 
  AND average_ticket > 0;