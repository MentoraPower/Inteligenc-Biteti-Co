-- =====================================================
-- PHASE 1: Add workspace_id columns to missing tables
-- =====================================================

-- Add workspace_id to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- Add workspace_id to pipelines table
ALTER TABLE public.pipelines 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- Add workspace_id to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- Add workspace_id to sent_emails table
ALTER TABLE public.sent_emails 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- Add workspace_id to scheduled_emails table
ALTER TABLE public.scheduled_emails 
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);

-- =====================================================
-- PHASE 1.5: Populate workspace_id for existing data
-- =====================================================

-- Default workspace ID
-- Update leads: get workspace from sub_origin -> origin
UPDATE public.leads l
SET workspace_id = o.workspace_id
FROM public.crm_sub_origins so
JOIN public.crm_origins o ON so.origin_id = o.id
WHERE l.sub_origin_id = so.id AND l.workspace_id IS NULL;

-- Update pipelines: get workspace from sub_origin -> origin
UPDATE public.pipelines p
SET workspace_id = o.workspace_id
FROM public.crm_sub_origins so
JOIN public.crm_origins o ON so.origin_id = o.id
WHERE p.sub_origin_id = so.id AND p.workspace_id IS NULL;

-- Update sent_emails: get workspace from lead
UPDATE public.sent_emails se
SET workspace_id = l.workspace_id
FROM public.leads l
WHERE se.lead_id = l.id AND se.workspace_id IS NULL;

-- Update scheduled_emails: get workspace from lead
UPDATE public.scheduled_emails sche
SET workspace_id = l.workspace_id
FROM public.leads l
WHERE sche.lead_id = l.id AND sche.workspace_id IS NULL;

-- Set default workspace for any remaining NULL values
UPDATE public.leads SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.pipelines SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.sales SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.sent_emails SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;
UPDATE public.scheduled_emails SET workspace_id = '00000000-0000-0000-0000-000000000001' WHERE workspace_id IS NULL;

-- =====================================================
-- PHASE 2: Create helper security functions
-- =====================================================

-- Function to get workspace_id from a lead
CREATE OR REPLACE FUNCTION public.get_lead_workspace_id(_lead_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.leads WHERE id = _lead_id
$$;

-- Function to get workspace_id from a sub_origin
CREATE OR REPLACE FUNCTION public.get_sub_origin_workspace_id(_sub_origin_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.workspace_id 
  FROM public.crm_sub_origins so
  JOIN public.crm_origins o ON so.origin_id = o.id
  WHERE so.id = _sub_origin_id
$$;

-- Function to check if user can access a session (WhatsApp)
CREATE OR REPLACE FUNCTION public.can_access_session(_session_id text, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.workspace_whatsapp_accounts wwa
    JOIN public.workspace_members wm ON wwa.workspace_id = wm.workspace_id
    WHERE wwa.session_id = _session_id AND wm.user_id = _user_id
  )
$$;

-- =====================================================
-- PHASE 3: Fix PROFILES table RLS (critical - contains employee data)
-- =====================================================

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Workspace members can view colleagues" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Users in same workspace can view each other
CREATE POLICY "Workspace members can view colleagues" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm1
    JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = auth.uid() AND wm2.user_id = profiles.id
  )
);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================
-- PHASE 4: Fix LEADS table RLS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can read leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can update leads" ON public.leads;

CREATE POLICY "Workspace members can read leads" ON public.leads
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert leads" ON public.leads
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update leads" ON public.leads
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete leads" ON public.leads
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- =====================================================
-- PHASE 5: Fix PIPELINES table RLS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can delete pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Anyone can insert pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Anyone can read pipelines" ON public.pipelines;
DROP POLICY IF EXISTS "Anyone can update pipelines" ON public.pipelines;

CREATE POLICY "Workspace members can read pipelines" ON public.pipelines
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert pipelines" ON public.pipelines
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update pipelines" ON public.pipelines
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete pipelines" ON public.pipelines
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- =====================================================
-- PHASE 6: Fix WHATSAPP tables RLS
-- =====================================================

-- whatsapp_chats
DROP POLICY IF EXISTS "Authenticated users can delete their chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Authenticated users can insert chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Authenticated users can read all chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Authenticated users can update their chats" ON public.whatsapp_chats;

