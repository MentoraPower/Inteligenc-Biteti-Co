-- Add is_edited column to track edited messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;