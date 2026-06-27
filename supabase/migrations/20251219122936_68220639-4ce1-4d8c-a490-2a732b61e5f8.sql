-- Create table for quick messages
CREATE TABLE public.quick_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  audio_data TEXT,
  audio_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Anyone can view quick_messages" 
ON public.quick_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert quick_messages" 
ON public.quick_messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update quick_messages" 
ON public.quick_messages 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete quick_messages" 
ON public.quick_messages 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_quick_messages_updated_at
BEFORE UPDATE ON public.quick_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();