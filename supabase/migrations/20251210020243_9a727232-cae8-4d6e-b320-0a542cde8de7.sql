-- Create page_views table for tracking visits
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  page_path TEXT NOT NULL DEFAULT '/'
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert page views (anonymous tracking)
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
WITH CHECK (true);

-- Allow anyone to read page views (for dashboard)
CREATE POLICY "Anyone can read page views"
ON public.page_views
FOR SELECT
USING (true);

-- Add realtime for page_views
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_views;