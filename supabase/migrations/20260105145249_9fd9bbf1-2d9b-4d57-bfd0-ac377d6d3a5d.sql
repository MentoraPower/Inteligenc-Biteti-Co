-- Add sub_origin_id column to crm_tab_preferences
ALTER TABLE public.crm_tab_preferences
ADD COLUMN sub_origin_id UUID REFERENCES public.crm_sub_origins(id) ON DELETE CASCADE;

-- Drop the unique constraint on workspace_id
ALTER TABLE public.crm_tab_preferences
DROP CONSTRAINT IF EXISTS crm_tab_preferences_workspace_id_key;

-- Create a unique constraint on sub_origin_id
ALTER TABLE public.crm_tab_preferences
ADD CONSTRAINT crm_tab_preferences_sub_origin_id_key UNIQUE (sub_origin_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_crm_tab_preferences_sub_origin_id ON public.crm_tab_preferences(sub_origin_id);