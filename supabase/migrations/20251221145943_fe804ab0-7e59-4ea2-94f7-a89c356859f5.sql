-- Drop the existing index with COALESCE (doesn't work with onConflict)
DROP INDEX IF EXISTS whatsapp_chats_phone_session_id_unique;

-- Create a proper unique constraint that works with onConflict
-- First, update any NULL session_id values to empty string to avoid conflicts
UPDATE whatsapp_chats SET session_id = '' WHERE session_id IS NULL;

-- Now create the unique constraint directly on the columns
ALTER TABLE whatsapp_chats ADD CONSTRAINT whatsapp_chats_phone_session_unique UNIQUE (phone, session_id);