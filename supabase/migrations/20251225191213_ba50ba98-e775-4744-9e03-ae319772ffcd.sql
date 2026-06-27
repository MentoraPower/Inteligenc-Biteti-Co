-- Create table for overview cards
CREATE TABLE public.overview_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sub_origin_id uuid NOT NULL REFERENCES public.crm_sub_origins(id) ON DELETE CASCADE,
  card_id text NOT NULL,
  title text NOT NULL,
  chart_type text NOT NULL,
  data_source text,
  width integer NOT NULL DEFAULT 280,
  height integer NOT NULL DEFAULT 180,
  card_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.overview_cards ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view overview_cards"
ON public.overview_cards
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert overview_cards"
ON public.overview_cards
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update overview_cards"
ON public.overview_cards
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete overview_cards"
ON public.overview_cards
FOR DELETE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_overview_cards_sub_origin ON public.overview_cards(sub_origin_id);

-- Create trigger for updated_at
CREATE TRIGGER update_overview_cards_updated_at
BEFORE UPDATE ON public.overview_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();