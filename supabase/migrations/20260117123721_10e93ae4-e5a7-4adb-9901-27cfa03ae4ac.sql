-- ============================================
-- FIX PERMISSIVE RLS POLICIES ON WHATSAPP TABLES
-- Drop existing policies first (including the ones that were just created)
-- ============================================

-- Drop ALL existing policies on whatsapp_chats
DROP POLICY IF EXISTS "Workspace members can insert chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Workspace members can update chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Workspace members can delete chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Workspace members can view chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Anyone can insert whatsapp_chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Anyone can update whatsapp_chats" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Anyone can delete whatsapp_chats" ON public.whatsapp_chats;

-- Create secure RLS policies for whatsapp_chats
CREATE POLICY "Workspace members can insert chats v2" ON public.whatsapp_chats
  FOR INSERT WITH CHECK (public.can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can update chats v2" ON public.whatsapp_chats
  FOR UPDATE USING (public.can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can delete chats v2" ON public.whatsapp_chats
  FOR DELETE USING (public.can_access_session(session_id, auth.uid()));

-- Drop ALL existing policies on whatsapp_messages
DROP POLICY IF EXISTS "Workspace members can insert messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Workspace members can update messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Workspace members can delete messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can insert whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can update whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can delete whatsapp_messages" ON public.whatsapp_messages;

-- Create secure RLS policies for whatsapp_messages
CREATE POLICY "Workspace members can insert messages v2" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whatsapp_chats c 
      WHERE c.id = chat_id 
      AND public.can_access_session(c.session_id, auth.uid())
    )
  );

CREATE POLICY "Workspace members can update messages v2" ON public.whatsapp_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_chats c 
      WHERE c.id = chat_id 
      AND public.can_access_session(c.session_id, auth.uid())
    )
  );

CREATE POLICY "Workspace members can delete messages v2" ON public.whatsapp_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.whatsapp_chats c 
      WHERE c.id = chat_id 
      AND public.can_access_session(c.session_id, auth.uid())
    )
  );

-- Drop ALL existing policies on whatsapp_groups
DROP POLICY IF EXISTS "Workspace members can insert groups" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Workspace members can update groups" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Workspace members can delete groups" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Anyone can insert whatsapp_groups" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Anyone can update whatsapp_groups" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Anyone can delete whatsapp_groups" ON public.whatsapp_groups;

-- Create secure RLS policies for whatsapp_groups
CREATE POLICY "Workspace members can insert groups v2" ON public.whatsapp_groups
  FOR INSERT WITH CHECK (public.can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can update groups v2" ON public.whatsapp_groups
  FOR UPDATE USING (public.can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can delete groups v2" ON public.whatsapp_groups
  FOR DELETE USING (public.can_access_session(session_id, auth.uid()));

-- Drop ALL existing policies on whatsapp_group_participants
DROP POLICY IF EXISTS "Workspace members can insert participants" ON public.whatsapp_group_participants;
DROP POLICY IF EXISTS "Workspace members can update participants" ON public.whatsapp_group_participants;
DROP POLICY IF EXISTS "Workspace members can delete participants" ON public.whatsapp_group_participants;
DROP POLICY IF EXISTS "Anyone can insert whatsapp_group_participants" ON public.whatsapp_group_participants;
DROP POLICY IF EXISTS "Anyone can update whatsapp_group_participants" ON public.whatsapp_group_participants;
DROP POLICY IF EXISTS "Anyone can delete whatsapp_group_participants" ON public.whatsapp_group_participants;

-- Create secure RLS policies for whatsapp_group_participants
CREATE POLICY "Workspace members can insert participants v2" ON public.whatsapp_group_participants
  FOR INSERT WITH CHECK (public.can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can update participants v2" ON public.whatsapp_group_participants
  FOR UPDATE USING (public.can_access_session(session_id, auth.uid()));

CREATE POLICY "Workspace members can delete participants v2" ON public.whatsapp_group_participants
  FOR DELETE USING (public.can_access_session(session_id, auth.uid()));