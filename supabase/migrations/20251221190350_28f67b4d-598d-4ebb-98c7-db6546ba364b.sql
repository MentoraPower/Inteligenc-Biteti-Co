-- Create table to cache group participants with their photos
CREATE TABLE public.whatsapp_group_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_jid TEXT NOT NULL,
  session_id TEXT NOT NULL,
  participant_jid TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  photo_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_jid, session_id, participant_jid)
);

-- Enable RLS
ALTER TABLE public.whatsapp_group_participants ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view participants" 
ON public.whatsapp_group_participants 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert participants" 
ON public.whatsapp_group_participants 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update participants" 
ON public.whatsapp_group_participants 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete participants" 
ON public.whatsapp_group_participants 
FOR DELETE 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_group_participants_updated_at
BEFORE UPDATE ON public.whatsapp_group_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_group_participants_lookup 
ON public.whatsapp_group_participants(group_jid, session_id);