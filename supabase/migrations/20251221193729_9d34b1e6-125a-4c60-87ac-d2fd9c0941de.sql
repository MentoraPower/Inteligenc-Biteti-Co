-- Enable REPLICA IDENTITY FULL for real-time updates
ALTER TABLE public.instagram_messages REPLICA IDENTITY FULL;
ALTER TABLE public.instagram_chats REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.instagram_chats;