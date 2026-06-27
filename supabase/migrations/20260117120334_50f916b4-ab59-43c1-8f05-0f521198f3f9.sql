-- =====================================================
-- PHASE 13: Remove remaining permissive policies (corrected)
-- =====================================================

-- calendar_appointments - old policies still exist
DROP POLICY IF EXISTS "Authenticated users can create appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "Authenticated users can view all appointments" ON public.calendar_appointments;

-- crm_origins - old policies
DROP POLICY IF EXISTS "Anyone can delete crm_origins" ON public.crm_origins;
DROP POLICY IF EXISTS "Anyone can insert crm_origins" ON public.crm_origins;
DROP POLICY IF EXISTS "Anyone can update crm_origins" ON public.crm_origins;
DROP POLICY IF EXISTS "Anyone can view crm_origins" ON public.crm_origins;

-- crm_sub_origins - old policies
DROP POLICY IF EXISTS "Anyone can delete crm_sub_origins" ON public.crm_sub_origins;
DROP POLICY IF EXISTS "Anyone can insert crm_sub_origins" ON public.crm_sub_origins;
DROP POLICY IF EXISTS "Anyone can update crm_sub_origins" ON public.crm_sub_origins;
DROP POLICY IF EXISTS "Anyone can view crm_sub_origins" ON public.crm_sub_origins;

-- crm_tab_preferences
DROP POLICY IF EXISTS "Authenticated users can delete tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Authenticated users can insert tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Authenticated users can update tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Authenticated users can view tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Workspace members can read tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Workspace members can insert tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Workspace members can update tab preferences" ON public.crm_tab_preferences;
DROP POLICY IF EXISTS "Workspace members can delete tab preferences" ON public.crm_tab_preferences;

CREATE POLICY "Workspace members can read tab preferences" ON public.crm_tab_preferences
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert tab preferences" ON public.crm_tab_preferences
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update tab preferences" ON public.crm_tab_preferences
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete tab preferences" ON public.crm_tab_preferences
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- crm_webhooks (via origin's workspace)
DROP POLICY IF EXISTS "Anyone can delete crm_webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Anyone can insert crm_webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Anyone can update crm_webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Anyone can view crm_webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Workspace members can read webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Workspace members can insert webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Workspace members can update webhooks" ON public.crm_webhooks;
DROP POLICY IF EXISTS "Workspace members can delete webhooks" ON public.crm_webhooks;

CREATE POLICY "Workspace members can read webhooks" ON public.crm_webhooks
FOR SELECT USING (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = crm_webhooks.origin_id),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can insert webhooks" ON public.crm_webhooks
FOR INSERT WITH CHECK (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = origin_id),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can update webhooks" ON public.crm_webhooks
FOR UPDATE USING (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = crm_webhooks.origin_id),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can delete webhooks" ON public.crm_webhooks
FOR DELETE USING (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = crm_webhooks.origin_id),
    auth.uid()
  )
);

-- dashboards
DROP POLICY IF EXISTS "Authenticated users can create dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Authenticated users can delete dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Authenticated users can update dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Authenticated users can view dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Workspace members can read dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Workspace members can insert dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Workspace members can update dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Workspace members can delete dashboards" ON public.dashboards;

CREATE POLICY "Workspace members can read dashboards" ON public.dashboards
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert dashboards" ON public.dashboards
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update dashboards" ON public.dashboards
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete dashboards" ON public.dashboards
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- dispatch_conversations - old policies
DROP POLICY IF EXISTS "Authenticated users can create dispatch_conversations" ON public.dispatch_conversations;
DROP POLICY IF EXISTS "Authenticated users can delete dispatch_conversations" ON public.dispatch_conversations;
DROP POLICY IF EXISTS "Authenticated users can update dispatch_conversations" ON public.dispatch_conversations;
DROP POLICY IF EXISTS "Authenticated users can view dispatch_conversations" ON public.dispatch_conversations;

