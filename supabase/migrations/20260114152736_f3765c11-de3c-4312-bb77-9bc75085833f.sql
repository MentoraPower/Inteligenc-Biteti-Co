-- Add unique constraint on whatsapp_groups for (group_jid, session_id)
-- This ensures each group is unique per WhatsApp account
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'whatsapp_groups_group_jid_session_id_key'
    ) THEN
        ALTER TABLE whatsapp_groups 
        ADD CONSTRAINT whatsapp_groups_group_jid_session_id_key 
        UNIQUE (group_jid, session_id);
    END IF;
END $$;