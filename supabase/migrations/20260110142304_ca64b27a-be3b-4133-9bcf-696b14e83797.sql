-- Create table for onboarding form templates
CREATE TABLE public.onboarding_form_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fields JSONB NOT NULL DEFAULT '[]',
  is_sequential BOOLEAN NOT NULL DEFAULT false,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_form_templates ENABLE ROW LEVEL SECURITY;

-- Policy: workspace members can view templates in their workspace
CREATE POLICY "Workspace members can view templates"
ON public.onboarding_form_templates
FOR SELECT
USING (
  workspace_id IS NULL OR 
  public.is_workspace_member(workspace_id, auth.uid())
);

-- Policy: workspace members can create templates
CREATE POLICY "Workspace members can create templates"
ON public.onboarding_form_templates
FOR INSERT
WITH CHECK (
  workspace_id IS NULL OR 
  public.is_workspace_member(workspace_id, auth.uid())
);

-- Policy: workspace members can update their templates
CREATE POLICY "Workspace members can update templates"
ON public.onboarding_form_templates
FOR UPDATE
USING (
  workspace_id IS NULL OR 
  public.is_workspace_member(workspace_id, auth.uid())
);

-- Policy: workspace members can delete their templates
CREATE POLICY "Workspace members can delete templates"
ON public.onboarding_form_templates
FOR DELETE
USING (
  workspace_id IS NULL OR 
  public.is_workspace_member(workspace_id, auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_onboarding_form_templates_updated_at
BEFORE UPDATE ON public.onboarding_form_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();