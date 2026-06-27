-- Add all existing members from default workspace to the Mentora workspace
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT 'c65cebf7-dc1d-464f-a267-938b07621680', user_id, 'member'
FROM workspace_members 
WHERE workspace_id = '00000000-0000-0000-0000-000000000001'
  AND user_id != 'ccdac70c-bea8-4dc0-a1e9-d60c0fc1f9bb'
ON CONFLICT DO NOTHING;