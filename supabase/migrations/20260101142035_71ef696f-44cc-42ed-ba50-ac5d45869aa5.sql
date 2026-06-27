-- Drop existing problematic RLS policies on workspace_members
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Owners can manage workspace members" ON workspace_members;

-- Create simple, non-recursive policies for workspace_members
-- Users can see their own memberships (no recursion - just checks user_id directly)
CREATE POLICY "Users can view their own memberships"
ON workspace_members
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own membership (for creating workspaces)
CREATE POLICY "Users can insert their own membership"
ON workspace_members
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Owners can manage members in their workspaces
-- Using a subquery that doesn't reference workspace_members recursively
CREATE POLICY "Owners can manage members"
ON workspace_members
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.role = 'owner'
  )
);

-- Also ensure workspaces table has proper RLS
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;

CREATE POLICY "Users can view workspaces they belong to"
ON workspaces
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspaces.id
    AND workspace_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create workspaces"
ON workspaces
FOR INSERT
WITH CHECK (auth.uid() = created_by);