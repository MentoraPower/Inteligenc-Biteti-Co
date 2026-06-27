-- Add column to store WhatsApp's key.id separately from the numeric msgId
-- message_id: stores the numeric WasenderAPI msgId (used for replyTo)
-- whatsapp_key_id: stores the WhatsApp internal key.id (used for matching quoted messages)

ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS whatsapp_key_id TEXT DEFAULT NULL;

-- Create index for faster lookups by WhatsApp key ID
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_key_id ON public.whatsapp_messages(whatsapp_key_id);

-- Also ensure message_id index exists
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages(message_id);

COMMENT ON COLUMN public.whatsapp_messages.message_id IS 'Numeric msgId from WasenderAPI - used for replyTo parameter when sending replies';
COMMENT ON COLUMN public.whatsapp_messages.whatsapp_key_id IS 'WhatsApp internal key.id - used for matching quoted messages via contextInfo.stanzaId';