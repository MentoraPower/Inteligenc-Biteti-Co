-- Create sales table for tracking sales
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  customer_name TEXT
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert sales
CREATE POLICY "Anyone can insert sales"
ON public.sales
FOR INSERT
WITH CHECK (true);

-- Allow anyone to read sales
CREATE POLICY "Anyone can read sales"
ON public.sales
FOR SELECT
USING (true);

-- Allow anyone to update sales
CREATE POLICY "Anyone can update sales"
ON public.sales
FOR UPDATE
USING (true);

-- Allow anyone to delete sales
CREATE POLICY "Anyone can delete sales"
ON public.sales
FOR DELETE
USING (true);

-- Add realtime for sales
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;