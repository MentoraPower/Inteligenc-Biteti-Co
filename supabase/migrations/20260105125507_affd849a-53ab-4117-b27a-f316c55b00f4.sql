-- Add config column to overview_cards for storing custom field settings
ALTER TABLE public.overview_cards 
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;