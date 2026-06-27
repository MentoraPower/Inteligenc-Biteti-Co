-- Create table for pipeline automations
CREATE TABLE public.pipeline_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('sub_origin', 'origin')),
  target_sub_origin_id UUID REFERENCES public.crm_sub_origins(id) ON DELETE CASCADE,
  target_origin_id UUID REFERENCES public.crm_origins(id) ON DELETE CASCADE,
  target_pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pipeline_automations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view pipeline_automations" 
ON public.pipeline_automations 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert pipeline_automations" 
ON public.pipeline_automations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update pipeline_automations" 
ON public.pipeline_automations 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete pipeline_automations" 
ON public.pipeline_automations 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pipeline_automations_updated_at
BEFORE UPDATE ON public.pipeline_automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();