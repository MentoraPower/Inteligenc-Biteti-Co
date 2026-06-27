-- Create lead_tags table
CREATE TABLE public.lead_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view lead_tags" 
ON public.lead_tags 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert lead_tags" 
ON public.lead_tags 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update lead_tags" 
ON public.lead_tags 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete lead_tags" 
ON public.lead_tags 
FOR DELETE 
USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tags;