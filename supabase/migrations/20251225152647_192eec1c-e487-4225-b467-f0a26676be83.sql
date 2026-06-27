-- Create table for email tracking events (opens and clicks)
CREATE TABLE public.email_tracking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_email_id UUID REFERENCES public.scheduled_emails(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
  link_url TEXT, -- Only for click events
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can insert tracking events" 
ON public.email_tracking_events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can view tracking events" 
ON public.email_tracking_events 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_email_tracking_scheduled_email ON public.email_tracking_events(scheduled_email_id);
CREATE INDEX idx_email_tracking_event_type ON public.email_tracking_events(event_type);
CREATE INDEX idx_email_tracking_created_at ON public.email_tracking_events(created_at);