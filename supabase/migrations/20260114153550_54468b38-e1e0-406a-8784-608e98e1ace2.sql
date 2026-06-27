-- Add unique constraint on whatsapp_group_participants for (group_jid, session_id, participant_jid)
-- This ensures each participant is unique per group per WhatsApp account
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'whatsapp_group_participants_group_session_participant_key'
    ) THEN
        ALTER TABLE whatsapp_group_participants 
        ADD CONSTRAINT whatsapp_group_participants_group_session_participant_key 
        UNIQUE (group_jid, session_id, participant_jid);
    END IF;
END $$;

-- Add index for efficient lookups by group_jid and session_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_participants_group_session 
ON whatsapp_group_participants (group_jid, session_id);

-- Enable realtime for whatsapp_groups table to get participant count updates
ALTER TABLE whatsapp_groups REPLICA IDENTITY FULL;

-- Add whatsapp_groups to realtime publication if not already added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'whatsapp_groups'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_groups;
    END IF;
END $$;