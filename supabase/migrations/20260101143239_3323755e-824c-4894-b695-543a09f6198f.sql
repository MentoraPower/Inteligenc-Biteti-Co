-- Ensure RLS is enabled but NOT forced (so SECURITY DEFINER can safely bypass)
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces NO FORCE ROW LEVEL SECURITY;

-- Drop all existing policies on both tables (avoid leftover recursive policies)
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('workspace_members','workspaces')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$$;

-- Helper functions (SECURITY DEFINER) to check membership/ownership without RLS recursion
DROP FUNCTION IF EXISTS public.is_workspace_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_workspace_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_user_workspace_ids(uuid);

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
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
      AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
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
      AND user_id = _user_id
      AND role = 'owner'
  )
$$;

-- Recreate policies for workspace_members
CREATE POLICY "Workspace members: select own or owner"
ON public.workspace_members
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_workspace_owner(workspace_id, auth.uid())
);

CREATE POLICY "Workspace members: insert (self or owner)"
ON public.workspace_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR public.is_workspace_owner(workspace_id, auth.uid())
);

CREATE POLICY "Workspace members: update (owner)"
ON public.workspace_members
FOR UPDATE
USING (public.is_workspace_owner(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_owner(workspace_id, auth.uid()));

CREATE POLICY "Workspace members: delete (owner)"
ON public.workspace_members
FOR DELETE
USING (public.is_workspace_owner(workspace_id, auth.uid()));

-- Recreate policies for workspaces
CREATE POLICY "Workspaces: select (member)"
ON public.workspaces
FOR SELECT
USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Workspaces: insert (creator)"
ON public.workspaces
FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Workspaces: update (owner)"
ON public.workspaces
FOR UPDATE
USING (public.is_workspace_owner(id, auth.uid()))
WITH CHECK (public.is_workspace_owner(id, auth.uid()));

CREATE POLICY "Workspaces: delete (owner)"
ON public.workspaces
FOR DELETE
USING (public.is_workspace_owner(id, auth.uid()));