
-- Tabela para formulários de onboarding por lead
CREATE TABLE public.lead_onboarding_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Onboarding',
  slug TEXT NOT NULL,
  is_sequential BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(slug)
);

-- Tabela para campos do formulário
CREATE TABLE public.lead_onboarding_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.lead_onboarding_forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL, -- text_short, text_long, dropdown, checkbox, radio
  title TEXT NOT NULL,
  description TEXT,
  options JSONB, -- para dropdown, checkbox, radio
  is_required BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para respostas
CREATE TABLE public.lead_onboarding_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.lead_onboarding_forms(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.lead_onboarding_fields(id) ON DELETE CASCADE,
  response_value TEXT,
  response_options JSONB, -- para checkbox com múltiplas seleções
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_onboarding_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_onboarding_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Policies for forms
CREATE POLICY "Anyone can view lead_onboarding_forms" 
ON public.lead_onboarding_forms FOR SELECT USING (true);

CREATE POLICY "Anyone can insert lead_onboarding_forms" 
ON public.lead_onboarding_forms FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update lead_onboarding_forms" 
ON public.lead_onboarding_forms FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete lead_onboarding_forms" 
ON public.lead_onboarding_forms FOR DELETE USING (true);

-- Policies for fields
CREATE POLICY "Anyone can view lead_onboarding_fields" 
ON public.lead_onboarding_fields FOR SELECT USING (true);

CREATE POLICY "Anyone can insert lead_onboarding_fields" 
ON public.lead_onboarding_fields FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update lead_onboarding_fields" 
ON public.lead_onboarding_fields FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete lead_onboarding_fields" 
ON public.lead_onboarding_fields FOR DELETE USING (true);

-- Policies for responses
CREATE POLICY "Anyone can view lead_onboarding_responses" 
ON public.lead_onboarding_responses FOR SELECT USING (true);

CREATE POLICY "Anyone can insert lead_onboarding_responses" 
ON public.lead_onboarding_responses FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update lead_onboarding_responses" 
ON public.lead_onboarding_responses FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete lead_onboarding_responses" 
ON public.lead_onboarding_responses FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_lead_onboarding_forms_updated_at
BEFORE UPDATE ON public.lead_onboarding_forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
