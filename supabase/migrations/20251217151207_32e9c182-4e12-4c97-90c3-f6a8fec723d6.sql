-- Add flow_steps column to store email flow builder node positions
ALTER TABLE public.email_automations 
ADD COLUMN flow_steps JSONB DEFAULT NULL;

COMMENT ON COLUMN public.email_automations.flow_steps IS 'Stores the email flow builder steps with node positions';