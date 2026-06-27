-- Create table for dispatch chat conversations
CREATE TABLE public.dispatch_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dispatch_conversations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view dispatch_conversations" 
ON public.dispatch_conversations 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create dispatch_conversations" 
ON public.dispatch_conversations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update dispatch_conversations" 
ON public.dispatch_conversations 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete dispatch_conversations" 
ON public.dispatch_conversations 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_dispatch_conversations_updated_at
BEFORE UPDATE ON public.dispatch_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();