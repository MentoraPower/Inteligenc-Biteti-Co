-- Instagram chats cache table
CREATE TABLE public.instagram_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE,
  participant_id TEXT NOT NULL,
  participant_name TEXT,
  participant_username TEXT,
  participant_avatar TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Instagram messages cache table
CREATE TABLE public.instagram_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL,
  text TEXT,
  from_me BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'RECEIVED',
  media_type TEXT,
  media_url TEXT,
  share_link TEXT,
  share_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.instagram_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for instagram_chats
CREATE POLICY "Authenticated users can view instagram_chats"
  ON public.instagram_chats FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert instagram_chats"
  ON public.instagram_chats FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update instagram_chats"
  ON public.instagram_chats FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete instagram_chats"
  ON public.instagram_chats FOR DELETE USING (true);

-- RLS policies for instagram_messages
CREATE POLICY "Authenticated users can view instagram_messages"
  ON public.instagram_messages FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert instagram_messages"
  ON public.instagram_messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update instagram_messages"
  ON public.instagram_messages FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete instagram_messages"
  ON public.instagram_messages FOR DELETE USING (true);

-- Indexes for performance
CREATE INDEX idx_instagram_messages_conversation ON public.instagram_messages(conversation_id);
CREATE INDEX idx_instagram_messages_created ON public.instagram_messages(created_at DESC);
CREATE INDEX idx_instagram_chats_updated ON public.instagram_chats(updated_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_instagram_chats_updated_at
  BEFORE UPDATE ON public.instagram_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();