-- =====================================================
-- PHASE 14: Fix remaining onboarding and misc tables
-- These need special handling as they require public access for forms
-- =====================================================

-- lead_onboarding_forms - keep SELECT public but restrict write
DROP POLICY IF EXISTS "Anyone can delete lead_onboarding_forms" ON public.lead_onboarding_forms;
DROP POLICY IF EXISTS "Anyone can insert lead_onboarding_forms" ON public.lead_onboarding_forms;
DROP POLICY IF EXISTS "Anyone can update lead_onboarding_forms" ON public.lead_onboarding_forms;
DROP POLICY IF EXISTS "Anyone can view lead_onboarding_forms" ON public.lead_onboarding_forms;

CREATE POLICY "Anyone can view published forms" ON public.lead_onboarding_forms
FOR SELECT USING (is_published = true OR is_workspace_member(get_lead_workspace_id(lead_id), auth.uid()));

CREATE POLICY "Workspace members can insert forms" ON public.lead_onboarding_forms
FOR INSERT WITH CHECK (is_workspace_member(get_lead_workspace_id(lead_id), auth.uid()));

CREATE POLICY "Workspace members can update forms" ON public.lead_onboarding_forms
FOR UPDATE USING (is_workspace_member(get_lead_workspace_id(lead_id), auth.uid()));

CREATE POLICY "Workspace members can delete forms" ON public.lead_onboarding_forms
FOR DELETE USING (is_workspace_member(get_lead_workspace_id(lead_id), auth.uid()));

-- lead_onboarding_fields
DROP POLICY IF EXISTS "Anyone can delete lead_onboarding_fields" ON public.lead_onboarding_fields;
DROP POLICY IF EXISTS "Anyone can insert lead_onboarding_fields" ON public.lead_onboarding_fields;
DROP POLICY IF EXISTS "Anyone can update lead_onboarding_fields" ON public.lead_onboarding_fields;
DROP POLICY IF EXISTS "Anyone can view lead_onboarding_fields" ON public.lead_onboarding_fields;

-- Helper to get lead workspace from field
CREATE OR REPLACE FUNCTION public.get_form_lead_workspace_id(_form_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_lead_workspace_id(lead_id) FROM public.lead_onboarding_forms WHERE id = _form_id
$$;

CREATE POLICY "Anyone can view published form fields" ON public.lead_onboarding_fields
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.lead_onboarding_forms f 
    WHERE f.id = lead_onboarding_fields.form_id AND f.is_published = true
  )
  OR is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid())
);

CREATE POLICY "Workspace members can insert fields" ON public.lead_onboarding_fields
FOR INSERT WITH CHECK (is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid()));

CREATE POLICY "Workspace members can update fields" ON public.lead_onboarding_fields
FOR UPDATE USING (is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid()));

CREATE POLICY "Workspace members can delete fields" ON public.lead_onboarding_fields
FOR DELETE USING (is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid()));

-- lead_onboarding_responses - public insert, restricted read/delete
DROP POLICY IF EXISTS "Anyone can delete lead_onboarding_responses" ON public.lead_onboarding_responses;
DROP POLICY IF EXISTS "Anyone can insert lead_onboarding_responses" ON public.lead_onboarding_responses;
DROP POLICY IF EXISTS "Anyone can update lead_onboarding_responses" ON public.lead_onboarding_responses;
DROP POLICY IF EXISTS "Anyone can view lead_onboarding_responses" ON public.lead_onboarding_responses;

-- Anyone can submit responses to published forms
CREATE POLICY "Anyone can submit responses to published forms" ON public.lead_onboarding_responses
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lead_onboarding_forms f 
    WHERE f.id = lead_onboarding_responses.form_id AND f.is_published = true
  )
  OR is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid())
);

CREATE POLICY "Workspace members can view responses" ON public.lead_onboarding_responses
FOR SELECT USING (is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid()));

CREATE POLICY "Workspace members can update responses" ON public.lead_onboarding_responses
FOR UPDATE USING (is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid()));

CREATE POLICY "Workspace members can delete responses" ON public.lead_onboarding_responses
FOR DELETE USING (is_workspace_member(get_form_lead_workspace_id(form_id), auth.uid()));

-- sub_origin_custom_fields
DROP POLICY IF EXISTS "Anyone can view sub_origin_custom_fields" ON public.sub_origin_custom_fields;
DROP POLICY IF EXISTS "Anyone can insert sub_origin_custom_fields" ON public.sub_origin_custom_fields;
DROP POLICY IF EXISTS "Anyone can update sub_origin_custom_fields" ON public.sub_origin_custom_fields;
DROP POLICY IF EXISTS "Anyone can delete sub_origin_custom_fields" ON public.sub_origin_custom_fields;

ALTER TABLE public.sub_origin_custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read custom fields" ON public.sub_origin_custom_fields
FOR SELECT USING (is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid()));

CREATE POLICY "Workspace members can insert custom fields" ON public.sub_origin_custom_fields
FOR INSERT WITH CHECK (is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid()));

CREATE POLICY "Workspace members can update custom fields" ON public.sub_origin_custom_fields
FOR UPDATE USING (is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid()));

CREATE POLICY "Workspace members can delete custom fields" ON public.sub_origin_custom_fields
FOR DELETE USING (is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid()));

-- email_tracking_events (keep public INSERT for tracking pixels, restrict read)
DROP POLICY IF EXISTS "Anyone can insert tracking events" ON public.email_tracking_events;
DROP POLICY IF EXISTS "Authenticated users can view tracking events" ON public.email_tracking_events;

-- Keep public INSERT for tracking pixels (from emails)
CREATE POLICY "Anyone can insert tracking events" ON public.email_tracking_events
FOR INSERT WITH CHECK (true);

-- Function to check workspace access via sent_email
CREATE OR REPLACE FUNCTION public.get_sent_email_workspace_id(_sent_email_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.sent_emails WHERE id = _sent_email_id
$$;

CREATE OR REPLACE FUNCTION public.get_scheduled_email_workspace_id(_scheduled_email_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.scheduled_emails WHERE id = _scheduled_email_id
$$;

CREATE POLICY "Workspace members can view tracking events" ON public.email_tracking_events
FOR SELECT USING (
  (sent_email_id IS NOT NULL AND is_workspace_member(get_sent_email_workspace_id(sent_email_id), auth.uid()))
  OR
  (scheduled_email_id IS NOT NULL AND is_workspace_member(get_scheduled_email_workspace_id(scheduled_email_id), auth.uid()))
);

-- page_views - public analytics, keep as is but it's fine since no sensitive data
-- These are intentionally public for analytics

-- origin_settings - keep SELECT public for settings, restrict write to admins
-- Already has correct admin policies, just need to verify SELECT