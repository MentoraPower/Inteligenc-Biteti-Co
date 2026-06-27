-- Create scheduled_emails table for delayed email sending
CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancel_reason TEXT
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations
CREATE POLICY "Allow all operations on scheduled_emails"
ON public.scheduled_emails
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient querying of pending emails
CREATE INDEX idx_scheduled_emails_pending ON public.scheduled_emails (status, scheduled_for) 
WHERE status = 'pending';

-- Create index for lead lookup (to cancel emails when lead joins group)
CREATE INDEX idx_scheduled_emails_lead ON public.scheduled_emails (lead_id, status)
WHERE status = 'pending';

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;