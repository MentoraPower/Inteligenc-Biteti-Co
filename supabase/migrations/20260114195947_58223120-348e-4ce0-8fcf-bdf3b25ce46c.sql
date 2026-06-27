-- Add sender information columns to whatsapp_messages for group message support
ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS sender_jid TEXT,
ADD COLUMN IF NOT EXISTS sender_phone TEXT,
ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Add index for faster lookups by sender_phone
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_phone ON whatsapp_messages(sender_phone);