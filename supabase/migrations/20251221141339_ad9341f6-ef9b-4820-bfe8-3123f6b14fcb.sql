-- Add session_id column to whatsapp_chats to associate chats with specific WhatsApp sessions
ALTER TABLE public.whatsapp_chats 
ADD COLUMN IF NOT EXISTS session_id text;

-- Add session_id column to whatsapp_messages as well for consistency
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS session_id text;

-- Create index for faster queries by session
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_session_id ON public.whatsapp_chats(session_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session_id ON public.whatsapp_messages(session_id);