-- Create table for CSV dispatch lists (linked to conversation)
CREATE TABLE public.dispatch_csv_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.dispatch_conversations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mapped_columns JSONB NOT NULL DEFAULT '{}',
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_emails INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups by conversation
CREATE INDEX idx_dispatch_csv_lists_conversation_id ON public.dispatch_csv_lists(conversation_id);

-- Enable RLS
ALTER TABLE public.dispatch_csv_lists ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view dispatch_csv_lists" 
ON public.dispatch_csv_lists 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert dispatch_csv_lists" 
ON public.dispatch_csv_lists 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete dispatch_csv_lists" 
ON public.dispatch_csv_lists 
FOR DELETE 
USING (true);

-- Create table for CSV recipients
CREATE TABLE public.dispatch_csv_list_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.dispatch_csv_lists(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT NOT NULL,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_dispatch_csv_list_recipients_list_id ON public.dispatch_csv_list_recipients(list_id);
CREATE INDEX idx_dispatch_csv_list_recipients_email ON public.dispatch_csv_list_recipients(list_id, email);

-- Enable RLS
ALTER TABLE public.dispatch_csv_list_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view dispatch_csv_list_recipients" 
ON public.dispatch_csv_list_recipients 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert dispatch_csv_list_recipients" 
ON public.dispatch_csv_list_recipients 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete dispatch_csv_list_recipients" 
ON public.dispatch_csv_list_recipients 
FOR DELETE 
USING (true);

-- Add csv_list_id to dispatch_jobs and make sub_origin_id nullable
ALTER TABLE public.dispatch_jobs 
  ADD COLUMN csv_list_id UUID REFERENCES public.dispatch_csv_lists(id) ON DELETE SET NULL,
  ALTER COLUMN sub_origin_id DROP NOT NULL;

-- Add index for csv_list_id
CREATE INDEX idx_dispatch_jobs_csv_list_id ON public.dispatch_jobs(csv_list_id);

-- Add constraint: either sub_origin_id OR csv_list_id must be set
ALTER TABLE public.dispatch_jobs 
  ADD CONSTRAINT dispatch_jobs_source_check 
  CHECK (sub_origin_id IS NOT NULL OR csv_list_id IS NOT NULL);