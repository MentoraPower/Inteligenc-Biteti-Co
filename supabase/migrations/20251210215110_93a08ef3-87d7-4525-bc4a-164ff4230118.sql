-- Add clinic_name column to leads table
ALTER TABLE public.leads 
ADD COLUMN clinic_name text;