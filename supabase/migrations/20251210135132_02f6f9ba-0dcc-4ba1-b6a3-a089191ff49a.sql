-- Create pipelines table for CRM stages
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  cor TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pipeline_id to leads table
ALTER TABLE public.leads ADD COLUMN pipeline_id UUID REFERENCES public.pipelines(id);

-- Add ordem column to leads for sorting within pipeline
ALTER TABLE public.leads ADD COLUMN ordem INTEGER DEFAULT 0;

-- Enable RLS on pipelines
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;

-- Policies for pipelines
CREATE POLICY "Anyone can view pipelines" ON public.pipelines FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pipelines" ON public.pipelines FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pipelines" ON public.pipelines FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pipelines" ON public.pipelines FOR DELETE USING (true);

-- Update leads policies to allow updates (for moving between pipelines)
CREATE POLICY "Anyone can update leads" ON public.leads FOR UPDATE USING (true);

-- Insert default "Base" pipeline
INSERT INTO public.pipelines (nome, ordem, cor) VALUES ('Base', 0, '#6366f1');

-- Update existing leads to be in Base pipeline
UPDATE public.leads SET pipeline_id = (SELECT id FROM public.pipelines WHERE nome = 'Base' LIMIT 1) WHERE pipeline_id IS NULL;

-- Enable realtime for pipelines
ALTER PUBLICATION supabase_realtime ADD TABLE public.pipelines;