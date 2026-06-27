-- Add columns for last message status tracking
ALTER TABLE public.whatsapp_chats 
ADD COLUMN IF NOT EXISTS last_message_status text,
ADD COLUMN IF NOT EXISTS last_message_from_me boolean DEFAULT false;