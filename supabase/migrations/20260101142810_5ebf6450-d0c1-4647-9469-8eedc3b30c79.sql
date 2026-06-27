-- Drop ALL existing policies on workspace_members and workspaces
DROP POLICY IF EXISTS "Users can view their own workspace memberships" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can create their own membership row" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can view members in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can add members to their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can update members in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can delete members in their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;

-- Drop old functions that might cause issues
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid);
DROP FUNCTION IF EXISTS public.is_workspace_owner(uuid);

-- Create a simple function to get user's workspace IDs (no RLS, direct table access)
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = _user_id
$$;

-- Create simple policy for workspace_members: user can see/manage their own rows
CREATE POLICY "User manages own memberships"
ON public.workspace_members
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for workspaces: user can see workspaces they belong to (using function)
CREATE POLICY "User can view own workspaces"
ON public.workspaces
FOR SELECT
USING (id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- User can create workspaces (they set created_by = their id)  
CREATE POLICY "User can create workspaces"
ON public.workspaces
FOR INSERT
WITH CHECK (created_by = auth.uid() OR created_by IS NULL);