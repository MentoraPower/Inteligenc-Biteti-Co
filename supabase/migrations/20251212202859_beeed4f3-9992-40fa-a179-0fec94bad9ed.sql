-- Tabela para armazenar conversas do WhatsApp
CREATE TABLE public.whatsapp_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  photo_url TEXT,
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar mensagens do WhatsApp
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE,
  phone TEXT NOT NULL,
  text TEXT,
  from_me BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'RECEIVED',
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_chats
CREATE POLICY "Anyone can view whatsapp_chats" 
ON public.whatsapp_chats 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert whatsapp_chats" 
ON public.whatsapp_chats 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update whatsapp_chats" 
ON public.whatsapp_chats 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete whatsapp_chats" 
ON public.whatsapp_chats 
FOR DELETE 
USING (true);

-- RLS policies for whatsapp_messages
CREATE POLICY "Anyone can view whatsapp_messages" 
ON public.whatsapp_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert whatsapp_messages" 
ON public.whatsapp_messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update whatsapp_messages" 
ON public.whatsapp_messages 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete whatsapp_messages" 
ON public.whatsapp_messages 
FOR DELETE 
USING (true);

-- Indexes para performance
CREATE INDEX idx_whatsapp_messages_chat_id ON public.whatsapp_messages(chat_id);
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone);
CREATE INDEX idx_whatsapp_chats_phone ON public.whatsapp_chats(phone);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_chats_updated_at
BEFORE UPDATE ON public.whatsapp_chats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;