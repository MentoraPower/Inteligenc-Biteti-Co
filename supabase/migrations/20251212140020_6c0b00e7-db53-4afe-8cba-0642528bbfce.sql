-- Add columns to store lead analysis
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS ai_analysis TEXT,
ADD COLUMN IF NOT EXISTS is_mql BOOLEAN,
ADD COLUMN IF NOT EXISTS analysis_created_at TIMESTAMP WITH TIME ZONE;