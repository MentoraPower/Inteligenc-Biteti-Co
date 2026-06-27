-- Add column to store AI estimated revenue for admin view
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS estimated_revenue numeric;