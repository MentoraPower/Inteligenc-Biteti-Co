-- Fix infinite recursion in RLS by using SECURITY DEFINER helper functions

-- Ensure RLS is enabled
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Helper functions (bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
      AND role = 'owner'
  )
$$;

-- Recreate workspace_members policies without self-references (no recursion)
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view their own workspace memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can create their own membership row" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can view members in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can add members to their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can update members in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can delete members in their workspaces" ON public.workspace_members;

CREATE POLICY "Users can view their own workspace memberships"
ON public.workspace_members
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own membership row"
ON public.workspace_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can view members in their workspaces"
ON public.workspace_members
FOR SELECT
USING (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can add members to their workspaces"
ON public.workspace_members
FOR INSERT
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can update members in their workspaces"
ON public.workspace_members
FOR UPDATE
USING (public.is_workspace_owner(workspace_id))
WITH CHECK (public.is_workspace_owner(workspace_id));

CREATE POLICY "Owners can delete members in their workspaces"
ON public.workspace_members
FOR DELETE
USING (public.is_workspace_owner(workspace_id));

-- Recreate workspaces policies (also avoid depending on workspace_members RLS)
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Members can view their workspaces" ON public.workspaces;

CREATE POLICY "Members can view their workspaces"
ON public.workspaces
FOR SELECT
USING (public.is_workspace_member(id));

CREATE POLICY "Users can create workspaces"
ON public.workspaces
FOR INSERT
WITH CHECK (auth.uid() = created_by);