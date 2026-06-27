-- =====================================================
-- PHASE 15: Fix final remaining permissive policies
-- =====================================================

-- workspace_members - need to ensure proper isolation
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can manage workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace members can view colleagues" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace members can manage members" ON public.workspace_members;

CREATE POLICY "Workspace members can view colleagues" ON public.workspace_members
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace owners can insert members" ON public.workspace_members
FOR INSERT WITH CHECK (is_workspace_owner(workspace_id, auth.uid()) OR auth.uid() = user_id);

CREATE POLICY "Workspace owners can update members" ON public.workspace_members
FOR UPDATE USING (is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "Workspace owners can delete members" ON public.workspace_members
FOR DELETE USING (is_workspace_owner(workspace_id, auth.uid()) OR auth.uid() = user_id);

-- workspaces
DROP POLICY IF EXISTS "Members can view their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace members can view workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace owners can manage workspaces" ON public.workspaces;

CREATE POLICY "Workspace members can view workspaces" ON public.workspaces
FOR SELECT USING (is_workspace_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Workspace owners can update workspaces" ON public.workspaces
FOR UPDATE USING (is_workspace_owner(id, auth.uid()));

CREATE POLICY "Workspace owners can delete workspaces" ON public.workspaces
FOR DELETE USING (is_workspace_owner(id, auth.uid()));

-- workspace_whatsapp_accounts
DROP POLICY IF EXISTS "Workspace members can manage accounts" ON public.workspace_whatsapp_accounts;
DROP POLICY IF EXISTS "Workspace members can read whatsapp accounts" ON public.workspace_whatsapp_accounts;
DROP POLICY IF EXISTS "Workspace members can manage whatsapp accounts" ON public.workspace_whatsapp_accounts;

CREATE POLICY "Workspace members can read whatsapp accounts" ON public.workspace_whatsapp_accounts
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert whatsapp accounts" ON public.workspace_whatsapp_accounts
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update whatsapp accounts" ON public.workspace_whatsapp_accounts
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete whatsapp accounts" ON public.workspace_whatsapp_accounts
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- user_roles - only admins can manage roles
DROP POLICY IF EXISTS "Anyone can view user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can insert user roles" ON public.user_roles
FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update user roles" ON public.user_roles
FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete user roles" ON public.user_roles
FOR DELETE USING (is_admin(auth.uid()));

-- user_permissions - only admins can manage permissions
DROP POLICY IF EXISTS "Anyone can view user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Anyone can insert user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Anyone can update user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Anyone can delete user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can view user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins can manage user permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;

CREATE POLICY "Users can view their own permissions" ON public.user_permissions
FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Admins can insert user permissions" ON public.user_permissions
FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update user permissions" ON public.user_permissions
FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete user permissions" ON public.user_permissions
FOR DELETE USING (is_admin(auth.uid()));