-- dispatch_csv_lists (via conversation's workspace)
DROP POLICY IF EXISTS "Authenticated users can delete dispatch_csv_lists" ON public.dispatch_csv_lists;
DROP POLICY IF EXISTS "Authenticated users can insert dispatch_csv_lists" ON public.dispatch_csv_lists;
DROP POLICY IF EXISTS "Authenticated users can view dispatch_csv_lists" ON public.dispatch_csv_lists;
DROP POLICY IF EXISTS "Workspace members can read csv lists" ON public.dispatch_csv_lists;
DROP POLICY IF EXISTS "Workspace members can insert csv lists" ON public.dispatch_csv_lists;
DROP POLICY IF EXISTS "Workspace members can delete csv lists" ON public.dispatch_csv_lists;

CREATE OR REPLACE FUNCTION public.get_dispatch_conversation_workspace_id(_conversation_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.dispatch_conversations WHERE id = _conversation_id
$$;

CREATE POLICY "Workspace members can read csv lists" ON public.dispatch_csv_lists
FOR SELECT USING (
  is_workspace_member(get_dispatch_conversation_workspace_id(conversation_id), auth.uid())
);

CREATE POLICY "Workspace members can insert csv lists" ON public.dispatch_csv_lists
FOR INSERT WITH CHECK (
  is_workspace_member(get_dispatch_conversation_workspace_id(conversation_id), auth.uid())
);

CREATE POLICY "Workspace members can delete csv lists" ON public.dispatch_csv_lists
FOR DELETE USING (
  is_workspace_member(get_dispatch_conversation_workspace_id(conversation_id), auth.uid())
);

-- dispatch_csv_list_recipients (via list's conversation's workspace)
DROP POLICY IF EXISTS "Authenticated users can delete dispatch_csv_list_recipients" ON public.dispatch_csv_list_recipients;
DROP POLICY IF EXISTS "Authenticated users can insert dispatch_csv_list_recipients" ON public.dispatch_csv_list_recipients;
DROP POLICY IF EXISTS "Authenticated users can view dispatch_csv_list_recipients" ON public.dispatch_csv_list_recipients;
DROP POLICY IF EXISTS "Workspace members can read csv recipients" ON public.dispatch_csv_list_recipients;
DROP POLICY IF EXISTS "Workspace members can insert csv recipients" ON public.dispatch_csv_list_recipients;
DROP POLICY IF EXISTS "Workspace members can delete csv recipients" ON public.dispatch_csv_list_recipients;

CREATE OR REPLACE FUNCTION public.get_csv_list_workspace_id(_list_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dc.workspace_id 
  FROM public.dispatch_csv_lists dcl
  JOIN public.dispatch_conversations dc ON dcl.conversation_id = dc.id
  WHERE dcl.id = _list_id
$$;

CREATE POLICY "Workspace members can read csv recipients" ON public.dispatch_csv_list_recipients
FOR SELECT USING (
  is_workspace_member(get_csv_list_workspace_id(list_id), auth.uid())
);

CREATE POLICY "Workspace members can insert csv recipients" ON public.dispatch_csv_list_recipients
FOR INSERT WITH CHECK (
  is_workspace_member(get_csv_list_workspace_id(list_id), auth.uid())
);

CREATE POLICY "Workspace members can delete csv recipients" ON public.dispatch_csv_list_recipients
FOR DELETE USING (
  is_workspace_member(get_csv_list_workspace_id(list_id), auth.uid())
);

-- dispatch_jobs - old policies
DROP POLICY IF EXISTS "Authenticated users can delete dispatch_jobs" ON public.dispatch_jobs;
DROP POLICY IF EXISTS "Authenticated users can insert dispatch_jobs" ON public.dispatch_jobs;
DROP POLICY IF EXISTS "Authenticated users can update dispatch_jobs" ON public.dispatch_jobs;
DROP POLICY IF EXISTS "Authenticated users can view dispatch_jobs" ON public.dispatch_jobs;

-- email_automations
DROP POLICY IF EXISTS "Allow all operations" ON public.email_automations;
DROP POLICY IF EXISTS "Workspace members can read automations" ON public.email_automations;
DROP POLICY IF EXISTS "Workspace members can insert automations" ON public.email_automations;
DROP POLICY IF EXISTS "Workspace members can update automations" ON public.email_automations;
DROP POLICY IF EXISTS "Workspace members can delete automations" ON public.email_automations;

CREATE POLICY "Workspace members can read automations" ON public.email_automations
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert automations" ON public.email_automations
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update automations" ON public.email_automations
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete automations" ON public.email_automations
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- email_settings (admin only)
DROP POLICY IF EXISTS "Allow all access to email_settings" ON public.email_settings;
DROP POLICY IF EXISTS "Admins can read email settings" ON public.email_settings;
DROP POLICY IF EXISTS "Admins can insert email settings" ON public.email_settings;
DROP POLICY IF EXISTS "Admins can update email settings" ON public.email_settings;
DROP POLICY IF EXISTS "Admins can delete email settings" ON public.email_settings;

CREATE POLICY "Admins can read email settings" ON public.email_settings
FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert email settings" ON public.email_settings
FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update email settings" ON public.email_settings
FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete email settings" ON public.email_settings
FOR DELETE USING (is_admin(auth.uid()));

-- email_templates
DROP POLICY IF EXISTS "Allow all access to email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Workspace members can read templates" ON public.email_templates;
DROP POLICY IF EXISTS "Workspace members can insert templates" ON public.email_templates;
DROP POLICY IF EXISTS "Workspace members can update templates" ON public.email_templates;
DROP POLICY IF EXISTS "Workspace members can delete templates" ON public.email_templates;

CREATE POLICY "Workspace members can read templates" ON public.email_templates
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert templates" ON public.email_templates
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update templates" ON public.email_templates
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete templates" ON public.email_templates
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- leads - remove old duplicate policies
DROP POLICY IF EXISTS "Anyone can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can submit leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can update leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can view leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can view leads" ON public.leads;

-- lead_activities - old policies
DROP POLICY IF EXISTS "Anyone can delete lead_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Anyone can insert lead_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Anyone can update lead_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Anyone can view lead_activities" ON public.lead_activities;

-- lead_custom_field_responses - old policies
DROP POLICY IF EXISTS "Anyone can delete lead_custom_field_responses" ON public.lead_custom_field_responses;
DROP POLICY IF EXISTS "Anyone can insert lead_custom_field_responses" ON public.lead_custom_field_responses;
DROP POLICY IF EXISTS "Anyone can update lead_custom_field_responses" ON public.lead_custom_field_responses;
DROP POLICY IF EXISTS "Anyone can view lead_custom_field_responses" ON public.lead_custom_field_responses;

-- lead_tags - old policies
DROP POLICY IF EXISTS "Anyone can delete lead_tags" ON public.lead_tags;
DROP POLICY IF EXISTS "Anyone can insert lead_tags" ON public.lead_tags;
DROP POLICY IF EXISTS "Anyone can update lead_tags" ON public.lead_tags;
DROP POLICY IF EXISTS "Anyone can view lead_tags" ON public.lead_tags;

-- lead_tracking - old policies
DROP POLICY IF EXISTS "Anyone can delete lead_tracking" ON public.lead_tracking;
DROP POLICY IF EXISTS "Anyone can insert lead_tracking" ON public.lead_tracking;
DROP POLICY IF EXISTS "Anyone can view lead_tracking" ON public.lead_tracking;

-- overview_cards
DROP POLICY IF EXISTS "Authenticated users can delete overview_cards" ON public.overview_cards;
DROP POLICY IF EXISTS "Authenticated users can insert overview_cards" ON public.overview_cards;
DROP POLICY IF EXISTS "Authenticated users can update overview_cards" ON public.overview_cards;
DROP POLICY IF EXISTS "Authenticated users can view overview_cards" ON public.overview_cards;
DROP POLICY IF EXISTS "Workspace members can read overview cards" ON public.overview_cards;
DROP POLICY IF EXISTS "Workspace members can insert overview cards" ON public.overview_cards;
DROP POLICY IF EXISTS "Workspace members can update overview cards" ON public.overview_cards;
DROP POLICY IF EXISTS "Workspace members can delete overview cards" ON public.overview_cards;

CREATE POLICY "Workspace members can read overview cards" ON public.overview_cards
FOR SELECT USING (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

CREATE POLICY "Workspace members can insert overview cards" ON public.overview_cards
FOR INSERT WITH CHECK (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

CREATE POLICY "Workspace members can update overview cards" ON public.overview_cards
FOR UPDATE USING (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

CREATE POLICY "Workspace members can delete overview cards" ON public.overview_cards
FOR DELETE USING (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

-- pipeline_automations
DROP POLICY IF EXISTS "Anyone can delete pipeline_automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Anyone can insert pipeline_automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Anyone can update pipeline_automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Anyone can view pipeline_automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Workspace members can read pipeline automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Workspace members can insert pipeline automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Workspace members can update pipeline automations" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Workspace members can delete pipeline automations" ON public.pipeline_automations;

CREATE POLICY "Workspace members can read pipeline automations" ON public.pipeline_automations
FOR SELECT USING (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

CREATE POLICY "Workspace members can insert pipeline automations" ON public.pipeline_automations
FOR INSERT WITH CHECK (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

CREATE POLICY "Workspace members can update pipeline automations" ON public.pipeline_automations
FOR UPDATE USING (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

CREATE POLICY "Workspace members can delete pipeline automations" ON public.pipeline_automations
FOR DELETE USING (
  is_workspace_member(get_sub_origin_workspace_id(sub_origin_id), auth.uid())
);

-- pipelines - old policies
DROP POLICY IF EXISTS "Anyone can delete pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Anyone can insert pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Anyone can update pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Anyone can view pipelines" ON public.pipelines;

-- profiles - old policies
DROP POLICY IF EXISTS "Anyone can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;

-- quick_messages
DROP POLICY IF EXISTS "Anyone can delete quick_messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Anyone can insert quick_messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Anyone can update quick_messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Anyone can view quick_messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Workspace members can read quick messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Workspace members can insert quick messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Workspace members can update quick messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Workspace members can delete quick messages" ON public.quick_messages;

CREATE POLICY "Workspace members can read quick messages" ON public.quick_messages
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert quick messages" ON public.quick_messages
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update quick messages" ON public.quick_messages
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete quick messages" ON public.quick_messages
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- sales - old policies
DROP POLICY IF EXISTS "Anyone can delete sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can read sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can update sales" ON public.sales;

-- scheduled_emails
DROP POLICY IF EXISTS "Allow all operations on scheduled_emails" ON public.scheduled_emails;

-- sent_emails
DROP POLICY IF EXISTS "Allow all access to sent_emails" ON public.sent_emails;