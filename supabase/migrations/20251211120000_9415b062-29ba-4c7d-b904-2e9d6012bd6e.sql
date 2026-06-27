-- Create origins table (folders)
CREATE TABLE public.crm_origins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create sub-origins table (CRM instances inside folders)
CREATE TABLE public.crm_sub_origins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_id uuid NOT NULL REFERENCES public.crm_origins(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_origins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sub_origins ENABLE ROW LEVEL SECURITY;

-- Policies for crm_origins
CREATE POLICY "Anyone can view crm_origins" ON public.crm_origins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert crm_origins" ON public.crm_origins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update crm_origins" ON public.crm_origins FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete crm_origins" ON public.crm_origins FOR DELETE USING (true);

-- Policies for crm_sub_origins
CREATE POLICY "Anyone can view crm_sub_origins" ON public.crm_sub_origins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert crm_sub_origins" ON public.crm_sub_origins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update crm_sub_origins" ON public.crm_sub_origins FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete crm_sub_origins" ON public.crm_sub_origins FOR DELETE USING (true);

-- Add sub_origin_id to leads table to track which CRM a lead belongs to
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sub_origin_id uuid REFERENCES public.crm_sub_origins(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idx_crm_sub_origins_origin_id ON public.crm_sub_origins(origin_id);
CREATE INDEX idx_leads_sub_origin_id ON public.leads(sub_origin_id);

-- Insert default origin "Scale" and sub-origin "Comercial"
INSERT INTO public.crm_origins (id, nome, ordem) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Scale', 0);

INSERT INTO public.crm_sub_origins (id, origin_id, nome, ordem) 
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Comercial', 0);

-- Update existing leads to belong to the default sub-origin
UPDATE public.leads SET sub_origin_id = '00000000-0000-0000-0000-000000000002' WHERE sub_origin_id IS NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_origins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_sub_origins;