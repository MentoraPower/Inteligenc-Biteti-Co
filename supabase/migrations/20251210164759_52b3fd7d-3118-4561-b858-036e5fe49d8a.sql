-- Add new columns to leads table for ticket médio and affordability check
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS average_ticket numeric,
ADD COLUMN IF NOT EXISTS can_afford text,
ADD COLUMN IF NOT EXISTS wants_more_info boolean DEFAULT false;