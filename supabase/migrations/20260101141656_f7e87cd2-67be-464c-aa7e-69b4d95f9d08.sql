-- Add all existing users as owners of the Scale Ask workspace
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  id,
  'owner'
FROM auth.users
ON CONFLICT (workspace_id, user_id) DO NOTHING;