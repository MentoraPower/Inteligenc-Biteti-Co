-- Add columns to whatsapp_messages for quoted/reply messages
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS quoted_message_id text,
ADD COLUMN IF NOT EXISTS quoted_text text,
ADD COLUMN IF NOT EXISTS quoted_from_me boolean;