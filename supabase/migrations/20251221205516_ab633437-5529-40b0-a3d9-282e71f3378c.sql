-- Create table for custom fields per sub-origin
CREATE TABLE public.sub_origin_custom_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_origin_id UUID NOT NULL REFERENCES public.crm_sub_origins(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, select, boolean
  options JSONB, -- For select type fields
  ordem INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sub_origin_id, field_key)
);

-- Create table for custom field responses per lead
CREATE TABLE public.lead_custom_field_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.sub_origin_custom_fields(id) ON DELETE CASCADE,
  response_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, field_id)
);

-- Enable RLS
ALTER TABLE public.sub_origin_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_custom_field_responses ENABLE ROW LEVEL SECURITY;

-- Policies for sub_origin_custom_fields
CREATE POLICY "Anyone can view sub_origin_custom_fields"
ON public.sub_origin_custom_fields FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert sub_origin_custom_fields"
ON public.sub_origin_custom_fields FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update sub_origin_custom_fields"
ON public.sub_origin_custom_fields FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete sub_origin_custom_fields"
ON public.sub_origin_custom_fields FOR DELETE
USING (true);

-- Policies for lead_custom_field_responses
CREATE POLICY "Anyone can view lead_custom_field_responses"
ON public.lead_custom_field_responses FOR SELECT
USING (true);

CREATE POLICY "Anyone can insert lead_custom_field_responses"
ON public.lead_custom_field_responses FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update lead_custom_field_responses"
ON public.lead_custom_field_responses FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete lead_custom_field_responses"
ON public.lead_custom_field_responses FOR DELETE
USING (true);

-- Create indexes
CREATE INDEX idx_custom_fields_sub_origin ON public.sub_origin_custom_fields(sub_origin_id);
CREATE INDEX idx_custom_responses_lead ON public.lead_custom_field_responses(lead_id);
CREATE INDEX idx_custom_responses_field ON public.lead_custom_field_responses(field_id);

-- Update trigger for timestamps
CREATE TRIGGER update_sub_origin_custom_fields_updated_at
  BEFORE UPDATE ON public.sub_origin_custom_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lead_custom_field_responses_updated_at
  BEFORE UPDATE ON public.lead_custom_field_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();