-- Drop existing RLS policies for crm_webhooks
DROP POLICY IF EXISTS "Workspace members can read webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Workspace members can insert webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Workspace members can update webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Workspace members can delete webhooks" ON public.crm_webhooks;

-- Create new RLS policies that check workspace via origin_id OR sub_origin_id
CREATE POLICY "Workspace members can read webhooks" ON public.crm_webhooks
FOR SELECT USING (
  is_workspace_member(
    COALESCE(
      (SELECT workspace_id FROM public.crm_origins WHERE id = crm_webhooks.origin_id),
      (SELECT o.workspace_id FROM public.crm_sub_origins so JOIN public.crm_origins o ON so.origin_id = o.id WHERE so.id = crm_webhooks.sub_origin_id)
    ),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can insert webhooks" ON public.crm_webhooks
FOR INSERT WITH CHECK (
  is_workspace_member(
    COALESCE(
      (SELECT workspace_id FROM public.crm_origins WHERE id = origin_id),
      (SELECT o.workspace_id FROM public.crm_sub_origins so JOIN public.crm_origins o ON so.origin_id = o.id WHERE so.id = sub_origin_id)
    ),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can update webhooks" ON public.crm_webhooks
FOR UPDATE USING (
  is_workspace_member(
    COALESCE(
      (SELECT workspace_id FROM public.crm_origins WHERE id = crm_webhooks.origin_id),
      (SELECT o.workspace_id FROM public.crm_sub_origins so JOIN public.crm_origins o ON so.origin_id = o.id WHERE so.id = crm_webhooks.sub_origin_id)
    ),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can delete webhooks" ON public.crm_webhooks
FOR DELETE USING (
  is_workspace_member(
    COALESCE(
      (SELECT workspace_id FROM public.crm_origins WHERE id = crm_webhooks.origin_id),
      (SELECT o.workspace_id FROM public.crm_sub_origins so JOIN public.crm_origins o ON so.origin_id = o.id WHERE so.id = crm_webhooks.sub_origin_id)
    ),
    auth.uid()
  )
);