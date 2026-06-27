-- Drop existing RLS policies that use workspace_id
DROP POLICY IF EXISTS "Workspace members can insert tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Workspace members can update tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Workspace members can view tab preferences" ON public.crm_tab_preferences;

-- Create new RLS policies (authenticated users can manage)
CREATE POLICY "Authenticated users can insert tab preferences" 
ON public.crm_tab_preferences 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update tab preferences" 
ON public.crm_tab_preferences 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can view tab preferences" 
ON public.crm_tab_preferences 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can delete tab preferences" 
ON public.crm_tab_preferences 
FOR DELETE 
USING (true);