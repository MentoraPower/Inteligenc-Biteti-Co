-- Add activity_group_id to link activities created together across leads
ALTER TABLE public.lead_activities
ADD COLUMN activity_group_id uuid DEFAULT NULL;

-- Create index for faster lookups
CREATE INDEX idx_lead_activities_group_id ON public.lead_activities(activity_group_id) WHERE activity_group_id IS NOT NULL;