-- Create function for atomic increment of unread count
CREATE OR REPLACE FUNCTION public.increment_unread_count(chat_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_chats 
  SET unread_count = COALESCE(unread_count, 0) + 1 
  WHERE id = chat_uuid;
END;
$$;