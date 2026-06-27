-- ========================================
-- REMOVER POLÍTICAS ANTIGAS - whatsapp_chats
-- ========================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON whatsapp_chats;
DROP POLICY IF EXISTS "Anyone can view whatsapp_chats" ON whatsapp_chats;
DROP POLICY IF EXISTS "Anyone can insert whatsapp_chats" ON whatsapp_chats;
DROP POLICY IF EXISTS "Anyone can update whatsapp_chats" ON whatsapp_chats;
DROP POLICY IF EXISTS "Anyone can delete whatsapp_chats" ON whatsapp_chats;

-- ========================================
-- REMOVER POLÍTICAS ANTIGAS - whatsapp_messages
-- ========================================
DROP POLICY IF EXISTS "Allow all for authenticated users" ON whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can view whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can insert whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can update whatsapp_messages" ON whatsapp_messages;
DROP POLICY IF EXISTS "Anyone can delete whatsapp_messages" ON whatsapp_messages;

-- ========================================
-- REMOVER POLÍTICAS ANTIGAS - whatsapp_groups
-- ========================================
DROP POLICY IF EXISTS "Authenticated users can view groups" ON whatsapp_groups;
DROP POLICY IF EXISTS "Authenticated users can insert groups" ON whatsapp_groups;
DROP POLICY IF EXISTS "Authenticated users can update groups" ON whatsapp_groups;
DROP POLICY IF EXISTS "Authenticated users can delete groups" ON whatsapp_groups;

-- ========================================
-- REMOVER POLÍTICAS ANTIGAS - whatsapp_group_participants
-- ========================================
DROP POLICY IF EXISTS "Authenticated users can view participants" ON whatsapp_group_participants;
DROP POLICY IF EXISTS "Authenticated users can insert participants" ON whatsapp_group_participants;
DROP POLICY IF EXISTS "Authenticated users can update participants" ON whatsapp_group_participants;
DROP POLICY IF EXISTS "Authenticated users can delete participants" ON whatsapp_group_participants;

-- ========================================
-- REMOVER POLÍTICAS DUPLICADAS - user_roles
-- ========================================
DROP POLICY IF EXISTS "Admins can insert user_roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update user_roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete user_roles" ON user_roles;