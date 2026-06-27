-- Create table for WhatsApp groups
CREATE TABLE public.whatsapp_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_jid text NOT NULL,
  name text NOT NULL,
  photo_url text,
  participant_count integer DEFAULT 0,
  description text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(group_jid, session_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view groups"
ON public.whatsapp_groups FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert groups"
ON public.whatsapp_groups FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update groups"
ON public.whatsapp_groups FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete groups"
ON public.whatsapp_groups FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_groups_updated_at
BEFORE UPDATE ON public.whatsapp_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_groups;