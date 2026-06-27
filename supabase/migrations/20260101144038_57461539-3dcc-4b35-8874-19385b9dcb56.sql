-- Fix workspace creation by allowing the creator to SELECT the workspace row
-- (Supabase/PostgREST may use INSERT ... RETURNING which effectively requires SELECT visibility)

DROP POLICY IF EXISTS "Workspaces: select (member)" ON public.workspaces;

CREATE POLICY "Workspaces: select (member or creator)"
ON public.workspaces
FOR SELECT
USING (
  public.is_workspace_member(id, auth.uid())
  OR created_by = auth.uid()
);
