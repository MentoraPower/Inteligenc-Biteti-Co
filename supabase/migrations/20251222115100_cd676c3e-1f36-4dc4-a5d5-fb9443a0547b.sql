-- Make trigger_pipeline_id nullable to support group triggers
ALTER TABLE public.email_automations 
ALTER COLUMN trigger_pipeline_id DROP NOT NULL;