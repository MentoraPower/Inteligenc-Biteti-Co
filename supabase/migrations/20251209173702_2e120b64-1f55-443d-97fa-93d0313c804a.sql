-- Create leads table to store form submissions
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT '+55',
  instagram TEXT NOT NULL,
  service_area TEXT NOT NULL,
  monthly_billing TEXT NOT NULL,
  weekly_attendance TEXT NOT NULL,
  workspace_type TEXT NOT NULL,
  years_experience TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view all leads (admin access)
CREATE POLICY "Authenticated users can view leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (true);

-- Create policy for anyone to insert leads (form submissions)
CREATE POLICY "Anyone can submit leads" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Create index for faster queries by date
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);