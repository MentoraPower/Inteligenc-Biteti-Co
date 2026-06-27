-- Create webhooks table
CREATE TABLE public.crm_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receive', 'send')),
  url TEXT,
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'origin', 'sub_origin')),
  origin_id UUID REFERENCES public.crm_origins(id) ON DELETE SET NULL,
  sub_origin_id UUID REFERENCES public.crm_sub_origins(id) ON DELETE SET NULL,
  trigger TEXT,
  trigger_pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_webhooks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view crm_webhooks" ON public.crm_webhooks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert crm_webhooks" ON public.crm_webhooks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update crm_webhooks" ON public.crm_webhooks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete crm_webhooks" ON public.crm_webhooks FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_crm_webhooks_updated_at
  BEFORE UPDATE ON public.crm_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();