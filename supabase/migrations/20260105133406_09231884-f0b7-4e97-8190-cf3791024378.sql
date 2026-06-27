-- Create table for CRM tab preferences per workspace
CREATE TABLE public.crm_tab_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tab_order TEXT[] NOT NULL DEFAULT ARRAY['overview', 'quadro', 'lista', 'calendario'],
  hidden_tabs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Enable RLS
ALTER TABLE public.crm_tab_preferences ENABLE ROW LEVEL SECURITY;

-- Policies - workspace members can read/write their workspace preferences
CREATE POLICY "Workspace members can view tab preferences"
ON public.crm_tab_preferences
FOR SELECT
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert tab preferences"
ON public.crm_tab_preferences
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update tab preferences"
ON public.crm_tab_preferences
FOR UPDATE
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_crm_tab_preferences_updated_at
BEFORE UPDATE ON public.crm_tab_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();