-- Create lead_activities table
CREATE TABLE public.lead_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'tarefa',
  data DATE NOT NULL,
  hora TIME NOT NULL DEFAULT '12:00',
  concluida BOOLEAN NOT NULL DEFAULT false,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view lead_activities"
ON public.lead_activities
FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert lead_activities"
ON public.lead_activities
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update lead_activities"
ON public.lead_activities
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete lead_activities"
ON public.lead_activities
FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_lead_activities_updated_at
BEFORE UPDATE ON public.lead_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activities;