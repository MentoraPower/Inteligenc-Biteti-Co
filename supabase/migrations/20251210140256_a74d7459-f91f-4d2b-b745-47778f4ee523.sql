-- Update all leads without pipeline_id to be in Base pipeline
UPDATE public.leads 
SET pipeline_id = 'b62bdfc2-cfda-4cc2-9a72-f87f9ac1f724' 
WHERE pipeline_id IS NULL;