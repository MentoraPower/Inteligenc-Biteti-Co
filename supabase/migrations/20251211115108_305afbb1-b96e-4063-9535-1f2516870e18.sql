-- Add UTM fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS utm_term text,
ADD COLUMN IF NOT EXISTS utm_content text;

-- Create lead_tracking table for history/audit log
CREATE TABLE public.lead_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'atualizacao',
  titulo text NOT NULL,
  descricao text,
  origem text,
  dados jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view lead_tracking" 
ON public.lead_tracking 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert lead_tracking" 
ON public.lead_tracking 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete lead_tracking" 
ON public.lead_tracking 
FOR DELETE 
USING (true);

-- Create index for better performance
CREATE INDEX idx_lead_tracking_lead_id ON public.lead_tracking(lead_id);
CREATE INDEX idx_lead_tracking_created_at ON public.lead_tracking(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tracking;