CREATE POLICY "Workspace members can read chats" ON public.whatsapp_chats
FOR SELECT USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can insert chats" ON public.whatsapp_chats
FOR INSERT WITH CHECK (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can update chats" ON public.whatsapp_chats
FOR UPDATE USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can delete chats" ON public.whatsapp_chats
FOR DELETE USING (can_access_session(session_id, auth.uid()));

-- whatsapp_messages
DROP POLICY IF EXISTS "Authenticated users can delete messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can read all messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Authenticated users can update messages" ON public.whatsapp_messages;

CREATE POLICY "Workspace members can read messages" ON public.whatsapp_messages
FOR SELECT USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can insert messages" ON public.whatsapp_messages
FOR INSERT WITH CHECK (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can update messages" ON public.whatsapp_messages
FOR UPDATE USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can delete messages" ON public.whatsapp_messages
FOR DELETE USING (can_access_session(session_id, auth.uid()));

-- whatsapp_groups
DROP POLICY IF EXISTS "Authenticated users can manage groups" ON public.whatsapp_groups;

CREATE POLICY "Workspace members can read groups" ON public.whatsapp_groups
FOR SELECT USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can insert groups" ON public.whatsapp_groups
FOR INSERT WITH CHECK (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can update groups" ON public.whatsapp_groups
FOR UPDATE USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can delete groups" ON public.whatsapp_groups
FOR DELETE USING (can_access_session(session_id, auth.uid()));

-- whatsapp_group_participants
DROP POLICY IF EXISTS "Authenticated users can manage group participants" ON public.whatsapp_group_participants;

CREATE POLICY "Workspace members can read participants" ON public.whatsapp_group_participants
FOR SELECT USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can insert participants" ON public.whatsapp_group_participants
FOR INSERT WITH CHECK (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can update participants" ON public.whatsapp_group_participants
FOR UPDATE USING (can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can delete participants" ON public.whatsapp_group_participants
FOR DELETE USING (can_access_session(session_id, auth.uid()));

-- =====================================================
-- PHASE 7: Fix CALENDAR table RLS
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "Authenticated users can read appointments" ON public.calendar_appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.calendar_appointments;

CREATE POLICY "Workspace members can read appointments" ON public.calendar_appointments
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert appointments" ON public.calendar_appointments
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update appointments" ON public.calendar_appointments
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete appointments" ON public.calendar_appointments
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- =====================================================
-- PHASE 8: Fix EMAIL tables RLS
-- =====================================================

-- sent_emails
DROP POLICY IF EXISTS "Authenticated users can delete sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can insert sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can read sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can update sent emails" ON public.sent_emails;

CREATE POLICY "Workspace members can read sent emails" ON public.sent_emails
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert sent emails" ON public.sent_emails
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update sent emails" ON public.sent_emails
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete sent emails" ON public.sent_emails
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- scheduled_emails
DROP POLICY IF EXISTS "Authenticated users can delete scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can insert scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can read scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Authenticated users can update scheduled emails" ON public.scheduled_emails;

CREATE POLICY "Workspace members can read scheduled emails" ON public.scheduled_emails
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert scheduled emails" ON public.scheduled_emails
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update scheduled emails" ON public.scheduled_emails
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete scheduled emails" ON public.scheduled_emails
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- =====================================================
-- PHASE 9: Fix DISPATCH tables RLS
-- =====================================================

-- dispatch_jobs
DROP POLICY IF EXISTS "Authenticated users can delete dispatch jobs" ON public.dispatch_jobs;
DROP POLICY IF EXISTS "Authenticated users can insert dispatch jobs" ON public.dispatch_jobs;
DROP POLICY IF EXISTS "Authenticated users can read dispatch jobs" ON public.dispatch_jobs;
DROP POLICY IF EXISTS "Authenticated users can update dispatch jobs" ON public.dispatch_jobs;

CREATE POLICY "Workspace members can read dispatch jobs" ON public.dispatch_jobs
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert dispatch jobs" ON public.dispatch_jobs
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update dispatch jobs" ON public.dispatch_jobs
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete dispatch jobs" ON public.dispatch_jobs
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- dispatch_conversations
DROP POLICY IF EXISTS "Authenticated users can delete conversations" ON public.dispatch_conversations;
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON public.dispatch_conversations;
DROP POLICY IF EXISTS "Authenticated users can read conversations" ON public.dispatch_conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON public.dispatch_conversations;

CREATE POLICY "Workspace members can read conversations" ON public.dispatch_conversations
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert conversations" ON public.dispatch_conversations
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update conversations" ON public.dispatch_conversations
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete conversations" ON public.dispatch_conversations
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- =====================================================
-- PHASE 10: Fix remaining CRM tables RLS
-- =====================================================

-- crm_origins
DROP POLICY IF EXISTS "Anyone can delete origins" ON public.crm_origins;
DROP POLICY IF EXISTS "Anyone can insert origins" ON public.crm_origins;
DROP POLICY IF EXISTS "Anyone can read origins" ON public.crm_origins;
DROP POLICY IF EXISTS "Anyone can update origins" ON public.crm_origins;

CREATE POLICY "Workspace members can read origins" ON public.crm_origins
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert origins" ON public.crm_origins
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update origins" ON public.crm_origins
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete origins" ON public.crm_origins
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));

-- crm_sub_origins (via origin's workspace)
DROP POLICY IF EXISTS "Anyone can delete sub_origins" ON public.crm_sub_origins;
DROP POLICY IF EXISTS "Anyone can insert sub_origins" ON public.crm_sub_origins;
DROP POLICY IF EXISTS "Anyone can read sub_origins" ON public.crm_sub_origins;
DROP POLICY IF EXISTS "Anyone can update sub_origins" ON public.crm_sub_origins;

CREATE POLICY "Workspace members can read sub_origins" ON public.crm_sub_origins
FOR SELECT USING (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = crm_sub_origins.origin_id),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can insert sub_origins" ON public.crm_sub_origins
FOR INSERT WITH CHECK (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = origin_id),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can update sub_origins" ON public.crm_sub_origins
FOR UPDATE USING (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = crm_sub_origins.origin_id),
    auth.uid()
  )
);

CREATE POLICY "Workspace members can delete sub_origins" ON public.crm_sub_origins
FOR DELETE USING (
  is_workspace_member(
    (SELECT workspace_id FROM public.crm_origins WHERE id = crm_sub_origins.origin_id),
    auth.uid()
  )
);

-- =====================================================
-- PHASE 11: Fix LEAD related tables RLS
-- =====================================================

-- lead_activities (via lead's workspace)
DROP POLICY IF EXISTS "Anyone can delete lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Anyone can insert lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Anyone can read lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Anyone can update lead activities" ON public.lead_activities;

CREATE POLICY "Workspace members can read lead activities" ON public.lead_activities
FOR SELECT USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can insert lead activities" ON public.lead_activities
FOR INSERT WITH CHECK (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can update lead activities" ON public.lead_activities
FOR UPDATE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can delete lead activities" ON public.lead_activities
FOR DELETE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

-- lead_tags (via lead's workspace)
DROP POLICY IF EXISTS "Anyone can delete lead tags" ON public.lead_tags;
DROP POLICY IF EXISTS "Anyone can insert lead tags" ON public.lead_tags;
DROP POLICY IF EXISTS "Anyone can read lead tags" ON public.lead_tags;
DROP POLICY IF EXISTS "Anyone can update lead tags" ON public.lead_tags;

CREATE POLICY "Workspace members can read lead tags" ON public.lead_tags
FOR SELECT USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can insert lead tags" ON public.lead_tags
FOR INSERT WITH CHECK (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can update lead tags" ON public.lead_tags
FOR UPDATE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can delete lead tags" ON public.lead_tags
FOR DELETE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

-- lead_tracking (via lead's workspace)
DROP POLICY IF EXISTS "Anyone can delete lead tracking" ON public.lead_tracking;
DROP POLICY IF EXISTS "Anyone can insert lead tracking" ON public.lead_tracking;
DROP POLICY IF EXISTS "Anyone can read lead tracking" ON public.lead_tracking;
DROP POLICY IF EXISTS "Anyone can update lead tracking" ON public.lead_tracking;

CREATE POLICY "Workspace members can read lead tracking" ON public.lead_tracking
FOR SELECT USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can insert lead tracking" ON public.lead_tracking
FOR INSERT WITH CHECK (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can update lead tracking" ON public.lead_tracking
FOR UPDATE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can delete lead tracking" ON public.lead_tracking
FOR DELETE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

-- lead_custom_field_responses (via lead's workspace)
DROP POLICY IF EXISTS "Anyone can delete lead custom field responses" ON public.lead_custom_field_responses;
DROP POLICY IF EXISTS "Anyone can insert lead custom field responses" ON public.lead_custom_field_responses;
DROP POLICY IF EXISTS "Anyone can read lead custom field responses" ON public.lead_custom_field_responses;
DROP POLICY IF EXISTS "Anyone can update lead custom field responses" ON public.lead_custom_field_responses;

CREATE POLICY "Workspace members can read custom field responses" ON public.lead_custom_field_responses
FOR SELECT USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can insert custom field responses" ON public.lead_custom_field_responses
FOR INSERT WITH CHECK (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can update custom field responses" ON public.lead_custom_field_responses
FOR UPDATE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

CREATE POLICY "Workspace members can delete custom field responses" ON public.lead_custom_field_responses
FOR DELETE USING (
  is_workspace_member(get_lead_workspace_id(lead_id), auth.uid())
);

-- =====================================================
-- PHASE 12: Fix SALES table RLS
-- =====================================================

DROP POLICY IF EXISTS "Anyone can delete sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can read sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can update sales" ON public.sales;

CREATE POLICY "Workspace members can read sales" ON public.sales
FOR SELECT USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert sales" ON public.sales
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update sales" ON public.sales
FOR UPDATE USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete sales" ON public.sales
FOR DELETE USING (is_workspace_member(workspace_id, auth.uid()));