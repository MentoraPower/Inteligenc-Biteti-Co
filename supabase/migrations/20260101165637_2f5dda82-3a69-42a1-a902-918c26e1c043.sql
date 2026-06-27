-- Create workspace_whatsapp_accounts to link WasenderAPI sessions to workspaces
CREATE TABLE public.workspace_whatsapp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- WasenderAPI session id (api_key)
  session_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, session_id)
);

-- Enable RLS
ALTER TABLE public.workspace_whatsapp_accounts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Workspace members can view accounts"
ON public.workspace_whatsapp_accounts FOR SELECT
USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert accounts"
ON public.workspace_whatsapp_accounts FOR INSERT
WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete accounts"
ON public.workspace_whatsapp_accounts FOR DELETE
USING (is_workspace_member(workspace_id, auth.uid()));

-- Add workspace_id to instagram_connections
ALTER TABLE public.instagram_connections ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

-- Add realtime for sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_whatsapp_accounts;