-- Update existing leads that have sub_origin_id but no workspace_id
UPDATE leads 
SET workspace_id = (
  SELECT o.workspace_id 
  FROM crm_sub_origins so 
  JOIN crm_origins o ON so.origin_id = o.id 
  WHERE so.id = leads.sub_origin_id
)
WHERE workspace_id IS NULL AND sub_origin_id IS NOT NULL;