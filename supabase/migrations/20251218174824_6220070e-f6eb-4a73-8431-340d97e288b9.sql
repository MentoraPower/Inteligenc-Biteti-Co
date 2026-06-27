-- Add trigger_type column to pipeline_automations
ALTER TABLE public.pipeline_automations 
ADD COLUMN trigger_type text NOT NULL DEFAULT 'lead_moved';

-- Add comment for clarity
COMMENT ON COLUMN public.pipeline_automations.trigger_type IS 'Type of trigger: lead_moved or onboarding_completed';