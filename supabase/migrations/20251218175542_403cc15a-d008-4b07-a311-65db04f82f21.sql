-- Make pipeline_id nullable to support onboarding_completed trigger type
ALTER TABLE public.pipeline_automations 
ALTER COLUMN pipeline_id DROP NOT NULL;